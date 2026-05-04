import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import Landing       from './pages/Landing'
import Signup        from './pages/Signup'
import Login         from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import Onboarding    from './pages/Onboarding'
import Home          from './pages/Home'
import Insights      from './pages/Insights'
import Settings      from './pages/Settings'
import ErrorBoundary from './components/ErrorBoundary'

function ProtectedRoute({ children }) {
  if (!localStorage.getItem('ss_token')) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/"                element={<Landing />} />
            <Route path="/signup"          element={<Signup />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/onboarding"      element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/home"            element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/insights"        element={<ProtectedRoute><Insights /></ProtectedRoute>} />
            <Route path="/settings"        element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </UserProvider>
    </BrowserRouter>
  )
}
