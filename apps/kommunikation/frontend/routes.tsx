import { Route } from 'react-router-dom';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { MessageDetailPage } from './pages/MessageDetailPage.js';
import { MessagesListPage } from './pages/MessagesListPage.js';

export const appKey = 'kommunikation';

export const appRoutes = (
  <>
    <Route path="apps/kommunikation" element={<MessagesListPage />} />
    <Route path="apps/kommunikation/settings" element={<AppSettingsPage />} />
    <Route path="apps/kommunikation/:id" element={<MessageDetailPage />} />
  </>
);
