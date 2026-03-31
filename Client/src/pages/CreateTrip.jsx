import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LocationAutocomplete from '../components/LocationAutocomplete'
import api from '../services/api'
import { HERO_EDITORIAL_IMAGES, INTEREST_OPTIONS, formatCityName, formatCurrency, getInterestMeta } from '../utils/travel'

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
    stayPlanningMode: 'static',
    hotelLocation: null,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [editorialImageFailed, setEditorialImageFailed] = useState(false)
  const [includeHotelSuggestions, setIncludeHotelSuggestions] = useState(false)
  const [hotelFilters, setHotelFilters] = useState({
    min_price: '',
    max_price: '',
    star: '',
  })
  const [hotelSuggestions, setHotelSuggestions] = useState([])
  const [hotelsLoading, setHotelsLoading] = useState(false)
  const [hotelsError, setHotelsError] = useState('')

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

  const handleHotelFilterChange = (event) => {
    const { name, value } = event.target
    setHotelFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const applyHotelToStartPoint = (hotel) => {
    handleLocationSelect({
      name: hotel.name,
      place_id: hotel.place_id,
      lat: hotel.location?.lat,
      lng: hotel.location?.lng,
    })
  }

  useEffect(() => {
    if (!includeHotelSuggestions) {
      setHotelSuggestions([])
      setHotelsError('')
      return
    }

    const city = formData.city.trim()
    if (!city) {
      setHotelSuggestions([])
      setHotelsError('Choose a destination first to load stay suggestions.')
      return
    }

    let cancelled = false

    const fetchHotels = async () => {
      setHotelsLoading(true)
      setHotelsError('')

      try {
        const params = { city }
        if (hotelFilters.min_price) {
          params.min_price = Number(hotelFilters.min_price)
        }
        if (hotelFilters.max_price) {
          params.max_price = Number(hotelFilters.max_price)
        }
        if (hotelFilters.star) {
          params.star = Number(hotelFilters.star)
        }

        const response = await api.get('/hotels', { params })
        if (!cancelled) {
          setHotelSuggestions(response.data?.data || [])
        }
      } catch (fetchError) {
        if (!cancelled) {
          setHotelSuggestions([])
          setHotelsError(fetchError.response?.data?.message || 'Failed to load hotel suggestions.')
        }
      } finally {
        if (!cancelled) {
          setHotelsLoading(false)
        }
      }
    }

    fetchHotels()

    return () => {
      cancelled = true
    }
  }, [includeHotelSuggestions, formData.city, hotelFilters.max_price, hotelFilters.min_price, hotelFilters.star])

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
      stayPlanningMode: formData.stayPlanningMode,
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
      <header className="flex items-center justify-between border-b border-brand-surfaceHigh/50 pb-4">
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

            <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#d1e8e3_0%,#8bc9d4_35%,#1f4c6a_100%)] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.3)]">
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
                  className={`flex h-[140px] w-[140px] flex-col items-center justify-center gap-3 rounded-full border px-4 py-4 text-center transition duration-200 ${
                    selected
                      ? 'border-brand-secondary bg-brand-secondary text-white shadow-[0_12px_24px_-8px_rgba(0,105,107,0.4)]'
                      : 'border-brand-surfaceHigh bg-white text-brand-palm shadow-[0_8px_20px_-8px_rgba(15,23,42,0.2)] hover:-translate-y-1 hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.25)]'
                  }`}
                >
                  <span className="inline-flex items-center justify-center">
                    <InterestIcon type={interest.value} selected={selected} />
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-[0.24em]">{accentLabel}</span>
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
                  <span>{formatCityName(formData.city) || 'Your destination'}</span>
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
                  </div>
                  <p className="mt-3 text-xl font-semibold text-brand-palm">{selectedBudgetLabel}</p>
                  <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                    {formData.budget ? `${formatCurrency(formData.budget)} total budget` : 'Balanced comfort and value'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Stay Planning</p>
                <h2 className="mt-3 text-2xl font-semibold text-brand-palm">Static or dynamic stay?</h2>
                <p className="mt-2 text-sm leading-7 text-brand-onSurfaceVariant">
                  Static stay keeps one hotel for the full trip. Dynamic stay unlocks day-by-day stay suggestions later, without changing itinerary generation or place order.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, stayPlanningMode: 'static' }))}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                    formData.stayPlanningMode === 'static'
                      ? 'bg-brand-palm text-white'
                      : 'bg-brand-surfaceLow text-brand-palm'
                  }`}
                >
                  Static Stay
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, stayPlanningMode: 'dynamic' }))}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                    formData.stayPlanningMode === 'dynamic'
                      ? 'bg-brand-secondary text-white'
                      : 'bg-brand-surfaceLow text-brand-palm'
                  }`}
                >
                  Dynamic Stay
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] bg-brand-surfaceLow p-5">
              <p className="text-sm font-medium text-brand-palm">
                {formData.stayPlanningMode === 'dynamic' ? 'Dynamic stay is enabled.' : 'Static stay is enabled.'}
              </p>
              <p className="mt-2 text-sm leading-7 text-brand-onSurfaceVariant">
                {formData.stayPlanningMode === 'dynamic'
                  ? 'After itinerary generation, you’ll get per-day hotel suggestions near each day’s endpoint with an option to continue the previous stay.'
                  : 'You’ll use the classic one-stay flow unless you switch to dynamic stay later.'}
              </p>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]">
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
                        <div
                          key={interest}
                          className="inline-flex h-[80px] w-[80px] items-center justify-center rounded-full text-xs font-semibold"
                        >
                          <span className={`inline-flex h-full w-full items-center justify-center rounded-full ${meta.accent}`}>
                            {meta.label}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-brand-onSurfaceVariant">No interests selected yet.</p>
                  )}
                </div>
                <div className="mt-4 rounded-2xl bg-white px-4 py-4 shadow-sm">
                  <p className="text-sm text-brand-onSurfaceVariant">Trip preview</p>
                  <p className="mt-2 text-xl font-semibold text-brand-palm">
                    {formatCityName(formData.city) || 'Your destination'}
                  </p>
                  <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                    {formData.days || 0} day journey • {formData.startDate || 'Flexible dates'}
                  </p>
                  <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                    {formData.stayPlanningMode === 'dynamic' ? 'Dynamic stay planning' : 'Static stay planning'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Stay Suggestions</p>
                <h2 className="mt-3 text-2xl font-semibold text-brand-palm">Include hotel suggestions?</h2>
                <p className="mt-2 text-sm leading-7 text-brand-onSurfaceVariant">
                  Optional. Turn this on to browse cached stay ideas for your destination without changing itinerary generation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIncludeHotelSuggestions((prev) => !prev)}
                className={`inline-flex min-w-[180px] items-center justify-between rounded-full px-5 py-3 text-sm font-semibold transition ${
                  includeHotelSuggestions
                    ? 'bg-brand-secondary text-white shadow-[0_12px_24px_-8px_rgba(0,105,107,0.4)]'
                    : 'bg-brand-surfaceLow text-brand-palm'
                }`}
              >
                <span>{includeHotelSuggestions ? 'Suggestions On' : 'Suggestions Off'}</span>
                <span className={`h-3 w-3 rounded-full ${includeHotelSuggestions ? 'bg-white' : 'bg-brand-onSurfaceVariant'}`} />
              </button>
            </div>

            {includeHotelSuggestions ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="min_price" className="field-label mb-2 block">Min Price</label>
                    <input
                      id="min_price"
                      name="min_price"
                      type="number"
                      min="0"
                      value={hotelFilters.min_price}
                      onChange={handleHotelFilterChange}
                      className="input-minimal"
                      placeholder="1500"
                    />
                  </div>
                  <div>
                    <label htmlFor="max_price" className="field-label mb-2 block">Max Price</label>
                    <input
                      id="max_price"
                      name="max_price"
                      type="number"
                      min="0"
                      value={hotelFilters.max_price}
                      onChange={handleHotelFilterChange}
                      className="input-minimal"
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label htmlFor="star" className="field-label mb-2 block">Star Rating</label>
                    <select
                      id="star"
                      name="star"
                      value={hotelFilters.star}
                      onChange={handleHotelFilterChange}
                      className="input-minimal"
                    >
                      <option value="">Any stay</option>
                      <option value="3">3-star and above</option>
                      <option value="4">4-star and above</option>
                      <option value="5">5-star only</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-[24px] bg-brand-surfaceLow p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-brand-palm">
                      {formData.city ? `Stay ideas in ${formatCityName(formData.city)}` : 'Pick a destination to browse stays'}
                    </p>
                    {hotelsLoading ? <span className="text-xs uppercase tracking-[0.2em] text-brand-onSurfaceVariant">Loading</span> : null}
                  </div>

                  {hotelsError ? <p className="mt-4 text-sm text-[#8a3022]">{hotelsError}</p> : null}

                  {!hotelsError && !hotelsLoading && hotelSuggestions.length === 0 ? (
                    <p className="mt-4 text-sm text-brand-onSurfaceVariant">No stay suggestions match these filters yet.</p>
                  ) : null}

                  <div className="mt-4 grid gap-3">
                    {hotelSuggestions.slice(0, 8).map((hotel) => (
                      <article
                        key={hotel._id || hotel.place_id || `${hotel.name}-${hotel.city}`}
                        className="rounded-[22px] bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-[70%]">
                            <h3 className="text-base font-semibold text-brand-palm">{hotel.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-brand-onSurfaceVariant">{hotel.address || formatCityName(hotel.city)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyHotelToStartPoint(hotel)}
                            className="rounded-full bg-brand-surfaceLow px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary transition hover:bg-brand-secondary hover:text-white"
                          >
                            Use This Stay
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-[#e7ebf1] px-3 py-2 text-[#264778]">{hotel.star_category || '-'} star</span>
                          <span className="rounded-full bg-[#d9f4f2] px-3 py-2 text-[#00504c]">
                            {hotel.price_per_night ? formatCurrency(hotel.price_per_night) : 'Price unavailable'}
                          </span>
                          <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">
                            Rating {Number(hotel.user_rating || 0).toFixed(1)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
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
