import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LocationAutocomplete from '../components/LocationAutocomplete'
import api from '../services/api'
import { HERO_EDITORIAL_IMAGES, INTEREST_OPTIONS, formatCurrency, getInterestMeta } from '../utils/travel'

function InterestIcon({ type, selected }) {
  const className = `h-5 w-5 ${selected ? 'text-white' : 'text-brand-onSurfaceVariant'}`

  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  }

  const icons = {
    beaches: (
      <svg {...props}>
        <path d="M4 17c1.5-2 3.4-3 5.5-3s4 .9 5.5 3" />
        <path d="M3 20h18" />
        <path d="M14 10c0-2.5 1.7-4.4 4.2-5 .1 2.8-1.1 5-3.2 6.3" />
      </svg>
    ),
    shopping: (
      <svg {...props}>
        <path d="M6 9h12l-1 10H7L6 9Z" />
        <path d="M9 9a3 3 0 0 1 6 0" />
      </svg>
    ),
    culture: (
      <svg {...props}>
        <path d="M4 19h16" />
        <path d="M6 19V9" />
        <path d="M10 19V9" />
        <path d="M14 19V9" />
        <path d="M18 19V9" />
        <path d="M3 9h18L12 4 3 9Z" />
      </svg>
    ),
    history: (
      <svg {...props}>
        <path d="M4 19h16" />
        <path d="M6 19V10" />
        <path d="M10 19V10" />
        <path d="M14 19V10" />
        <path d="M18 19V10" />
        <path d="M3 10h18" />
        <path d="M12 5v2" />
      </svg>
    ),
    nature: (
      <svg {...props}>
        <path d="M12 4 6 13h4l-2 7 8-11h-4l2-5Z" />
      </svg>
    ),
    food: (
      <svg {...props}>
        <path d="M6 3v8" />
        <path d="M9 3v8" />
        <path d="M6 7h3" />
        <path d="M16 3v18" />
        <path d="M19 3v6a3 3 0 0 1-3 3h0" />
      </svg>
    ),
    nightlife: (
      <svg {...props}>
        <path d="M8 4v6l-2 10" />
        <path d="M16 4v6l2 10" />
        <path d="M5 4h6" />
        <path d="M13 4h6" />
      </svg>
    ),
    art: (
      <svg {...props}>
        <path d="M12 4a8 8 0 1 0 8 8c0-1.2-.8-2-2-2h-1a2 2 0 0 1-2-2V7a3 3 0 0 0-3-3Z" />
        <circle cx="7.5" cy="12.5" r="1" />
        <circle cx="9.5" cy="8.5" r="1" />
        <circle cx="13.5" cy="7.5" r="1" />
      </svg>
    ),
    adventure: (
      <svg {...props}>
        <path d="M9 6 6 9l3 3" />
        <path d="M15 6l3 3-3 3" />
        <path d="M12 12v8" />
        <path d="M9 20h6" />
      </svg>
    ),
    sports: (
      <svg {...props}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 5a9 9 0 0 1 5 5" />
        <path d="M7 19a9 9 0 0 0 10-4" />
      </svg>
    ),
  }

  return icons[type] || icons.adventure
}

