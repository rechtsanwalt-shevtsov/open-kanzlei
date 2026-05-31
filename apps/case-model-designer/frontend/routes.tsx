import { Navigate, Route, useParams } from 'react-router-dom';
import { AdminRoute } from '@shell/components/AdminRoute.js';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { CaseModelDetailPage } from './pages/CaseModelDetailPage.js';
import { CaseModelFormPage } from './pages/CaseModelFormPage.js';
import { CaseModelsListPage } from './pages/CaseModelsListPage.js';

function LegacyCaseModelRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/apps/case-model-designer/${id ?? ''}`} replace />;
}

export const appKey = 'case-model-designer';

export const appRoutes = (
  <Route element={<AdminRoute />}>
    <Route path="apps/case-model-designer" element={<CaseModelsListPage />} />
    <Route path="apps/case-model-designer/new" element={<CaseModelFormPage />} />
    <Route path="apps/case-model-designer/settings" element={<AppSettingsPage />} />
    <Route path="apps/case-model-designer/:id/edit" element={<CaseModelFormPage />} />
    <Route path="apps/case-model-designer/:id" element={<CaseModelDetailPage />} />
    <Route path="admin/case-models/:id" element={<LegacyCaseModelRedirect />} />
  </Route>
);
