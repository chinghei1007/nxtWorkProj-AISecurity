import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useSession } from "./hooks/use-session";
import { ForcePasswordPage } from "./pages/ForcePasswordPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { ScanDetailPage } from "./pages/ScanDetailPage";
import { ScanPage } from "./pages/ScanPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        Loading secure workspace…
      </div>
    </div>
  );
}

function Protected() {
  const session = useSession();
  if (session.isLoading) return <LoadingScreen />;
  if (!session.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function ReadyOnly() {
  const session = useSession();
  if (session.data?.user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

function PasswordChangeOnly() {
  const session = useSession();
  if (!session.data?.user.mustChangePassword) return <Navigate to="/scan" replace />;
  return <ForcePasswordPage />;
}

function AdminOnly() {
  const session = useSession();
  if (session.data?.user.role !== "ADMIN") return <Navigate to="/scan" replace />;
  return <Outlet />;
}

function LoginRoute() {
  const session = useSession();
  const location = useLocation();
  if (session.isLoading) return <LoadingScreen />;
  if (session.data) {
    return (
      <Navigate
        to={session.data.user.mustChangePassword ? "/change-password" : "/scan"}
        state={{ from: location }}
        replace
      />
    );
  }
  return <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<Protected />}>
        <Route path="/change-password" element={<PasswordChangeOnly />} />
        <Route element={<ReadyOnly />}>
          <Route element={<AppShell />}>
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:id" element={<ScanDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route element={<AdminOnly />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="*" element={<Navigate to="/scan" replace />} />
    </Routes>
  );
}
