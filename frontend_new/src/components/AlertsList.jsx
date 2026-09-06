import React from 'react';
import { AlertTriangle, Clock, CheckCircle, ChevronRight, User, FileText, PhoneCall, Radio, MessageCircle, Smartphone } from 'lucide-react';

function ChannelIcon({ channel }) {
  if (!channel) return <PhoneCall className="w-3 h-3 text-brand" />;
  if (channel.includes('NHAA')) return <PhoneCall className="w-3 h-3 text-emerald-600" />;
  if (channel.includes('IVRS')) return <Radio className="w-3 h-3 text-amber-600" />;
  if (channel.includes('Chatbot')) return <MessageCircle className="w-3 h-3 text-purple-600" />;
  return <Smartphone className="w-3 h-3 text-brand" />;
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-2xl border border-blue-100/60 glass-card space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-28 bg-blue-100 rounded-lg" />
        <div className="h-4 w-12 bg-blue-100 rounded-lg" />
      </div>
      <div className="h-3 w-3/4 bg-blue-50 rounded-lg" />
    </div>
  );
}

export default function AlertsList({ alerts, selectedAlertId, onSelectAlert, loading }) {
  if (loading) {
    return (
      <div className="glass-card rounded-3xl border border-white/80 shadow-glass p-4 space-y-3">
        <div className="h-5 w-36 bg-blue-100 rounded-lg animate-pulse mb-4" />
        {[1, 2, 3].map(n => <SkeletonCard key={n} />)}
      </div>
    );
  }

  if (!alerts?.length) {
    return (
      <div className="glass-card rounded-3xl border border-white/80 shadow-glass p-10 text-center">
        <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h4 className="font-semibold text-ink text-sm">No active alerts</h4>
        <p className="text-xs text-muted mt-1">All cases reviewed for this filter.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl border border-white/80 shadow-glass p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-blue-100/60">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-alert" />
          <h3 className="font-bold text-sm text-ink">Priority Case Stream</h3>
        </div>
        <span className="bg-brand-soft text-brand text-xs font-bold px-2.5 py-0.5 rounded-xl">
          {alerts.length} alerts
        </span>
      </div>

      <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-0.5">
        {alerts.map((alert) => {
          const isSelected = selectedAlertId === alert.id;
          const isCritical = alert.distress_score >= 85;
          const isHigh = alert.distress_score >= 70 && !isCritical;
          const isAcknowledged = alert.status === 'ACKNOWLEDGED';

          return (
            <div
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className={`
                p-4 rounded-2xl border cursor-pointer transition-all duration-200
                ${isSelected
                  ? 'bg-white border-brand/30 shadow-glass ring-2 ring-brand/20'
                  : 'bg-white/50 border-blue-100/60 hover:bg-white/80 hover:border-blue-200'}
              `}
            >
              {/* Name & score */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-brand-soft flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-brand" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink leading-tight">{alert.person_name}</div>
                    <div className="text-[11px] text-muted font-mono">{alert.person_id}</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-xl text-xs font-bold flex-shrink-0 ${
                  isCritical ? 'bg-alert-soft text-alert' :
                  isHigh ? 'bg-amber-100 text-amber-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {alert.distress_score}
                </span>
              </div>

              {/* Category + Channel */}
              {(alert.category || alert.channel) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {alert.category && (
                    <span className="text-[10px] bg-brand-soft text-brand px-2 py-0.5 rounded-lg font-semibold border border-blue-100">
                      {alert.category}
                    </span>
                  )}
                  {alert.channel && (
                    <span className="text-[10px] text-muted border border-blue-100/60 px-2 py-0.5 rounded-lg flex items-center gap-1 bg-white/60">
                      <ChannelIcon channel={alert.channel} /> {alert.channel}
                    </span>
                  )}
                </div>
              )}

              {/* Snippet */}
              {alert.last_checkin_text && (
                <div className="mt-2 p-2 rounded-xl bg-blue-50/50 text-xs text-muted/90 italic flex items-start gap-1.5 border border-blue-100/40">
                  <FileText className="w-3.5 h-3.5 text-muted-light flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">"{alert.last_checkin_text}"</span>
                </div>
              )}

              {/* Flag reasons */}
              {alert.flag_reasons?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {alert.flag_reasons.map((r, i) => (
                    <span key={i} className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-lg">
                      {r}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-blue-100/40 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-1 font-medium">
                  {isAcknowledged ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Done
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg font-semibold">Review</span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
