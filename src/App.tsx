import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AppLayout from './components/AppLayout'

const Home = () => {
  const { t } = useTranslation()
  return <h1>{t('nav.home')}</h1>
}


const ModulePage = ({ ns }: { ns: string }) => {
  const { t } = useTranslation(ns)
  return <h1>{t('title')}</h1>
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/talently" element={<ModulePage ns="talently" />} />
        <Route path="/people" element={<ModulePage ns="people" />} />
        <Route path="/onboard" element={<ModulePage ns="onboard" />} />
        <Route path="/time" element={<ModulePage ns="time" />} />
        <Route path="/settings" element={<ModulePage ns="settings" />} />
      </Route>
    </Routes>
  )
}