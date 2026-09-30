import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'

const Page = ({ name }: { name: string }) => <h1>{name}</h1>

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Page name="Home" />} />
        <Route path="/talently" element={<Page name="Talently" />} />
        <Route path="/people" element={<Page name="People" />} />
        <Route path="/onboard" element={<Page name="Onboard" />} />
        <Route path="/time" element={<Page name="Time" />} />
        <Route path="/settings" element={<Page name="Settings" />} />
      </Route>
    </Routes>
  )
}