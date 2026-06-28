import { Navigate, Route, useParams } from 'react-router-dom';
import { AdminRoute } from '@shell/components/AdminRoute.js';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { MessageModelDetailPage } from './pages/MessageModelDetailPage.js';
import { MessageModelFormPage } from './pages/MessageModelFormPage.js';
import { MessageModelsListPage } from './pages/MessageModelsListPage.js';

function MessageModelEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/apps/message-model-designer/${id ?? ''}`} replace />;
}

export const appKey = 'message-model-designer';

export const appRoutes = (
  <Route element={<AdminRoute />}>
    <Route path="apps/message-model-designer" element={<MessageModelsListPage />} />
    <Route path="apps/message-model-designer/new" element={<MessageModelFormPage />} />
    <Route path="apps/message-model-designer/settings" element={<AppSettingsPage />} />
    <Route path="apps/message-model-designer/:id/edit" element={<MessageModelEditRedirect />} />
    <Route path="apps/message-model-designer/:id" element={<MessageModelDetailPage />} />
  </Route>
);
