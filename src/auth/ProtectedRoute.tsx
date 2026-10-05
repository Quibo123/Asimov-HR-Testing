import { Navigate, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './authContext'

export default function ProtectedRoute() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()

  if (loading) return <p>{t('loading')}</p>
  return session ? <Outlet /> : <Navigate to="/signin" replace />
}