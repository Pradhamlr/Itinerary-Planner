import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TripCard from '../components/TripCard'
import api from '../services/api'

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="h-44 animate-pulse bg-slate-200" />
          <div className="space-y-4 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-200" />
            <div className="flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
            </div>
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

  return (
    <section className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.3),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.24),transparent_34%)] p-8 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">Smart Itinerary Planner</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Design city breaks that feel curated before you even board the flight.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Build trips, align them with your interests, and generate personalized place recommendations from your travel data stack.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/create-trip"
                className="inline-flex items-center justify-center rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Create a new trip
              </Link>
              <button
                type="button"
                onClick={fetchTrips}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/10"
              >
                Refresh dashboard
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">Trips saved</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">{trips.length}</p>
            <p className="mt-2 text-sm text-slate-500">Your active travel ideas in one place.</p>
          </div>
          <div className="rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">Recommendation ready</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">{trips.filter((trip) => trip.interests?.length).length}</p>
            <p className="mt-2 text-sm text-slate-500">Trips already primed with interests for smart scoring.</p>
          </div>
          <div className="rounded-[28px] border border-white/60 bg-white/85 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">Next move</p>
            <p className="mt-3 text-xl font-semibold text-slate-950">Open a trip and generate ranked places.</p>
            <p className="mt-2 text-sm text-slate-500">Each itinerary now supports ML-powered suggestions.</p>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Your Trips</h2>
          <p className="mt-1 text-slate-600">Track budgets, interests, and recommendation-ready itineraries.</p>
        </div>
        <Link
          to="/create-trip"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Plan another destination
        </Link>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : trips.length === 0 ? (
        <div className="rounded-[30px] border border-dashed border-slate-300 bg-white/80 p-10 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <h3 className="text-2xl font-semibold text-slate-950">No trips yet</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
            Start with one destination, a trip length, and a few interests. The recommendation engine will take it from there.
          </p>
          <Link
            to="/create-trip"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create your first trip
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip._id} trip={trip} onDelete={handleDeleteTrip} />
          ))}
        </div>
      )}
    </section>
  )
}

export default Dashboard
