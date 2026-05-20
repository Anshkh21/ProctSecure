import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  AlertTriangle, 
  Eye, 
  Clock, 
  CheckCircle, 
  Flag,
  Monitor,
  Volume2,
  Camera,
  LogOut,
  RefreshCw,
  Download,
  Search,
  FileText,
  Trash2,
  Plus,
  Edit,
  Shield,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { Input } from './ui/input';
import { useToast } from '../hooks/use-toast';
import { EnrollmentTab } from './EnrollmentTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const ProctorDashboard = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState([]);
  const [flags, setFlags] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [verificationImages, setVerificationImages] = useState({ idCard: null, refFace: null });
  const [loadingImages, setLoadingImages] = useState(false);

  React.useEffect(() => {
    if (selectedStudent) {
      setLoadingImages(true);
      const token = localStorage.getItem('token');
      axios.get(`${API}/proctor/session/${selectedStudent.sessionId}/verification-images`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setVerificationImages({
          idCard: res.data.id_card_image,
          refFace: res.data.reference_face_image
        });
      })
      .catch(err => console.error("Error fetching verification images", err))
      .finally(() => setLoadingImages(false));
    } else {
      setVerificationImages({ idCard: null, refFace: null });
    }
  }, [selectedStudent]);
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('proctorActiveTab') || 'overview';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [selectedExamFilter, setSelectedExamFilter] = useState('all');
  const [resultsSortBy, setResultsSortBy] = useState('endTime'); // 'endTime', 'score', 'timeRemaining'
  const [resultsSortOrder, setResultsSortOrder] = useState('desc'); // 'asc', 'desc'
  const [exams, setExams] = useState([]); // New state for exams
  const [selectedExamForEnrollment, setSelectedExamForEnrollment] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [enrollingStudents, setEnrollingStudents] = useState(false);
  const [liveFeed, setLiveFeed] = useState({ webcam: null, screen: null }); // kept for compat
  // WebRTC live feed state & refs — commented out (re-enable when TURN infra is ready)
  // const [webrtcStatus, setWebrtcStatus] = useState('idle');
  // const proctorPcRef = useRef(null);
  // const proctorWsRef = useRef(null);
  // const webcamVideoRef = useRef(null);
  // const screenVideoRef = useRef(null);
  // const receivedStreamsRef = useRef([]);
  const [analytics, setAnalytics] = useState({ average_time_per_question: 0, most_difficult_question: 'N/A' });
  const [isActionPending, setIsActionPending] = useState(false);
  const [selectedExamForReset, setSelectedExamForReset] = useState('');
  const [selectedStudentForReset, setSelectedStudentForReset] = useState('');
  const [isLoading, setIsLoading] = useState(true); // [NEW] Loading state
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.setItem('proctorActiveTab', activeTab);
  }, [activeTab]);

  // Parse role from stored JWT for UI gating
  const currentUserRole = (() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'proctor';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'proctor';
    } catch { return 'proctor'; }
  })();
  const isAdmin = currentUserRole === 'admin';

  const fetchDashboardData = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        navigate('/');
        return;
      }
      
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const [studentsRes, flagsRes, examsRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/proctor/students`, config),
        axios.get(`${API}/proctor/flags`, config),
        axios.get(`${API}/exams`, config),
        axios.get(`${API}/proctor/analytics`, config)
      ]);
      
      // Transform backend data to match UI expected format if needed
      const studentsData = studentsRes.data.map(s => ({
        ...s,
        webcamStatus: s.webcam_status, // map snake_case to camelCase
        screenStatus: s.screen_status,
        flagCount: s.flag_count,
        timeRemaining: s.time_remaining,
        lastActivity: s.last_active,
        exam_title: s.examTitle // Map camelCase from backend to snake_case expected by UI
      }));
      
      setStudents(studentsData);
      setFlags(flagsRes.data.map(flag => ({
          ...flag,
          studentId: flag.student_id // Fix mismatch
      })));
      setExams(examsRes.data);
      setAnalytics(analyticsRes.data);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const handleDeleteExam = async (examId) => {
     if (!window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
       return;
     }
     
     try {
       const token = localStorage.getItem('token');
       await axios.delete(`${API}/proctor/exams/${examId}`, {
         headers: { Authorization: `Bearer ${token}` }
       });
       
       setExams(exams.filter(e => e.id !== examId));
     } catch (error) {
       console.error("Error deleting exam:", error);
       alert("Failed to delete exam");
     }
  };

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchDashboardData, 10000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchDashboardData]);

  // ==========================================================================
  // WebRTC Live Feed — Proctor (Subscriber) Side
  // Commented out — re-enable when TURN/signaling infrastructure is ready.
  // ==========================================================================
  /*
  useEffect(() => {
    const cleanup = () => {
      if (proctorPcRef.current) { proctorPcRef.current.close(); proctorPcRef.current = null; }
      if (proctorWsRef.current) { proctorWsRef.current.close(); proctorWsRef.current = null; }
      receivedStreamsRef.current = [];
      if (webcamVideoRef.current) webcamVideoRef.current.srcObject = null;
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    };
    if (!selectedStudent || !selectedStudent.sessionId) { cleanup(); return; }
    const sessionId = selectedStudent.sessionId;
    const connect = async () => {
      const token = localStorage.getItem('token');
      let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      try {
        const iceRes = await axios.get(`${API}/rtc/ice-servers`, { headers: { Authorization: `Bearer ${token}` } });
        iceServers = iceRes.data.iceServers;
      } catch (e) {}
      const pc = new RTCPeerConnection({ iceServers });
      proctorPcRef.current = pc;
      pc.ontrack = ({ streams }) => {
        const stream = streams[0]; if (!stream) return;
        if (!receivedStreamsRef.current.find(s => s.id === stream.id)) {
          receivedStreamsRef.current.push(stream);
          const idx = receivedStreamsRef.current.length;
          if (idx === 1 && webcamVideoRef.current) { webcamVideoRef.current.srcObject = stream; webcamVideoRef.current.play().catch(() => {}); }
          else if (idx === 2 && screenVideoRef.current) { screenVideoRef.current.srcObject = stream; screenVideoRef.current.play().catch(() => {}); }
        }
      };
      const wsBase = BACKEND_URL.replace(/^http/, 'ws');
      const ws = new WebSocket(`${wsBase}/ws/rtc/${sessionId}/proctor?token=${token}`);
      proctorWsRef.current = ws;
      ws.onmessage = async ({ data }) => {
        const msg = JSON.parse(data);
        if (msg.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
        } else if (msg.type === 'ice-candidate' && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ice-candidate', candidate }));
      };
    };
    connect().catch(console.error);
    return cleanup;
  }, [selectedStudent]);
  */


  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'flagged': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const filteredStudents = students.filter(student => 
    (activeTab === 'results' ? student.status?.toLowerCase() === 'completed' : student.status?.toLowerCase() !== 'completed') &&
    (selectedExamFilter === 'all' || student.examId === selectedExamFilter) &&
    (student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => {
    if (activeTab !== 'results') return 0;
    
    let comparison = 0;
    if (resultsSortBy === 'score') {
      comparison = (a.percentage || 0) - (b.percentage || 0);
    } else if (resultsSortBy === 'timeRemaining') {
      comparison = (a.timeRemaining || 0) - (b.timeRemaining || 0);
    } else { // endTime
      comparison = new Date(a.end_time || 0).getTime() - new Date(b.end_time || 0).getTime();
    }
    return resultsSortOrder === 'asc' ? comparison : -comparison;
  });

  const analyticsStudents = students.filter(student => 
    (selectedExamFilter === 'all' || student.examId === selectedExamFilter)
  );

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'verified').length;
  const flaggedStudents = students.filter(s => s.status === 'flagged').length;
  const totalFlags = flags.length;

  const formatTimestamp = (timeString) => {
    if (!timeString) return 'N/A';
    // Force UTC interpretation by appending 'Z' if missing (fixes local time assumption)
    const ts = timeString.endsWith('Z') ? timeString : timeString + 'Z';
    const date = new Date(ts);
    return date.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
    }) + ' IST';
  };

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setActiveTab('student-detail');
  };

  const handleEditExam = (exam) => {
    // Navigate with both query param (robust) and state (legacy/backup)
    navigate(`/create-exam?editId=${exam.id}`, { state: { examToEdit: exam } });
  };

  const exportReport = () => {
    let reportTitle = 'All Exams';
    let filteredStudentsForExport = students;
    
    if (selectedExamFilter !== 'all') {
      const selectedExam = exams.find(e => e.id === selectedExamFilter);
      if (selectedExam) {
        reportTitle = selectedExam.title;
      }
      filteredStudentsForExport = students.filter(s => s.examId === selectedExamFilter);
    }

    // Filter flags based on the filtered students
    const studentIds = new Set(filteredStudentsForExport.map(s => s.id));
    const filteredFlagsForExport = selectedExamFilter === 'all' 
        ? flags 
        : flags.filter(f => studentIds.has(f.studentId));

    const data = {
      examSession: reportTitle,
      timestamp: new Date().toISOString(),
      students: filteredStudentsForExport.length,
      flags: filteredFlagsForExport.length,
      details: { 
        students: filteredStudentsForExport, 
        flags: filteredFlagsForExport 
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const examIdentifier = selectedExamFilter === 'all' ? 'all-exams' : selectedExamFilter;
    a.download = `exam-report-${examIdentifier}-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async () => {
    if (!selectedStudent) return;
    const msg = prompt(`Enter message to send to ${selectedStudent.name}:`, "Please check your camera angle.");
    if (!msg) return;

    setIsActionPending(true);
    try {
        const token = localStorage.getItem('token');
        await axios.post(`${API}/proctor/send-message`, {
            student_id: selectedStudent.id,
            session_id: selectedStudent.sessionId,
            message: msg
        }, { headers: { Authorization: `Bearer ${token}` } });
        toast({ title: "Message Sent", description: `Message delivered to ${selectedStudent.name}` });
    } catch (err) {
        toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    } finally {
        setIsActionPending(false);
    }
  };

  const handleFlagStudent = async () => {
      if (!selectedStudent) return;
      const reason = prompt(`Reason for flagging ${selectedStudent.name}:`, "Suspicious behavior observed.");
      if (!reason) return;
  
      setIsActionPending(true);
      try {
          const token = localStorage.getItem('token');
          await axios.post(`${API}/proctor/flag`, {
              student_id: selectedStudent.id,
              session_id: selectedStudent.sessionId,
              flag_type: "proctor_manual_flag",
              description: reason,
              severity: "high"
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast({ title: "Student Flagged", description: `Manually flagged ${selectedStudent.name}` });
          fetchDashboardData();
      } catch (err) {
          toast({ title: "Error", description: "Failed to flag student.", variant: "destructive" });
      } finally {
          setIsActionPending(false);
      }
  };

  const handleEndSession = async () => {
    if (!selectedStudent) return;
    if (!window.confirm(`Are you sure you want to FORCE END the exam for ${selectedStudent.name}? This action cannot be undone.`)) return;

    setIsActionPending(true);
    try {
        const token = localStorage.getItem('token');
        await axios.post(`${API}/proctor/end-session/${selectedStudent.sessionId}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: "Session Terminated", description: `Forced ended exam for ${selectedStudent.name}.` });
        fetchDashboardData();
        setSelectedStudent(null);
        setActiveTab('students');
    } catch (err) {
        toast({ title: "Error", description: "Failed to terminate session.", variant: "destructive" });
    } finally {
        setIsActionPending(false);
    }
  };

  const handleResetData = async (collectionName, label) => {
    if (!window.confirm(`⚠️ WARNING ⚠️\n\nAre you sure you want to delete all ${label}? This action CANNOT be undone.`)) {
      return;
    }

    setIsActionPending(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/reset/${collectionName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast({
        title: "Success",
        description: `Successfully cleared ${label}.`,
        className: "bg-green-50 border-green-200"
      });
      
      // Refresh the dashboard to clear the UI
      fetchDashboardData();
      
      // If we deleted students or sessions, we should probably clear the selected student view
      if (['sessions', 'students', 'all'].includes(collectionName)) {
         setSelectedStudent(null);
         setActiveTab("overview");
      }
      
    } catch (err) {
      console.error(`Error resetting ${collectionName}:`, err);
      toast({
        title: "Error",
        description: err.response?.data?.detail || `Failed to clear ${label}.`,
        variant: "destructive"
      });
    } finally {
      setIsActionPending(false);
    }
  };

  // --- Helper: Flag Aggregation ---
  const groupFlags = (flagsArray) => {
    if (!flagsArray || flagsArray.length === 0) return [];
    
    const grouped = {};
    flagsArray.forEach(flag => {
      // Normalise field name: backend ProctoringFlag model stores as `type`, but some paths may use `flag_type`
      const flagType = flag.type || flag.flag_type || 'unknown';
      const studentKey = flag.student_id || flag.studentId || 'unknown-student';
      const sessionKey = flag.session_id || 'no-session';
      // Create a unique key per student + session + violation type
      const key = `${studentKey}-${sessionKey}-${flagType}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          ...flag,
          type: flagType,       // Normalise to always have `type`
          count: 1,
          occurrences: [flag]
        };
      } else {
        grouped[key].count += 1;
        grouped[key].occurrences.push(flag);
        // Keep the *latest* timestamp
        if (new Date(flag.timestamp) > new Date(grouped[key].timestamp)) {
           grouped[key].timestamp = flag.timestamp;
        }
      }
    });
    
    // Sort: high severity first, then by latest timestamp descending
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return Object.values(grouped).sort((a, b) => {
      const sA = severityOrder[a.severity] ?? 3;
      const sB = severityOrder[b.severity] ?? 3;
      if (sA !== sB) return sA - sB;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    toast({ title: "Logged out", description: "You have been successfully logged out." });
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)'}}>
        <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-white">Loading Dashboard...</h2>
        <p className="text-blue-300 mt-2">Fetching live exam data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{background:'linear-gradient(160deg,#f0f4ff 0%,#fafbff 60%,#f5f0ff 100%)'}}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a2f5e 100%)'}} className="sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">ProctorSecure</h1>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <p className="text-xs text-blue-300">Live Exam Monitoring</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/create-exam')}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
                <Plus className="w-4 h-4" />
                <span>Create Exam</span>
              </button>
              <button
                onClick={exportReport}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-200 border border-white/10 hover:bg-white/10 transition-all">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={fetchDashboardData}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-200 border border-white/10 hover:bg-white/10 transition-all">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-300 border border-red-400/20 hover:bg-red-400/10 transition-all">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Stat Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl p-5 shadow-sm border border-white/60" style={{background:'linear-gradient(135deg,#eff6ff,#dbeafe)'}}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#3b82f6,#2563eb)'}}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Total</span>
            </div>
            <p className="text-3xl font-bold text-blue-900">{totalStudents}</p>
            <p className="text-sm text-blue-600 mt-1">Registered Students</p>
          </div>

          <div className="rounded-2xl p-5 shadow-sm border border-white/60" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)'}}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#22c55e,#16a34a)'}}>
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Live</span>
            </div>
            <p className="text-3xl font-bold text-emerald-900">{activeStudents}</p>
            <p className="text-sm text-emerald-600 mt-1">Active Sessions</p>
          </div>

          <div className="rounded-2xl p-5 shadow-sm border border-white/60" style={{background:'linear-gradient(135deg,#fff1f2,#ffe4e6)'}}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Alert</span>
            </div>
            <p className="text-3xl font-bold text-red-900">{flaggedStudents}</p>
            <p className="text-sm text-red-500 mt-1">Flagged Students</p>
          </div>

          <div className="rounded-2xl p-5 shadow-sm border border-white/60" style={{background:'linear-gradient(135deg,#fffbeb,#fef3c7)'}}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>
                <Flag className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Flags</span>
            </div>
            <p className="text-3xl font-bold text-amber-900">{totalFlags}</p>
            <p className="text-sm text-amber-600 mt-1">Total Violations</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 mb-6 overflow-x-auto">
            <TabsList className="flex space-x-1 bg-transparent h-auto p-0 w-max min-w-full">
              {[
                { value: 'overview',     label: 'Overview',        icon: Monitor },
                { value: 'students',     label: 'Live Sessions',   icon: Users },
                { value: 'results',      label: 'Results',         icon: FileText },
                { value: 'flags',        label: 'Flags & Alerts',  icon: AlertTriangle },
                { value: 'analytics',    label: 'Analytics',       icon: GraduationCap },
                { value: 'exams',        label: 'Exams',           icon: BookOpen },
                { value: 'enrollments',  label: 'Enrollments',     icon: Users },
                { value: 'system',       label: 'System Actions',  icon: Shield },
              ].map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-500 hover:text-gray-800"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
              {selectedStudent && (
                <TabsTrigger
                  value="student-detail"
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-500 hover:text-gray-800"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Student Detail</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>


          <TabsContent value="overview" className="space-y-6">
            {exams.length === 0 ? (
              /* Onboarding/Empty State for New Proctors */
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Your Proctor Dashboard!</h2>
                    <p className="text-gray-600">Let's get you started with monitoring exams</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-blue-600 font-bold text-lg">1</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Create an Exam</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Click the "Create Exam" button to set up your first proctored examination with questions and settings.
                      </p>
                      <Button onClick={() => navigate('/create-exam')} className="w-full bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Exam
                      </Button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-indigo-600 font-bold text-lg">2</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Enroll Students</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Go to the "Enrollments" tab to add students to your exam using their email addresses.
                      </p>
                      <Button onClick={() => setActiveTab('enrollments')} variant="outline" className="w-full">
                        <Users className="w-4 h-4 mr-2" />
                        View Enrollments
                      </Button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <span className="text-purple-600 font-bold text-lg">3</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">Monitor Live</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Once students start taking exams, you'll see real-time monitoring data, webcam feeds, and alerts here.
                      </p>
                      <Button variant="outline" className="w-full" disabled>
                        <Monitor className="w-4 h-4 mr-2" />
                        Awaiting Active Sessions
                      </Button>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-900">
                      <strong>💡 Tip:</strong> Students will only see exams they're enrolled in. Make sure to enroll your students after creating an exam!
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">

                {/* Active Sessions Panel */}
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                    <div>
                      <h3 className="font-semibold text-gray-900">Active Sessions</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Students currently in exam</p>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-xs font-medium text-emerald-700">AI Monitoring</span>
                    </div>
                  </div>
                  <div className="p-4">
                    {students.filter(s => s.status !== 'completed').length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{background:'linear-gradient(135deg,#f1f5f9,#e2e8f0)'}}>
                          <Users className="w-7 h-7 text-gray-400" />
                        </div>
                        <p className="font-medium text-gray-500 text-sm">No active sessions</p>
                        <p className="text-xs text-gray-400 mt-1">Students appear here when they start</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {students.filter(s => s.status !== 'completed').slice(0, 4).map((student) => (
                          <div
                            key={student.sessionId || student.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-gray-50 hover:border-blue-100 hover:bg-blue-50/40 transition-all cursor-pointer"
                            onClick={() => handleStudentClick(student)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{background:'linear-gradient(135deg,#6366f1,#3b82f6)'}}>
                                {student.name?.split(' ').map(n => n?.[0]).join('').slice(0,2) || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{student.name || 'Unknown'}</p>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <div className="h-1 w-16 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 rounded-full" style={{width:`${student.progress}%`}} />
                                  </div>
                                  <span className="text-xs text-gray-400">{student.progress}%</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {student.flagCount > 0 && (
                                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{student.flagCount} flags</span>
                              )}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(student.status)}`}>{student.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Flags Panel — scoped to active sessions only */}
                {(() => {
                  const activeStudentIds = new Set(
                    students.filter(s => s.status !== 'completed').map(s => s.id)
                  );
                  const hasActiveSessions = activeStudentIds.size > 0;
                  const liveFlags = flags
                    .filter(f => activeStudentIds.has(f.studentId))
                    .slice(0, 5);

                  return (
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                        <div>
                          <h3 className="font-semibold text-gray-900">Live Flags</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Violations from current sessions</p>
                        </div>
                        {liveFlags.length > 0 && (
                          <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                            {liveFlags.length} live
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        {!hasActiveSessions ? (
                          /* No active sessions — don't show historical flags */
                          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{background:'linear-gradient(135deg,#f8fafc,#f1f5f9)'}}>
                              <Monitor className="w-7 h-7 text-gray-300" />
                            </div>
                            <p className="font-medium text-gray-400 text-sm">No active sessions</p>
                            <p className="text-xs text-gray-300 mt-1">Flags will appear when an exam starts</p>
                          </div>
                        ) : liveFlags.length === 0 ? (
                          /* Active sessions but no flags yet */
                          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)'}}>
                              <CheckCircle className="w-7 h-7 text-emerald-400" />
                            </div>
                            <p className="font-medium text-gray-500 text-sm">All clear</p>
                            <p className="text-xs text-gray-400 mt-1">No violations in current sessions</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {liveFlags.map((flag) => {
                              const student = students.find(s => s.id === flag.studentId);
                              const severityStyle = flag.severity === 'high'
                                ? { dot: 'bg-red-500', bg: 'bg-red-50 border-red-100', text: 'text-red-600' }
                                : flag.severity === 'medium'
                                ? { dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600' }
                                : { dot: 'bg-blue-400', bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600' };
                              return (
                                <div key={flag.id} className={`flex items-start space-x-3 p-3 rounded-xl border ${severityStyle.bg}`}>
                                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse ${severityStyle.dot}`}></span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{flag.student_name || student?.name || 'Unknown'}</p>
                                    <p className="text-xs text-gray-600 truncate">{flag.description}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{flag.exam_title} · {formatTimestamp(flag.timestamp)}</p>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${severityStyle.text} bg-white border`}>{flag.severity}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </TabsContent>

          <TabsContent value="enrollments" className="space-y-6">
            <EnrollmentTab 
              exams={exams} 
              token={localStorage.getItem('token')} 
              toast={toast} 
            />
          </TabsContent>

          <TabsContent value="students" className="space-y-5">

            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Live Sessions</h2>
                <p className="text-sm text-gray-400">Students currently sitting an exam</p>
              </div>
              <div className="flex items-center space-x-3">
                <select
                  className="h-9 rounded-xl border border-gray-200 text-sm bg-white px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                  value={selectedExamFilter}
                  onChange={(e) => setSelectedExamFilter(e.target.value)}
                >
                  <option value="all">All Exams</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search students…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-56 rounded-xl border-gray-200 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-gray-200 bg-white">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{background:'linear-gradient(135deg,#f1f5f9,#e2e8f0)'}}>
                  <Monitor className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-700">No Active Sessions</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-xs text-center">Students appear here automatically when they start an exam.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredStudents.map((student) => (
                  <div
                    key={student.sessionId}
                    className="group rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer overflow-hidden"
                    onClick={() => handleStudentClick(student)}
                  >
                    {/* Card top accent */}
                    <div className="h-1.5 w-full" style={{background:'linear-gradient(90deg,#6366f1,#3b82f6,#06b6d4)'}} />

                    <div className="p-5">
                      {/* Student identity row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{background:'linear-gradient(135deg,#6366f1,#3b82f6)'}}>
                            {student.name?.split(' ').map(n => n?.[0]).join('').slice(0,2) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{student.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-400 truncate">{student.email}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusColor(student.status)}`}>
                          {student.status}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span className="font-semibold text-gray-700">{student.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{width:`${student.progress}%`, background:'linear-gradient(90deg,#6366f1,#3b82f6)'}}
                          />
                        </div>
                      </div>

                      {/* Completed score */}
                      {student.status === 'completed' && (
                        <div className="rounded-xl p-2.5 text-center mb-3" style={{background:'linear-gradient(135deg,#eff6ff,#dbeafe)'}}>
                          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Final Score</p>
                          <p className="text-lg font-bold text-blue-800 mt-0.5">
                            {student.score} / {student.total_points}
                            <span className="text-sm font-medium text-blue-500 ml-1">({student.percentage?.toFixed(1)}%)</span>
                          </p>
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
                        <div className="flex items-center space-x-1">
                          <Camera className={`w-3.5 h-3.5 ${student.webcamStatus === 'active' ? 'text-emerald-500' : 'text-red-400'}`} />
                          <Monitor className={`w-3.5 h-3.5 ${student.screenStatus === 'monitored' ? 'text-emerald-500' : 'text-amber-400'}`} />
                        </div>
                        <span className="text-gray-400">{student.timeRemaining ? Math.round(student.timeRemaining) : 0} min left</span>
                        {student.flagCount > 0 ? (
                          <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{student.flagCount} flags</span>
                        ) : (
                          <span className="text-emerald-500 font-medium">Clean</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Exam Results</h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white rounded-lg border border-gray-200 p-1">
                  <select 
                    className="h-8 text-sm bg-transparent focus:outline-none text-gray-700"
                    value={resultsSortBy}
                    onChange={(e) => setResultsSortBy(e.target.value)}
                  >
                    <option value="endTime">Sort by Date</option>
                    <option value="score">Sort by Score</option>
                    <option value="timeRemaining">Sort by Time Left</option>
                  </select>
                  <button 
                    onClick={() => setResultsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                  >
                    {resultsSortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
                <select 
                  className="h-9 w-[200px] border border-gray-200 rounded-md text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedExamFilter}
                  onChange={(e) => setSelectedExamFilter(e.target.value)}
                >
                  <option value="all">All Exams</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    placeholder="Search results..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b bg-gray-50/50">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Student</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Exam</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Submitted At</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Time Left</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Score</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Percentage</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                                <CheckCircle className="w-12 h-12 text-gray-300 mb-3" />
                                <p className="text-lg font-medium text-gray-900">No Results Found</p>
                                <p className="text-sm text-gray-500">Completed exams will appear here.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => (
                            <tr key={student.sessionId} className="border-b transition-colors hover:bg-gray-50/50">
                              <td className="p-4 align-middle">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs">
                                      {student.name?.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{student.name}</p>
                                    <p className="text-xs text-gray-500">{student.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                {student.exam_title || 'Unknown Exam'}
                              </td>
                              <td className="p-4 align-middle text-gray-500">
                                {student.end_time ? formatTimestamp(student.end_time) : 'N/A'}
                              </td>
                              <td className="p-4 align-middle text-gray-600">
                                {student.timeRemaining ? `${Math.floor(student.timeRemaining / 60)}m ${Math.floor(student.timeRemaining % 60)}s` : '0m 0s'}
                              </td>
                              <td className="p-4 align-middle font-medium">
                                {student.score} / {student.total_points}
                              </td>
                              <td className="p-4 align-middle">
                                <Badge variant={student.percentage >= 50 ? "default" : "destructive"} 
                                       className={student.percentage >= 50 ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"}>
                                  {student.percentage?.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="p-4 align-middle text-right">
                                <Button size="sm" variant="outline" onClick={() => handleStudentClick(student)}>
                                  View Details
                                </Button>
                              </td>
                            </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Flags & Alerts</h2>
              <div className="flex space-x-2">
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {groupFlags(flags).filter(f => f.severity === 'high').length} High Priority
                </Badge>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                  {groupFlags(flags).filter(f => f.severity === 'medium').length} Medium Priority
                </Badge>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b bg-gray-50/50">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[100px]">Severity</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Student</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Incident</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Exam</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Time</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flags.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-gray-500">
                            No flags reported. Clean sessions!
                          </td>
                        </tr>
                      ) : (
                        groupFlags(flags).map((flagGroup) => {
                          const student = students.find(s => s.id === (flagGroup.student_id || flagGroup.studentId));
                          // Prefer backend-enriched student_name so completed-session students still display
                          const displayName = flagGroup.student_name || student?.name || 'Unknown';
                          const displayEmail = student?.email || '';
                          const initials = displayName !== 'Unknown'
                            ? displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase()
                            : '?';
                          return (
                            <tr key={flagGroup.id || `${flagGroup.student_id || flagGroup.studentId}-${flagGroup.type}`} className="border-b transition-colors hover:bg-gray-50/50">
                              <td className="p-4 align-middle">
                                <Badge className={`${getSeverityColor(flagGroup.severity)} text-white border-0`}>
                                  {(flagGroup.severity || 'low').toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center space-x-3">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-gray-900">{displayName}</p>
                                    <p className="text-xs text-gray-500">{displayEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center space-x-2">
                                  <div>
                                    <p className="font-medium text-gray-900">{(flagGroup.type || flagGroup.flag_type || 'unknown').replace(/_/g, ' ').toUpperCase()}</p>
                                    <p className="text-xs text-gray-500">{flagGroup.description}</p>
                                  </div>
                                  {flagGroup.count > 1 && (
                                    <Badge variant="secondary" className="bg-gray-200 text-gray-700 ml-2">
                                      x {flagGroup.count}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 align-middle">
                                {flagGroup.exam_title || 'Unknown Exam'}
                              </td>
                              <td className="p-4 align-middle text-gray-500">
                                {new Date(flagGroup.timestamp.endsWith('Z') ? flagGroup.timestamp : flagGroup.timestamp + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'}
                              </td>
                              <td className="p-4 align-middle text-right">
                                {flagGroup.evidence_image ? (
                                  <Button size="sm" variant="outline" className="h-8" onClick={() => {
                                      const win = window.open();
                                      let imagesHtml = flagGroup.occurrences
                                          .filter(occ => occ.evidence_image)
                                          .map(occ => `<div style="text-align:center;margin-bottom:2rem;"><p style="color:white;font-family:sans-serif;">${new Date(occ.timestamp.endsWith('Z') ? occ.timestamp : occ.timestamp + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'}</p><img src="${occ.evidence_image}" style="max-width:90%;max-height:80vh;border:2px solid white;"/></div>`)
                                          .join('');
                                          
                                      if (!imagesHtml) {
                                          imagesHtml = `<div style="color:white;font-family:sans-serif;">No verifiable images captured for this flag type.</div>`;
                                      }
                                      
                                      win.document.write(`<div style="padding:2rem;background:#111;min-height:100vh;">${imagesHtml}</div>`);
                                  }}>
                                    <Eye className="w-3 h-3 mr-2" />
                                    Evidence ({flagGroup.occurrences.filter(o => o.evidence_image).length})
                                  </Button>
                                ) : (
                                  <span className="text-xs text-gray-400">No Evidence</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Exam Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Completion Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Overall Progress</span>
                        <span className="text-sm font-medium">
                          {analyticsStudents.length > 0 ? Math.round(analyticsStudents.reduce((acc, s) => acc + (s.status === 'completed' ? 100 : (s.progress || 0)), 0) / analyticsStudents.length) : 0}%
                        </span>
                      </div>
                      <Progress value={analyticsStudents.length > 0 ? Math.round(analyticsStudents.reduce((acc, s) => acc + (s.status === 'completed' ? 100 : (s.progress || 0)), 0) / analyticsStudents.length) : 0} />
                    </div>
                    <div className="pt-4 space-y-2">
                      <p className="text-sm text-gray-600">Students completed: {analyticsStudents.filter(s => s.status === 'completed').length}</p>
                      <p className="text-sm text-gray-600">Average time per question: {analytics.average_time_per_question} minutes</p>
                      <p className="text-sm text-gray-600">Most difficult question: {analytics.most_difficult_question}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Clean sessions</span>
                      <Badge className="bg-green-100 text-green-800">
                        {analyticsStudents.filter(s => s.flagCount === 0).length} students
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Minor violations</span>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {analyticsStudents.filter(s => s.flagCount > 0 && s.flagCount < 3).length} students
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Major violations</span>
                      <Badge className="bg-red-100 text-red-800">
                        {analyticsStudents.filter(s => s.flagCount >= 3).length} students
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="exams" className="space-y-6">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Manage Exams</h2>
                <Button onClick={() => navigate('/create-exam')} className="bg-blue-600 hover:bg-blue-700">
                   <Plus className="w-4 h-4 mr-2" />
                   Create New Exam
                </Button>
             </div>

             <div className="grid gap-4">
                <Card>
                   <CardContent className="p-0">
                      <div className="relative w-full overflow-auto">
                         <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b bg-gray-50/50">
                               <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[200px]">Title</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Subject</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Duration</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Scheduled At</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                               </tr>
                            </thead>
                            <tbody>
                               {exams.length === 0 ? (
                                   <tr>
                                      <td colSpan="6" className="p-8 text-center text-gray-500">
                                         No exams found. Create your first exam!
                                      </td>
                                   </tr>
                               ) : (
                                   exams.map((exam) => (
                                       <tr key={exam.id} className="border-b transition-colors hover:bg-gray-50/50">
                                           <td className="p-4 align-middle font-medium">{exam.title}</td>
                                           <td className="p-4 align-middle">{exam.subject}</td>
                                           <td className="p-4 align-middle">{exam.duration} min</td>
                                           <td className="p-4 align-middle">
                                               {(() => {
                                                   // Fix timestamp display - ensure UTC interpretation before converting
                                                   const dateStr = exam.scheduled_at.endsWith('Z') ? exam.scheduled_at : exam.scheduled_at + 'Z';
                                                   return new Date(dateStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
                                               })()}
                                           </td>
                                           <td className="p-4 align-middle">
                                               <Badge variant={exam.status === 'active' ? 'default' : 'secondary'} 
                                                      className={getStatusColor(exam.status)}>
                                                   {exam.status}
                                               </Badge>
                                           </td>
                                           <td className="p-4 align-middle text-right">
                                               <div className="flex justify-end gap-2">
                                                   <Button 
                                                       variant="ghost" 
                                                       size="icon" 
                                                       className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                       onClick={() => handleEditExam(exam)}
                                                   >
                                                       <Edit className="h-4 w-4" />
                                                   </Button>
                                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                           onClick={() => handleDeleteExam(exam.id)}>
                                                       <Trash2 className="h-4 w-4" />
                                                   </Button>
                                               </div>
                                           </td>
                                       </tr>
                                   ))
                               )}
                            </tbody>
                         </table>
                      </div>
                   </CardContent>
                </Card>
              </div>
           </TabsContent>

           <TabsContent value="system" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">System Actions</h2>
                <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
                  Danger Zone
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <Trash2 className="w-5 h-5 mr-2" />
                      Clear Exam Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Delete all active and completed exam sessions. This will remove all student attempts and scores, but keep the created exams intact.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => handleResetData('sessions', 'exam sessions')}
                      disabled={isActionPending}
                    >
                      Delete All Sessions
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <Flag className="w-5 h-5 mr-2" />
                      Clear Proctoring Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Delete all recorded incidents, warnings, and photo evidence. Useful for clearing out test data from dry runs.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => handleResetData('flags', 'proctoring flags')}
                      disabled={isActionPending}
                    >
                      Delete All Flags
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <BookOpen className="w-5 h-5 mr-2" />
                      Clear Records for a Specific Exam
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-3">
                      Delete all sessions and flags tied to one exam. The exam itself is kept intact.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="flex-1 border border-orange-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={selectedExamForReset}
                        onChange={(e) => setSelectedExamForReset(e.target.value)}
                      >
                        <option value="">— Select Exam —</option>
                        {exams.map((ex) => (
                          <option key={ex.id} value={ex.id}>{ex.title}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        className="border-orange-400 text-orange-700 hover:bg-orange-100 whitespace-nowrap"
                        disabled={isActionPending || !selectedExamForReset}
                        onClick={async () => {
                          const exam = exams.find(e => e.id === selectedExamForReset);
                          if (!window.confirm(`Delete all sessions & flags for exam "${exam?.title || selectedExamForReset}"?\nThe exam itself will NOT be deleted.`)) return;
                          setIsActionPending(true);
                          try {
                            const token = localStorage.getItem('token');
                            const res = await axios.delete(`${API}/proctor/reset/exam/${selectedExamForReset}`, { headers: { Authorization: `Bearer ${token}` } });
                            toast({ title: 'Done', description: res.data.message });
                            setSelectedExamForReset('');
                          } catch (err) {
                            toast({ title: 'Error', description: err.response?.data?.detail || 'Failed.', variant: 'destructive' });
                          } finally { setIsActionPending(false); }
                        }}
                      >
                        Delete Exam Records
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-orange-800">
                      <GraduationCap className="w-5 h-5 mr-2" />
                      Clear Records for a Specific Student
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-3">
                      Delete sessions and flags for a student, scoped to your exams only.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="flex-1 border border-orange-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={selectedStudentForReset}
                        onChange={(e) => setSelectedStudentForReset(e.target.value)}
                      >
                        <option value="">— Select Student —</option>
                        {students.map((st) => (
                          <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        className="border-orange-400 text-orange-700 hover:bg-orange-100 whitespace-nowrap"
                        disabled={isActionPending || !selectedStudentForReset}
                        onClick={async () => {
                          const student = students.find(s => s.id === selectedStudentForReset);
                          if (!window.confirm(`Delete all sessions & flags for student "${student?.name || selectedStudentForReset}" (scoped to your exams)?`)) return;
                          setIsActionPending(true);
                          try {
                            const token = localStorage.getItem('token');
                            const res = await axios.delete(`${API}/proctor/reset/student/${selectedStudentForReset}`, { headers: { Authorization: `Bearer ${token}` } });
                            toast({ title: 'Done', description: res.data.message });
                            setSelectedStudentForReset('');
                          } catch (err) {
                            toast({ title: 'Error', description: err.response?.data?.detail || 'Failed.', variant: 'destructive' });
                          } finally { setIsActionPending(false); }
                        }}
                      >
                        Delete Student Records
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-800">
                      <Users className="w-5 h-5 mr-2" />
                      Clear Student Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Permanently delete all registered students from the platform. Admin and Proctor accounts will NOT be deleted.
                    </p>
                    {isAdmin ? (
                      <Button 
                        variant="destructive" 
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={() => handleResetData('students', 'student accounts')}
                        disabled={isActionPending}
                      >
                        Delete All Students
                      </Button>
                    ) : (
                      <p className="text-xs text-red-500 italic text-center pt-1">⛔ Only Super Admins can delete student accounts.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-red-600 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-900 font-bold">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      {isAdmin ? 'Factory Data Reset' : 'Clear My Data'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-800 mb-4 font-medium">
                      {isAdmin 
                        ? 'Wipe the slate clean. This permanently deletes EVERYTHING: Exams, Sessions, Flags, and Students.'
                        : 'Delete all your exams, exam sessions, and proctoring flags that you created.'}
                    </p>
                    <Button 
                      variant="destructive" 
                      className="w-full bg-red-800 hover:bg-red-900 font-bold"
                      onClick={() => handleResetData('all', isAdmin ? 'ENTIRE DATABASE' : 'all your data')}
                      disabled={isActionPending}
                    >
                      {isAdmin ? 'Master Reset' : 'Delete My Data'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
           </TabsContent>

           {selectedStudent && (
            <TabsContent value="student-detail" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Student Detail</h2>
                <Button variant="outline" onClick={() => setSelectedStudent(null)}>
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                {selectedStudent.status === 'completed' ? (
                    /* [NEW] Post-Exam Report View */
                    <div className="space-y-6">
                        <Card className="border-l-4 border-blue-500">
                            <CardHeader>
                                <CardTitle className="text-xl">Post-Exam Report</CardTitle>
                                <CardDescription>Exam submitted on {formatTimestamp(selectedStudent.end_time)}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 uppercase tracking-wide">Final Score</p>
                                        <p className="text-3xl font-bold text-gray-900 mt-1">{selectedStudent.score} / {selectedStudent.total_points}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 uppercase tracking-wide">Percentage</p>
                                        <p className={`text-3xl font-bold mt-1 ${selectedStudent.percentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                            {selectedStudent.percentage?.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500 uppercase tracking-wide">Security Flags</p>
                                        <p className="text-3xl font-bold text-red-600 mt-1">{selectedStudent.flagCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* [NEW] Identity Verification Gallery */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Identity Verification Data</CardTitle>
                                <CardDescription>Submitted at onboarding</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingImages ? (
                                    <p className="text-gray-500">Loading verification images...</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="border rounded-lg p-2 bg-gray-50 text-center">
                                            <p className="text-sm font-semibold text-gray-700 mb-2">ID Card</p>
                                            {verificationImages.idCard ? (
                                                <img src={verificationImages.idCard} alt="ID Card" className="max-h-48 mx-auto rounded object-contain" />
                                            ) : (
                                                <p className="text-sm text-gray-500 italic py-8">No ID Card saved</p>
                                            )}
                                        </div>
                                        <div className="border rounded-lg p-2 bg-gray-50 text-center">
                                            <p className="text-sm font-semibold text-gray-700 mb-2">Reference Face</p>
                                            {verificationImages.refFace ? (
                                                <img src={verificationImages.refFace} alt="Reference Face" className="max-h-48 mx-auto rounded object-contain" />
                                            ) : (
                                                <p className="text-sm text-gray-500 italic py-8">No Reference Face saved</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Flag Evidence Gallery for Completed Exams */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Flagged Incidents & Evidence</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {flags.filter(f => f.session_id === selectedStudent.sessionId).length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                                        <CheckCircle className="w-10 h-10 mx-auto text-green-500 mb-2" />
                                        <p>No incidents reported during this session.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {groupFlags(flags.filter(f => f.session_id === selectedStudent.sessionId)).map((flagGroup) => (
                                            <div key={flagGroup.id || `${flagGroup.studentId}-${flagGroup.type}`} className="flex items-start space-x-4 p-4 border rounded-lg bg-gray-50">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <Badge className={getSeverityColor(flagGroup.severity)}>{flagGroup.severity}</Badge>
                                                        <span className="font-semibold text-gray-900">{flagGroup.type.replace(/_/g, ' ').toUpperCase()}</span>
                                                        {flagGroup.count > 1 && (
                                                            <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                                                                x {flagGroup.count}
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-gray-500">• {formatTimestamp(flagGroup.timestamp)}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700">{flagGroup.description}</p>
                                                </div>
                                                {flagGroup.evidence_image && (
                                                    <div className="flex-shrink-0">
                                                        <Button size="sm" variant="outline" onClick={() => {
                                                            const win = window.open();
                                                            // We construct simple HTML. A more robust implementation would loop over flagGroup.occurrences
                                                            // allowing proctors to see *all* photos of the occurrences. 
                                                            let imagesHtml = flagGroup.occurrences
                                                                .filter(occ => occ.evidence_image)
                                                                .map(occ => `<div style="text-align:center;margin-bottom:2rem;"><p style="color:white;font-family:sans-serif;">${new Date(occ.timestamp.endsWith('Z') ? occ.timestamp : occ.timestamp + 'Z').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'}</p><img src="${occ.evidence_image}" style="max-width:90%;max-height:80vh;border:2px solid white;"/></div>`)
                                                                .join('');
                                                                
                                                            if (!imagesHtml) {
                                                                imagesHtml = `<div style="color:white;font-family:sans-serif;">No verifiable images captured for this flag type.</div>`;
                                                            }
                                                            
                                                            win.document.write(`<div style="padding:2rem;background:#111;min-height:100vh;">${imagesHtml}</div>`);
                                                        }}>
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            View Evidence ({flagGroup.occurrences.filter(o => o.evidence_image).length})
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                  <div className="space-y-4">

                    {/* AI Proctoring Active Banner */}
                    <div className="rounded-2xl p-5 border" style={{background:'linear-gradient(135deg,#0f172a,#1e3a5f)'}}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#3b82f6,#6366f1)'}}>
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">AI Proctoring Active</p>
                            <p className="text-blue-300 text-xs">Behavioral analysis running in background</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-emerald-300 text-xs font-medium">Monitoring</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Total Flags', value: flags.filter(f => f.studentId === selectedStudent?.id).length, color: 'text-red-300' },
                          { label: 'Exam Progress', value: `${selectedStudent?.progress ?? 0}%`, color: 'text-blue-300' },
                          { label: 'Time Left', value: `${selectedStudent?.timeRemaining ? Math.round(selectedStudent.timeRemaining) : 0}m`, color: 'text-amber-300' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                            <p className={`text-xl font-bold ${color}`}>{value}</p>
                            <p className="text-blue-300 text-xs mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Violation Breakdown */}
                    {(() => {
                      const studentFlags = flags.filter(f => f.studentId === selectedStudent?.id);
                      const byType = studentFlags.reduce((acc, f) => {
                        const key = f.flag_type || f.description || 'Unknown';
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                      }, {});
                      const entries = Object.entries(byType).sort((a,b) => b[1]-a[1]);
                      if (entries.length === 0) return null;
                      return (
                        <Card className="border border-gray-100 shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              <span>Violation Breakdown</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {entries.map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 truncate max-w-[200px]">{type}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, (count / Math.max(...entries.map(e=>e[1]))) * 100)}%`,
                                        background: 'linear-gradient(90deg,#ef4444,#f97316)'
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-red-500 w-4 text-right">{count}</span>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })()}

                  </div>
                )}

                </div>

                <div className="space-y-6">
                  {/* Student Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Student Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {selectedStudent.name?.split(' ').map(n => n?.[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedStudent.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-600">{selectedStudent.email}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status</span>
                          <Badge className={getStatusColor(selectedStudent.status)}>
                            {selectedStudent.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">{selectedStudent.progress}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Time Remaining</span>
                          <span className="font-medium">{selectedStudent.timeRemaining} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Flags</span>
                          <span className="font-medium text-red-600">{selectedStudent.flagCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* System Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>System Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Webcam</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            selectedStudent.webcamStatus === 'active' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-sm">{selectedStudent.webcamStatus}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Screen</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            selectedStudent.screenStatus === 'monitored' ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></div>
                          <span className="text-sm">{selectedStudent.screenStatus}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Last Activity</span>
                        <span className="text-sm">{formatTimestamp(selectedStudent.lastActivity)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions - Only show for active sessions */}
                  {selectedStudent.status?.toLowerCase() !== 'completed' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full" variant="outline" onClick={handleSendMessage} disabled={isActionPending}>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Send Message
                      </Button>
                      <Button className="w-full" variant="outline" onClick={handleFlagStudent} disabled={isActionPending}>
                        <Flag className="w-4 h-4 mr-2" />
                        Flag Student
                      </Button>
                      <Button className="w-full" variant="destructive" onClick={handleEndSession} disabled={isActionPending}>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        End Session
                      </Button>
                    </CardContent>
                  </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ProctorDashboard;
