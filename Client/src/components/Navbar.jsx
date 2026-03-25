import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function Navbar() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to={isAuthenticated ? '/dashboard' : '/login'} className="editorial-title text-2xl font-semibold text-brand-palm">
            Voyager
          </Link>

          {isAuthenticated ? (
            <nav className="hidden items-center gap-6 md:flex">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `border-b-2 pb-2 text-sm font-medium transition ${
                    isActive ? 'border-brand-secondary text-brand-secondary' : 'border-transparent text-brand-onSurfaceVariant hover:text-brand-palm'
                  }`
                }
              >
                Explore
              </NavLink>
              <span className="border-b-2 border-brand-secondary pb-2 text-sm font-medium text-brand-secondary">
                Itineraries
              </span>
              <span className="pb-2 text-sm font-medium text-brand-onSurfaceVariant">Discovery</span>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-brand-onSurfaceVariant transition hover:bg-brand-surfaceLow md:inline-flex">
                🔔
              </button>
              <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-full text-brand-onSurfaceVariant transition hover:bg-brand-surfaceLow md:inline-flex">
                ⚙
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-surfaceHigh text-brand-palm transition hover:bg-[#dfe4e8]"
              >
                ✦
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-brand-onSurfaceVariant transition hover:bg-brand-surfaceLow">
                Login
              </NavLink>
              <NavLink to="/signup" className="btn-primary px-5 py-2.5">
                Get Started
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
