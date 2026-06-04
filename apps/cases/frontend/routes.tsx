import { Route } from 'react-router-dom';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { CaseDetailPage } from './pages/CaseDetailPage.js';
import { CasesListPage } from './pages/CasesListPage.js';

export const appKey = 'cases';

export const appRoutes = (
  <>
    <Route path="apps/cases" element={<CasesListPage />} />
    <Route path="apps/cases/settings" element={<AppSettingsPage />} />
    <Route path="apps/cases/:id" element={<CaseDetailPage />} />
  </>
);
