import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePrivateMode } from '../context/PrivateModeContext';
import { Heart, LayoutGrid, Lock, LogOut, PhoneCall, ShieldCheck, EyeOff } from 'lucide-react';

export default function Sidebar({ open, setOpen }) {
  const { user, logout } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const { privateMode, togglePrivateMode } = usePrivateMode();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCheckin = location.pathname === '/checkin';
  const isDashboard = location.pathname === '/dashboard';

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-64 sidebar-glass
          flex flex-col shadow-sidebar
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto lg:flex
        `}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center shadow-orb-sm flex-shrink-0">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <div className="text-base font-bold text-ink">Saathi</div>
              <div className="text-[10px] text-muted leading-tight font-medium">
                Ministry of Social Justice<br />and Empowerment
              </div>
            </div>
          </div>
        </div>

        {/* Nav items — role-gated */}
        <nav className="px-3 space-y-1 flex-1">
          {/* Check in — visible to victims only */}
          {user?.role === 'victim' && (
            <Link
              to="/checkin"
              onClick={() => setOpen(false)}
              className={`nav-item ${isCheckin ? 'nav-item-active' : ''}`}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isCheckin ? 'bg-brand-soft text-brand' : 'text-muted-light'}`}>
                <Heart className="w-4 h-4" />
              </span>
              <span className={`text-sm font-semibold ${isCheckin ? 'text-brand' : 'text-muted'}`}>
                Check in
              </span>
            </Link>
          )}

          {/* Officer view — visible to officers only */}
          {user?.role === 'officer' && (
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className={`nav-item ${isDashboard ? 'nav-item-active' : ''}`}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isDashboard ? 'bg-brand-soft text-brand' : 'text-muted-light'}`}>
                <LayoutGrid className="w-4 h-4" />
              </span>
              <span className={`text-sm font-semibold ${isDashboard ? 'text-brand' : 'text-muted'}`}>
                Officer view
              </span>
            </Link>
          )}
        </nav>

        {/* Monitoring overview card */}
        <div className="mx-3 mb-4">
          <div className="rounded-2xl p-4 glass-card border border-blue-100/60 shadow-glass">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">
              Monitoring Overview
            </div>
            <p className="text-xs font-semibold text-ink leading-snug mb-3">
              Your words are handled with care
            </p>
            <div className="space-y-1.5 text-xs text-muted">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                <span>No judgement</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                <span>Human support when needed</span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                <span className="font-semibold text-brand">NHAA 14566</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Private mode (victims only) + logout */}
        <div className="px-4 pb-5 border-t border-blue-100/50 pt-4 space-y-3">

          {/* Private mode toggle — victims only */}
          {user?.role === 'victim' && (
            <button
              onClick={togglePrivateMode}
              className={`w-full flex items-center gap-2 text-xs font-semibold rounded-2xl px-3 py-2.5 transition-all border ${
                privateMode
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                  : 'bg-white/60 text-muted border-blue-100 hover:bg-white/90 hover:text-ink'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Private mode</span>
              {/* Pill switch */}
              <span className="ml-auto flex-shrink-0">
                <span
                  className={`relative inline-flex h-4 w-7 rounded-full transition-colors ${
                    privateMode ? 'bg-white/30' : 'bg-blue-100'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full shadow transition-transform ${
                      privateMode ? 'translate-x-3 bg-white' : 'translate-x-0 bg-brand'
                    }`}
                  />
                </span>
              </span>
            </button>
          )}

          {/* Active private mode badge */}
          {user?.role === 'victim' && privateMode && (
            <div className="px-3 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-[10px] text-indigo-800 leading-snug">
              <span className="font-bold block mb-0.5">🔒 Anonymous mode ON</span>
              Your check-in will not include your name, ID, or location. Officers see only a distress score.
            </div>
          )}

          {user && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 text-xs text-muted hover:text-alert transition-colors py-1"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">Sign out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