function DetailIcon({ type }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-4 w-4 text-brand-secondary',
  }

  if (type === 'destination') {
    return (
      <svg {...props}>
        <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    )
  }

  if (type === 'dates') {
    return (
      <svg {...props}>
        <path d="M7 3v4" />
        <path d="M17 3v4" />
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16" />
      </svg>
    )
  }

  return (
    <svg {...props}>
      <path d="M4 7h16" />
      <path d="M6 7V5" />
      <path d="M18 7V5" />
      <path d="M6 11h12" />
      <path d="M6 15h8" />
    </svg>
  )
}

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
  const [editorialImageFailed, setEditorialImageFailed] = useState(false)

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

  const selectedBudgetLabel = Number(formData.budget) >= 150000
    ? 'Luxury'
    : Number(formData.budget) >= 60000
    ? 'Mid-Range'
    : formData.budget
    ? 'Value'
    : 'Select budget'

  return (
    <section className="space-y-8">
      <header className="flex items-center justify-between border-b border-brand-surfaceHigh pb-4">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-surfaceHigh bg-white text-brand-palm transition hover:bg-brand-surfaceLow"
            aria-label="Back to dashboard"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="editorial-title text-[1.7rem] font-semibold text-brand-palm">Voyager</span>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-onSurfaceVariant">Step 4 of 4</span>
          <div className="h-2 w-44 overflow-hidden rounded-full bg-brand-surfaceHigh">
            <div className="h-full w-full rounded-full bg-brand-secondary" />
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-surfaceLow px-4 py-2 text-sm font-medium text-brand-onSurfaceVariant">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-secondary" />
            Draft saved
          </span>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-surfaceHigh text-brand-palm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
              <path d="M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9L12 3z" />
            </svg>
          </span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-8 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <div>
            <h1 className="editorial-title max-w-sm text-[2.35rem] font-semibold leading-[1.02] text-brand-palm lg:text-[2.9rem]">
              What kind of <span className="text-brand-secondary">vibe</span> are we chasing?
            </h1>
            <p className="mt-4 max-w-md text-[0.98rem] leading-8 text-brand-onSurfaceVariant">
              Select the interests that define this journey. We&apos;ll use these to curate smarter itineraries, nearby gems, and a more refined day plan.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#b8ece4_0%,#6bbfce_35%,#0f3560_100%)] shadow-[0_24px_56px_-24px_rgba(15,23,42,0.35)]">
            {HERO_EDITORIAL_IMAGES.createTrip && !editorialImageFailed ? (
              <img
                src={HERO_EDITORIAL_IMAGES.createTrip.url}
                alt="Travel editorial landscape"
                onError={() => setEditorialImageFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: HERO_EDITORIAL_IMAGES.createTrip.position || 'center' }}
              />
            ) : null}
            <div className="aspect-[1.18/0.82] bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.28),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.3))]" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#081120]/92 to-transparent px-5 py-5 text-white">
              <p className="max-w-sm text-lg font-medium italic leading-8">
                "The real voyage of discovery consists not in seeking new landscapes, but in having new eyes."
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:max-h-[calc(100vh-180px)] xl:overflow-y-auto xl:pr-2">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEREST_OPTIONS.map((interest) => {
              const selected = formData.interests.includes(interest.value)
              const accentLabel = {
                beaches: 'Coast',
                shopping: 'Shop',
                culture: 'Muse',
                history: 'Past',
                nature: 'Wild',
                food: 'Food',
                nightlife: 'Night',
                art: 'Art',
                adventure: 'Trail',
                sports: 'Play',
              }[interest.value] || 'Vibe'

              return (
                <button
                  key={interest.value}
                  type="button"
                  onClick={() => toggleInterest(interest.value)}
                  className={`flex min-h-[110px] flex-col items-center justify-center gap-3 rounded-[22px] border px-4 py-4 text-center transition duration-200 ${
                    selected
                      ? 'border-brand-secondary bg-brand-secondary text-white shadow-[0_20px_36px_-24px_rgba(0,105,107,0.75)]'
                      : 'border-brand-surfaceHigh bg-white text-brand-palm shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] hover:-translate-y-1 hover:shadow-[0_24px_46px_-28px_rgba(15,23,42,0.28)]'
                  }`}
                >
                  <span className="inline-flex items-center justify-center">
                    <InterestIcon type={interest.value} selected={selected} />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-80">{accentLabel}</span>
                  <span className="text-[1rem] font-medium">{interest.label}</span>
                </button>
              )
            })}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] bg-brand-surfaceLow p-6 shadow-[0_12px_34px_-28px_rgba(15,23,42,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Destination and Dates</p>
              <div className="mt-5 space-y-3">
                <div>
                  <label htmlFor="city" className="field-label mb-2 block">Destination</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="Kyoto, Japan"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="input-minimal"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="days" className="field-label mb-2 block">Days</label>
                    <input
                      id="days"
                      name="days"
                      type="number"
                      min="1"
                      value={formData.days}
                      onChange={handleChange}
                      required
                      className="input-minimal"
                    />
                  </div>
                  <div>
                    <label htmlFor="startDate" className="field-label mb-2 block">Start Date</label>
                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      className="input-minimal"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 rounded-[22px] bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3 text-sm text-brand-palm">
                  <DetailIcon type="destination" />
                  <span>{formData.city || 'Your destination'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-brand-onSurfaceVariant">
                  <DetailIcon type="dates" />
                  <span>{formData.startDate || 'Flexible dates'}{formData.days ? ` • ${formData.days} days` : ''}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-brand-surfaceLow p-6 shadow-[0_12px_34px_-28px_rgba(15,23,42,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Selected Budget</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="budget" className="field-label mb-2 block">Budget</label>
                  <input
                    id="budget"
                    name="budget"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.budget}
                    onChange={handleChange}
                    required
                    className="input-minimal"
                  />
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-brand-secondary">
                    <span>INR</span>
                    <span>INR</span>
                    <span className={`${Number(formData.budget) >= 150000 ? 'text-brand-secondary' : 'text-brand-outlineVariant'}`}>INR</span>
                  </div>
                  <p className="mt-3 text-xl font-semibold text-brand-palm">{selectedBudgetLabel}</p>
                  <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                    {formData.budget ? `${formatCurrency(formData.budget)} total budget` : 'Balanced comfort and value'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.38)]">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <label className="field-label block">Hotel / Start Location</label>
                <p className="mt-2 text-sm leading-7 text-brand-onSurfaceVariant">
                  Optional. Search for your hotel, stay, or preferred starting point to make routing feel more grounded.
                </p>
                <div className="mt-4">
                  <LocationAutocomplete
                    city={formData.city}
                    value={formData.hotelLocation}
                    onSelect={handleLocationSelect}
                    onClear={clearLocation}
                  />
                </div>
              </div>

              <div className="rounded-[24px] bg-brand-surfaceLow p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Selected vibe</p>
                <div className="mt-4 flex min-h-[110px] flex-wrap gap-2">
                  {formData.interests.length > 0 ? (
                    formData.interests.map((interest) => {
                      const meta = getInterestMeta(interest)
                      return (
                        <span
                          key={interest}
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${meta.accent}`}
                        >
                          {meta.label}
                        </span>
                      )
                    })
                  ) : (
                    <p className="text-sm text-brand-onSurfaceVariant">No interests selected yet.</p>
                  )}
                </div>
                <div className="mt-4 rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-sm text-brand-onSurfaceVariant">Trip preview</p>
                  <p className="mt-2 text-xl font-semibold text-brand-palm">
                    {formData.city || 'Your destination'}
                  </p>
                  <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                    {formData.days || 0} day journey • {formData.startDate || 'Flexible dates'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {error ? <p className="rounded-2xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{error}</p> : null}

          <div className="flex items-center justify-between border-t border-brand-surfaceHigh pt-8">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 text-base font-semibold text-brand-secondary transition hover:text-brand-palm"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-palm to-brand-palmContainer px-10 py-4 text-base font-semibold text-white shadow-[0_24px_40px_-24px_rgba(15,23,42,0.55)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creating trip...' : 'Create Trip'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default CreateTrip
