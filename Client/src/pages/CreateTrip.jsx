import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LocationAutocomplete from '../components/LocationAutocomplete'
import api from '../services/api'
import { INTEREST_OPTIONS, formatCurrency, getInterestMeta } from '../utils/travel'

function CreateTrip() {
  const [formData, setFormData] = useState({
    city: '',
    days: '',
    budget: '',
    startDate: '',
    interests: [],
    hotelLocation: null,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const toggleInterest = (interest) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((item) => item !== interest)
        : [...prev.interests, interest],
    }))
  }

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      hotelLocation: location,
    }))
  }

  const clearLocation = () => {
    setFormData((prev) => ({
      ...prev,
      hotelLocation: null,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const parsedDays = Number(formData.days)
    const parsedBudget = Number(formData.budget)

    if (!formData.city.trim()) {
      setError('Please choose a destination city.')
      return
    }

    if (!Number.isInteger(parsedDays) || parsedDays <= 0) {
      setError('Trip duration must be at least 1 day.')
      return
    }

    if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
      setError('Budget must be a valid non-negative number.')
      return
    }

    if (formData.hotelLocation) {
      if (
        !Number.isFinite(Number(formData.hotelLocation.lat))
        || !Number.isFinite(Number(formData.hotelLocation.lng))
      ) {
        setError('Please select a valid hotel or start location from search.')
        return
      }
    }

    const payload = {
      city: formData.city.trim(),
      days: parsedDays,
      budget: parsedBudget,
      startDate: formData.startDate || undefined,
      interests: formData.interests,
      hotelLocation: formData.hotelLocation
        ? {
            name: formData.hotelLocation.name,
            place_id: formData.hotelLocation.place_id,
            lat: Number(formData.hotelLocation.lat),
            lng: Number(formData.hotelLocation.lng),
          }
        : undefined,
    }

    setLoading(true)
    try {
      await api.post('/trips', payload)
      navigate('/dashboard', { replace: true })
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to create trip.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="h-full bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.35),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.25),transparent_36%)] p-8 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">New itinerary</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Shape a trip the recommendation engine can personalize.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            Add your destination, trip length, budget, and interests. We'll use that profile to rank places more intelligently in the next step.
          </p>

          <div className="mt-8 space-y-3 rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <div>
              <p className="text-sm text-slate-300">Budget preview</p>
              <p className="mt-2 text-3xl font-semibold">
                {formData.budget ? formatCurrency(formData.budget) : '$0'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-slate-300">Duration</p>
                <p className="mt-1 font-semibold">{formData.days || 0} day plan</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-slate-300">Start date</p>
                <p className="mt-1 font-semibold">{formData.startDate || 'Flexible dates'}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 text-sm text-slate-200">
              <p className="text-slate-300">Start location</p>
              <p className="mt-1 font-semibold">
                {formData.hotelLocation?.name ? 'Hotel routing enabled' : 'Start from top attraction'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold text-slate-950">Create a smart trip</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            The more precisely you describe your trip, the better your recommendation results will feel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="city" className="mb-2 block text-sm font-semibold text-slate-700">
              Destination
            </label>
            <input
              id="city"
              name="city"
              type="text"
              placeholder="Kochi"
              value={formData.city}
              onChange={handleChange}
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="days" className="mb-2 block text-sm font-semibold text-slate-700">
                Number of days
              </label>
              <input
                id="days"
                name="days"
                type="number"
                min="1"
                value={formData.days}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label htmlFor="budget" className="mb-2 block text-sm font-semibold text-slate-700">
                Budget
              </label>
              <input
                id="budget"
                name="budget"
                type="number"
                min="0"
                step="1"
                value={formData.budget}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label htmlFor="startDate" className="mb-2 block text-sm font-semibold text-slate-700">
                Trip start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>
          </div>

          <div>
            <div className="mb-3">
              <label className="block text-sm font-semibold text-slate-700">Hotel / start location</label>
              <p className="mt-1 text-sm text-slate-500">
                Optional. Search for your hotel, stay, or preferred starting point instead of entering coordinates manually.
              </p>
            </div>
            <LocationAutocomplete
              city={formData.city}
              value={formData.hotelLocation}
              onSelect={handleLocationSelect}
              onClear={clearLocation}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold text-slate-700">Interests</label>
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Choose 2 to 4</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {INTEREST_OPTIONS.map((interest) => {
                const selected = formData.interests.includes(interest.value)
                return (
                  <button
                    key={interest.value}
                    type="button"
                    onClick={() => toggleInterest(interest.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                        : `${interest.accent} hover:-translate-y-0.5`
                    }`}
                  >
                    {interest.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex min-h-[38px] flex-wrap gap-2">
              {formData.interests.length > 0 ? (
                formData.interests.map((interest) => {
                  const meta = getInterestMeta(interest)
                  return (
                    <span key={interest} className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.accent}`}>
                      {meta.label}
                    </span>
                  )
                })
              ) : (
                <p className="text-sm text-slate-500">No interests selected yet.</p>
              )}
            </div>
          </div>

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating itinerary...' : 'Create smart trip'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default CreateTrip
