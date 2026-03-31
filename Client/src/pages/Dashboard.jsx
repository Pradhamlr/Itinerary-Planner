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
  const [completionModalTrip, setCompletionModalTrip] = useState(null)
  const [completionForm, setCompletionForm] = useState({
    follow_score: 0,
    satisfaction_score: 0,
    hotel_score: 0,
    feedback_text: '',
  })
  const [savingCompletion, setSavingCompletion] = useState(false)

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

  const openCompletionModal = (trip) => {
    setCompletionModalTrip(trip)
    setCompletionForm({
      follow_score: trip?.completionFeedback?.follow_score || 0,
      satisfaction_score: trip?.completionFeedback?.satisfaction_score || 0,
      hotel_score: trip?.completionFeedback?.hotel_score || 0,
      feedback_text: trip?.completionFeedback?.feedback_text || '',
    })
  }

  const closeCompletionModal = () => {
    setCompletionModalTrip(null)
    setCompletionForm({
      follow_score: 0,
      satisfaction_score: 0,
      hotel_score: 0,
      feedback_text: '',
    })
  }

  const updateCompletionScore = (field, value) => {
    setCompletionForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const submitCompletionFeedback = async () => {
    if (!completionModalTrip) {
      return
    }

    if (!completionForm.follow_score || !completionForm.satisfaction_score || !completionForm.hotel_score) {
      setError('Please rate all three feedback questions before marking the trip as completed.')
      return
    }

    try {
      setSavingCompletion(true)
      setError('')
      const completionFeedback = {
        ...completionForm,
        feedback_text: completionForm.feedback_text.trim(),
        created_at: new Date().toISOString(),
      }

      const response = await api.put(`/trips/${completionModalTrip._id}`, {
        completed: true,
        completionFeedback,
      })
      const updatedTrip = response.data?.data
      setTrips((prev) => prev.map((trip) => (trip._id === updatedTrip._id ? updatedTrip : trip)))
      closeCompletionModal()
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save trip feedback.')
    } finally {
      setSavingCompletion(false)
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
      <div className="relative overflow-hidden rounded-[34px] bg-brand-palm text-white shadow-[0_16px_40px_-8px_rgba(15,23,42,0.35)]">
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
            <div className="relative overflow-hidden rounded-[28px] shadow-[0_20px_40px_-12px_rgba(15,23,42,0.25)]">
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
            <p className="mt-2 max-w-xl text-brand-onSurfaceVariant">Track interests, completion status, and recommendation-ready journeys in one refined workspace.</p>
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
              <TripCard key={trip._id} trip={trip} onDelete={handleDeleteTrip} onComplete={openCompletionModal} />
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

      {completionModalTrip ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[30px] bg-white p-6 shadow-[0_34px_80px_-34px_rgba(15,23,42,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="field-label">Trip Completion</p>
                <h3 className="mt-2 text-[1.7rem] font-semibold text-brand-palm">How did this trip go?</h3>
                <p className="mt-2 text-sm text-brand-onSurfaceVariant">
                  Share quick feedback for {completionModalTrip.city}. This marks the trip as completed.
                </p>
              </div>
              <button type="button" onClick={closeCompletionModal} className="btn-ghost px-4 py-2" disabled={savingCompletion}>
                Close
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {[
                ['follow_score', 'How closely did you follow the itinerary?'],
                ['satisfaction_score', 'How satisfied are you with recommendations?'],
                ['hotel_score', 'Was hotel selection helpful?'],
              ].map(([field, label]) => (
                <div key={field} className="rounded-[22px] bg-brand-surfaceLow p-4">
                  <p className="text-sm font-semibold text-brand-palm">{label}</p>
                  <div className="mt-3 flex gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={`${field}-${value}`}
                        type="button"
                        onClick={() => updateCompletionScore(field, value)}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition ${
                          completionForm[field] === value
                            ? 'bg-brand-secondary text-white'
                            : 'bg-white text-brand-palm ring-1 ring-brand-surfaceHigh'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label htmlFor="feedback_text" className="field-label mb-2 block">Optional feedback</label>
                <textarea
                  id="feedback_text"
                  value={completionForm.feedback_text}
                  onChange={(event) => updateCompletionScore('feedback_text', event.target.value)}
                  rows="4"
                  className="input-minimal min-h-[120px]"
                  placeholder="Anything that worked especially well or needs improvement?"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeCompletionModal} className="btn-ghost px-4 py-2" disabled={savingCompletion}>
                Cancel
              </button>
              <button type="button" onClick={submitCompletionFeedback} className="btn-primary px-5 py-3" disabled={savingCompletion}>
                {savingCompletion ? 'Saving...' : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Dashboard
