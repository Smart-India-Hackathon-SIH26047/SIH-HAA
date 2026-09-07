import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ROLES } from "@/auth/AuthProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from "@/auth/guards";
import VictimLayout from "@/layouts/VictimLayout";
import OfficerLayout from "@/layouts/OfficerLayout";
import LoginPage from "@/pages/auth/LoginPage";
import RoleSelectPage from "@/pages/auth/RoleSelectPage";
import LandingPage from "@/pages/LandingPage";
import CheckinPage from "@/pages/victim/CheckinPage";
import StatusPage from "@/pages/victim/StatusPage";
import SupportPage from "@/pages/victim/SupportPage";
import DashboardPage from "@/pages/officer/DashboardPage";
import CaseDetailPage from "@/pages/officer/CaseDetailPage";
import AlertReviewPage from "@/pages/officer/AlertReviewPage";
import NotFoundPage from "@/pages/NotFoundPage";

/**
 * Login-gated, then split by role.
 *
 * Two route trees behind one gate. Nothing from the officer side (bands,
 * scores, alerts) is reachable from the victim side, and the two never share
 * a layout.
 */
export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes>
        {/* Public marketing page — reachable signed out or in. */}
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />

        {/* Signed in, but role not yet chosen. Outside RequireAuth, which
            would otherwise bounce back here forever. */}
        <Route path="/choose-role" element={<RoleSelectPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireRole role={ROLES.VICTIM} />}>
            <Route element={<VictimLayout />}>
              <Route path="/check-in" element={<CheckinPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/support" element={<SupportPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole role={ROLES.OFFICER} />}>
            <Route path="/officer" element={<OfficerLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="cases/:personId" element={<CaseDetailPage />} />
              <Route path="alerts" element={<AlertReviewPage />} />
            </Route>
          </Route>
        </Route>

          <Route path="/dashboard" element={<Navigate to="/officer" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}
