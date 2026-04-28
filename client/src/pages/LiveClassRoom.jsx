import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function LiveClassRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendance, setAttendance] = useState({ joined: false, duration: 0 });
  const [demoSecondsLeft, setDemoSecondsLeft] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const jitsiRef = useRef(null);
  const timerRef = useRef(null);
  const demoTimerRef = useRef(null);
  const reminderTimerRef = useRef(null);

  useEffect(() => {
    loadClassInfo();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
      if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
      handleLeave();
    };
  }, [id]);

  const loadClassInfo = async () => {
    try {
      const data = await api.get(`/live-classes/${id}/join`);
      setClassInfo(data);
      setAttendance({ joined: true, startTime: Date.now() });

      // Start attendance duration timer
      timerRef.current = setInterval(() => {
        setAttendance(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - prev.startTime) / 1000)
        }));
      }, 10000);

      // Every-3-min payment reminder for demo users (not for paid students)
      if (data.is_demo) {
        reminderTimerRef.current = setInterval(() => {
          setShowReminderBanner(true);
          setReminderCount(n => n + 1);
        }, 3 * 60 * 1000); // every 3 minutes
      }

      // Start demo countdown if demo mode
      if (data.is_demo && data.demo_minutes) {
        const totalSeconds = data.demo_minutes * 60;
        setDemoSecondsLeft(totalSeconds);
        demoTimerRef.current = setInterval(() => {
          setDemoSecondsLeft(prev => {
            if (prev <= 1) {
              clearInterval(demoTimerRef.current);
              setShowPaywall(true);
              // Dispose Jitsi when demo expires
              if (window.jitsiApi) {
                window.jitsiApi.dispose();
                window.jitsiApi = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }

      loadJitsi(data);
    } catch (e) {
      setError(e.message || 'Failed to join class');
    } finally {
      setLoading(false);
    }
  };

  const loadJitsi = (data) => {
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => initializeJitsi(data);
      document.body.appendChild(script);
    } else {
      initializeJitsi(data);
    }
  };

  const initializeJitsi = (data) => {
    const domain = 'meet.jit.si';
    const options = {
      roomName: data.jitsi_room_name,
      width: '100%',
      height: '100%',
      parentNode: jitsiRef.current,
      userInfo: {
        displayName: user?.name || 'Student',
        email: user?.email
      },
      configOverwrite: {
        startWithAudioMuted: !data.allow_audio,
        startWithVideoMuted: !data.allow_video,
        disableModeratorIndicator: !data.is_moderator,
        enableWelcomePage: false,
        enableClosePage: false,
        hideLobbyButton: true,
        disableProfile: true,
        prejoinPageEnabled: false,
        readOnlyName: true,
        toolbarButtons: data.is_moderator
          ? ['microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection', 'hangup', 'chat', 'recording', 'raisehand', 'videoquality', 'filmstrip', 'tileview', 'mute-everyone', 'security']
          : data.is_demo
            ? ['fullscreen', 'tileview'] // Demo: view-only
            : data.class_mode === 'broadcast'
              ? ['chat', 'raisehand', 'fullscreen', 'tileview']
              : ['microphone', 'camera', 'desktop', 'fullscreen', 'chat', 'raisehand', 'videoquality', 'filmstrip', 'tileview']
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRANDED_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Student',
        TOOLBAR_ALWAYS_VISIBLE: true,
        DEFAULT_BACKGROUND: '#1a1a1a',
        ENABLE_FEEDBACK_ANIMATION: false,
        DISABLE_FOCUS_INDICATOR: false
      }
    };

    const jitsiApiInstance = new window.JitsiMeetExternalAPI(domain, options);

    jitsiApiInstance.addEventListeners({
      readyToClose: () => {
        handleLeave();
        navigate(-1);
      },
      videoConferenceLeft: () => {
        handleLeave();
      }
    });

    window.jitsiApi = jitsiApiInstance;
  };

  const handleLeave = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
    if (reminderTimerRef.current) { clearInterval(reminderTimerRef.current); reminderTimerRef.current = null; }

    try {
      if (attendance.joined) {
        await api.post(`/live-classes/${id}/leave`);
        if (attendance.duration > 0) {
          await api.post(`/live-classes/${id}/attendance`, {
            duration_seconds: attendance.duration,
            time_percent: Math.min(100, Math.round((attendance.duration / (classInfo?.duration_minutes * 60 || 3600)) * 100))
          });
        }
      }
      if (window.jitsiApi) { window.jitsiApi.dispose(); window.jitsiApi = null; }
    } catch (e) {
      console.error('Error leaving class:', e);
    }
  };

  const formatDemoTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Joining class...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="btn-primary">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 relative">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold">{classInfo?.title}</h1>
          <span className="text-xs bg-blue-600 px-2 py-1 rounded">
            {classInfo?.is_moderator ? 'Moderator' : classInfo?.is_demo ? 'Demo Preview' : 'Student'}
          </span>
          <span className="text-xs bg-slate-600 px-2 py-1 rounded">
            {classInfo?.class_mode === 'broadcast' ? 'Broadcast Mode' : 'Interactive Mode'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {/* Demo countdown badge */}
          {classInfo?.is_demo && demoSecondsLeft !== null && !showPaywall && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${demoSecondsLeft <= 60 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
              <span>⏱</span>
              <span>Demo: {formatDemoTime(demoSecondsLeft)}</span>
            </div>
          )}
          {!classInfo?.is_demo && (
            <span className="text-slate-400">
              Time in class: {Math.floor(attendance.duration / 60)}m {attendance.duration % 60}s
            </span>
          )}
          <button
            onClick={() => { handleLeave(); navigate(-1); }}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Leave Class
          </button>
        </div>
      </div>

      {/* Jitsi Container */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 48px)' }}>
        <div ref={jitsiRef} className="w-full h-full" />

        {/* 3-min dismissible payment reminder (demo only, not for paid students) */}
        {classInfo?.is_demo && showReminderBanner && !showPaywall && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
            <div className="bg-amber-500 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 animate-bounce-once">
              <span className="text-2xl flex-shrink-0">💳</span>
              <div className="flex-1">
                <p className="font-bold text-sm">You're watching a free preview</p>
                <p className="text-xs text-amber-100 mt-0.5">
                  Purchase <strong>{classInfo.course_title}</strong> for full access to all classes.
                  {demoSecondsLeft !== null && (
                    <span> Demo ends in {formatDemoTime(demoSecondsLeft)}.</span>
                  )}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="bg-white text-amber-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition"
                    onClick={() => { handleLeave(); navigate('/student', { state: { tab: 'catalog' } }); }}>
                    Buy ₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}
                  </button>
                  <button
                    className="text-amber-100 text-xs px-3 py-1.5 rounded-lg hover:bg-amber-600 transition"
                    onClick={() => setShowReminderBanner(false)}>
                    Remind me later ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paywall overlay when demo expires */}
        {showPaywall && (
          <div className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Your Demo Has Ended</h2>
              <p className="text-slate-500 mb-6">
                You've used your 15-minute free preview. Purchase the course to continue watching this class and get full access.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-slate-500 mb-1">Course</p>
                <p className="font-bold text-slate-900 text-lg">{classInfo?.course_title}</p>
                <p className="text-2xl font-black text-blue-600 mt-1">
                  ₹{Number(classInfo?.course_price || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                className="w-full py-3 rounded-xl text-white font-bold text-lg mb-3"
                style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}
                onClick={() => navigate('/student', { state: { tab: 'catalog' } })}
              >
                Purchase Course
              </button>
              <button
                className="w-full py-2 rounded-xl text-slate-500 text-sm hover:text-slate-700 transition-colors"
                onClick={() => navigate(-1)}
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
