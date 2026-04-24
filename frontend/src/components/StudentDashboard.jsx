import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, BookOpen, AlertCircle, Play, User, LogOut,
  CheckCircle, Zap, Shield, RefreshCw, ChevronRight, Star
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import GuideDialog from './GuideDialog';
import SystemCheckDialog from './SystemCheckDialog';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

/* ─── Motivational tips that rotate every 6s ─── */
const TIPS = [
  { icon: '💡', text: 'Keep a glass of water nearby — hydration helps you think clearly during exams.' },
  { icon: '🎯', text: 'Read each question fully before answering. Rushing causes careless mistakes.' },
  { icon: '⏱️', text: 'Manage your time wisely. Skip tough questions and return to them later.' },
  { icon: '🧘', text: 'Take a deep breath before you start. Calm focus beats panic every time.' },
  { icon: '🔒', text: 'Ensure your webcam & microphone are working before the exam window opens.' },
  { icon: '📶', text: 'Check your internet connection before exam time to avoid disruptions.' },
];

/* ─── Inline CSS keyframes injected once ─── */
const GLOBAL_STYLES = `
  @keyframes sd-fadeInUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sd-slideInRight {
    from { opacity: 0; transform: translateX(32px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes sd-pulse-ring {
    0%   { transform: scale(1);   opacity: 1; }
    70%  { transform: scale(1.6); opacity: 0; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes sd-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes sd-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes sd-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes sd-count-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sd-tip-fade {
    0%  { opacity: 0; transform: translateX(12px); }
    10% { opacity: 1; transform: translateX(0); }
    85% { opacity: 1; transform: translateX(0); }
    100%{ opacity: 0; transform: translateX(-12px); }
  }
  @keyframes sd-glow-pulse {
    0%, 100% { box-shadow: 0 0 8px 2px rgba(59,130,246,0.3); }
    50%       { box-shadow: 0 0 20px 6px rgba(59,130,246,0.6); }
  }
  @keyframes sd-particle {
    0%   { transform: translateY(100vh) rotate(0deg); opacity: 0; }
    10%  { opacity: 0.4; }
    90%  { opacity: 0.2; }
    100% { transform: translateY(-100px) rotate(720deg); opacity: 0; }
  }
  .sd-card-hover {
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
  }
  .sd-card-hover:hover {
    transform: translateY(-6px) scale(1.015);
    box-shadow: 0 20px 48px rgba(0,0,0,0.12);
  }
  .sd-btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .sd-btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
    pointer-events: none;
  }
  .sd-btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(99,102,241,0.45);
  }
  .sd-btn-primary:active { transform: translateY(0); }
  .sd-progress-bar {
    height: 6px;
    border-radius: 9999px;
    background: #e5e7eb;
    overflow: hidden;
  }
  .sd-progress-fill {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(90deg, #3b82f6, #6366f1);
    transition: width 0.8s ease;
  }
`;

/* ─── Countdown hook: returns { h, m, s, total } ─── */
function useCountdown(targetDate) {
  const [delta, setDelta] = useState(() => targetDate - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDelta(targetDate - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  const total = Math.max(0, delta);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return { h, m, s, total };
}

/* ─── Floating particles background ─── */
function Particles() {
  const particles = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 8,
      duration: 12 + Math.random() * 12,
    }))
  ).current;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '-20px',
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #93c5fd, #a5b4fc)',
            opacity: 0,
            animation: `sd-particle ${p.duration}s ${p.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Live clock ─── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
    </span>
  );
}

/* ─── Animated stat pill ─── */
function StatPill({ value, label, color, icon: Icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(12px)',
      borderRadius: 14, padding: '10px 18px',
      border: `1.5px solid ${color}33`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      animation: 'sd-fadeInUp 0.5s ease both',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1, animation: 'sd-count-up 0.6s ease' }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── Countdown display on card ─── */
function CountdownChip({ targetMs, label, chipColor }) {
  const { h, m, s, total } = useCountdown(targetMs);
  if (total <= 0) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${chipColor}18`,
      border: `1px solid ${chipColor}44`,
      color: chipColor, borderRadius: 8, padding: '3px 10px',
      fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
    }}>
      <Clock size={11} />
      {label}: {h > 0 ? `${h}h ` : ''}{String(m).padStart(2,'0')}m {String(s).padStart(2,'0')}s
    </div>
  );
}

