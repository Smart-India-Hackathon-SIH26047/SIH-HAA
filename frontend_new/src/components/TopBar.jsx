import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lock, Menu, Shield, User } from 'lucide-react';

export default function TopBar({ onMenuClick }) {
  const { lang, toggleLanguage } = useLanguage();
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4">
      {/* Hamburger for mobile */}
      <button
        className="lg:hidden p-2 rounded-xl hover:bg-white/50 text-muted transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="hidden lg:block" /> {/* spacer */}

      {/* Right side controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Language switcher */}
        <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur-sm rounded-xl border border-white/80 shadow-glass overflow-hidden px-1.5 py-1">
          <button
            onClick={() => lang !== 'en' && toggleLanguage()}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              lang === 'en'
                ? 'bg-white text-brand shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            English
          </button>
          <button
            onClick={() => lang !== 'hi' && toggleLanguage()}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              lang === 'hi'
                ? 'bg-white text-brand shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            हिंदी
          </button>
        </div>

        {/* Session badge if logged in */}
        {user && (
          <div className="flex items-center gap-2 glass-card rounded-xl px-3 py-2 border border-white/80 shadow-glass">
            <div className="w-5 h-5 rounded-lg bg-brand flex items-center justify-center">
              {user.role === 'officer'
                ? <Shield className="w-3 h-3 text-white" />
                : <User className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xs font-semibold text-ink hidden sm:block">
              {user.role === 'victim' ? `${user.name} (${user.id})` : user.name}
            </span>
          </div>
        )}

        {/* Private mode button */}
        <button className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-xl border border-white/80 px-4 py-2 text-xs font-semibold text-ink hover:bg-white/90 transition-all shadow-glass">
          <Lock className="w-3.5 h-3.5 text-muted" />
          Private mode
        </button>
      </div>
    </header>
  );
}
