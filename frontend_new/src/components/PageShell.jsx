import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * PageShell — the main layout wrapper for all pages.
 * Renders the sidebar + top bar + main content area.
 */
export default function PageShell({ children, footer }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #E8F2FF 0%, #EDF6FF 40%, #F3F9FF 100%)' }}>
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto h-full">
          {children}
        </main>

        {/* Optional footer */}
        {footer && (
          <footer className="px-6 py-4 flex items-center justify-between text-[11px] text-muted border-t border-blue-100/30">
            <div className="flex items-center gap-2">
              <span className="text-muted-light">⊕</span>
              <span>Ministry of Social Justice and Empowerment</span>
            </div>
            <span>Saathi Portal · 2026</span>
          </footer>
        )}
      </div>
    </div>
  );
}
