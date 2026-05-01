import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function LiveClassRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [classInfo, setClassInfo]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [attendance, setAttendance]     = useState({ joined: false, duration: 0 });
  const [demoSecondsLeft, setDemoSecondsLeft] = useState(null);
  const [showPaywall, setShowPaywall]   = useState(false);
  const [zoomLaunched, setZoomLaunched] = useState(false);
  // One-time demo notice (shown once per session per class)
  const demoNoticeSeen = useRef(false);
  const [showDemoNotice, setShowDemoNotice] = useState(false);
  const jitsiRef       = useRef(null);
  const timerRef       = useRef(null);
  const demoTimerRef   = useRef(null);

  useEffect(() => {
    loadClassInfo();
    return () => {
      if (timerRef.current)     clearInterval(timerRef.current);
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
      handleLeave();
    };
  }, [id]);

  const loadClassInfo = async () => {
    try {
      const data = await api.get(`/live-classes/${id}/join`);
      setClassInfo(data);
      setAttendance({ joined: true, startTime: Date.now() });

      // Attendance duration timer (every 10s)
      timerRef.current = setInterval(() => {
        setAttendance(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - prev.startTime) / 1000)
        }));
      }, 10000);

      // ── Zoom platform ──────────────────────────────────────────
      if (data.platform === 'zoom') {
        if (data.is_demo) {
          // Demo: open Zoom for 5 min with one-time notice
          if (data.zoom_join_url) {
            window.open(data.zoom_join_url, '_blank');
            setZoomLaunched(true);
          }
          // Show the one-time demo notice (only once per session)
          const seen = sessionStorage.getItem(`demo_notice_${id}`);
          if (!seen) {
            setShowDemoNotice(true);
            sessionStorage.setItem(`demo_notice_${id}`, '1');
          }
        } else if (!data.payment_rejected && !data.payment_expired && data.zoom_join_url) {
          // Enrolled or payment pending: open Zoom
          window.open(data.zoom_join_url, '_blank');
          setZoomLaunched(true);
        }
        // Demo countdown
        if (data.is_demo && data.demo_minutes) {
          startDemoTimer(data.demo_minutes);
        }
      } else {
        // ── Jitsi platform ─────────────────────────────────────────
        // Demo notice for Jitsi (once)
        if (data.is_demo) {
          const seen = sessionStorage.getItem(`demo_notice_${id}`);
          if (!seen) {
            setShowDemoNotice(true);
            sessionStorage.setItem(`demo_notice_${id}`, '1');
          }
        }
        if (data.is_demo && data.demo_minutes) {
          startDemoTimer(data.demo_minutes, true);
        }
        loadJitsi(data);
      }
    } catch (e) {
      setError(e.message || 'Failed to join class');
    } finally {
      setLoading(false);
    }
  };

  const startDemoTimer = (minutes, disposeJitsiOnExpiry = false) => {
    const totalSeconds = minutes * 60;
    setDemoSecondsLeft(totalSeconds);
    demoTimerRef.current = setInterval(() => {
      setDemoSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(demoTimerRef.current);
          setShowPaywall(true);
          if (disposeJitsiOnExpiry && window.jitsiApi) {
            window.jitsiApi.dispose();
            window.jitsiApi = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const loadJitsi = (data) => {
    const scriptSrc = (data.jaas_token && data.jaas_app_id)
      ? 'https://8x8.vc/libs/external_api.min.js'
      : 'https://meet.jit.si/external_api.js';
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.onload = () => initializeJitsi(data);
      document.body.appendChild(script);
    } else {
      initializeJitsi(data);
    }
  };

  const initializeJitsi = (data) => {
    const useJaaS  = !!(data.jaas_token && data.jaas_app_id);
    const domain   = useJaaS ? '8x8.vc' : 'meet.jit.si';
    const roomName = useJaaS ? `${data.jaas_app_id}/${data.jitsi_room_name}` : data.jitsi_room_name;
    const options  = {
      roomName, width: '100%', height: '100%',
      parentNode: jitsiRef.current,
      ...(useJaaS ? { jwt: data.jaas_token } : {}),
      userInfo: { displayName: user?.name || 'Student', email: user?.email },
      configOverwrite: {
        startWithAudioMuted: !data.allow_audio,
        startWithVideoMuted: !data.allow_video,
        disableModeratorIndicator: !data.is_moderator,
        enableWelcomePage: false, enableClosePage: false,
        hideLobbyButton: true, disableProfile: true,
        prejoinPageEnabled: false, readOnlyName: true,
        toolbarButtons: data.is_moderator
          ? ['microphone','camera','desktop','fullscreen','fodeviceselection','hangup','chat','recording','raisehand','videoquality','filmstrip','tileview','mute-everyone','security']
          : data.is_demo
            ? ['fullscreen','tileview']
            : data.class_mode === 'broadcast'
              ? ['chat','raisehand','fullscreen','tileview']
              : ['microphone','camera','desktop','fullscreen','chat','raisehand','videoquality','filmstrip','tileview']
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false, SHOW_BRANDED_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Student',
        TOOLBAR_ALWAYS_VISIBLE: true, DEFAULT_BACKGROUND: '#1a1a1a',
        ENABLE_FEEDBACK_ANIMATION: false,
      }
    };
    const api = new window.JitsiMeetExternalAPI(domain, options);
    api.addEventListeners({
      readyToClose: () => { handleLeave(); navigate(-1); },
      videoConferenceLeft: () => { handleLeave(); }
    });
    window.jitsiApi = api;
  };

  const handleLeave = async () => {
    if (timerRef.current)     { clearInterval(timerRef.current);     timerRef.current = null; }
    if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; }
    try {
      if (attendance.joined) {
        await api.post(`/live-classes/${id}/leave`);
        if (attendance.duration > 0) {
          await api.post(`/live-classes/${id}/attendance`, {
            duration_seconds: attendance.duration,
            time_percent: Math.min(100, Math.round((attendance.duration / ((classInfo?.duration_minutes || 60) * 60)) * 100))
          });
        }
      }
      if (window.jitsiApi) { window.jitsiApi.dispose(); window.jitsiApi = null; }
    } catch (_) {}
  };

  const fmtTime = (secs) => `${Math.floor(secs/60)}:${(secs%60).toString().padStart(2,'0')}`;

  // ─── WhatsApp helper ──────────────────────────────────────────
  const openWhatsApp = (msg) => {
    const phone = (classInfo?.agency_phone || '').replace(/\D/g,'');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const waPaymentMsg = () =>
    `Hi ${classInfo?.agency_name || 'Academy'}! I have paid my fee and submitted the payment proof.\n\nPlease allow me to access:\n📚 Course: ${classInfo?.course_title}\n🏫 Class: ${classInfo?.title}\n🆔 Class ID: ${id}\n\nKindly verify and activate my access. Thank you!`;

  const waPayRejectedMsg = () =>
    `Hi ${classInfo?.agency_name || 'Academy'}! My payment proof was not approved.\n\nClass: ${classInfo?.title}\nCourse: ${classInfo?.course_title}\nClass ID: ${id}\n\nPlease help me resolve this. Thank you!`;

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-white text-center">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
        <p>Joining class...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center px-6">
        <p className="text-red-400 mb-4 text-lg font-semibold">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold">Go Back</button>
      </div>
    </div>
  );

  // ─── PAYMENT REJECTED / EXPIRED SCREEN ───────────────────────
  if (classInfo?.payment_rejected || classInfo?.payment_expired) {
    const isRejected = classInfo.payment_rejected;
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="text-5xl mb-4">{isRejected ? '❌' : '⏰'}</div>
          <h2 className="text-xl font-black text-slate-900 mb-2">
            {isRejected ? 'Payment Not Confirmed' : 'Payment Approval Expired'}
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            {isRejected
              ? `Your payment proof was reviewed but could not be verified. ${classInfo.payment_admin_note ? `Reason: ${classInfo.payment_admin_note}` : 'Please submit a new payment proof to continue.'}`
              : 'Your payment proof has been pending for more than 48 hours without approval. Please contact your academy.'}
          </p>

          {/* Contact details */}
          <div className="bg-slate-50 rounded-xl p-4 mb-5 text-left border border-slate-200">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">Contact Your Academy</p>
            <p className="font-bold text-slate-900">{classInfo.agency_name}</p>
            {classInfo.agency_phone && <p className="text-sm text-slate-600 mt-1">📞 {classInfo.agency_phone}</p>}
            {classInfo.agency_email && <p className="text-sm text-slate-600">✉️ {classInfo.agency_email}</p>}
          </div>

          {/* WhatsApp button */}
          {classInfo.agency_phone && (
            <button
              onClick={() => openWhatsApp(waPayRejectedMsg())}
              className="w-full py-3 rounded-xl font-black text-white mb-3 flex items-center justify-center gap-2 transition hover:opacity-90"
              style={{ background: '#25D366' }}>
              <span>📱</span> Send WhatsApp Message
            </button>
          )}

          {/* Re-enroll */}
          <button
            onClick={() => { handleLeave(); navigate('/student', { state: { tab: 'payments' } }); }}
            className="w-full py-3 rounded-xl font-black text-white mb-3 transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            💳 Submit New Payment Proof
          </button>
          <button
            onClick={() => { handleLeave(); navigate(-1); }}
            className="w-full py-2 text-slate-400 text-sm hover:text-slate-600 transition">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // ─── ZOOM PLATFORM UI ────────────────────────────────────────
  if (classInfo?.platform === 'zoom') {
    const tzLabel = classInfo.timezone === 'Asia/Kolkata' || !classInfo.timezone
      ? 'IST' : classInfo.timezone.split('/')[1]?.replace('_',' ') || classInfo.timezone;
    const isBlocked = showPaywall;

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8 relative">

        {/* Back */}
        <div className="w-full max-w-lg mb-4">
          <button onClick={() => { handleLeave(); navigate(-1); }}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            ← Back to Classes
          </button>
        </div>

        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-700 overflow-hidden">

          {/* Top banner */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            <div className="flex items-center gap-2 text-white font-bold text-sm">🔵 Zoom Live Class</div>
            <div className="flex items-center gap-2">
              {classInfo.is_demo && demoSecondsLeft !== null && !isBlocked && (
                <span className={`text-xs font-black px-3 py-1 rounded-full text-white ${demoSecondsLeft <= 60 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
                  ⏱ Demo: {fmtTime(demoSecondsLeft)}
                </span>
              )}
              {classInfo.payment_pending && (
                <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-500 text-white">⏳ Payment Pending</span>
              )}
              {!classInfo.is_demo && !classInfo.payment_pending && (
                <span className="text-xs font-black px-3 py-1 rounded-full bg-green-500/80 text-white">✅ Enrolled</span>
              )}
            </div>
          </div>

          <div className="p-6">
            <h1 className="text-xl font-black text-white mb-1">{classInfo.title}</h1>
            {classInfo.description && <p className="text-slate-400 text-sm mb-4">{classInfo.description}</p>}

            {/* Info pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {classInfo.scheduled_at && (
                <>
                  <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs">
                    📅 {new Date(classInfo.scheduled_at.slice(0,19)).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                  </span>
                  <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs">
                    🕐 {new Date(classInfo.scheduled_at.slice(0,19)).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
                    <span className="text-blue-400 font-bold ml-1">{tzLabel}</span>
                  </span>
                </>
              )}
              <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs">⏱️ {classInfo.duration_minutes} min</span>
            </div>

            {/* Password (enrolled/pending only) */}
            {!classInfo.is_demo && classInfo.zoom_password && (
              <div className="bg-slate-700/60 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-slate-400 mb-1">Meeting Password</p>
                <p className="font-mono font-black text-white text-xl tracking-widest select-all">{classInfo.zoom_password}</p>
                <p className="text-xs text-slate-500 mt-1">Copy before opening Zoom</p>
              </div>
            )}

            {/* Payment pending banner */}
            {classInfo.payment_pending && (
              <div className="mb-5 rounded-xl border border-amber-500/50 bg-amber-900/20 p-4">
                <p className="font-bold text-amber-300 text-sm mb-1">⏳ Payment under review</p>
                <p className="text-amber-200/70 text-xs mb-2">
                  Your payment proof has been submitted and is being verified.
                  {classInfo.payment_hours_left != null && ` Approval expected within ${classInfo.payment_hours_left}h.`}
                  {' '}If not approved, your access will be stopped.
                </p>
                {classInfo.agency_phone && (
                  <button onClick={() => openWhatsApp(waPaymentMsg())}
                    className="text-xs font-bold text-green-400 hover:text-green-300 flex items-center gap-1 transition">
                    📱 Send "I have paid" WhatsApp →
                  </button>
                )}
              </div>
            )}

            {/* Attendance timer (enrolled/pending) */}
            {!classInfo.is_demo && (
              <div className="bg-slate-700/40 rounded-xl px-4 py-3 mb-5 flex items-center justify-between text-sm">
                <span className="text-slate-400">Time in class</span>
                <strong className="text-white">{Math.floor(attendance.duration/60)}m {attendance.duration%60}s</strong>
              </div>
            )}

            {/* Join / Rejoin buttons */}
            {!isBlocked && zoomLaunched && (
              <div className="mb-4">
                <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3 mb-3 text-green-300 text-sm text-center">
                  ✅ Zoom launched in a new tab — return here when done.
                </div>
                <button
                  className="w-full py-3 rounded-xl font-black text-white transition-transform hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                  onClick={() => window.open(classInfo.zoom_join_url, '_blank')}>
                  🔵 Rejoin Zoom
                </button>
              </div>
            )}
            {!isBlocked && !zoomLaunched && classInfo.zoom_join_url && (
              <button
                className="w-full py-3 rounded-xl font-black text-white mb-4 transition-transform hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                onClick={() => { window.open(classInfo.zoom_join_url, '_blank'); setZoomLaunched(true); }}>
                🔵 Open Zoom Meeting
              </button>
            )}

            <button
              onClick={() => { handleLeave(); navigate(-1); }}
              className="w-full py-2 rounded-xl text-slate-400 text-sm hover:text-white hover:bg-slate-700 transition-colors">
              ← Leave Class
            </button>
          </div>
        </div>

        {/* ── One-time demo notice modal ─────────────────────── */}
        {showDemoNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center">
              <div className="text-4xl mb-3">🎁</div>
              <h3 className="text-lg font-black text-slate-900 mb-2">FREE 5-Minute Demo</h3>
              <p className="text-slate-600 text-sm mb-1">
                You are joining <strong>{classInfo.title}</strong> as a <strong>free demo</strong>.
              </p>
              <p className="text-slate-500 text-sm mb-4">
                Zoom has opened in a new tab. You can attend for <strong>5 minutes free</strong>.
                After that, you'll need to enroll to continue.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-left">
                <p className="text-xs font-black text-amber-700 uppercase tracking-wide mb-1">Course</p>
                <p className="font-bold text-slate-800">{classInfo.course_title}</p>
                <p className="text-lg font-black text-amber-600 mt-0.5">
                  ₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                className="w-full py-3 rounded-xl font-black text-white mb-2 transition hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                onClick={() => { setShowDemoNotice(false); handleLeave(); navigate('/student', { state: { tab: 'catalog' } }); }}>
                🎓 Enroll Now — ₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}
              </button>
              <button
                onClick={() => setShowDemoNotice(false)}
                className="w-full py-2 text-slate-500 text-sm hover:text-slate-700 transition">
                Continue with 5-min demo →
              </button>
            </div>
          </div>
        )}

        {/* ── Paywall when Zoom demo expires ─────────────────── */}
        {isBlocked && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: 'rgba(15,23,42,0.96)', backdropFilter: 'blur(10px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h2 className="text-xl font-black text-slate-900 mb-2">Your Free Demo Has Ended</h2>
              <p className="text-slate-500 text-sm mb-4">
                Your 5-minute free demo of this Zoom class has ended.
                Enroll in <strong>{classInfo.course_title}</strong> to get full, unlimited access to all live classes.
              </p>
              <div className="bg-blue-50 rounded-xl p-4 mb-5 border border-blue-100">
                <p className="text-xs text-slate-400 mb-1">Enroll in</p>
                <p className="font-bold text-slate-900">{classInfo.course_title}</p>
                <p className="text-2xl font-black text-blue-600 mt-1">₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}</p>
              </div>
              <button
                className="w-full py-3 rounded-xl text-white font-black mb-3 transition hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}
                onClick={() => { handleLeave(); navigate('/student', { state: { tab: 'catalog' } }); }}>
                🎓 Enroll Now
              </button>
              <button
                className="w-full py-2 text-slate-400 text-sm hover:text-slate-600 transition"
                onClick={() => { handleLeave(); navigate(-1); }}>
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── JITSI PLATFORM UI ───────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-900 relative">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-semibold text-sm">{classInfo?.title}</h1>
          <span className="text-xs bg-blue-600 px-2 py-1 rounded">
            {classInfo?.is_moderator ? 'Moderator' : classInfo?.is_demo ? '🎁 Demo Preview' : 'Student'}
          </span>
          {classInfo?.payment_pending && (
            <span className="text-xs bg-amber-500 px-2 py-1 rounded">⏳ Payment Pending</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {classInfo?.is_demo && demoSecondsLeft !== null && !showPaywall && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${demoSecondsLeft <= 60 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
              ⏱ Demo: {fmtTime(demoSecondsLeft)}
            </div>
          )}
          {!classInfo?.is_demo && (
            <span className="text-slate-400 text-xs">
              {Math.floor(attendance.duration/60)}m {attendance.duration%60}s in class
            </span>
          )}
          <button
            onClick={() => { handleLeave(); navigate(-1); }}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm font-medium transition-colors">
            Leave
          </button>
        </div>
      </div>

      {/* Jitsi container */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 48px)' }}>
        <div ref={jitsiRef} className="w-full h-full" />

        {/* Jitsi paywall overlay */}
        {showPaywall && (
          <div className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Your Demo Has Ended</h2>
              <p className="text-slate-500 mb-6">
                Your 15-minute free preview has ended. Purchase the course to continue.
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
                onClick={() => navigate('/student', { state: { tab: 'catalog' } })}>
                Purchase Course
              </button>
              <button
                className="w-full py-2 rounded-xl text-slate-500 text-sm hover:text-slate-700 transition-colors"
                onClick={() => navigate(-1)}>
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* One-time Jitsi demo notice */}
      {showDemoNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(15,23,42,0.80)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center">
            <div className="text-4xl mb-3">🎁</div>
            <h3 className="text-lg font-black text-slate-900 mb-2">FREE 15-Minute Preview</h3>
            <p className="text-slate-600 text-sm mb-4">
              You're joining <strong>{classInfo?.title}</strong> as a free preview.
              You have <strong>15 minutes</strong> to experience the class before enrolling.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-left">
              <p className="font-bold text-slate-800">{classInfo?.course_title}</p>
              <p className="text-lg font-black text-amber-600 mt-0.5">
                ₹{Number(classInfo?.course_price || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <button
              className="w-full py-3 rounded-xl font-black text-white mb-2 transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              onClick={() => { setShowDemoNotice(false); handleLeave(); navigate('/student', { state: { tab: 'catalog' } }); }}>
              🎓 Enroll Now
            </button>
            <button onClick={() => setShowDemoNotice(false)}
              className="w-full py-2 text-slate-500 text-sm hover:text-slate-700 transition">
              Continue with 15-min preview →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