/* ─── Tip rotator ─── */
function TipBanner() {
  const [idx, setIdx] = useState(0);
  const [key, setKey] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIdx(i => (i + 1) % TIPS.length);
      setKey(k => k + 1);
    }, 6000);
    return () => clearInterval(id);
  }, []);
  const tip = TIPS[idx];
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      border: '1.5px solid #fcd34d',
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: 28,
      animation: 'sd-fadeInUp 0.4s ease both',
    }}>
      <div style={{ fontSize: 24, flexShrink: 0 }}>{tip.icon}</div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', letterSpacing: '0.05em', marginBottom: 2 }}>
          EXAM TIP
        </div>
        <div
          key={key}
          style={{
            fontSize: 13, color: '#78350f', lineHeight: 1.5,
            animation: 'sd-tip-fade 6s ease forwards',
          }}
        >
          {tip.text}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {TIPS.map((_, i) => (
          <div
            key={i}
            onClick={() => { setIdx(i); setKey(k => k + 1); }}
            style={{
              width: i === idx ? 16 : 6, height: 6,
              borderRadius: 3, cursor: 'pointer',
              background: i === idx ? '#f59e0b' : '#fcd34d',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Exam card ─── */
function ExamCard({ exam, onStart, onContinue, formatDateTime, style }) {
  const now = Date.now();
  let dateStr = exam.scheduled_at;
  if (typeof dateStr === 'string' && !dateStr.endsWith('Z')) dateStr += 'Z';
  const scheduledMs = new Date(dateStr).getTime();
  const windowEndMs = scheduledMs + 10 * 60000;

  const isActive    = exam.status === 'active';
  const isCompleted = exam.status === 'completed';
  const isLive      = exam.status === 'scheduled' && now >= scheduledMs && now <= windowEndMs;
  const isUpcoming  = exam.status === 'scheduled' && now < scheduledMs;
  const isMissed    = exam.status === 'scheduled' && now > windowEndMs;

  /* card accent */
  let accentColor = '#6b7280';
  let accentGradient = 'linear-gradient(135deg, #f9fafb, #f3f4f6)';
  let borderColor = '#e5e7eb';
  if (isActive || isLive) {
    accentColor = '#16a34a';
    accentGradient = 'linear-gradient(135deg, #f0fdf4, #dcfce7)';
    borderColor = '#86efac';
  } else if (isUpcoming) {
    accentColor = '#2563eb';
    accentGradient = 'linear-gradient(135deg, #eff6ff, #dbeafe)';
    borderColor = '#93c5fd';
  } else if (isCompleted) {
    accentColor = '#7c3aed';
    accentGradient = 'linear-gradient(135deg, #faf5ff, #ede9fe)';
    borderColor = '#c4b5fd';
  } else if (isMissed) {
    accentColor = '#dc2626';
    accentGradient = 'linear-gradient(135deg, #fff5f5, #fee2e2)';
    borderColor = '#fca5a5';
  }

  return (
    <div
      className="sd-card-hover"
      style={{
        background: '#fff',
        borderRadius: 18,
        border: `1.5px solid ${borderColor}`,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {/* top accent strip */}
      <div style={{ height: 4, background: accentGradient.replace('135deg,', '90deg,') }} />

      {/* live pulse badge */}
      {(isActive || isLive) && (
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: '#22c55e',
              animation: 'sd-pulse-ring 1.5s ease-out infinite',
            }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', letterSpacing: '0.05em' }}>LIVE</span>
        </div>
      )}

      <div style={{ padding: '18px 20px' }}>
        {/* subject tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: `${accentColor}15`, color: accentColor,
          borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700,
          marginBottom: 10, letterSpacing: '0.04em',
        }}>
          <BookOpen size={10} />
          {exam.subject || 'General'}
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', lineHeight: 1.3 }}>
          {exam.title}
        </h3>

        {/* meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
            <Clock size={13} /> {exam.duration} min
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
            <Star size={13} /> {exam.total_questions} questions
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
            <Calendar size={13} /> {formatDateTime(exam.scheduled_at)}
          </span>
        </div>

        {/* countdowns */}
        <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {isUpcoming && (
            <CountdownChip targetMs={scheduledMs} label="Starts in" chipColor="#2563eb" />
          )}
          {isLive && (
            <CountdownChip targetMs={windowEndMs} label="Window closes" chipColor="#16a34a" />
          )}
        </div>

        {/* instructions */}
        {exam.instructions && exam.instructions.length > 0 && (
          <div style={{
            background: '#f8fafc', borderRadius: 10, padding: '10px 14px',
            marginBottom: 14, border: '1px solid #e2e8f0',
          }}>
            {exam.instructions.slice(0, 2).map((inst, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#475569', marginBottom: i === 0 ? 4 : 0 }}>
                <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0 }}>▸</span>
                <span>{inst}</span>
              </div>
            ))}
            {exam.instructions.length > 2 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                +{exam.instructions.length - 2} more instructions…
              </div>
            )}
          </div>
        )}

        {/* CTA button */}
        <div style={{ marginTop: 4 }}>
          {isActive && (
            <button
              className="sd-btn-primary"
              onClick={() => onContinue(exam.id)}
              style={{
                width: '100%', border: 'none', borderRadius: 12,
                color: '#fff', padding: '11px 0', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Play size={16} /> Continue Exam
            </button>
          )}
          {isLive && (
            <button
              className="sd-btn-primary"
              onClick={() => onStart(exam.id)}
              style={{
                width: '100%', border: 'none', borderRadius: 12,
                color: '#fff', padding: '11px 0', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                animation: 'sd-glow-pulse 2s ease-in-out infinite',
              }}
            >
              <Zap size={16} /> Start Exam Now!
            </button>
          )}
          {isUpcoming && (
            <div style={{
              width: '100%', borderRadius: 12, border: '1.5px solid #bfdbfe',
              background: '#eff6ff', color: '#2563eb',
              padding: '11px 0', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              userSelect: 'none',
            }}>
              <Clock size={14} /> Not open yet — stand by!
            </div>
          )}
          {isCompleted && (
            <div style={{
              width: '100%', borderRadius: 12, border: '1.5px solid #d8b4fe',
              background: '#faf5ff', color: '#7c3aed',
              padding: '11px 0', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              userSelect: 'none',
            }}>
              <CheckCircle size={14} /> Completed ✓
            </div>
          )}
          {isMissed && (
            <div style={{
              width: '100%', borderRadius: 12, border: '1.5px solid #fca5a5',
              background: '#fff5f5', color: '#dc2626',
              padding: '11px 0', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              userSelect: 'none',
            }}>
              <AlertCircle size={14} /> Entry Window Expired
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton loader card ─── */
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 18, border: '1.5px solid #e5e7eb',
      overflow: 'hidden', background: '#fff',
    }}>
      <div style={{ height: 4, background: '#f1f5f9' }} />
      <div style={{ padding: 20 }}>
        {[80, '60%', '90%', 40].map((w, i) => (
          <div key={i} style={{
            height: typeof w === 'number' ? w : 14,
            width: typeof w === 'string' ? w : '100%',
            borderRadius: 8, marginBottom: 14,
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '800px 100%',
            animation: 'sd-shimmer 1.5s infinite linear',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
const StudentDashboard = () => {
  const [exams, setExams] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  /* inject global keyframes once */
  useEffect(() => {
    const id = 'sd-global-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = GLOBAL_STYLES;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    loadUserData();
    loadExams();
    const timer = setInterval(loadExams, 60000); // silent refresh every 60s
    return () => clearInterval(timer);
  }, []); // intentional: only run on mount

  const loadUserData = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
      navigate('/');
    }
  };

  const loadExams = async (showSpinner = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        navigate('/');
        return;
      }
      if (showSpinner) setRefreshing(true);
      const response = await axios.get(`${API}/exams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExams(response.data);
    } catch (error) {
      console.error('Error loading exams:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.clear();
        navigate('/');
      } else {
        toast({ title: 'Error', description: 'Failed to load exams. Please try again.', variant: 'destructive' });
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleStartExam = async (examId) => {
    try {
      const exam = exams.find(e => e.id === examId);
      if (exam) {
        let dateStr = exam.scheduled_at;
        if (typeof dateStr === 'string' && !dateStr.endsWith('Z')) dateStr += 'Z';
        const scheduledTime = new Date(dateStr);
        const windowEndTime = new Date(scheduledTime.getTime() + 10 * 60000);
        if (new Date() > windowEndTime) {
          toast({ title: 'Entry Closed', description: 'The 10-minute entry window for this exam has expired.', variant: 'destructive' });
          loadExams();
          return;
        }
      }
      localStorage.removeItem('examSessionId');
      localStorage.removeItem('activeExamId');
      localStorage.removeItem(`examVerification:${examId}`);
      toast({ title: 'Exam Starting', description: 'Redirecting to identity verification…' });
      setTimeout(() => navigate(`/verify?examId=${examId}`), 1000);
    } catch (error) {
      console.error('Error starting exam:', error);
      toast({ title: 'Error', description: 'Failed to start exam. Please try again.', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    navigate('/');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const ds = typeof dateString === 'string' && dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const d = new Date(ds);
    return (
      d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) +
      ' at ' +
      d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) +
      ' IST'
    );
  };

  const isExamUpcoming = (exam) => {
    if (exam.status !== 'scheduled') return false;
    let ds = exam.scheduled_at;
    if (typeof ds === 'string' && !ds.endsWith('Z')) ds += 'Z';
    const now = new Date();
    const windowEnd = new Date(new Date(ds).getTime() + 10 * 60000);
    return now <= windowEnd;
  };

  /* derived counts */
  const upcomingCount  = exams.filter(isExamUpcoming).length;
  const activeCount    = exams.filter(e => e.status === 'active').length;
  const completedCount = exams.filter(e => e.status === 'completed').length;

  /* split exams by relevance */
  const liveExams      = exams.filter(e => {
    if (e.status === 'active') return true;
    if (e.status !== 'scheduled') return false;
    let ds = e.scheduled_at; if (!ds.endsWith('Z')) ds += 'Z';
    const now = Date.now(), ms = new Date(ds).getTime();
    return now >= ms && now <= ms + 10 * 60000;
  });
  const upcomingExams  = exams.filter(e => {
    if (e.status !== 'scheduled') return false;
    let ds = e.scheduled_at; if (!ds.endsWith('Z')) ds += 'Z';
    return Date.now() < new Date(ds).getTime();
  });
  const otherExams     = exams.filter(e =>
    !liveExams.includes(e) && !upcomingExams.includes(e)
  );

  /* ── LOADING SCREEN ── */
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'sd-float 2s ease-in-out infinite',
        }}>
          <BookOpen size={28} color="#fff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            Loading your dashboard…
          </div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Fetching your exams</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%', background: '#3b82f6',
              animation: `sd-pulse-ring 1.2s ${i * 0.2}s ease-out infinite`,
              opacity: 0.8,
            }} />
          ))}
        </div>
      </div>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'Student';
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f4ff 0%, #f8fafc 40%, #fafafa 100%)',
      position: 'relative',
    }}>
      <Particles />

      {/* ── HEADER ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 1px 20px rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
            }}>
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>ProctorSecure</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Student Portal</div>
            </div>
          </div>

          {/* clock + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f1f5f9', borderRadius: 8, padding: '6px 12px',
              fontSize: 13, fontWeight: 600, color: '#475569',
            }}>
              <Clock size={13} />
              <LiveClock />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={15} color="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{user?.name || 'Student'}</span>
            </div>

            <button
              onClick={() => loadExams(true)}
              title="Refresh"
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1.5px solid #e2e8f0',
                background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={15} color="#64748b" style={{ animation: refreshing ? 'sd-spin-slow 0.8s linear infinite' : 'none' }} />
            </button>

            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 8, border: '1.5px solid #e2e8f0',
                background: '#fff', padding: '6px 14px',
                fontSize: 13, fontWeight: 600, color: '#475569',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>

        {/* HERO */}
        <div style={{
          borderRadius: 24,
          background: 'linear-gradient(135deg, #1e3a5f 0%, #312e81 60%, #1e1b4b 100%)',
          padding: '36px 40px',
          marginBottom: 28,
          position: 'relative', overflow: 'hidden',
          animation: 'sd-fadeInUp 0.5s ease both',
        }}>
          {/* decorative blobs */}
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: '50%', background: 'rgba(99,102,241,0.15)',
            filter: 'blur(60px)',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: 100, width: 150, height: 150,
            borderRadius: '50%', background: 'rgba(59,130,246,0.2)',
            filter: 'blur(50px)',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative' }}>
            <div>
              <div style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
                {greeting.toUpperCase()}
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                {greeting}, {firstName}! 👋
              </h2>
              <p style={{ color: '#94a3b8', margin: '10px 0 0', fontSize: 15 }}>
                {upcomingCount > 0
                  ? `You have ${upcomingCount} upcoming exam${upcomingCount !== 1 ? 's' : ''} — you've got this!`
                  : activeCount > 0
                  ? `You have ${activeCount} active exam${activeCount !== 1 ? 's' : ''} in progress.`
                  : 'No upcoming exams right now. Enjoy your break!'}
              </p>
            </div>

            {/* stat pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <StatPill value={upcomingCount}  label="Upcoming"  color="#3b82f6" icon={Clock} />
              <StatPill value={activeCount}    label="Active"    color="#16a34a" icon={Zap} />
              <StatPill value={completedCount} label="Completed" color="#7c3aed" icon={CheckCircle} />
            </div>
          </div>
        </div>

        {/* SYSTEM CHECK BANNER */}
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
          border: '1.5px solid #fcd34d',
          borderRadius: 14, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: 18,
          animation: 'sd-fadeInUp 0.5s 0.1s ease both',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#fef3c7', border: '1.5px solid #fcd34d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertCircle size={20} color="#d97706" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>System Requirements Check</div>
            <div style={{ color: '#78350f', fontSize: 12, marginTop: 2 }}>
              Make sure your webcam and microphone are working before any exam starts.
            </div>
          </div>
          <SystemCheckDialog>
            <button style={{
              borderRadius: 10, border: '1.5px solid #fbbf24',
              background: '#fff', color: '#b45309', padding: '7px 16px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              transition: 'all 0.2s',
            }}>
              <Zap size={14} /> Test System
            </button>
          </SystemCheckDialog>
        </div>

        {/* TIP ROTATOR */}
        <TipBanner />

        {/* ── EXAM SECTIONS ── */}
        {exams.length === 0 ? (
          /* Empty state */
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: '#fff', borderRadius: 20, border: '1.5px dashed #cbd5e1',
            animation: 'sd-fadeInUp 0.5s 0.2s ease both',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              animation: 'sd-float 3s ease-in-out infinite',
            }}>
              <BookOpen size={36} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>No Exams Yet</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>Your scheduled exams will appear here. Check back soon!</p>
          </div>
        ) : (
          <div>
            {/* LIVE / ACTIVE */}
            {liveExams.length > 0 && (
              <section style={{ marginBottom: 36, animation: 'sd-fadeInUp 0.5s 0.15s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'sd-pulse-ring 1.5s ease-out infinite' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Live Right Now</h3>
                  <span style={{
                    background: '#dcfce7', color: '#16a34a',
                    borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{liveExams.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                  {liveExams.map((exam, i) => (
                    <ExamCard
                      key={exam.id} exam={exam}
                      onStart={handleStartExam}
                      onContinue={(id) => navigate(`/exam/${id}`)}
                      formatDateTime={formatDateTime}
                      style={{ animationDelay: `${i * 0.08}s` }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* UPCOMING */}
            {upcomingExams.length > 0 && (
              <section style={{ marginBottom: 36, animation: 'sd-fadeInUp 0.5s 0.2s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Clock size={18} color="#2563eb" />
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Upcoming Exams</h3>
                  <span style={{
                    background: '#dbeafe', color: '#2563eb',
                    borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{upcomingExams.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                  {upcomingExams.map((exam, i) => (
                    <ExamCard
                      key={exam.id} exam={exam}
                      onStart={handleStartExam}
                      onContinue={(id) => navigate(`/exam/${id}`)}
                      formatDateTime={formatDateTime}
                      style={{ animationDelay: `${i * 0.08}s` }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* COMPLETED / MISSED */}
            {otherExams.length > 0 && (
              <section style={{ marginBottom: 36, animation: 'sd-fadeInUp 0.5s 0.25s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <CheckCircle size={18} color="#7c3aed" />
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Past Exams</h3>
                  <span style={{
                    background: '#ede9fe', color: '#7c3aed',
                    borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{otherExams.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                  {otherExams.map((exam, i) => (
                    <ExamCard
                      key={exam.id} exam={exam}
                      onStart={handleStartExam}
                      onContinue={(id) => navigate(`/exam/${id}`)}
                      formatDateTime={formatDateTime}
                      style={{ animationDelay: `${i * 0.08}s` }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* HELP FOOTER */}
        <div style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)',
          padding: '28px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20,
          animation: 'sd-fadeInUp 0.5s 0.3s ease both',
          marginTop: 8,
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Need Help?</h3>
            <p style={{ color: '#c7d2fe', fontSize: 13, margin: 0 }}>
              Check our comprehensive guide on exam preparation and system requirements.
            </p>
          </div>
          <GuideDialog>
            <button style={{
              borderRadius: 12, border: 'none',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              color: '#fff', padding: '10px 22px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1.5px solid rgba(255,255,255,0.3)',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              View Guide <ChevronRight size={16} />
            </button>
          </GuideDialog>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
