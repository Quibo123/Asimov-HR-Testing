import { Navigate, Route, Routes } from 'react-router-dom'
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
import PeopleLayout from './people/PeopleLayout'
import DirectoryPage from './people/DirectoryPage'
import OrgPage from './people/OrgPage'
import ImportPage from './people/ImportPage'
import ProfilePage from './people/ProfilePage'
import OnboardLayout from './onboard/OnboardLayout'
import OnboardTemplatesList from './onboard/TemplatesList'
import OnboardEditorPage from './onboard/TemplateEditorPage'
import BoardPage from './onboard/BoardPage'
import JoinLayout from './joiner/JoinLayout'
import JoinPage from './joiner/JoinPage'
import ClockPage from './time/ClockPage'

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
      <Route element={<JoinLayout />}>
        <Route path="/join/:token" element={<JoinPage />} />
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

          <Route path="/people" element={<PeopleLayout />}>
            <Route index element={<Navigate to="/people/directory" replace />} />
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="org" element={<OrgPage />} />
            <Route path="import" element={<ImportPage />} />
          </Route>
          <Route path="/people/:id" element={<ProfilePage />} />

          <Route path="/onboard" element={<OnboardLayout />}>
            <Route index element={<Navigate to="/onboard/templates" replace />} />
            <Route path="templates" element={<OnboardTemplatesList />} />
            <Route path="templates/new" element={<OnboardEditorPage />} />
            <Route path="templates/:id" element={<OnboardEditorPage />} />
            <Route path="board" element={<BoardPage />} />
          </Route>

          <Route path="/time" element={<ClockPage />} />
          <Route path="/settings" element={<Navigate to="/settings/users" replace />} />
          <Route path="/settings/users" element={<SettingsUsers />} />
        </Route>
      </Route>
    </Routes>
  )
}