import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { PrivateModeProvider } from './context/PrivateModeContext';
import LoginPage from './pages/LoginPage';
import CheckinPage from './pages/CheckinPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PrivateModeProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/checkin" element={<CheckinPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
        </PrivateModeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
