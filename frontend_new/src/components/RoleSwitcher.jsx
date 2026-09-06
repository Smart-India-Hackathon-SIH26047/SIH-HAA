import React from 'react';
import { UserCheck, Shield } from 'lucide-react';

export const TEST_OFFICERS = [
  { id: "OFF-01", name: "Officer Vikram Singh", role: "Nodal Case Officer", dept: "Patna Division" },
  { id: "OFF-02", name: "Dr. Ananya Sen", role: "Senior Social Worker", dept: "Welfare Cell" },
  { id: "OFF-03", name: "Dr. Rajiv Sharma", role: "Mental Health Specialist", dept: "Clinical Care" },
  { id: "OFF-04", name: "Priya Nair", role: "DM Legal Aid Delegate", dept: "Judicial Support" },
];

export default function RoleSwitcher({ currentOfficerId, onOfficerChange }) {
  const currentOfficer = TEST_OFFICERS.find(o => o.id === currentOfficerId) || TEST_OFFICERS[0];

  return (
    <div className="glass-card rounded-2xl border border-white/80 shadow-glass p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-soft border border-blue-100 flex items-center justify-center text-brand flex-shrink-0">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand uppercase tracking-wider">Authenticated Role</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">ACTIVE</span>
          </div>
          <p className="text-sm font-semibold text-ink leading-tight">{currentOfficer.name}</p>
          <p className="text-xs text-muted">{currentOfficer.role} · {currentOfficer.dept}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-blue-100/50">
        <UserCheck className="w-4 h-4 text-muted hidden sm:block flex-shrink-0" />
        <select
          id="officer-select"
          value={currentOfficerId}
          onChange={(e) => onOfficerChange(e.target.value)}
          className="w-full sm:w-auto bg-blue-50/50 text-xs font-medium text-ink border border-blue-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {TEST_OFFICERS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id} – {o.name} ({o.role})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
