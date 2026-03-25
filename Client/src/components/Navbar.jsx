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
    <header className="sticky top-0 z-20 border-b border-orange-100/40 bg-white/90 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.15)] backdrop-blur-xl\">
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
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `border-b-2 pb-2 text-sm font-medium transition ${
                    isActive ? 'border-brand-secondary text-brand-secondary' : 'border-transparent text-brand-onSurfaceVariant hover:text-brand-palm'
                  }`
                }
              >
                Itineraries
              </NavLink>
              <span className="pb-2 text-sm font-medium text-brand-onSurfaceVariant">Discovery</span>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-palm transition hover:bg-brand-surfaceLow"
              aria-label="Go to home"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
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
