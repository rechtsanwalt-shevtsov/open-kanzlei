import { Route } from 'react-router-dom';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { KanbanBoardPage } from './pages/KanbanBoardPage.js';

export const appKey = 'tasks-kanban';

export const appRoutes = (
  <>
    <Route path="apps/tasks-kanban" element={<KanbanBoardPage />} />
    <Route path="apps/tasks-kanban/settings" element={<AppSettingsPage />} />
  </>
);
