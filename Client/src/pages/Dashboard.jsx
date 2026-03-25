import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TripCard from '../components/TripCard'
import api from '../services/api'
import { HERO_EDITORIAL_IMAGES } from '../utils/travel'

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[28px] bg-brand-surfaceLowest shadow-soft">
          <div className="h-48 animate-pulse bg-[#ddd7be]" />
          <div className="space-y-4 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#ddd7be]" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#ddd7be]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[#ddd7be]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Dashboard() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [heroImageFailed, setHeroImageFailed] = useState(false)

  const fetchTrips = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.get('/trips')
      setTrips(response.data.data || [])
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load trips.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTrip = async (tripId) => {
    try {
      await api.delete(`/trips/${tripId}`)
      setTrips((prev) => prev.filter((trip) => trip._id !== tripId))
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete trip.')
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  const filteredTrips = trips.filter((trip) => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return true
    }

    return (
      String(trip.city || '').toLowerCase().includes(query)
      || (trip.interests || []).some((interest) => String(interest).toLowerCase().includes(query))
    )
  })

  return (
    <section className="space-y-14">
      <div className="relative overflow-hidden rounded-[34px] bg-brand-palm text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(90,248,251,0.15),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(214,227,255,0.14),transparent_26%)]" />
        <div className="relative grid gap-10 px-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:py-12">
          <div className="flex flex-col justify-center">
            <p className="field-label text-[#8cf0f2]">The Digital Concierge</p>
            <h1 className="editorial-title mt-4 max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Where will your next <span className="text-[#62f0f6]">adventure</span> begin?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#d6e3ff]">
              Experience the art of effortless travel. Voyager curates destination ideas, day plans, and route-aware journeys with a calmer editorial feel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/create-trip"
                className="inline-flex items-center justify-center rounded-full bg-brand-secondary px-7 py-4 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Create New Trip
              </Link>
              <button
                type="button"
                onClick={fetchTrips}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-4 text-sm font-semibold text-[#fefae0] backdrop-blur transition hover:bg-white/14 hover:text-white"
              >
                Refresh dashboard
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[420px] lg:mr-0">
            <div className="relative overflow-hidden rounded-[28px] shadow-[0_30px_60px_-32px_rgba(0,0,0,0.5)]">
              {HERO_EDITORIAL_IMAGES.dashboard && !heroImageFailed ? (
                <img
                  src={HERO_EDITORIAL_IMAGES.dashboard.url}
                  alt="Editorial travel view"
                  onError={() => setHeroImageFailed(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: HERO_EDITORIAL_IMAGES.dashboard.position || 'center' }}
                />
              ) : null}
              <div className="aspect-[1.08/1] bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.22),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.18))]" />
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{error}</p> : null}

      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="editorial-title text-3xl font-semibold text-brand-palm">My Saved Trips</h2>
            <p className="mt-2 max-w-xl text-brand-onSurfaceVariant">Track budgets, interests, and recommendation-ready journeys in one refined workspace.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="flex min-w-[290px] items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_10px_26px_-22px_rgba(15,23,42,0.4)] ring-1 ring-brand-surfaceHigh">
              <span className="text-brand-onSurfaceVariant">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your itineraries..."
                className="w-full border-none bg-transparent text-sm text-brand-palm outline-none placeholder:text-brand-onSurfaceVariant"
              />
            </div>
            <Link
              to="/create-trip"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-surfaceHigh px-5 py-3 text-sm font-semibold text-brand-palm transition hover:bg-[#dde2e6]"
            >
              Start New Adventure
            </Link>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : filteredTrips.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="soft-panel p-10 text-center">
                <h3 className="editorial-title text-3xl font-semibold text-brand-palm">No trips yet</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-brand-onSurfaceVariant">
                  Start with one destination, a trip length, and a few interests. Voyager will turn that into a recommendation-ready journey.
                </p>
                <Link
                  to="/create-trip"
                  className="btn-primary mt-6"
                >
                  Create your first trip
                </Link>
              </div>
            </div>
            <Link
              to="/create-trip"
              className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-brand-outlineVariant/80 bg-white text-center transition hover:border-brand-secondary/60 hover:bg-brand-surfaceLow"
            >
              <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-surfaceHigh text-3xl text-brand-onSurfaceVariant">+</span>
              <span className="text-lg font-semibold text-brand-palm">Start a New Adventure</span>
              <span className="mt-2 max-w-[220px] text-sm leading-6 text-brand-onSurfaceVariant">Plan your dream itinerary with AI assistance.</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTrips.map((trip) => (
              <TripCard key={trip._id} trip={trip} onDelete={handleDeleteTrip} />
            ))}
            <Link
              to="/create-trip"
              className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-brand-outlineVariant/80 bg-white text-center transition hover:border-brand-secondary/60 hover:bg-brand-surfaceLow"
            >
              <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-surfaceHigh text-3xl text-brand-onSurfaceVariant">+</span>
              <span className="text-lg font-semibold text-brand-palm">Start a New Adventure</span>
              <span className="mt-2 max-w-[220px] text-sm leading-6 text-brand-onSurfaceVariant">Plan your dream itinerary with AI assistance.</span>
            </Link>
          </div>
        )}
      </section>
    </section>
  )
}

export default Dashboard
