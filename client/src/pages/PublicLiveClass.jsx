import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// Public (no auth) live class join page
// Works for both Jitsi and Zoom. Shows payment prompt for non-enrolled guests.
export default function PublicLiveClass() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [nameEntered, setNameEntered] = useState(false);
  const [demoSecondsLeft, setDemoSecondsLeft] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [zoomLaunched, setZoomLaunched] = useState(false);
  const jitsiRef = useRef(null);
  const demoTimerRef = useRef(null);
  const reminderTimerRef = useRef(null);

  useEffect(() => {
    api.get(`/live-classes/${id}/public`).then(data => {
      setClassInfo(data);
      setLoading(false);
    }).catch(e => {
      setError(e.message || 'Class not found or not available');
      setLoading(false);
    });
    return () => {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
      if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
      if (window.jitsiApiGuest) { window.jitsiApiGuest.dispose(); window.jitsiApiGuest = null; }
    };
  }, [id]);

  const tzLabel = (tz) => {
    if (!tz || tz === 'Asia/Kolkata') return 'IST';
    return tz.split('/')[1]?.replace('_', ' ') || tz;
  };

  const startDemo = () => {
    if (!classInfo) return;
    const demoMins = classInfo.demo_minutes || 15;
    const totalSecs = demoMins * 60;
    setDemoSecondsLeft(totalSecs);

    // Payment reminder every 3 min
    reminderTimerRef.current = setInterval(() => {
      setShowReminderBanner(true);
    }, 3 * 60 * 1000);

    // Demo countdown
    demoTimerRef.current = setInterval(() => {
      setDemoSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(demoTimerRef.current);
          setShowPaywall(true);
          if (window.jitsiApiGuest) { window.jitsiApiGuest.dispose(); window.jitsiApiGuest = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (classInfo.platform === 'zoom') {
      window.open(classInfo.zoom_join_url, '_blank');
      setZoomLaunched(true);
    } else {
      loadJitsiGuest(classInfo);
    }
  };

  const loadJitsiGuest = (data) => {
    const scriptSrc = (data.jaas_token && data.jaas_app_id)
      ? 'https://8x8.vc/libs/external_api.min.js'
      : 'https://meet.jit.si/external_api.js';
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.onload = () => initJitsiGuest(data);
      document.body.appendChild(script);
    } else {
      initJitsiGuest(data);
    }
  };

  const initJitsiGuest = (data) => {
    const useJaaS = !!(data.jaas_token && data.jaas_app_id);
    const domain = useJaaS ? '8x8.vc' : 'meet.jit.si';
    const roomName = useJaaS ? `${data.jaas_app_id}/${data.jitsi_room_name}` : data.jitsi_room_name;

    const jitsiApiInstance = new window.JitsiMeetExternalAPI(domain, {
      roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiRef.current,
      userInfo: { displayName: guestName || 'Guest', email: '' },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        enableWelcomePage: false,
        enableClosePage: false,
        prejoinPageEnabled: false,
        // Demo users get view-only toolbar
        toolbarButtons: ['fullscreen', 'tileview'],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRANDED_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Instructor',
        TOOLBAR_ALWAYS_VISIBLE: true,
        DEFAULT_BACKGROUND: '#1a1a1a',
      }
    });
    jitsiApiInstance.addEventListeners({
      readyToClose: () => navigate(-1),
    });
    window.jitsiApiGuest = jitsiApiInstance;
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-white text-center">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
        <p>Loading class info…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">📺</div>
        <h2 className="text-white font-black text-xl mb-2">Class Unavailable</h2>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <a href="/" className="text-blue-400 hover:underline text-sm">← Go Home</a>
      </div>
    </div>
  );

  // ── Guest Name Entry (shown before joining Jitsi) ───────────
  if (!nameEntered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          {classInfo.logo_url ? (
            <img src={classInfo.logo_url} alt="logo" className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4 shadow" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-2xl mx-auto mb-4 shadow"
              style={{ background: classInfo.brand_color || '#1e40af' }}>
              {classInfo.agency_name?.slice(0,1) || '🎓'}
            </div>
          )}

          {/* LIVE badge */}
          {classInfo.status === 'live' && (
            <div className="flex justify-center mb-3">
              <span className="flex items-center gap-1.5 font-black text-white text-sm px-4 py-1.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 0 16px rgba(22,163,74,0.5)' }}>
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping inline-block" />
                🟢 CLASS IS LIVE
              </span>
            </div>
          )}

          <h1 className="text-2xl font-black text-slate-900 mb-1">{classInfo.title}</h1>
          <p className="text-slate-400 text-sm mb-1">{classInfo.agency_name}</p>
          {classInfo.description && <p className="text-slate-500 text-sm mb-4">{classInfo.description}</p>}

          <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500 mb-6">
            <span className="bg-slate-100 px-3 py-1 rounded-full">
              🕐 {new Date(classInfo.scheduled_at?.slice(0,19)).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})} {tzLabel(classInfo.timezone)}
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full">⏱️ {classInfo.duration_minutes} min</span>
            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">🎁 15-min Free Preview</span>
          </div>

          <div className="mb-5">
            <label className="block text-left text-sm font-semibold text-slate-700 mb-1.5">Your Name</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name to join"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guestName.trim() && (setNameEntered(true), startDemo())}
            />
          </div>

          <button
            disabled={!guestName.trim()}
            className="w-full py-3.5 rounded-2xl font-black text-white text-base transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)', boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}
            onClick={() => { setNameEntered(true); startDemo(); }}
          >
            ▶ Join Free Preview
          </button>

          <p className="text-xs text-slate-400 mt-4">
            Already enrolled? <a href="/login" className="text-blue-500 hover:underline">Sign in</a> for full access
          </p>
        </div>
      </div>
    );
  }

  // ── Zoom Platform View ───────────────────────────────────────
  if (classInfo.platform === 'zoom') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            ← Back
          </button>
        </div>
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center border border-slate-700">
          <div className="text-5xl mb-4">🔵</div>
          <h1 className="text-2xl font-black text-white mb-1">{classInfo.title}</h1>
          <p className="text-slate-400 text-sm mb-5">{classInfo.agency_name}</p>

          {/* Demo countdown */}
          {demoSecondsLeft !== null && !showPaywall && (
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold text-white mb-4 ${demoSecondsLeft <= 60 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
              ⏱ Demo: {formatTime(demoSecondsLeft)}
            </div>
          )}

          {classInfo.zoom_password && (
            <div className="bg-slate-700/60 rounded-xl px-4 py-3 mb-5 text-left">
              <p className="text-xs text-slate-400 mb-1">Zoom Meeting Password</p>
              <p className="font-mono font-bold text-white text-lg tracking-widest">{classInfo.zoom_password}</p>
            </div>
          )}

          {zoomLaunched ? (
            <button
              className="w-full py-3 rounded-xl font-bold text-white mb-3 transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              onClick={() => window.open(classInfo.zoom_join_url, '_blank')}
            >
              🔵 Rejoin Zoom Meeting
            </button>
          ) : (
            <button
              className="w-full py-3 rounded-xl font-bold text-white mb-3 transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              onClick={() => { window.open(classInfo.zoom_join_url, '_blank'); setZoomLaunched(true); }}
            >
              🔵 Open Zoom Meeting
            </button>
          )}

          {/* Payment CTA */}
          {!showPaywall && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 text-left mt-4">
              <p className="font-bold text-amber-300 text-sm mb-1">🎁 Free 15-min preview</p>
              <p className="text-amber-200/70 text-xs mb-3">Purchase <strong>{classInfo.course_title}</strong> for full access.</p>
              <button
                className="w-full py-2.5 rounded-lg font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                onClick={() => navigate('/login')}
              >
                🔓 Sign up & Enroll — ₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}
              </button>
            </div>
          )}
        </div>

        {/* Paywall overlay */}
        {showPaywall && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Free Preview Ended</h2>
              <p className="text-slate-500 mb-6">Your 15-minute preview is over. Create an account and enroll to continue.</p>
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="font-bold text-slate-900 text-lg">{classInfo.course_title}</p>
                <p className="text-2xl font-black text-blue-600 mt-1">₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}</p>
              </div>
              <button
                className="w-full py-3 rounded-xl text-white font-bold text-lg mb-3"
                style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}
                onClick={() => navigate('/login')}
              >
                Sign Up & Enroll
              </button>
              <button className="w-full py-2 text-slate-400 text-sm hover:text-slate-700 transition" onClick={() => navigate(-1)}>
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Jitsi (Guest) View ───────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-900 relative">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-sm">{classInfo.title}</h1>
          <span className="text-xs bg-amber-500 px-2 py-0.5 rounded font-bold">🎁 Guest Preview</span>
          {classInfo.status === 'live' && (
            <span className="flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />🟢 LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {demoSecondsLeft !== null && !showPaywall && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${demoSecondsLeft <= 60 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'}`}>
              <span>⏱</span>
              <span>Demo: {formatTime(demoSecondsLeft)}</span>
            </div>
          )}
          <button onClick={() => navigate(-1)} className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm font-medium transition-colors">
            Leave
          </button>
        </div>
      </div>

      {/* Jitsi container */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - 48px)' }}>
        <div ref={jitsiRef} className="w-full h-full" />

        {/* Payment reminder banner */}
        {showReminderBanner && !showPaywall && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
            <div className="bg-amber-500 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">💳</span>
              <div className="flex-1">
                <p className="font-bold text-sm">You're watching a free preview</p>
                <p className="text-xs text-amber-100 mt-0.5">
                  Create an account and purchase <strong>{classInfo.course_title}</strong> for full access.
                  {demoSecondsLeft !== null && <span> Demo ends in {formatTime(demoSecondsLeft)}.</span>}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="bg-white text-amber-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition"
                    onClick={() => navigate('/login')}>
                    Sign Up & Enroll ₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}
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

        {/* Paywall overlay */}
        {showPaywall && (
          <div className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Free Preview Ended</h2>
              <p className="text-slate-500 mb-6">Your 15-minute preview is over. Create an account to enroll and get full access.</p>
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-slate-500 mb-1">Course</p>
                <p className="font-bold text-slate-900 text-lg">{classInfo.course_title}</p>
                <p className="text-2xl font-black text-blue-600 mt-1">₹{Number(classInfo.course_price || 0).toLocaleString('en-IN')}</p>
              </div>
              <button
                className="w-full py-3 rounded-xl text-white font-bold text-lg mb-3"
                style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)' }}
                onClick={() => navigate('/login')}
              >
                Sign Up & Enroll
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
