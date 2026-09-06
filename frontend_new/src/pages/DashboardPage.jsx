import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PageShell from '../components/PageShell';
import RoleSwitcher from '../components/RoleSwitcher';
import AlertsList from '../components/AlertsList';
import CaseDetail from '../components/CaseDetail';
import { getOfficerAlerts } from '../api/client';
import { RefreshCw, MapPin, Globe2, Building2, Filter, PhoneCall } from 'lucide-react';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [currentOfficerId, setCurrentOfficerId] = useState(user?.role === 'officer' ? user.id : 'OFF-01');
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminLevel, setAdminLevel] = useState('district');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    if (user?.role === 'officer' && user.id) setCurrentOfficerId(user.id);
  }, [user]);

  const fetchAlerts = (officerId) => {
    setLoading(true);
    getOfficerAlerts(officerId)
      .then((data) => {
        setAlerts(data);
        setSelectedAlert(data?.[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAlerts(currentOfficerId); }, [currentOfficerId]);

  const handleAlertAcknowledged = (alertId, decision, reason) => {
    const update = (a) => a.id === alertId ? { ...a, status: 'ACKNOWLEDGED', decision, reason } : a;
    setAlerts(prev => prev.map(update));
    if (selectedAlert?.id === alertId) setSelectedAlert(prev => update(prev));
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (categoryFilter === 'RAPE' && !alert.category?.includes('Rape')) return false;
    if (categoryFilter === 'WITNESS' && !alert.category?.includes('Witness')) return false;
    if (categoryFilter === 'MURDER' && !alert.category?.includes('Murder') && !alert.category?.includes('Arson')) return false;
    return true;
  });

  const LEVELS = [
    { id: 'district', label: t('districtLevel'), icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'state', label: t('stateLevel'), icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'national', label: t('nationalLevel'), icon: <Globe2 className="w-3.5 h-3.5" /> },
  ];

  const CATS = [
    { id: 'ALL', label: `All (${alerts.length})` },
    { id: 'WITNESS', label: 'Witness Intimidation' },
    { id: 'RAPE', label: 'Rape / Gang Rape' },
    { id: 'MURDER', label: 'Murder / Arson' },
  ];

  return (
    <PageShell footer>
      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-[1400px]">

        {/* Header */}
        <div className="glass-card rounded-3xl border border-white/80 shadow-glass p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-extrabold text-ink">SIH Dynamic Distress Monitoring</h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <PhoneCall className="w-3 h-3" /> NHAA 14566
                </span>
              </div>
              <p className="text-xs text-muted">SC/ST (PoA) Act 1989 • Ministry of Social Justice & Empowerment</p>
            </div>

            {/* Admin level toggle */}
            <div className="flex items-center gap-1 bg-blue-50/70 p-1 rounded-2xl border border-blue-100 self-start md:self-auto">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setAdminLevel(lvl.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${adminLevel === lvl.id ? 'bg-white text-brand shadow-sm border border-blue-100' : 'text-muted hover:text-ink'}`}
                >
                  {lvl.icon}
                  <span className="hidden sm:inline">{lvl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-blue-100/50">
            <div className="flex items-center gap-2 overflow-x-auto flex-wrap">
              <span className="text-muted text-xs font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-brand" /> PoA Category:
              </span>
              {CATS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors border ${
                    categoryFilter === c.id
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white/60 text-muted border-blue-100 hover:bg-white/90'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchAlerts(currentOfficerId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-ink bg-white/60 border border-blue-100 hover:bg-white/90 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Role switcher */}
        <RoleSwitcher currentOfficerId={currentOfficerId} onOfficerChange={setCurrentOfficerId} />

        {/* Summary pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending Alerts', value: filteredAlerts.filter(a => a.status === 'PENDING').length, color: 'text-ink' },
            { label: 'High/Critical', value: filteredAlerts.filter(a => a.distress_score >= 75).length, color: 'text-alert' },
            { label: 'Acknowledged', value: filteredAlerts.filter(a => a.status === 'ACKNOWLEDGED').length, color: 'text-emerald-700' },
            { label: 'Monitor Scope', value: adminLevel.toUpperCase(), color: 'text-brand', small: true },
          ].map((item, i) => (
            <div key={i} className="glass-card rounded-2xl border border-white/80 shadow-glass p-4">
              <div className="text-[11px] text-muted font-medium mb-1">{item.label}</div>
              <div className={`font-extrabold ${item.color} ${item.small ? 'text-xs' : 'text-2xl'}`}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Main 2-column split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-4">
            <AlertsList
              alerts={filteredAlerts}
              selectedAlertId={selectedAlert?.id}
              onSelectAlert={setSelectedAlert}
              loading={loading}
            />
          </div>
          <div className="lg:col-span-8">
            <CaseDetail
              alert={selectedAlert}
              currentOfficerId={currentOfficerId}
              onAlertAcknowledged={handleAlertAcknowledged}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
