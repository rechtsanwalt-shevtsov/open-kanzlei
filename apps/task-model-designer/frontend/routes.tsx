import { Navigate, Route, useParams } from 'react-router-dom';
import { AdminRoute } from '@shell/components/AdminRoute.js';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { TaskModelDetailPage } from './pages/TaskModelDetailPage.js';
import { TaskModelFormPage } from './pages/TaskModelFormPage.js';
import { TaskModelsListPage } from './pages/TaskModelsListPage.js';

function TaskModelEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/apps/task-model-designer/${id ?? ''}`} replace />;
}

export const appKey = 'task-model-designer';

export const appRoutes = (
  <Route element={<AdminRoute />}>
    <Route path="apps/task-model-designer" element={<TaskModelsListPage />} />
    <Route path="apps/task-model-designer/new" element={<TaskModelFormPage />} />
    <Route path="apps/task-model-designer/settings" element={<AppSettingsPage />} />
    <Route path="apps/task-model-designer/:id/edit" element={<TaskModelEditRedirect />} />
    <Route path="apps/task-model-designer/:id" element={<TaskModelDetailPage />} />
  </Route>
);
