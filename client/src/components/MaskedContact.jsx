import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

// ── Masking helpers ──────────────────────────────────────────
export function maskEmail(e) {
  if (!e) return '—';
  const [user, domain] = e.split('@');
  if (!domain) return '••••••';
  return user.slice(0, 2) + '•'.repeat(Math.max(2, user.length - 2)) + '@' + domain;
}

export function maskPhone(p) {
  if (!p) return '—';
  const digits = p.replace(/\D/g, '');
  if (digits.length < 6) return '••••••';
  return digits.slice(0, 2) + '•'.repeat(Math.max(2, digits.length - 4)) + digits.slice(-2);
}

// ── MaskedContact ────────────────────────────────────────────
// Renders masked email + phone with action buttons.
// Every reveal / call / email / whatsapp action is logged server-side.
export default function MaskedContact({ studentId, email, phone }) {
  const [revealed, setRevealed] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [flagged, setFlagged]   = useState(false);
  const timerRef = useRef(null);

  // Auto-re-mask after 30 seconds
  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRevealed(null), 30000);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const doAction = async (action) => {
    if (loading) return;

    // If already revealed, just log + do the action
    if (revealed && action !== 'reveal') {
      try { await api.post(`/contacts/${studentId}/reveal`, { action }); } catch (_) {}
      if (action === 'call'      && revealed.phone) window.open(`tel:${revealed.phone}`);
      if (action === 'email'     && revealed.email) window.open(`mailto:${revealed.email}`);
      if (action === 'whatsapp'  && revealed.phone) {
        const ph = revealed.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${ph.startsWith('91') ? ph : '91' + ph}`);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api.post(`/contacts/${studentId}/reveal`, { action });
      setRevealed(data);
      setFlagged(data.is_flagged);
      startTimer();
      if (action === 'call'     && data.phone) window.open(`tel:${data.phone}`);
      if (action === 'email'    && data.email) window.open(`mailto:${data.email}`);
      if (action === 'whatsapp' && data.phone) {
        const ph = data.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${ph.startsWith('91') ? ph : '91' + ph}`);
      }
    } catch (_) {}
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-0.5">
      {/* Email row */}
      <div className="flex items-center gap-1">
        <span className={`text-xs font-mono ${revealed ? 'text-slate-800' : 'text-slate-400 tracking-wider'}`}>
          {revealed ? revealed.email || '—' : maskEmail(email)}
        </span>
        {!revealed && (
          <button onClick={() => doAction('reveal')} disabled={loading} title="View contact (logged)"
            className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 transition-all flex-shrink-0">
            {loading ? '…' : '👁'}
          </button>
        )}
        {revealed && (
          <>
            <button onClick={() => doAction('email')} title="Send email (logged)"
              className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0">📧</button>
            <button onClick={() => doAction('whatsapp')} title="WhatsApp (logged)"
              className="text-[10px] px-1.5 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50 transition-all flex-shrink-0">💬</button>
          </>
        )}
      </div>
      {/* Phone row */}
      <div className="flex items-center gap-1">
        <span className={`text-xs font-mono ${revealed ? 'text-slate-800' : 'text-slate-400 tracking-wider'}`}>
          {revealed ? revealed.phone || '—' : maskPhone(phone)}
        </span>
        {revealed && revealed.phone && (
          <button onClick={() => doAction('call')} title="Call (logged)"
            className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-600 transition-all flex-shrink-0">📞</button>
        )}
      </div>
      {/* Timer hint + flag warning */}
      {revealed && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] text-slate-400">⏱ hides in 30s</span>
          {flagged && <span className="text-[9px] text-red-600 font-bold">🚨 logged + flagged</span>}
          {!flagged && <span className="text-[9px] text-emerald-600">✅ access logged</span>}
        </div>
      )}
    </div>
  );
}
