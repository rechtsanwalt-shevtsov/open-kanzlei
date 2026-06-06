import { Route } from 'react-router-dom';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { TaskDetailPage } from './pages/TaskDetailPage.js';
import { TasksListPage } from './pages/TasksListPage.js';

export const appKey = 'tasks';

export const appRoutes = (
  <>
    <Route path="apps/tasks" element={<TasksListPage />} />
    <Route path="apps/tasks/settings" element={<AppSettingsPage />} />
    <Route path="apps/tasks/:id" element={<TaskDetailPage />} />
  </>
);
