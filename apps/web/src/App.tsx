import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const HistoryPage = lazy(() => import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })));
const LocalReportPage = lazy(() => import("./pages/LocalReportPage").then((module) => ({ default: module.LocalReportPage })));
const OpenScanPage = lazy(() => import("./pages/OpenScanPage").then((module) => ({ default: module.OpenScanPage })));
const ScanDetailPage = lazy(() => import("./pages/ScanDetailPage").then((module) => ({ default: module.ScanDetailPage })));
const ScanPage = lazy(() => import("./pages/ScanPage").then((module) => ({ default: module.ScanPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-500">Loading AI Security Check…</div>}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<ScanDetailPage />} />
          <Route path="/archive/:localId" element={<LocalReportPage />} />
          <Route path="/open" element={<OpenScanPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/scan" replace />} />
        <Route path="*" element={<Navigate to="/scan" replace />} />
      </Routes>
    </Suspense>
  );
}
