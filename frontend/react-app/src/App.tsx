import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { GuestRoute } from './components/GuestRoute.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { AuthProvider } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { I18nProvider } from './i18n/I18nContext.js';
import { HomePage } from './pages/HomePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { AdminRoute } from './components/AdminRoute.js';
import { AdminAppsPage } from './pages/admin/AdminAppsPage.js';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.js';
import { ModelDetailPage } from './pages/admin/ModelDetailPage.js';
import { ModelsPage } from './pages/admin/ModelsPage.js';
import { UsersPage } from './pages/admin/UsersPage.js';
import { CasesPage } from './pages/CasesPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { bundledAppRoutes } from './app-routes/bundled-app-routes.js';

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route element={<GuestRoute />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="cases" element={<CasesPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="profile" element={<ProfilePage />} />
                {bundledAppRoutes}
                <Route element={<AdminRoute />}>
                  <Route path="admin/settings" element={<AdminSettingsPage />} />
                  <Route path="admin/apps" element={<AdminAppsPage />} />
                  <Route path="admin/users" element={<UsersPage />} />
                  <Route path="admin/models" element={<ModelsPage />} />
                  <Route
                    path="admin/task-models/:id"
                    element={<ModelDetailPage kind="task_model" />}
                  />
                  <Route
                    path="admin/instrument-models/:id"
                    element={<ModelDetailPage kind="instrument_model" />}
                  />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
