import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ItineraryPanel, RecommendationsPanel } from '../components/TripDetailsPanels'
import api from '../services/api'
import { formatCurrency, getInterestMeta } from '../utils/travel'

function formatTripDate(value) {
  if (!value) {
    return 'Flexible dates'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Flexible dates'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function parseDurationToMinutes(durationText) {
  if (!durationText || typeof durationText !== 'string') {
    return 0
  }

  const hourMatch = durationText.match(/(\d+)\s*hr/)
  const minuteMatch = durationText.match(/(\d+)\s*mins?/)
  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0
  return (hours * 60) + minutes
}

function normalizeItineraryDays(days) {
  return (days || []).map((day) => {
    if (day?.route_stats) {
      return day
    }

    const route = day?.route || []
    const mealSuggestions = day?.meal_suggestions || []
    const travelMinutes = route.reduce((sum, place) => (
      sum
      + parseDurationToMinutes(place.travel_time_from_start)
      + parseDurationToMinutes(place.travel_time_to_next)
      + parseDurationToMinutes(place.return_travel_time_to_start)
    ), 0)
    const visitMinutes = route.reduce((sum, place) => sum + Number(place.visit_duration_minutes || 0), 0)
    const mealBreakMinutes = mealSuggestions.reduce((sum, meal) => sum + (meal.type === 'Dinner' ? 75 : 60), 0)

    return {
      ...day,
      route_stats: {
        stop_count: route.length,
        total_travel_minutes: travelMinutes,
        total_visit_minutes: visitMinutes,
        meal_break_minutes: mealBreakMinutes,
        total_day_minutes: travelMinutes + visitMinutes + mealBreakMinutes,
        over_travel_limit: false,
        over_total_limit: false,
      },
    }
  })
}

function TripDetails() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [trip, setTrip] = useState(null)
  const [attractions, setAttractions] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [itineraryDays, setItineraryDays] = useState([])
  const [itineraryRestaurants, setItineraryRestaurants] = useState([])
  const [itineraryMetadata, setItineraryMetadata] = useState(null)
  const [recommendationsGeneratedAt, setRecommendationsGeneratedAt] = useState('')
  const [itineraryGeneratedAt, setItineraryGeneratedAt] = useState('')
  const [finalizedItineraryGeneratedAt, setFinalizedItineraryGeneratedAt] = useState('')
  const [loadingTrip, setLoadingTrip] = useState(true)
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [loadingItinerary, setLoadingItinerary] = useState(false)
  const [savingFinalizedItinerary, setSavingFinalizedItinerary] = useState(false)
  const [recommendationsGenerated, setRecommendationsGenerated] = useState(false)
  const [itineraryGenerated, setItineraryGenerated] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState('')
  const [itineraryError, setItineraryError] = useState('')
  const [tripError, setTripError] = useState('')
  const [recommendationsFromSnapshot, setRecommendationsFromSnapshot] = useState(false)
  const [itineraryFromSnapshot, setItineraryFromSnapshot] = useState(false)
  const [itineraryActionDay, setItineraryActionDay] = useState(null)
  const [swapState, setSwapState] = useState({
    open: false,
    dayNumber: null,
    place: null,
    suggestions: [],
    loading: false,
    applyingPlaceId: '',
  })

  const hydrateSavedPlans = (tripData) => {
    const recommendationSnapshot = tripData?.recommendationSnapshot
    const itinerarySnapshot = tripData?.itinerarySnapshot
    const finalizedItinerarySnapshot = tripData?.finalizedItinerarySnapshot

    if (recommendationSnapshot) {
      setAttractions(recommendationSnapshot.attractions || [])
      setRestaurants(recommendationSnapshot.restaurants || [])
      setMetadata(recommendationSnapshot.metadata || null)
      setRecommendationsGenerated(Boolean((recommendationSnapshot.attractions || []).length || (recommendationSnapshot.restaurants || []).length))
      setRecommendationsGeneratedAt(recommendationSnapshot.generatedAt || '')
      setRecommendationsFromSnapshot(true)
    } else {
      setAttractions([])
      setRestaurants([])
      setMetadata(null)
      setRecommendationsGenerated(false)
      setRecommendationsGeneratedAt('')
      setRecommendationsFromSnapshot(false)
    }

    if (itinerarySnapshot) {
      setItineraryDays(normalizeItineraryDays(itinerarySnapshot.itinerary || []))
      setItineraryRestaurants(itinerarySnapshot.restaurants || [])
      setItineraryMetadata(itinerarySnapshot.metadata || null)
      setItineraryGenerated(Boolean((itinerarySnapshot.itinerary || []).length))
      setItineraryGeneratedAt(itinerarySnapshot.generatedAt || '')
      setItineraryFromSnapshot(true)
    } else {
      setItineraryDays([])
      setItineraryRestaurants([])
      setItineraryMetadata(null)
      setItineraryGenerated(false)
      setItineraryGeneratedAt('')
      setItineraryFromSnapshot(false)
    }

    setFinalizedItineraryGeneratedAt(finalizedItinerarySnapshot?.generatedAt || '')
  }

  const fetchTrip = async () => {
    try {
      setLoadingTrip(true)
      setTripError('')
      const response = await api.get(`/trips/${id}`)
      const tripData = response.data.data
      setTrip(tripData)
      hydrateSavedPlans(tripData)
    } catch (err) {
      setTripError(err.response?.data?.message || 'Failed to load trip details.')
    } finally {
      setLoadingTrip(false)
    }
  }

  const fetchRecommendations = async () => {
    try {
      setLoadingRecommendations(true)
      setRecommendationsError('')
      const response = await api.get(`/recommendations/${id}`)
      const recommendationData = response.data || {}

      setAttractions(recommendationData.attractions || [])
      setRestaurants(recommendationData.restaurants || [])
      setMetadata(recommendationData.metadata || null)
      setRecommendationsGenerated(true)
      setRecommendationsGeneratedAt(new Date().toISOString())
      setRecommendationsFromSnapshot(false)
    } catch (err) {
      setRecommendationsError(err.response?.data?.message || 'Failed to generate recommendations.')
      setRecommendationsGenerated(true)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  const fetchItinerary = async () => {
    try {
      setLoadingItinerary(true)
      setItineraryError('')
      const response = await api.get(`/itinerary/${id}`)
      const itineraryData = response.data || {}

      setItineraryDays(normalizeItineraryDays(itineraryData.itinerary || []))
      setItineraryRestaurants(itineraryData.restaurants || [])
      setItineraryMetadata(itineraryData.metadata || null)
      setItineraryGenerated(true)
      setItineraryGeneratedAt(new Date().toISOString())
      setItineraryFromSnapshot(false)
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to generate itinerary.')
      setItineraryGenerated(true)
    } finally {
      setLoadingItinerary(false)
    }
  }

  const persistItinerarySnapshot = async (nextItineraryDays) => {
    const snapshotPayload = {
      generatedAt: itineraryGeneratedAt || new Date().toISOString(),
      itinerary: normalizeItineraryDays(nextItineraryDays),
      restaurants: itineraryRestaurants || [],
      metadata: itineraryMetadata || {},
    }

    await api.put(`/trips/${id}`, {
      itinerarySnapshot: snapshotPayload,
    })
  }

  const toggleLockedPlace = async (dayNumber, placeId) => {
    const nextItineraryDays = normalizeItineraryDays(itineraryDays.map((day) => (
      day.day !== dayNumber
        ? day
        : {
            ...day,
            route: (day.route || []).map((place) => (
              place.place_id === placeId ? { ...place, locked: !place.locked } : place
            )),
          }
    )))

    setItineraryDays(nextItineraryDays)

    try {
      await persistItinerarySnapshot(nextItineraryDays)
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to save locked places.')
      fetchTrip()
    }
  }

  const reorderDayStops = async (dayNumber, fromIndex, toIndex) => {
    if (fromIndex === toIndex) {
      return
    }

    const nextItineraryDays = normalizeItineraryDays(itineraryDays.map((day) => {
      if (day.day !== dayNumber) {
        return day
      }

      const nextRoute = [...(day.route || [])]
      const [movedPlace] = nextRoute.splice(fromIndex, 1)
      nextRoute.splice(toIndex, 0, movedPlace)

      return {
        ...day,
        customized_order: true,
        route: nextRoute,
      }
    }))

    setItineraryDays(nextItineraryDays)

    try {
      setItineraryActionDay(dayNumber)
      const targetDay = nextItineraryDays.find((day) => day.day === dayNumber)
      const response = await api.post(`/itinerary/${id}/recalculate-day/${dayNumber}`, {
        route: targetDay?.route || [],
      })
      const itineraryData = response.data || {}

      setItineraryDays(normalizeItineraryDays(itineraryData.itinerary || []))
      setItineraryRestaurants(itineraryData.restaurants || [])
      setItineraryMetadata(itineraryData.metadata || null)
      setItineraryGenerated(true)
      setItineraryGeneratedAt(new Date().toISOString())
      setItineraryFromSnapshot(false)
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to recalculate reordered itinerary day.')
      fetchTrip()
    } finally {
      setItineraryActionDay(null)
    }
  }

  const regenerateDay = async (dayNumber) => {
    try {
      setItineraryActionDay(dayNumber)
      setItineraryError('')
      const response = await api.post(`/itinerary/${id}/regenerate-day/${dayNumber}`)
      const itineraryData = response.data || {}

      setItineraryDays(normalizeItineraryDays(itineraryData.itinerary || []))
      setItineraryRestaurants(itineraryData.restaurants || [])
      setItineraryMetadata(itineraryData.metadata || null)
      setItineraryGenerated(true)
      setItineraryGeneratedAt(new Date().toISOString())
      setItineraryFromSnapshot(false)
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to regenerate itinerary day.')
    } finally {
      setItineraryActionDay(null)
    }
  }

  const finalizeItinerary = async () => {
    try {
      setSavingFinalizedItinerary(true)
      setItineraryError('')

      const snapshotPayload = {
        generatedAt: itineraryGeneratedAt || new Date().toISOString(),
        itinerary: normalizeItineraryDays(itineraryDays),
        restaurants: itineraryRestaurants || [],
        metadata: itineraryMetadata || {},
      }

      const response = await api.post(`/itinerary/${id}/finalize`, {
        itinerarySnapshot: snapshotPayload,
      })

      const finalizedSnapshot = response.data?.finalizedItinerarySnapshot
      setTrip((currentTrip) => (
        currentTrip
          ? { ...currentTrip, finalizedItinerarySnapshot: finalizedSnapshot }
          : currentTrip
      ))
      setFinalizedItineraryGeneratedAt(finalizedSnapshot?.generatedAt || new Date().toISOString())
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to save final itinerary.')
    } finally {
      setSavingFinalizedItinerary(false)
    }
  }

  const openSwapSuggestions = async (dayNumber, place) => {
    try {
      setSwapState({
        open: true,
        dayNumber,
        place,
        suggestions: [],
        loading: true,
        applyingPlaceId: '',
      })
      setItineraryError('')

      const response = await api.post(`/itinerary/${id}/swap-options/${dayNumber}`, {
        placeId: place.place_id,
      })

      setSwapState({
        open: true,
        dayNumber,
        place,
        suggestions: response.data?.suggestions || [],
        loading: false,
        applyingPlaceId: '',
      })
    } catch (err) {
      setSwapState({
        open: false,
        dayNumber: null,
        place: null,
        suggestions: [],
        loading: false,
        applyingPlaceId: '',
      })
      setItineraryError(err.response?.data?.message || 'Failed to load swap suggestions.')
    }
  }

  const closeSwapSuggestions = () => {
    setSwapState({
      open: false,
      dayNumber: null,
      place: null,
      suggestions: [],
      loading: false,
      applyingPlaceId: '',
    })
  }

  const applySwapSuggestion = async (replacementPlaceId) => {
    if (!swapState.dayNumber || !swapState.place?.place_id) {
      return
    }

    try {
      setSwapState((current) => ({
        ...current,
        applyingPlaceId: replacementPlaceId,
      }))
      setItineraryActionDay(swapState.dayNumber)
      setItineraryError('')

      const response = await api.post(`/itinerary/${id}/swap-place/${swapState.dayNumber}`, {
        placeId: swapState.place.place_id,
        replacementPlaceId,
      })
      const itineraryData = response.data || {}

      setItineraryDays(normalizeItineraryDays(itineraryData.itinerary || []))
      setItineraryRestaurants(itineraryData.restaurants || [])
      setItineraryMetadata(itineraryData.metadata || null)
      setItineraryGenerated(true)
      setItineraryGeneratedAt(new Date().toISOString())
      setItineraryFromSnapshot(false)
      closeSwapSuggestions()
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to swap itinerary place.')
      setSwapState((current) => ({
        ...current,
        applyingPlaceId: '',
      }))
    } finally {
      setItineraryActionDay(null)
    }
  }

  useEffect(() => {
    fetchTrip()
  }, [id])

  if (loadingTrip) {
    return (
      <section className="rounded-[30px] bg-white p-10 text-center shadow-soft">
        <p className="text-brand-onSurfaceVariant">Loading trip details...</p>
      </section>
    )
  }

  if (tripError) {
    return (
      <section className="space-y-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost px-4 py-2"
        >
          Back to dashboard
        </button>
        <div className="rounded-[30px] bg-white p-8 shadow-soft">
          <p className="rounded-2xl bg-[#f5ddd8] px-4 py-3 text-[#8a3022]">{tripError}</p>
        </div>
      </section>
    )
  }

  if (!trip) {
    return (
      <section className="space-y-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost px-4 py-2"
        >
          Back to dashboard
        </button>
        <div className="rounded-[30px] bg-white p-8 text-center shadow-soft">
          <p className="text-brand-onSurfaceVariant">Trip not found.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <div className="space-y-8">
        <header className="flex flex-col gap-5 rounded-[30px] bg-white px-6 py-5 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.35)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[1.7rem] font-semibold text-brand-palm">{trip.city}</p>
            <p className="mt-1 text-brand-onSurfaceVariant">Curated trip workspace</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full bg-brand-surfaceLow px-4 py-2 text-sm font-medium text-brand-palm">
              {formatTripDate(trip.startDate)} • {trip.days} day{trip.days > 1 ? 's' : ''}
            </div>
            <button
              onClick={finalizeItinerary}
              disabled={savingFinalizedItinerary || !itineraryGenerated}
              className="inline-flex items-center justify-center rounded-full bg-brand-palm px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingFinalizedItinerary ? 'Saving...' : 'Save Finalized'}
            </button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] bg-white p-6 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.35)]">
            <p className="field-label">ML data processed</p>
            <h1 className="editorial-title mt-3 text-[2rem] font-semibold text-brand-palm">Curated for you</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-brand-onSurfaceVariant">
              Our planning engine combines your preferences, place quality, route efficiency, and itinerary pacing to build this collection.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={fetchRecommendations}
                disabled={loadingRecommendations}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingRecommendations ? 'Refreshing...' : recommendationsGenerated ? 'Refresh Recommendations' : 'Generate Recommendations'}
              </button>
              <button
                onClick={fetchItinerary}
                disabled={loadingItinerary}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingItinerary ? 'Building...' : itineraryGenerated ? 'Refresh Itinerary' : 'Generate Itinerary'}
              </button>
            </div>
          </div>

          <div className="rounded-[30px] bg-white p-6 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.35)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] bg-brand-surfaceLow p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Destination</p>
                <p className="mt-3 text-xl font-semibold text-brand-palm">{trip.city}</p>
              </div>
              <div className="rounded-[24px] bg-brand-surfaceLow p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Dates</p>
                <p className="mt-3 text-xl font-semibold text-brand-palm">{formatTripDate(trip.startDate)} - {trip.days} day plan</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(trip.interests || []).length ? (
                trip.interests.map((interest) => {
                  const meta = getInterestMeta(interest)
                  return (
                    <span key={interest} className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.accent}`}>
                      {meta.label}
                    </span>
                  )
                })
              ) : (
                <span className="rounded-full bg-brand-surfaceLow px-3 py-1 text-xs font-semibold text-brand-onSurfaceVariant">
                  Flexible journey
                </span>
              )}
            </div>
            <div className="mt-4 rounded-[24px] bg-brand-surfaceLow p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Budget</p>
              <p className="mt-2 text-xl font-semibold text-brand-palm">{formatCurrency(trip.budget)}</p>
            </div>
          </div>
        </div>

        <RecommendationsPanel
          attractions={attractions}
          restaurants={restaurants}
          metadata={metadata}
          tripDays={trip.days}
          loading={loadingRecommendations}
          generated={recommendationsGenerated}
          error={recommendationsError}
          onRefresh={fetchRecommendations}
          generatedAt={recommendationsGeneratedAt}
          hydratedFromSnapshot={recommendationsFromSnapshot}
          onGenerateItinerary={fetchItinerary}
          itineraryLoading={loadingItinerary}
        />

        <ItineraryPanel
          itineraryDays={itineraryDays}
          loading={loadingItinerary}
          generated={itineraryGenerated}
          error={itineraryError}
          onRefresh={fetchItinerary}
          generatedAt={itineraryGeneratedAt}
          hydratedFromSnapshot={itineraryFromSnapshot}
          onToggleLock={toggleLockedPlace}
          onRegenerateDay={regenerateDay}
          onReorderDay={reorderDayStops}
          actionDay={itineraryActionDay}
          onFinalize={finalizeItinerary}
          savingFinalized={savingFinalizedItinerary}
          finalizedGeneratedAt={finalizedItineraryGeneratedAt}
          onRequestSwap={openSwapSuggestions}
          onApplySwap={applySwapSuggestion}
          onCloseSwap={closeSwapSuggestions}
          swapState={swapState}
        />
      </div>
    </section>
  )
}

export default TripDetails
