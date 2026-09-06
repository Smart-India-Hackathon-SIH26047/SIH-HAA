import React, { useState, useEffect } from 'react';
import { getPersonHistory, acknowledgeAlert, logCaseEvent } from '../api/client';
import TrendChart from './TrendChart';
import {
  CheckCircle2, XCircle, Calendar, Shield, MapPin, FileText, Send, AlertTriangle, Info,
  Brain, Mic, ShieldAlert, Sparkles, Activity, PlusCircle, Check, MessageSquare
} from 'lucide-react';

export default function CaseDetail({ alert, currentOfficerId, onAlertAcknowledged }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [submittingAck, setSubmittingAck] = useState(false);
  const [ackSuccess, setAckSuccess] = useState(false);
  const [activeInterventions, setActiveInterventions] = useState({});
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  useEffect(() => {
    if (!alert) return;
    let isMounted = true;
    setLoading(true);
    setDecision(null);
    setReason('');
    setAckSuccess(false);
    setActiveInterventions({});
    getPersonHistory(alert.person_id, currentOfficerId)
      .then((data) => { if (isMounted) { setHistory(data); setLoading(false); } })
      .catch(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [alert, currentOfficerId]);

  if (!alert) {
    return (
      <div className="glass-card rounded-3xl border border-white/80 shadow-glass p-12 text-center">
        <Info className="w-10 h-10 text-blue-200 mx-auto mb-3" />
        <h3 className="font-semibold text-ink text-sm">Select a case alert to inspect</h3>
        <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
          Choose an alert from the left to review distress trends and issue decisions.
        </p>
      </div>
    );
  }

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    if (!decision || (decision === 'DISAGREE' && !reason.trim())) return;
    setSubmittingAck(true);
    try {
      await acknowledgeAlert(alert.id, currentOfficerId, decision, reason.trim());
      setAckSuccess(true);
      onAlertAcknowledged?.(alert.id, decision, reason.trim());
    } finally {
      setSubmittingAck(false);
    }
  };

  const handleTriggerIntervention = (intId, title) => {
    setActiveInterventions(prev => ({ ...prev, [intId]: true }));
    logCaseEvent({ person_id: alert.person_id, label: `Intervention: ${title}`, description: `Triggered by ${currentOfficerId}`, officer_id: currentOfficerId });
  };

  const handleLogEventSubmit = async (e) => {
    e.preventDefault();
    if (!newEventLabel.trim()) return;
    await logCaseEvent({ person_id: alert.person_id, label: newEventLabel.trim(), description: newEventDesc.trim(), officer_id: currentOfficerId });
    setHistory(prev => {
      if (!prev) return prev;
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      return {
        ...prev,
        timeline: [...prev.timeline, { date: today, distress_score: alert.distress_score, event: newEventLabel.trim() }],
        case_events: [...prev.case_events, { date: today, label: newEventLabel.trim(), description: newEventDesc.trim() }]
      };
    });
    setNewEventLabel(''); setNewEventDesc(''); setShowAddEvent(false);
  };

  const emotionAi = history?.emotion_ai || { anxiety: 80, fear: 74, hopelessness: 68, voice_stress: "ELEVATED" };

  return (
    <div className="glass-card rounded-3xl border border-white/80 shadow-glass p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-blue-100/60">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-ink">{alert.person_name}</h2>
            <span className="bg-brand-soft text-brand text-xs font-bold px-2.5 py-0.5 rounded-xl border border-blue-100">{alert.person_id}</span>
            {history?.category && (
              <span className="bg-alert-soft text-alert text-[11px] font-bold px-2 py-0.5 rounded-lg border border-red-200">{history.category}</span>
            )}
          </div>
          {history && (
            <div className="flex items-center gap-3 flex-wrap mt-1.5 text-xs text-muted">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-brand" /> {history.district}</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-brand" /> {history.case_ref}</span>
              <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">
                {history.channel}
              </span>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-muted font-medium">Dynamic Distress</div>
          <div className={`text-3xl font-black ${alert.distress_score >= 80 ? 'text-alert' : 'text-brand'}`}>
            {alert.distress_score}<span className="text-xs text-muted font-normal">/100</span>
          </div>
        </div>
      </div>

      {/* Latest Victim Check-in Message */}
      {alert.last_checkin_text && (
        <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-xs space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-brand text-xs">
              <MessageSquare className="w-4 h-4 text-brand" /> Latest Submitted Check-in / Problem
            </div>
            <span className="text-[10px] bg-white text-brand px-2 py-0.5 rounded-lg border border-blue-100 font-semibold">
              {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Real-time update'}
            </span>
          </div>
          <p className="text-ink font-semibold leading-relaxed bg-white/90 p-3 rounded-xl border border-blue-100/80 shadow-xs italic text-sm">
            "{alert.last_checkin_text}"
          </p>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs text-muted animate-pulse">Loading case analytics…</div>
      ) : (
        <>
          {history && <TrendChart timeline={history.timeline} caseEvents={history.case_events} />}

          {/* Emotion AI Panel */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/60 border border-blue-100/60 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                <Brain className="w-4 h-4" /> Emotion AI & Voice Stress Analytics
              </h4>
              <span className="text-[10px] bg-white text-brand border border-blue-100 px-2 py-0.5 rounded-lg font-semibold">NLP Engine</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Anxiety', value: emotionAi.anxiety, color: 'bg-amber-500' },
                { label: 'Fear / Threat', value: emotionAi.fear, color: 'bg-alert' },
                { label: 'Hopelessness', value: emotionAi.hopelessness, color: 'bg-purple-600' },
              ].map((m) => (
                <div key={m.label} className="bg-white/80 p-3 rounded-xl border border-blue-100/60">
                  <div className="text-[10px] text-muted font-medium">{m.label}</div>
                  <div className="text-sm font-extrabold text-ink mt-0.5">{m.value}%</div>
                  <div className="w-full bg-blue-50 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className={`${m.color} h-full rounded-full`} style={{ width: `${m.value}%` }} />
                  </div>
                </div>
              ))}
              <div className="bg-white/80 p-3 rounded-xl border border-blue-100/60">
                <div className="text-[10px] text-muted font-medium flex items-center gap-1"><Mic className="w-3 h-3 text-brand" /> Voice Pitch</div>
                <div className="text-xs font-bold text-alert mt-1 truncate">{emotionAi.voice_stress}</div>
              </div>
            </div>
          </div>

          {/* XAI + Forecast */}
          {history?.xai_rationale && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Sparkles className="w-4 h-4 text-amber-600" /> Explainable AI (XAI)
                </div>
                <p className="text-amber-900/90 leading-relaxed">{history.xai_rationale}</p>
              </div>
              <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200/60 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-alert">
                  <Activity className="w-4 h-4" /> 30-Day Prediction
                </div>
                <p className="text-red-900/90 leading-relaxed">{history.predictive_forecast}</p>
              </div>
            </div>
          )}

          {/* AI Recommended Interventions */}
          {history?.recommended_interventions && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand" /> AI Recommended Interventions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {history.recommended_interventions.map((item) => {
                  const done = activeInterventions[item.id];
                  return (
                    <div key={item.id} className="p-3.5 rounded-2xl bg-white/80 border border-blue-100/60 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-semibold text-xs text-ink leading-tight">{item.title}</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-lg flex-shrink-0 ${item.priority === 'URGENT' ? 'bg-alert-soft text-alert' : 'bg-brand-soft text-brand'}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted leading-snug">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => !done && handleTriggerIntervention(item.id, item.title)}
                        className={`w-full py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${done ? 'bg-emerald-100 text-emerald-800 cursor-default' : 'bg-brand text-white hover:bg-brand-mid'}`}
                      >
                        {done ? <><Check className="w-3.5 h-3.5" /> Dispatched</> : <><PlusCircle className="w-3.5 h-3.5" /> Trigger</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Case Events */}
          {history?.case_events && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand" /> Case Events
                </h4>
                <button type="button" onClick={() => setShowAddEvent(!showAddEvent)} className="text-xs text-brand hover:underline font-semibold">
                  {showAddEvent ? 'Cancel' : '+ Log Event'}
                </button>
              </div>
              {showAddEvent && (
                <form onSubmit={handleLogEventSubmit} className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-2 text-xs">
                  <input type="text" placeholder="Event title…" value={newEventLabel} onChange={e => setNewEventLabel(e.target.value)} className="w-full border border-blue-100 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand/30" required />
                  <textarea placeholder="Description…" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} rows={2} className="w-full border border-blue-100 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand/30 resize-none" />
                  <button type="submit" className="px-4 py-1.5 bg-brand text-white font-semibold rounded-xl text-xs">Save</button>
                </form>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {history.case_events.map((evt, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-white/70 border border-blue-100/60 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-ink">
                      <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-brand" /> {evt.label}</span>
                      <span className="text-[10px] text-muted">{evt.date}</span>
                    </div>
                    <p className="text-muted leading-relaxed">{evt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acknowledge */}
          <div className="border-t border-blue-100/60 pt-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Officer Decision
            </h4>
            {ackSuccess || alert.status === 'ACKNOWLEDGED' ? (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Acknowledged ({alert.decision || decision})
                </div>
                <p className="text-emerald-800">Reviewed by: <span className="font-mono font-semibold">{alert.reviewer_ref || currentOfficerId}</span></p>
                {(alert.reason || reason) && (
                  <p className="mt-1 bg-white/80 p-2 rounded-xl border border-emerald-200 text-ink italic">"{alert.reason || reason}"</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleAcknowledge} className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/60 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold text-ink">Assessment:</span>
                  {[
                    { val: 'AGREE', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Agree with Risk', active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50' },
                    { val: 'DISAGREE', icon: <XCircle className="w-4 h-4" />, label: 'Disagree / FP', active: 'bg-alert text-white border-alert', inactive: 'bg-white text-alert border-red-300 hover:bg-red-50' },
                  ].map(btn => (
                    <button key={btn.val} type="button" onClick={() => setDecision(btn.val)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${decision === btn.val ? btn.active : btn.inactive}`}>
                      {btn.icon} {btn.label}
                    </button>
                  ))}
                </div>
                {decision === 'DISAGREE' && (
                  <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Required: Reason for disagreement…" required
                    className="w-full text-xs p-3 rounded-xl border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-alert/20 resize-none" />
                )}
                {decision === 'AGREE' && (
                  <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Optional: interventions planned…"
                    className="w-full text-xs p-2.5 rounded-xl border border-blue-100 bg-white focus:outline-none focus:ring-1 focus:ring-brand/30" />
                )}
                <div className="flex justify-end">
                  <button type="submit"
                    disabled={!decision || (decision === 'DISAGREE' && !reason.trim()) || submittingAck}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                    {submittingAck ? 'Submitting…' : <>Submit Decision <Send className="w-3.5 h-3.5" /></>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
