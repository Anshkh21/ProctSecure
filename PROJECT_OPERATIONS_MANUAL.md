# ProctorSecure: Project Operations Manual

This document provides a comprehensive operational overview of the ProctorSecure platform, detailing its architecture, API surfaces, database models, core workflows, deployment strategy, and ongoing maintenance guidelines.

---

## 1. System Architecture Overview

ProctorSecure is a real-time, ML-powered remote exam proctoring platform. It uses a decoupled client-server architecture with state-of-the-art computer vision libraries for cheat detection.

**Frontend Layer (Client)**
*   **Framework**: React 18, utilizing React Router v6 for client-side routing.
*   **Styling & Components**: Tailwind CSS combined with `shadcn/ui` and Radix primitives. Icons provided by `lucide-react`.
*   **Networking**: Standardized via Axios (`apiClient.js`) handling JWT authentication headers and 401 redirect interceptions automatically.
*   **Media**: Utilizes native HTML5 `<video>` and Canvas APIs to capture user webcam and screen-share feeds as polling base64 payloads (architectural transition to WebRTC planned).

**Backend Layer (Server)**
*   **Framework**: Python FastAPI.
*   **Validation**: Pydantic v2 data models.
*   **Machine Learning**: `cv2` (OpenCV), `mediapipe` (Face and Pose detection), and YOLO (Object Detection/Phones). Encapsulated in the `ml_models.py` inference engine.
*   **Database Driver**: `motor` (AsyncIOMotorClient) for non-blocking asynchronous MongoDB operations.

**Persistence Layer (Database)**
*   **Engine**: MongoDB (typically hosted via MongoDB Atlas).

---

## 2. API Structure & Usage

All backend endpoints are prefixed with `/api`. Authentication is handled via Bearer JWT tokens.

### Module: Authentication (`/auth`)
*   `POST /auth/register`: Student registration.
*   `POST /auth/login`: Issues JWT tokens and returns user profiles. Evaluates role (`admin`, `proctor`, `student`).

### Module: Administration (`/admin`)
*   **Middleware Constraint**: Requires `Depends(require_admin)`
*   `GET /admin/proctors`: Lists all registered proctors.
*   `POST /admin/proctors/invite`: Invites a new proctor and returns a temporary password.
*   `DELETE /admin/proctors/{id}`: Soft/Hard removes a proctor and gracefully cascades deletions.
*   `DELETE /admin/reset/{collection}`: Super-admin factory resets of entire database collections.

### Module: Proctoring (`/proctor`)
*   **Middleware Constraint**: Requires `Depends(require_proctor)`
*   `GET /proctor/students`: Polled by the Proctor Dashboard to view active exam progress.
*   `GET /proctor/session/{id}/live`: Polled every 3 seconds by the dashboard to grab the latest Base64 webcam and screen frames.
*   `POST /proctor/exams`: Creates a new exam and its questions.
*   `POST /proctor/enroll`: Links student emails to a specific exam ID.

### Module: Exam Sessions (`/session`)
*   `POST /session/start`: Initializes a new exam attempt and records hardware verification checks.
*   `POST /session/{id}/monitor`: The high-frequency student endpoint (called every 10s); uploads base64 frame data for basic analysis.
*   `POST /session/{id}/analyze-enhanced`: Deep-learning endpoint (YOLO/Anomaly scoring); checks for phones, multi-face presence, and logs high-severity flags.
*   `POST /session/{id}/submit`: Calculates final score and terminates session securely.

---

## 3. Database Schema and Rules

Because ProctorSecure uses **MongoDB**, security rules are enforced strictly in the **FastAPI Middleware** rather than at the database perimeter (as they would be in Firestore).

### Collections
1.  **`users`**: Stores authentication credentials, hashed passwords (bcrypt), and roles.
2.  **`exams`**: Metadata for tests (duration, title, instructions, proctor owner).
3.  **`questions`**: Individual questions mapped by `exam_id`.
4.  **`exam_enrollments`**: Junction mapping `student_id` to `exam_id`.
5.  **`exam_sessions`**: Tracks active or completed exam attempts. Fields include `status` (verified, flagged, completed), `start_time`, `score`, `face_detected`, and `last_active`.
6.  **`proctoring_flags`**: Event logs of suspected cheating. Links securely to `session_id`. Contains an `evidence_image` (Base64) to justify flags.

