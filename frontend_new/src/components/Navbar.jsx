import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Shield, User, LogOut, MessageSquare, LayoutDashboard, LogIn, Globe, PhoneCall } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <nav className="bg-white border-b border-line px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
      {/* Brand logo & Ministry title */}
      <Link to="/" className="flex items-center gap-3 group">
        <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-extrabold text-sm group-hover:bg-brand/90 transition-colors shadow-2xs">
          S
        </div>
        <div>
          <h1 className="text-sm font-bold text-ink leading-tight flex items-center gap-2">
            {t('portalTitle')}
            <span className="bg-brand-soft text-brand text-[10px] font-semibold px-2 py-0.5 rounded">
              SIH • MSJE
            </span>
          </h1>
          <p className="text-[10px] text-muted leading-none flex items-center gap-1.5 mt-0.5">
            <span>{t('portalSubtitle')}</span>
            <span className="hidden lg:inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
              <PhoneCall className="w-2.5 h-2.5" /> NHAA 14566
            </span>
          </p>
        </div>
      </Link>

      {/* Right Navigation & Session controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Language Switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line bg-paper text-xs font-semibold text-ink hover:bg-brand-soft hover:text-brand transition-colors"
          title="Switch Language (English / हिंदी)"
        >
          <Globe className="w-3.5 h-3.5 text-brand" />
          <span>{lang === 'en' ? 'हिंदी' : 'English'}</span>
        </button>

        {user ? (
          <>
            {/* Navigation tabs */}
            <div className="hidden md:flex items-center gap-1 bg-paper p-1 rounded-xl border border-line">
              <Link
                to="/checkin"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  location.pathname === '/checkin'
                    ? 'bg-white text-brand shadow-xs border border-line'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Check-in
              </Link>
              <Link
                to="/dashboard"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  location.pathname === '/dashboard'
                    ? 'bg-white text-brand shadow-xs border border-line'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </Link>
            </div>

            {/* Active User Badge */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-brand-soft/60 border border-brand/20">
              <div className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold">
                {user.role === 'officer' ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-ink leading-none">{user.name}</div>
                <div className="text-[10px] text-brand uppercase tracking-wider font-bold">
                  {user.role === 'officer' ? `Officer (${user.id})` : `Beneficiary (${user.id})`}
                </div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-muted hover:text-alert hover:bg-red-50 transition-colors"
              title="Logout Session"
            >
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </>
        ) : (
          !isLoginPage && (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Portal Login
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
