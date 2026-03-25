import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/useAuth'
import CreateTrip from './pages/CreateTrip'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Signup from './pages/Signup'
import TripDetails from './pages/TripDetails'
import ForgotPassword from './pages/ForgotPassword'

function App() {
  const { token } = useAuth()
  const location = useLocation()
  const hideNavbar = ['/login', '/signup', '/forgot-password', '/create-trip'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,rgba(90,248,251,0.16),transparent_22%),radial-gradient(circle_at_95%_0%,rgba(0,30,67,0.14),transparent_32%)]" />
      {hideNavbar ? null : <Navbar />}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/signup" element={token ? <Navigate to="/dashboard" replace /> : <Signup />} />
          <Route path="/forgot-password" element={token ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-trip"
            element={
              <ProtectedRoute>
                <CreateTrip />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trip/:id"
            element={
              <ProtectedRoute>
                <TripDetails />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
