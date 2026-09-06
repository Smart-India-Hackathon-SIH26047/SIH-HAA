import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, TEST_VICTIMS, TEST_OFFICERS_AUTH } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Heart, Shield, ArrowRight, Lock, Key, User } from 'lucide-react';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('victim');
  const [victimId, setVictimId] = useState('P101');
  const [victimPin, setVictimPin] = useState('4821');
  const [officerId, setOfficerId] = useState('OFF-01');
  const [officerPass, setOfficerPass] = useState('Nodal@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { loginAsVictim, loginAsOfficer } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleVictimSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      loginAsVictim(victimId);
      setLoading(false);
      navigate(`/checkin?person_id=${victimId}`);
    }, 400);
  };

  const handleOfficerSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      loginAsOfficer(officerId);
      setLoading(false);
      navigate('/dashboard');
    }, 400);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #E8F2FF 0%, #EDF6FF 40%, #F3F9FF 100%)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center shadow-orb-sm">
            <Heart className="w-5 h-5 text-white" fill="white" />
          </div>
          <div>
            <div className="text-sm font-bold text-ink">Saathi</div>
            <div className="text-[10px] text-muted">Ministry of Social Justice and Empowerment</div>
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur-sm rounded-xl border border-white/80 shadow-glass overflow-hidden px-1.5 py-1">
          <button
            onClick={() => lang !== 'en' && toggleLanguage()}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${lang === 'en' ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            English
          </button>
          <button
            onClick={() => lang !== 'hi' && toggleLanguage()}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${lang === 'hi' ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Main card centered */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Glowing orb visual */}
          <div className="flex justify-center mb-8">
            <div
              className="w-20 h-20 rounded-full animate-orb-pulse shadow-orb"
              style={{ background: 'radial-gradient(circle at 35% 35%, #93C5FD 0%, #3B82F6 50%, #1D4ED8 100%)' }}
            />
          </div>

          <h1 className="text-2xl font-extrabold text-ink text-center mb-1">Welcome to Saathi</h1>
          <p className="text-sm text-muted text-center mb-8">
            {lang === 'hi' ? 'आगे बढ़ने के लिए साइन इन करें' : 'Sign in to continue to your secure portal'}
          </p>

          {/* Card */}
          <div className="glass-card rounded-3xl border border-white/80 shadow-glass overflow-hidden">
            {/* Tab strip */}
            <div className="grid grid-cols-2 p-1.5 bg-blue-50/50 gap-1">
              <button
                type="button"
                onClick={() => { setActiveTab('victim'); setError(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${activeTab === 'victim' ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                <Heart className="w-3.5 h-3.5" /> Victim Portal
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('officer'); setError(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all ${activeTab === 'officer' ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                <Shield className="w-3.5 h-3.5" /> Officer Portal
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 rounded-2xl bg-alert-soft border border-red-200/60 text-xs text-alert">{error}</div>
              )}

              {/* VICTIM FORM */}
              {activeTab === 'victim' && (
                <form onSubmit={handleVictimSubmit} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Beneficiary Profile</label>
                    <select
                      value={victimId}
                      onChange={(e) => setVictimId(e.target.value)}
                      className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl px-4 py-3 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                    >
                      {TEST_VICTIMS.map((v) => (
                        <option key={v.id} value={v.id}>{v.id} · {v.name} ({v.district})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Security PIN / OTP</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={victimPin}
                        onChange={(e) => setVictimPin(e.target.value)}
                        placeholder="Enter 4-digit PIN"
                        className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl pl-10 pr-4 py-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                        required
                      />
                      <Key className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary justify-center py-3"
                  >
                    {loading ? 'Signing in…' : <><span>Enter Check-in Portal</span><ArrowRight className="w-4 h-4" /></>}
                  </button>

                  {/* Quick demo */}
                  <div className="pt-1 border-t border-blue-100/60">
                    <p className="text-[10px] text-muted-light uppercase tracking-widest mb-2 font-semibold">Quick demo</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'P101', label: 'Ramesh Kumar (P101)' }, { id: 'P103', label: 'Ankit Verma (P103)', red: true }].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => { loginAsVictim(d.id); navigate(`/checkin?person_id=${d.id}`); }}
                          className={`p-2.5 rounded-2xl text-left text-xs font-semibold transition-colors border ${d.red ? 'bg-alert-soft text-alert border-red-200/60 hover:bg-red-100' : 'bg-brand-soft text-brand border-blue-100 hover:bg-blue-100'}`}
                        >
                          {d.label} →
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {/* OFFICER FORM */}
              {activeTab === 'officer' && (
                <form onSubmit={handleOfficerSubmit} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Officer Credentials</label>
                    <select
                      value={officerId}
                      onChange={(e) => setOfficerId(e.target.value)}
                      className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl px-4 py-3 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                    >
                      {TEST_OFFICERS_AUTH.map((o) => (
                        <option key={o.id} value={o.id}>{o.id} · {o.name} ({o.role})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">Password / 2FA Token</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={officerPass}
                        onChange={(e) => setOfficerPass(e.target.value)}
                        placeholder="Enter secure password"
                        className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl pl-10 pr-4 py-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                        required
                      />
                      <Lock className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary justify-center py-3"
                  >
                    {loading ? 'Authenticating…' : <><span>Access Officer Dashboard</span><ArrowRight className="w-4 h-4" /></>}
                  </button>

                  <div className="pt-1 border-t border-blue-100/60">
                    <p className="text-[10px] text-muted-light uppercase tracking-widest mb-2 font-semibold">Quick demo</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ id: 'OFF-01', label: 'Officer Vikram' }, { id: 'OFF-03', label: 'Dr. Sharma (Specialist)', em: true }].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => { loginAsOfficer(d.id); navigate('/dashboard'); }}
                          className={`p-2.5 rounded-2xl text-left text-xs font-semibold transition-colors border ${d.em ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' : 'bg-brand-soft text-brand border-blue-100 hover:bg-blue-100'}`}
                        >
                          {d.label} →
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-light mt-5 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> Protected under SC/ST (PoA) Act, 1989 · Ministry of Social Justice
          </p>
        </div>
      </div>
    </div>
  );
}
