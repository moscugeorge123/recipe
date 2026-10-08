import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ImportDetailPage } from './pages/ImportDetailPage';
import { ImportsPage } from './pages/ImportsPage';
import { LogsPage } from './pages/LogsPage';
import { OverviewPage } from './pages/OverviewPage';
import { UsagePage } from './pages/UsagePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="imports/:jobId" element={<ImportDetailPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="*" element={<MissingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function MissingPage() {
  return (
    <header className="page-header">
      <p className="page-kicker">Missing</p>
      <h1>That page is not in the ledger</h1>
    </header>
  );
}
