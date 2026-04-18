import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import LandingPage from "./components/LandingPage";
import Register from "./components/Register";
import StudentDashboard from "./components/StudentDashboard";
import ExamInterface from "./components/ExamInterface";
import ProctorDashboard from "./components/ProctorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import IdentityVerification from "./components/IdentityVerification";
import CreateExam from "./components/CreateExam";

const VERIFICATION_WINDOW_MS = 6 * 60 * 60 * 1000;

const readUserFromStorage = () => {
  try {
    const rawUser = localStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.error("Failed to read stored user:", error);
    return null;
  }
};

const getVerificationRecord = (examId) => {
  if (!examId) return null;

  try {
    const rawValue = localStorage.getItem(`examVerification:${examId}`);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.error("Failed to read verification state:", error);
    return null;
  }
};

const hasFreshVerification = (examId) => {
  const record = getVerificationRecord(examId);
  if (!record?.verifiedAt) return false;

  const verifiedAt = new Date(record.verifiedAt).getTime();
  if (Number.isNaN(verifiedAt)) return false;

  return Date.now() - verifiedAt < VERIFICATION_WINDOW_MS;
};

function ProtectedRoute({ children, allowedRoles, requireVerification = false }) {
  const location = useLocation();
  const params = useParams();
  const token = localStorage.getItem("token");
  const user = readUserFromStorage();

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (requireVerification && user.role === "student") {
    const searchParams = new URLSearchParams(location.search);
    const examId = params.examId || searchParams.get("examId");
    const hasActiveSession =
      localStorage.getItem("activeExamId") === examId &&
      !!localStorage.getItem("examSessionId");

    if (!hasActiveSession && !hasFreshVerification(examId)) {
      return <Navigate to={`/verify?examId=${examId}`} replace />;
    }
  }

  return children;
}

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exam/:examId"
            element={
              <ProtectedRoute allowedRoles={["student"]} requireVerification={true}>
                <ExamInterface />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <IdentityVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/proctor"
            element={
              <ProtectedRoute allowedRoles={["proctor"]}>
                <ProctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-exam"
            element={
              <ProtectedRoute allowedRoles={["proctor", "admin"]}>
                <CreateExam />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </div>
  );
}

export default App;
