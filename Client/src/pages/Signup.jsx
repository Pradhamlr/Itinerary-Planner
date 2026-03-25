import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

function Signup() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSignupSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/auth/signup', formData)
      if (response.data.success) {
        setStep(2)
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerificationSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.verificationCode) {
        setError('Please enter the verification code')
        return
      }

      const response = await api.post('/auth/verify-email', {
        email: formData.email,
        code: formData.verificationCode
      })

      if (response.data.success) {
        navigate('/login', {
          state: { message: 'Email verified successfully! Please log in to continue.' }
        })
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resendCode = async () => {
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/signup', formData)
      setError('')
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to resend code.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 2) {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-[34px] bg-white p-8 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.35)] sm:p-10">
        <p className="editorial-title text-xl font-semibold text-brand-secondary">Voyager</p>
        <h1 className="editorial-title mt-5 text-4xl font-semibold text-brand-palm">Verify your email</h1>
        <p className="mt-4 text-base leading-7 text-brand-onSurfaceVariant">
          We sent a 6-digit code to {formData.email}
        </p>

        <form onSubmit={handleVerificationSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="verificationCode" className="mb-2 block text-base font-medium text-brand-palm">
              Verification Code
            </label>
            <input
              id="verificationCode"
              name="verificationCode"
              type="text"
              value={formData.verificationCode}
              onChange={handleChange}
              placeholder="123456"
              maxLength={6}
              className="input-minimal text-center text-base tracking-[0.35em]"
              required
            />
          </div>

          {error ? <p className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-palm to-brand-palmContainer px-6 py-4 text-base font-semibold text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.5)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={resendCode}
              disabled={loading}
              className="text-sm font-semibold text-brand-secondary hover:underline disabled:opacity-50"
            >
              Resend Code
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm font-semibold text-brand-onSurfaceVariant hover:text-brand-palm"
            >
              Back to Signup
            </button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section className="grid min-h-[calc(100vh-4rem)] overflow-hidden rounded-[34px] bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.35)] lg:grid-cols-[0.95fr_1.05fr]">
      <div className="relative hidden lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,34,68,0.24),rgba(1,9,24,0.72)),radial-gradient(circle_at_top,rgba(90,248,251,0.18),transparent_24%),linear-gradient(180deg,#8db8d4_0%,#456a8c_48%,#081120_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <span className="editorial-title text-xl font-semibold">Voyager</span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8cf0f2]">Curated journeys</p>
            <h1 className="editorial-title mt-5 max-w-md text-5xl font-semibold leading-[1.02]">Your global itinerary, refined.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/78">Join our exclusive community of world travelers and start crafting intelligent journeys.</p>
          </div>
          <div className="flex items-center gap-4 text-base text-white/78">
            <span className="h-px w-16 bg-[#5ae0e7]" />
            Voyager Digital Concierge
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-2xl">
          <p className="editorial-title text-xl font-semibold text-brand-secondary">Voyager</p>
          <h1 className="editorial-title mt-5 text-4xl font-semibold text-brand-palm">Create your account</h1>
          <p className="mt-3 text-base leading-7 text-brand-onSurfaceVariant">
            Join our exclusive community of world travelers.
          </p>

          <form onSubmit={handleSignupSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="name" className="mb-2 block text-base font-medium text-brand-palm">Full Name</label>
              <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required className="input-minimal" />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-base font-medium text-brand-palm">Email Address</label>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="input-minimal" />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-2 block text-base font-medium text-brand-palm">Password</label>
                <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required minLength={6} className="input-minimal" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-base font-medium text-brand-palm">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required minLength={6} className="input-minimal" />
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm leading-7 text-brand-onSurfaceVariant">
              <input type="checkbox" className="mt-1 h-5 w-5 rounded border-brand-outlineVariant" required />
              <span>I agree to the <span className="font-semibold text-brand-secondary">Terms and Conditions</span> and <span className="font-semibold text-brand-secondary">Privacy Policy</span>.</span>
            </label>

            {error ? <p className="rounded-xl bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-brand-palm to-brand-palmContainer px-6 py-4 text-base font-semibold text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.5)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Join Voyager'}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-brand-onSurfaceVariant">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-secondary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

export default Signup
