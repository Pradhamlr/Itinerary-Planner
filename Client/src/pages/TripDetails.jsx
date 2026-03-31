import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ItineraryPanel, RecommendationsPanel } from '../components/TripDetailsPanels'
import api from '../services/api'
import { formatCityName, formatCurrency, getInterestMeta } from '../utils/travel'
import {
  buildDefaultHotelSelections,
  deriveDynamicAnchoredItinerary,
  getHotelSelectionKey,
} from '../utils/dynamicStay'

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
  const [stayPlanningMode, setStayPlanningMode] = useState('static')
  const [dynamicHotelFilters, setDynamicHotelFilters] = useState({
    min_price: '',
    max_price: '',
    star: '',
  })
  const [dynamicHotels, setDynamicHotels] = useState([])
  const [dynamicHotelsMetadata, setDynamicHotelsMetadata] = useState(null)
  const [dynamicHotelsLoading, setDynamicHotelsLoading] = useState(false)
  const [dynamicHotelsError, setDynamicHotelsError] = useState('')
  const [hotelSelections, setHotelSelections] = useState({})
  const [continuedStayDays, setContinuedStayDays] = useState({})
  const [derivedItineraryDays, setDerivedItineraryDays] = useState([])

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

  const handleDynamicHotelFilterChange = (event) => {
    const { name, value } = event.target
    setDynamicHotelFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const fetchDynamicHotels = async () => {
    if (!itineraryGenerated) {
      setDynamicHotels([])
      setDynamicHotelsError('Generate an itinerary first to unlock dynamic stay planning.')
      return
    }

    try {
      setDynamicHotelsLoading(true)
      setDynamicHotelsError('')
      const params = {}
      if (dynamicHotelFilters.min_price) {
        params.min_price = Number(dynamicHotelFilters.min_price)
      }
      if (dynamicHotelFilters.max_price) {
        params.max_price = Number(dynamicHotelFilters.max_price)
      }
      if (dynamicHotelFilters.star) {
        params.star = Number(dynamicHotelFilters.star)
      }

      const response = await api.get(`/hotels/dynamic/${id}`, { params })
      const dynamicHotelDays = response.data?.dynamic_hotels || []
      setDynamicHotels(dynamicHotelDays)
      setDynamicHotelsMetadata(response.data?.metadata || null)
      setHotelSelections((prev) => buildDefaultHotelSelections(dynamicHotelDays, prev))
    } catch (err) {
      setDynamicHotels([])
      setDynamicHotelsMetadata(null)
      setDynamicHotelsError(err.response?.data?.message || 'Failed to load dynamic hotel suggestions.')
    } finally {
      setDynamicHotelsLoading(false)
    }
  }

  const selectDynamicHotel = (dayNumber, hotel) => {
    setHotelSelections((prev) => ({
      ...prev,
      [dayNumber]: getHotelSelectionKey(hotel),
    }))
    setContinuedStayDays((prev) => ({
      ...prev,
      [dayNumber]: false,
    }))
  }

  const toggleContinueStay = (dayNumber) => {
    setContinuedStayDays((prev) => ({
      ...prev,
      [dayNumber]: !prev[dayNumber],
    }))
  }

  useEffect(() => {
    fetchTrip()
  }, [id])

  useEffect(() => {
    if (stayPlanningMode !== 'dynamic') {
      return
    }

    fetchDynamicHotels()
  }, [stayPlanningMode, itineraryGenerated, id, dynamicHotelFilters.max_price, dynamicHotelFilters.min_price, dynamicHotelFilters.star])

  useEffect(() => {
    if (trip?.stayPlanningMode) {
      setStayPlanningMode(trip.stayPlanningMode)
    }
  }, [trip?.stayPlanningMode])

  useEffect(() => {
    setDerivedItineraryDays(deriveDynamicAnchoredItinerary({
      itineraryDays,
      dynamicHotelDays: dynamicHotels,
      hotelSelections,
      continuedStayDays,
      initialHotelLocation: trip?.hotelLocation,
      dynamicEnabled: stayPlanningMode === 'dynamic',
    }))
  }, [continuedStayDays, dynamicHotels, hotelSelections, itineraryDays, stayPlanningMode, trip?.hotelLocation])

  const plannedDayLookup = Object.fromEntries(derivedItineraryDays.map((day) => [day.day, day]))

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
        <header className="flex flex-col gap-5 rounded-[30px] bg-white px-6 py-5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[1.7rem] font-semibold text-brand-palm">{formatCityName(trip.city)}</p>
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
          <div className="rounded-[30px] bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)]">
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
                <p className="mt-3 text-xl font-semibold text-brand-palm">{formatCityName(trip.city)}</p>
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

        <section className="rounded-[30px] bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="field-label">Stay planning</p>
              <h2 className="editorial-title mt-3 text-[1.9rem] font-semibold text-brand-palm">Static or dynamic stay?</h2>
              <p className="mt-3 text-brand-onSurfaceVariant">
                Static stay keeps one hotel for the full trip. Dynamic stay adds a separate daily hotel-planning layer near each day&apos;s end point without touching itinerary generation or route order.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStayPlanningMode('static')}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  stayPlanningMode === 'static'
                    ? 'bg-brand-palm text-white'
                    : 'bg-brand-surfaceLow text-brand-palm'
                }`}
              >
                Static Stay
              </button>
              <button
                type="button"
                onClick={() => setStayPlanningMode('dynamic')}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  stayPlanningMode === 'dynamic'
                    ? 'bg-brand-secondary text-white'
                    : 'bg-brand-surfaceLow text-brand-palm'
                }`}
              >
                Dynamic Stay
              </button>
            </div>
          </div>

          {stayPlanningMode === 'static' ? (
            <div className="mt-6 rounded-[24px] bg-brand-surfaceLow p-5">
              <p className="text-sm text-brand-onSurfaceVariant">
                Static stay is active. Your itinerary remains unchanged, and you can keep using one hotel or start point for the full journey.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label htmlFor="dynamic_min_price" className="field-label mb-2 block">Min Price</label>
                  <input
                    id="dynamic_min_price"
                    name="min_price"
                    type="number"
                    min="0"
                    value={dynamicHotelFilters.min_price}
                    onChange={handleDynamicHotelFilterChange}
                    className="input-minimal"
                    placeholder="1500"
                  />
                </div>
                <div>
                  <label htmlFor="dynamic_max_price" className="field-label mb-2 block">Max Price</label>
                  <input
                    id="dynamic_max_price"
                    name="max_price"
                    type="number"
                    min="0"
                    value={dynamicHotelFilters.max_price}
                    onChange={handleDynamicHotelFilterChange}
                    className="input-minimal"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label htmlFor="dynamic_star" className="field-label mb-2 block">Star Rating</label>
                  <select
                    id="dynamic_star"
                    name="star"
                    value={dynamicHotelFilters.star}
                    onChange={handleDynamicHotelFilterChange}
                    className="input-minimal"
                  >
                    <option value="">Any stay</option>
                    <option value="3">3-star and above</option>
                    <option value="4">4-star and above</option>
                    <option value="5">5-star only</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={fetchDynamicHotels}
                    disabled={dynamicHotelsLoading}
                    className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {dynamicHotelsLoading ? 'Refreshing...' : 'Refresh Suggestions'}
                  </button>
                </div>
              </div>

              {dynamicHotelsMetadata ? (
                <div className="rounded-[24px] bg-brand-surfaceLow p-4 text-sm text-brand-onSurfaceVariant">
                  Suggestions are ranked primarily by distance to each day&apos;s end point, then rating and price fit. Search radius expands from {dynamicHotelsMetadata.base_radius_km} km to {dynamicHotelsMetadata.expanded_radius_km} km when needed.
                </div>
              ) : null}

              {dynamicHotelsError ? <p className="rounded-2xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{dynamicHotelsError}</p> : null}

              <div className="grid gap-4">
                {dynamicHotels.map((dayEntry) => {
                  const plannedDay = plannedDayLookup[dayEntry.day]
                  const previousPlannedDay = plannedDayLookup[dayEntry.day - 1]
                  const plannedHotel = plannedDay?.selected_hotel || null
                  const canContinuePrevious = dayEntry.continue_previous_available && Boolean(previousPlannedDay?.selected_hotel)

                  return (
                    <article key={dayEntry.day} className="rounded-[26px] bg-brand-surfaceLow p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Day {dayEntry.day}</p>
                          <h3 className="mt-2 text-xl font-semibold text-brand-palm">{plannedDay?.end_location?.name || 'End point unavailable'}</h3>
                          <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                            Start: {plannedDay?.start_location?.name || 'Trip start'} - End anchor radius: {dayEntry.search_radius_km} km
                          </p>
                          <p className="hidden">
                            Start: {dayEntry.start_location?.name || 'Trip start'} · End anchor radius: {dayEntry.search_radius_km} km
                          </p>
                        </div>

                        {dayEntry.day > 1 ? (
                          <button
                            type="button"
                            disabled={!canContinuePrevious}
                            onClick={() => toggleContinueStay(dayEntry.day)}
                            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                              continuedStayDays[dayEntry.day]
                                ? 'bg-brand-secondary text-white'
                                : 'bg-white text-brand-secondary'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {continuedStayDays[dayEntry.day] ? 'Continuing Previous Stay' : 'Continue Previous Stay?'}
                          </button>
                        ) : null}
                      </div>

                      {plannedHotel ? (
                        <div className="mt-4 rounded-[22px] bg-white p-4 shadow-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-onSurfaceVariant">
                            {continuedStayDays[dayEntry.day] ? 'Reused stay' : 'Selected stay'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-brand-palm">{plannedHotel.name}</p>
                              <p className="mt-1 text-sm text-brand-onSurfaceVariant">{plannedHotel.address}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-[#e7ebf1] px-3 py-2 text-[#264778]">{plannedHotel.star_category} star</span>
                              <span className="rounded-full bg-[#d9f4f2] px-3 py-2 text-[#00504c]">{formatCurrency(plannedHotel.price_per_night)}</span>
                              <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">Rating {Number(plannedHotel.user_rating || 0).toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {!continuedStayDays[dayEntry.day] ? (
                        <div className="mt-4 grid gap-3">
                          {(dayEntry.suggested_hotels || []).length > 0 ? (
                            dayEntry.suggested_hotels.map((hotel) => {
                              const selected = hotelSelections[dayEntry.day] === getHotelSelectionKey(hotel)
                              return (
                                <div
                                  key={hotel._id || hotel.place_id || `${dayEntry.day}-${hotel.name}`}
                                  className={`rounded-[22px] border p-4 transition ${
                                    selected
                                      ? 'border-brand-secondary bg-white shadow-sm'
                                      : 'border-transparent bg-white/80'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="max-w-[72%]">
                                      <p className="text-base font-semibold text-brand-palm">{hotel.name}</p>
                                      <p className="mt-1 text-sm text-brand-onSurfaceVariant">{hotel.address}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => selectDynamicHotel(dayEntry.day, hotel)}
                                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                                        selected
                                          ? 'bg-brand-secondary text-white'
                                          : 'bg-brand-surfaceLow text-brand-secondary hover:bg-brand-secondary hover:text-white'
                                      }`}
                                    >
                                      {selected ? 'Selected' : 'Choose Stay'}
                                    </button>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                    <span className="rounded-full bg-[#e7ebf1] px-3 py-2 text-[#264778]">{hotel.star_category} star</span>
                                    <span className="rounded-full bg-[#d9f4f2] px-3 py-2 text-[#00504c]">{formatCurrency(hotel.price_per_night)}</span>
                                    <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">Rating {Number(hotel.user_rating || 0).toFixed(1)}</span>
                                    <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">{hotel.distance_km} km from end</span>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <p className="text-sm text-brand-onSurfaceVariant">No nearby hotels matched this day&apos;s anchor and filters.</p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>

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
          itineraryDays={derivedItineraryDays}
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
