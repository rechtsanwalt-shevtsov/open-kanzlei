import { Route } from 'react-router-dom';
import { AppSettingsPage } from './pages/AppSettingsPage.js';
import { ActorDetailPage } from './pages/ActorDetailPage.js';
import { ActorsListPage } from './pages/ActorsListPage.js';

export const appKey = 'actors';

export const appRoutes = (
  <>
    <Route path="apps/actors" element={<ActorsListPage />} />
    <Route path="apps/actors/settings" element={<AppSettingsPage />} />
    <Route path="apps/actors/:id" element={<ActorDetailPage />} />
  </>
);
