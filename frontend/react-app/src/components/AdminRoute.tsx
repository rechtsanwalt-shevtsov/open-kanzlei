import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useI18n } from '../i18n/I18nContext.js';
import { userIsAdmin } from '../lib/is-admin.js';

export function AdminRoute() {
  const { user, loading } = useAuth();
  const { msg } = useI18n();

  if (loading) {
    return <p className="status">{msg('loading')}</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userIsAdmin(user.teams)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
