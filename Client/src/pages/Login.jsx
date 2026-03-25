import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import api from '../services/api'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', formData)
      login(response.data.data)
      navigate(from, { replace: true })
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-4rem)] overflow-hidden rounded-[34px] bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.35)] lg:grid-cols-[0.95fr_1.05fr]">
      <div className="relative hidden lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,34,68,0.2),rgba(1,9,24,0.68)),radial-gradient(circle_at_top,rgba(90,248,251,0.16),transparent_24%),linear-gradient(180deg,#7db6d6_0%,#24496a_48%,#081120_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="editorial-title text-xl font-semibold">Voyager</span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8cf0f2]">Curated journeys</p>
            <h1 className="editorial-title mt-5 max-w-md text-5xl font-semibold leading-[1.02]">Your global itinerary, refined.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/78">Sign back in to continue shaping journeys with intelligent recommendations and route-aware planning.</p>
          </div>
          <div className="flex items-center gap-4 text-base text-white/78">
            <span className="h-px w-16 bg-[#5ae0e7]" />
            Voyager Digital Concierge
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-xl">
          <div className="mb-10">
            <p className="editorial-title text-xl font-semibold text-brand-secondary">Voyager</p>
            <h1 className="editorial-title mt-5 text-4xl font-semibold text-brand-palm">Welcome back</h1>
            <p className="mt-3 text-base leading-7 text-brand-onSurfaceVariant">
              Continue your journey planning with saved trips, editable itineraries, and curated recommendations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-base font-medium text-brand-palm">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input-minimal"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-base font-medium text-brand-palm">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="input-minimal"
              />
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand-secondary hover:underline">
                Forgot password?
              </Link>
            </div>

            {successMessage ? (
              <p className="rounded-xl bg-[#def7f7] px-4 py-3 text-sm text-[#00504c]">{successMessage}</p>
            ) : null}
            {error ? <p className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-palm to-brand-palmContainer px-6 py-4 text-base font-semibold text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.5)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Enter Voyager'}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-brand-onSurfaceVariant">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-secondary hover:underline">
              Join Voyager
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default Login