### Data Security Policies
*   **Isolation**: Every mutating or sensitive query in `server.py` includes a `Depends(require_proctor)` / `Depends(require_admin)` scope, along with `{"proctor_id": current_user["id"]}` or equivalent query scoping to isolate tenant data.
*   **Integrity**: Pydantic models automatically enforce max-lengths on payloads preventing DB buffer bloat. Master delete routes process deletions synchronously in dependency order (Flags → Sessions → Exams) to prevent orphans.

---

## 4. Key Workflows

### The Administrative Workflow
1.  Admin logs in using credentials secured in the `.env` file.
2.  Admin views overall platform health and provisions **Proctor Accounts** via the Invite portal.
3.  (Emergency Only) Admin can trigger collection-wide factory resets.

### The Proctor Workflow
1.  Proctor receives temporary password, logs in, and creates a new **Exam** via the builder.
2.  Proctor navigates to the "Enrollments" tab and adds students via email.
3.  Pending active sessions, proctors monitor the live Dashboard, allowing them to:
    *   Monitor up to ~50 concurrent test-takers via realtime card updates.
    *   Click into a student profile to view the live Webcam/Screen stream.
    *   Review aggregated Security Flags.

### The Student Workflow
1.  Student creates an account and logs in to their Dashboard.
2.  They click an enrolled active exam, initiating the **Identity Verification Gate**:
    *   *Step 1:* Hardware check (Camera, Mic, Screen Share permissions).
    *   *Step 2:* Photo ID capture.
    *   *Step 3:* Room Scan (360-degree environment capture).
3.  Entering the exam interface locks them into Fullscreen mode.
4.  Anti-cheat listeners activate (Tab switching, Copy/Paste blocks, Right-click blocks).
5.  Background polling loops trigger the ML inference endpoints asynchronously.

---

## 5. Deployment Process

### Environment Preparation
Both contexts require strict `.env` configurations. Ensure `.env` is **never committed to version control**.

**Backend (`backend/.env`)**
```env
MONGO_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net"
DB_NAME="proctor_secure_prod"
JWT_SECRET="<SECURE_256_BIT_GENERATED_STRING>"
ADMIN_EMAIL="admin@proctortool.com"
ADMIN_PASSWORD="<STRONG_PASSWORD>"
FRONTEND_URL="https://your-frontend-domain.com"
```

**Frontend (`frontend/.env`)**
```env
REACT_APP_BACKEND_URL="https://api.your-backend-domain.com"
```

### Infrastructure Guidelines
1.  **Backend (FastAPI)**: Deploy to a persistent cloud instance supporting Python 3.9+ (e.g., AWS EC2, DigitalOcean Droplet, Render).
    *   *Note on Dependencies*: The OS requires `libgl1-mesa-glx` (Linux) to run OpenCV operations cleanly.
    *   *Startup*: Use Uvicorn with Gunicorn process managers: `uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4`
2.  **Frontend (React)**: Deploy to Vercel, Netlify, or AWS Amplify. The React app is a static SPA once compiled (`npm run build`).
3.  **Database**: Utilize MongoDB Atlas (Serverless or Dedicated Cluster). Ensure network policies (IP Allowlisting) are restricted to the FastAPI server IP.

---

## 6. Monitoring and Maintenance

### Disk Space Management
The platform captures physical evidence of cheating. By default, raw frames may be written via internal helpers.
*   **Action**: Regularly monitor the size of the MongoDB Database. Base64 `evidence_image` strings in `proctoring_flags` will consume significant storage at scale.
*   **Strategy**: Schedule an off-peak cron job (or MongoDB TTL index) to purge flags and sessions older than statutory holding limits (e.g., 90 days post-exam).

### Performance Considerations
Currently, the live monitoring feed relies on synchronous REST polling (base64 string blobs over HTTPS).
*   **Action**: Over-provision backend network bandwidth to compensate for heavy JSON encoding operations during peak exam periods.
*   **Mid-Term Goal**: Transition the `monitor_session` and `live` endpoints to utilize a dedicated WebRTC signaling architecture to eliminate HTTP handshake overhead.

### Logging
All critical failures are intercepted by the Global Exception Handler and routed via standard Python `logging`. Connect this standard output stream to Datadog, AWS CloudWatch, or Sentry for aggressive uptime tracking and ML failure rate observation.
