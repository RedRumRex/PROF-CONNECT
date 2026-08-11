import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login          from './pages/Login'
import Home           from './pages/Home'
import Explore        from './pages/Explore'
import Dashboard      from './pages/Dashboard'
import Appointment    from './pages/Appointment'
import StudentProfile from './pages/StudentProfile'
import Profile        from './pages/Profile'
import Messages       from './pages/Messages'
import Settings       from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Navigate to="/login" replace />} />
        <Route path="/login"             element={<Login />} />
        <Route path="/home"              element={<Home />} />
        <Route path="/explore"           element={<Explore />} />
        <Route path="/profile/:id"       element={<Profile />} />
        <Route path="/profile"           element={<StudentProfile />} />
        <Route path="/dashboard"         element={<Dashboard />} />
        <Route path="/appointment/:id"   element={<Appointment />} />
        <Route path="/messages"          element={<Messages />} />
        <Route path="/settings"          element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}