import React, { useState } from 'react';
import { ShieldAlert, PhoneCall, HeartHandshake, AlertCircle, RefreshCw, Volume2, VolumeX } from 'lucide-react';

export default function SafetyFlagMessage({ helplineInfo, message, onReset }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const info = helplineInfo || {
    nhaa_helpline: "14566 (National Helpline Against Atrocities)",
    hotline: "1800-599-0019 (KIRAN Mental Health)",
    emergency_contact: "112 (National Emergency)",
    counselor_chat: "1800-11-4015 (24/7 Ministry Line)",
    local_nodal_officer: "District Protection Cell: 0612-2200192"
  };

  const handleReadAloud = () => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const text = `We are here with you. ${message || ''} Please call the National Helpline at ${info.nhaa_helpline}, or KIRAN at ${info.hotline}, or National Emergency at ${info.emergency_contact}. Your welfare officer has been alerted.`;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="glass-card rounded-3xl border-2 border-red-200/60 shadow-glass p-6 space-y-5 animate-slide-up">
      {/* Banner */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-red-50/80 border border-red-200/60">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-7 h-7 text-alert flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-alert text-base">We are here with you</h3>
            <p className="text-xs text-ink/80 mt-1 leading-relaxed">
              {message || "Your check-in indicates distress. Immediate supportive intervention has been prioritized for you."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReadAloud}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-200 text-alert text-xs font-bold hover:bg-red-50 transition-colors flex-shrink-0"
        >
          {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{isSpeaking ? 'Stop' : 'Listen'}</span>
        </button>
      </div>

      <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
        <HeartHandshake className="w-4 h-4 text-brand" /> Emergency & Support Contacts
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { bg: 'bg-brand-soft border-blue-100', titleColor: 'text-brand', icon: <PhoneCall className="w-4 h-4" />, title: 'NHAA National Helpline', number: info.nhaa_helpline, sub: 'Toll-free 24/7' },
          { bg: 'bg-brand-soft border-blue-100', titleColor: 'text-brand', icon: <PhoneCall className="w-4 h-4" />, title: 'KIRAN Mental Health', number: info.hotline, sub: 'Free psychological support' },
          { bg: 'bg-amber-50 border-amber-100', titleColor: 'text-amber-800', icon: <AlertCircle className="w-4 h-4" />, title: 'National Emergency', number: info.emergency_contact, sub: 'Immediate dispatch' },
          { bg: 'bg-blue-50/60 border-blue-100/60', titleColor: 'text-ink', icon: null, title: 'District Nodal Cell', number: info.local_nodal_officer, sub: 'PoA Case Officer' },
        ].map((item, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${item.bg} space-y-1.5`}>
            <div className={`flex items-center gap-2 text-xs font-semibold ${item.titleColor}`}>
              {item.icon} {item.title}
            </div>
            <div className="text-sm font-bold text-ink">{item.number}</div>
            <div className="text-xs text-muted">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100/60 text-xs text-muted space-y-1">
        <p className="font-semibold text-ink">What happens next?</p>
        <p>• Your Nodal Case Officer has been alerted in real time.</p>
        <p>• A verified district social worker may contact you shortly.</p>
        <p>• All communications are strictly confidential under the PoA Act.</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted hover:text-ink rounded-xl border border-blue-100 hover:bg-white/60 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Submit another check-in
        </button>
      </div>
    </div>
  );
}
