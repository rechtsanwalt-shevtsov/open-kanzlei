import { Navigate, Route, useParams } from 'react-router-dom';
import { AdminRoute } from '@shell/components/AdminRoute.js';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { ActorModelDetailPage } from './pages/ActorModelDetailPage.js';
import { ActorModelFormPage } from './pages/ActorModelFormPage.js';
import { ActorModelsListPage } from './pages/ActorModelsListPage.js';

function ActorModelEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/apps/actor-model-designer/${id ?? ''}`} replace />;
}

export const appKey = 'actor-model-designer';

export const appRoutes = (
  <Route element={<AdminRoute />}>
    <Route path="apps/actor-model-designer" element={<ActorModelsListPage />} />
    <Route path="apps/actor-model-designer/new" element={<ActorModelFormPage />} />
    <Route path="apps/actor-model-designer/settings" element={<AppSettingsPage />} />
    <Route path="apps/actor-model-designer/:id/edit" element={<ActorModelEditRedirect />} />
    <Route path="apps/actor-model-designer/:id" element={<ActorModelDetailPage />} />
  </Route>
);
