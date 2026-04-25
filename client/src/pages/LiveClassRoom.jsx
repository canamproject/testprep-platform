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
  const jitsiRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    loadClassInfo();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      handleLeave();
    };
  }, [id]);

  const loadClassInfo = async () => {
    try {
      const data = await api.get(`/live-classes/${id}/join`);
      setClassInfo(data);
      setAttendance({ joined: true, startTime: Date.now() });
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setAttendance(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - prev.startTime) / 1000)
        }));
      }, 10000); // Update every 10 seconds
      
      // Load Jitsi
      loadJitsi(data);
    } catch (e) {
      setError(e.message || 'Failed to join class');
    } finally {
      setLoading(false);
    }
  };

  const loadJitsi = (data) => {
    // Check if Jitsi is already loaded
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
          : data.class_mode === 'broadcast'
            ? ['chat', 'raisehand', 'fullscreen', 'tileview'] // Students in broadcast mode
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

    const api = new window.JitsiMeetExternalAPI(domain, options);
    
    // Handle events
    api.addEventListeners({
      readyToClose: () => {
        handleLeave();
        navigate(-1);
      },
      videoConferenceLeft: () => {
        handleLeave();
      },
      participantRoleChanged: (event) => {
        console.log('Role changed:', event);
      }
    });

    // Store API reference
    window.jitsiApi = api;
  };

  const handleLeave = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    try {
      // Send final attendance
      if (attendance.joined) {
        await api.post(`/live-classes/${id}/leave`);
        
        // Update attendance duration
        if (attendance.duration > 0) {
          await api.post(`/live-classes/${id}/attendance`, {
            duration_seconds: attendance.duration,
            time_percent: Math.min(100, Math.round((attendance.duration / (classInfo?.duration_minutes * 60 || 3600)) * 100))
          });
        }
      }
      
      // Dispose Jitsi
      if (window.jitsiApi) {
        window.jitsiApi.dispose();
        window.jitsiApi = null;
      }
    } catch (e) {
      console.error('Error leaving class:', e);
    }
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
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold">{classInfo?.title}</h1>
          <span className="text-xs bg-blue-600 px-2 py-1 rounded">
            {classInfo?.is_moderator ? 'Moderator' : 'Student'}
          </span>
          <span className="text-xs bg-slate-600 px-2 py-1 rounded">
            {classInfo?.class_mode === 'broadcast' ? 'Broadcast Mode' : 'Interactive Mode'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            Time in class: {Math.floor(attendance.duration / 60)}m {attendance.duration % 60}s
          </span>
          <button 
            onClick={() => { handleLeave(); navigate(-1); }}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Leave Class
          </button>
        </div>
      </div>

      {/* Jitsi Container */}
      <div ref={jitsiRef} className="flex-1" style={{ height: 'calc(100vh - 48px)' }} />
    </div>
  );
}
