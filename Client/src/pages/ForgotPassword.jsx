import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: password
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/dashboard');
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.email) {
        setError('Please enter your email');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email');
        return;
      }

      await api.post('/auth/forgot-password', { email: formData.email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.code) {
        setError('Please enter the verification code');
        return;
      }

      await api.post('/auth/verify-reset-code', { 
        email: formData.email, 
        code: formData.code 
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.newPassword || !formData.confirmPassword) {
        setError('Please fill in all password fields');
        return;
      }

      if (formData.newPassword.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      await api.post('/auth/reset-password', {
        email: formData.email,
        code: formData.code,
        newPassword: formData.newPassword
      });

      // Success - redirect to login
      navigate('/login', { 
        state: { message: 'Password reset successfully! Please log in with your new password.' }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <p className="field-label">Recovery</p>
      <h1 className="editorial-title mt-3 text-4xl font-semibold text-brand-palm">Forgot Password?</h1>
      <p className="mt-3 text-sm leading-7 text-[#5a5843]">
        Enter your email to receive a verification code
      </p>

      <form onSubmit={handleEmailSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="email" className="field-label block">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your@email.com"
            className="input-minimal"
            required
          />
        </div>

        {error && (
          <p className="rounded-xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Sending...' : 'Send Verification Code'}
        </button>
      </form>
    </>
  );

  const renderStep2 = () => (
    <>
      <p className="field-label">Verification</p>
      <h1 className="editorial-title mt-3 text-4xl font-semibold text-brand-palm">Enter Verification Code</h1>
      <p className="mt-3 text-sm leading-7 text-[#5a5843]">
        We sent a 6-digit code to {formData.email}
      </p>

      <form onSubmit={handleCodeSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="code" className="field-label block">
            Verification Code
          </label>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="123456"
            maxLength={6}
            className="input-minimal text-center text-lg tracking-[0.4em]"
            required
          />
        </div>

        {error && (
          <p className="rounded-xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

        <button
          type="button"
          onClick={() => handleEmailSubmit({ preventDefault: () => {} })}
          disabled={loading}
          className="w-full text-sm font-semibold text-brand-secondary hover:text-brand-terracottaInk disabled:opacity-50"
        >
          Resend Code
        </button>

        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-full text-sm font-semibold text-[#5a5843] hover:text-brand-palm"
        >
          Back to Email
        </button>
      </form>
    </>
  );

  const renderStep3 = () => (
    <>
      <p className="field-label">Reset Password</p>
      <h1 className="editorial-title mt-3 text-4xl font-semibold text-brand-palm">Set New Password</h1>
      <p className="mt-3 text-sm leading-7 text-[#5a5843]">
        Enter your new password below
      </p>

      <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="newPassword" className="field-label block">
            New Password
          </label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            minLength={6}
            className="input-minimal"
            required
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="field-label block">
            Confirm New Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            minLength={6}
            className="input-minimal"
            required
          />
        </div>

        {error && (
          <p className="rounded-xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </>
  );

  return (
    <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div className="hero-panel p-8 sm:p-10">
        <p className="field-label text-[#d6e3ff]">Recovery Flow</p>
        <h1 className="editorial-title mt-4 text-4xl font-semibold">Recover access without losing your travel workspace.</h1>
        <p className="mt-4 max-w-md text-sm leading-7 text-[#d6e3ff]">
          Verify your email, confirm the code, and set a new password to get back to your saved journeys.
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl soft-panel p-7 sm:p-10">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <p className="mt-6 text-sm text-brand-onSurfaceVariant">
          Remember your password?{' '}
          <Link to="/login" className="font-semibold text-brand-secondary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
