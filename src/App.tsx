import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './auth/ProtectedRoute'
import SignIn from './pages/SignIn'
import Accept from './pages/Accept'
import Home from './pages/Home'
import SettingsUsers from './pages/SettingsUsers'
import CareersLayout from './careers/CareersLayout'
import CareersList from './careers/CareersList'
import JobPage from './careers/JobPage'
import ApplySuccess from './careers/ApplySuccess'
import TemplatesList from './templates/TemplatesList'
import TemplateEditorPage from './templates/TemplateEditorPage'
import TalentlyLayout from './ats/TalentlyLayout'
import CandidatesPage from './ats/CandidatesPage'
import DirectoryPage from './people/DirectoryPage'
import ProfilePage from './people/ProfilePage'

const ModulePage = ({ ns }: { ns: string }) => {
  const { t } = useTranslation(ns)
  return <h1>{t('title')}</h1>
}

export default function App() {
  return (
    <Routes>
      {/* Public: no shell, no login */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/accept/:token" element={<Accept />} />
      <Route element={<CareersLayout />}>
        <Route path="/careers" element={<CareersList />} />
        <Route path="/careers/:jobId" element={<JobPage />} />
        <Route path="/careers/:jobId/success" element={<ApplySuccess />} />
      </Route>

      {/* Signed-in app */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />

          <Route path="/talently" element={<TalentlyLayout />}>
            <Route index element={<Navigate to="/talently/templates" replace />} />
            <Route path="templates" element={<TemplatesList />} />
            <Route path="templates/new" element={<TemplateEditorPage />} />
            <Route path="templates/:id" element={<TemplateEditorPage />} />
            <Route path="candidates" element={<CandidatesPage />} />
          </Route>

          <Route path="/people" element={<Navigate to="/people/directory" replace />} />
          <Route path="/people/directory" element={<DirectoryPage />} />
          <Route path="/people/:id" element={<ProfilePage />} />

          <Route path="/onboard" element={<ModulePage ns="onboard" />} />
          <Route path="/time" element={<ModulePage ns="time" />} />
          <Route path="/settings" element={<Navigate to="/settings/users" replace />} />
          <Route path="/settings/users" element={<SettingsUsers />} />
        </Route>
      </Route>
    </Routes>
  )
}