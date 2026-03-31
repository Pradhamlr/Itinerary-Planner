import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ItineraryPanel, RecommendationsPanel } from '../components/TripDetailsPanels'
import api from '../services/api'
import {
  formatCityName,
  formatCurrency,
  formatHotelMetric,
  getInterestMeta,
  getPlaceInsightBadges,
  getTripTypeLabel,
} from '../utils/travel'
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
  const [masterAttractionPool, setMasterAttractionPool] = useState([])
  const [replacementAttractionPool, setReplacementAttractionPool] = useState([])
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
  const [recommendationPairingSuggestions, setRecommendationPairingSuggestions] = useState([])
  const [pairingInterestLoading, setPairingInterestLoading] = useState('')
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
  const [hotelSelectionMessage, setHotelSelectionMessage] = useState('')
  const [dynamicHotelsRefreshSeed, setDynamicHotelsRefreshSeed] = useState(0)

  const hydrateSavedPlans = (tripData) => {
    const recommendationSnapshot = tripData?.recommendationSnapshot
    const itinerarySnapshot = tripData?.itinerarySnapshot
    const finalizedItinerarySnapshot = tripData?.finalizedItinerarySnapshot

    if (recommendationSnapshot) {
      setAttractions(recommendationSnapshot.attractions || [])
      setMasterAttractionPool(recommendationSnapshot.masterAttractionPool || [])
      setReplacementAttractionPool(recommendationSnapshot.replacementAttractionPool || [])
      setRestaurants(recommendationSnapshot.restaurants || [])
      setMetadata(recommendationSnapshot.metadata || null)
      setRecommendationPairingSuggestions(recommendationSnapshot.metadata?.pairing_suggestions || [])
      setRecommendationsGenerated(Boolean((recommendationSnapshot.attractions || []).length || (recommendationSnapshot.restaurants || []).length))
      setRecommendationsGeneratedAt(recommendationSnapshot.generatedAt || '')
      setRecommendationsFromSnapshot(true)
    } else {
      setAttractions([])
      setMasterAttractionPool([])
      setReplacementAttractionPool([])
      setRestaurants([])
      setMetadata(null)
      setRecommendationPairingSuggestions([])
      setRecommendationsGenerated(false)
      setRecommendationsGeneratedAt('')
      setRecommendationsFromSnapshot(false)
    }

    if (itinerarySnapshot) {
      setItineraryDays(normalizeItineraryDays(itinerarySnapshot.itinerary || []))
      setItineraryRestaurants(itinerarySnapshot.restaurants || [])
      setItineraryMetadata(itinerarySnapshot.metadata || null)
      setHotelSelections(
        Object.fromEntries(
          (itinerarySnapshot.itinerary || [])
            .filter((day) => day?.selected_hotel)
            .map((day) => [day.day, getHotelSelectionKey(day.selected_hotel)]),
        ),
      )
      setContinuedStayDays(
        Object.fromEntries(
          (itinerarySnapshot.itinerary || [])
            .filter((day) => day?.continued_previous_stay)
            .map((day) => [day.day, true]),
        ),
      )
      setItineraryGenerated(Boolean((itinerarySnapshot.itinerary || []).length))
      setItineraryGeneratedAt(itinerarySnapshot.generatedAt || '')
      setItineraryFromSnapshot(true)
    } else {
      setItineraryDays([])
      setItineraryRestaurants([])
      setItineraryMetadata(null)
      setHotelSelections({})
      setContinuedStayDays({})
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
      setMasterAttractionPool(recommendationData.masterAttractionPool || [])
      setReplacementAttractionPool(recommendationData.replacementAttractionPool || [])
      setRestaurants(recommendationData.restaurants || [])
      setMetadata(recommendationData.metadata || null)
      setRecommendationPairingSuggestions(recommendationData.metadata?.pairing_suggestions || [])
      setRecommendationsGenerated(true)
      setRecommendationsGeneratedAt(new Date().toISOString())
      setRecommendationsFromSnapshot(false)
    } catch (err) {
      setMasterAttractionPool([])
      setReplacementAttractionPool([])
      setRecommendationPairingSuggestions(err.response?.data?.pairingSuggestions || [])
      setRecommendationsError(err.response?.data?.message || 'Failed to generate recommendations.')
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
    } finally {
      setLoadingItinerary(false)
    }
  }

  const applyInterestPairing = async (suggestedInterest) => {
    if (!trip || !suggestedInterest) {
      return
    }

    const normalizedCurrentInterests = (trip.interests || []).map((interest) => String(interest || '').trim().toLowerCase())
    const normalizedSuggestedInterest = String(suggestedInterest).trim().toLowerCase()
    if (!normalizedSuggestedInterest || normalizedCurrentInterests.includes(normalizedSuggestedInterest)) {
      return
    }

    const nextInterests = [...(trip.interests || []), normalizedSuggestedInterest]

    try {
      setPairingInterestLoading(normalizedSuggestedInterest)
      setRecommendationsError('')
      setItineraryError('')
      setItineraryGenerated(false)
      setItineraryFromSnapshot(false)
      setItineraryGeneratedAt('')
      setItineraryDays([])
      setDerivedItineraryDays([])
      setItineraryRestaurants([])
      setItineraryMetadata(null)

      const updateResponse = await api.put(`/trips/${id}`, {
        interests: nextInterests,
        recommendationSnapshot: null,
        itinerarySnapshot: null,
      })
      const updatedTrip = updateResponse.data?.data
      if (updatedTrip) {
        setTrip(updatedTrip)
      } else {
        setTrip((currentTrip) => (
          currentTrip
            ? {
                ...currentTrip,
                interests: nextInterests,
                recommendationSnapshot: null,
                itinerarySnapshot: null,
              }
            : currentTrip
        ))
      }

      setRecommendationsGenerated(false)
      setRecommendationsGeneratedAt('')
      setRecommendationsFromSnapshot(false)
      setMasterAttractionPool([])
      setReplacementAttractionPool([])

      try {
        setLoadingRecommendations(true)
        const recommendationResponse = await api.get(`/recommendations/${id}`)
        const recommendationData = recommendationResponse.data || {}
        setAttractions(recommendationData.attractions || [])
        setMasterAttractionPool(recommendationData.masterAttractionPool || [])
        setReplacementAttractionPool(recommendationData.replacementAttractionPool || [])
        setRestaurants(recommendationData.restaurants || [])
        setMetadata(recommendationData.metadata || null)
        setRecommendationPairingSuggestions(recommendationData.metadata?.pairing_suggestions || [])
        setRecommendationsGenerated(true)
        setRecommendationsGeneratedAt(new Date().toISOString())
        setRecommendationsFromSnapshot(false)
      } finally {
        setLoadingRecommendations(false)
      }

      try {
        setLoadingItinerary(true)
        const itineraryResponse = await api.get(`/itinerary/${id}`)
        const itineraryData = itineraryResponse.data || {}
        setItineraryDays(normalizeItineraryDays(itineraryData.itinerary || []))
        setItineraryRestaurants(itineraryData.restaurants || [])
        setItineraryMetadata(itineraryData.metadata || null)
        setItineraryGenerated(true)
        setItineraryGeneratedAt(new Date().toISOString())
        setItineraryFromSnapshot(false)
      } finally {
        setLoadingItinerary(false)
      }
    } catch (err) {
      setRecommendationsError(err.response?.data?.message || 'Failed to pair interests and regenerate the trip.')
    } finally {
      setPairingInterestLoading('')
    }
  }

  const buildItinerarySnapshotPayload = (nextItineraryDays, mode = stayPlanningMode) => ({
    generatedAt: itineraryGeneratedAt || new Date().toISOString(),
    itinerary: normalizeItineraryDays(nextItineraryDays),
    restaurants: itineraryRestaurants || [],
    metadata: {
      ...(itineraryMetadata || {}),
      stay_planning_mode: mode,
    },
  })

  const persistItinerarySnapshot = async (nextItineraryDays, options = {}) => {
    const mode = options.mode || stayPlanningMode
    const snapshotPayload = buildItinerarySnapshotPayload(nextItineraryDays, mode)

    await api.put(`/trips/${id}`, {
      itinerarySnapshot: snapshotPayload,
      ...(options.persistMode ? { stayPlanningMode: mode } : {}),
    })
  }

  const persistStayPlanningMode = async (mode, snapshotDays = null) => {
    const updatePayload = { stayPlanningMode: mode }
    if (snapshotDays && snapshotDays.length > 0) {
      updatePayload.itinerarySnapshot = buildItinerarySnapshotPayload(snapshotDays, mode)
    }

    const response = await api.put(`/trips/${id}`, updatePayload)
    const updatedTrip = response.data?.data
    if (updatedTrip) {
      setTrip(updatedTrip)
    } else {
      setTrip((currentTrip) => (
        currentTrip ? { ...currentTrip, stayPlanningMode: mode } : currentTrip
      ))
    }
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

      const snapshotPayload = buildItinerarySnapshotPayload(
        stayPlanningMode === 'dynamic' ? derivedItineraryDays : itineraryDays,
        stayPlanningMode,
      )

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
      const normalizedResponseDays = normalizeItineraryDays(itineraryData.itinerary || [])
      const preservedSwapDays = normalizedResponseDays.map((day) => {
        if (day.day !== swapState.dayNumber) {
          return day
        }

        const previousDay = itineraryDays.find((entry) => entry.day === swapState.dayNumber)
        const previousRoute = previousDay?.route || []
        const nextRoute = day.route || []
        if (!previousRoute.length || nextRoute.length >= previousRoute.length) {
          return day
        }

        const replacementPlace = nextRoute.find((place) => place.place_id === replacementPlaceId)
          || swapState.suggestions.find((place) => place.place_id === replacementPlaceId)
          || null

        if (!replacementPlace) {
          return day
        }

        return {
          ...day,
          route: previousRoute.map((place) => (
            place.place_id === swapState.place.place_id
              ? { ...place, ...replacementPlace, locked: false }
              : place
          )),
        }
      })

      setItineraryDays(normalizeItineraryDays(preservedSwapDays))
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
      params.refresh_seed = dynamicHotelsRefreshSeed

      const response = await api.get(`/hotels/dynamic/${id}`, { params })
      const dynamicHotelDays = response.data?.dynamic_hotels || []
      setDynamicHotels(dynamicHotelDays)
      setDynamicHotelsMetadata(response.data?.metadata || null)
      setHotelSelections((prev) => buildDefaultHotelSelections(dynamicHotelDays, prev))
      if (dynamicHotelDays.some((day) => (day.suggested_hotels || []).length > 0)) {
        setHotelSelectionMessage('Default hotel selected for each day. You can change it any time.')
      }
    } catch (err) {
      setDynamicHotels([])
      setDynamicHotelsMetadata(null)
      setDynamicHotelsError(err.response?.data?.message || 'Failed to load dynamic hotel suggestions.')
    } finally {
      setDynamicHotelsLoading(false)
    }
  }

  const selectDynamicHotel = async (dayNumber, hotel) => {
    const nextHotelSelections = {
      ...hotelSelections,
      [dayNumber]: getHotelSelectionKey(hotel),
    }
    const nextContinuedStayDays = {
      ...continuedStayDays,
      [dayNumber]: false,
    }
    const nextDerivedDays = deriveDynamicAnchoredItinerary({
      itineraryDays,
      dynamicHotelDays: dynamicHotels,
      hotelSelections: nextHotelSelections,
      continuedStayDays: nextContinuedStayDays,
      initialHotelLocation: trip?.hotelLocation,
      dynamicEnabled: true,
    })

    setHotelSelections(nextHotelSelections)
    setContinuedStayDays(nextContinuedStayDays)
    setHotelSelectionMessage('Hotel selected. Route updated.')

    try {
      await persistItinerarySnapshot(nextDerivedDays, { mode: 'dynamic', persistMode: true })
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to save dynamic hotel selection.')
    }
  }

  const toggleContinueStay = async (dayNumber) => {
    const nextContinuedStayDays = {
      ...continuedStayDays,
      [dayNumber]: !continuedStayDays[dayNumber],
    }
    const nextDerivedDays = deriveDynamicAnchoredItinerary({
      itineraryDays,
      dynamicHotelDays: dynamicHotels,
      hotelSelections,
      continuedStayDays: nextContinuedStayDays,
      initialHotelLocation: trip?.hotelLocation,
      dynamicEnabled: true,
    })

    setContinuedStayDays(nextContinuedStayDays)
    setHotelSelectionMessage('Hotel selected. Route updated.')

    try {
      await persistItinerarySnapshot(nextDerivedDays, { mode: 'dynamic', persistMode: true })
    } catch (err) {
      setItineraryError(err.response?.data?.message || 'Failed to save continued stay preference.')
    }
  }

  const handleStayPlanningModeChange = async (mode) => {
    if (mode === stayPlanningMode) {
      return
    }

    const snapshotDays = mode === 'dynamic' ? derivedItineraryDays : itineraryDays
    const previousMode = stayPlanningMode
    setStayPlanningMode(mode)

    try {
      await persistStayPlanningMode(mode, itineraryGenerated ? snapshotDays : null)
    } catch (err) {
      setStayPlanningMode(previousMode)
      setItineraryError(err.response?.data?.message || 'Failed to save stay planning mode.')
    }
  }

  useEffect(() => {
    fetchTrip()
  }, [id])

  useEffect(() => {
    if (stayPlanningMode !== 'dynamic') {
      return
    }

    fetchDynamicHotels()
  }, [stayPlanningMode, itineraryGenerated, id, dynamicHotelFilters.max_price, dynamicHotelFilters.min_price, dynamicHotelFilters.star, dynamicHotelsRefreshSeed])

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

  useEffect(() => {
    if (!hotelSelectionMessage) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setHotelSelectionMessage('')
    }, 2800)

    return () => window.clearTimeout(timeoutId)
  }, [hotelSelectionMessage])

  const plannedDayLookup = Object.fromEntries(derivedItineraryDays.map((day) => [day.day, day]))
  const tripType = getTripTypeLabel(derivedItineraryDays)

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
            {loadingItinerary ? (
              <p className="mt-4 rounded-[18px] bg-brand-surfaceLow px-4 py-3 text-sm text-brand-onSurfaceVariant">
                Building itinerary and day-wise travel summary...
              </p>
            ) : null}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Start Point</p>
              <p className="mt-2 text-xl font-semibold text-brand-palm">{trip.hotelLocation?.name || 'Flexible start'}</p>
            </div>
            <div className="mt-4 rounded-[24px] bg-brand-surfaceLow p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Trip Type</p>
              <p className="mt-2 text-xl font-semibold text-brand-palm">{tripType}</p>
            </div>
          </div>
        </div>

        <section className="rounded-[30px] bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="field-label">Stay planning</p>
              <div className="mt-3 flex items-center gap-2">
                <h2 className="editorial-title text-[1.9rem] font-semibold text-brand-palm">Static or dynamic stay?</h2>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-surfaceLow text-xs font-bold text-brand-secondary"
                  title="Dynamic Stay suggests a different hotel per day and only updates start and end anchors. It does not regenerate the itinerary."
                >
                  i
                </span>
              </div>
              <p className="mt-3 text-brand-onSurfaceVariant">
                Static stay keeps one hotel for the full trip. Dynamic stay adds a separate daily hotel-planning layer near each day&apos;s end point without touching itinerary generation or route order.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleStayPlanningModeChange('static')}
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
                onClick={() => handleStayPlanningModeChange('dynamic')}
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
              {hotelSelectionMessage ? (
                <div className="rounded-[24px] border border-[#cdeee8] bg-[#eefcf8] px-4 py-3 text-sm font-medium text-[#0b5b56]">
                  {hotelSelectionMessage}
                </div>
              ) : null}

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setDynamicHotelsRefreshSeed((current) => current + 1)}
                  disabled={dynamicHotelsLoading}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {dynamicHotelsLoading ? 'Refreshing...' : 'Refresh Hotels'}
                </button>
              </div>

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
                    {dynamicHotelsLoading ? 'Refreshing...' : 'Apply Filters'}
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
                  const defaultHotelKey = getHotelSelectionKey(dayEntry.suggested_hotels?.[0])
                  const selectedHotelKey = plannedHotel ? getHotelSelectionKey(plannedHotel) : ''
                  const isDefaultSelection = !continuedStayDays[dayEntry.day] && selectedHotelKey && selectedHotelKey === defaultHotelKey
                  const hotelBadges = plannedHotel ? getPlaceInsightBadges(plannedHotel) : []

                  return (
                    <article key={dayEntry.day} className="rounded-[26px] bg-brand-surfaceLow p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Day {dayEntry.day} Plan</p>
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
                            title="Reuse the previous day's hotel for this day. Only the start and end anchors update."
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-onSurfaceVariant">
                              {continuedStayDays[dayEntry.day] ? 'Reused stay' : 'Selected stay'}
                            </p>
                            {isDefaultSelection ? (
                              <span className="rounded-full bg-[#edf7ed] px-3 py-1 text-[11px] font-semibold text-[#2c6a3d]">Default hotel selected</span>
                            ) : null}
                            <span className="rounded-full bg-[#def7f7] px-3 py-1 text-[11px] font-semibold text-brand-secondary">Recommended for this day</span>
                            {hotelBadges.map((badge) => (
                              <span key={`${dayEntry.day}-${badge}`} className="rounded-full bg-[#f5ecd2] px-3 py-1 text-[11px] font-semibold text-[#7a5a10]">{badge}</span>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-brand-palm">{plannedHotel.name}</p>
                              <p className="mt-1 text-sm text-brand-onSurfaceVariant">{plannedHotel.address || 'Estimated value'}</p>
                              <p className="mt-2 text-sm text-brand-onSurfaceVariant">
                                Price: {formatHotelMetric(plannedHotel.price_per_night, (value) => `${formatCurrency(value)} / night`)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-[#e7ebf1] px-3 py-2 text-[#264778]">
                                {formatHotelMetric(plannedHotel.star_category, (value) => `${value}-star stay`)}
                              </span>
                              <span className="rounded-full bg-[#d9f4f2] px-3 py-2 text-[#00504c]">
                                {formatHotelMetric(plannedHotel.price_per_night, (value) => `${formatCurrency(value)} / night`)}
                              </span>
                              <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">Rating {Number(plannedHotel.user_rating || 0).toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[22px] border border-dashed border-brand-outlineVariant bg-white p-4 text-sm text-brand-onSurfaceVariant">
                          No hotel selected yet. The itinerary falls back to the original trip anchor until a hotel is chosen.
                        </div>
                      )}

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
                                      ? 'border-brand-secondary bg-white shadow-sm ring-2 ring-brand-secondary/20'
                                      : 'border-transparent bg-white/80'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="max-w-[72%]">
                                      <p className="text-base font-semibold text-brand-palm">{hotel.name}</p>
                                      <p className="mt-1 text-sm text-brand-onSurfaceVariant">{hotel.address || 'Estimated value'}</p>
                                      <p className="mt-2 text-sm text-brand-onSurfaceVariant">
                                        Price: {formatHotelMetric(hotel.price_per_night, (value) => `${formatCurrency(value)} / night`)}
                                      </p>
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
                                      {selected ? 'Selected' : 'Use This Stay'}
                                    </button>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                    <span className="rounded-full bg-[#def7f7] px-3 py-2 text-brand-secondary">Recommended for this day</span>
                                    {getPlaceInsightBadges(hotel).map((badge) => (
                                      <span key={`${hotel._id || hotel.place_id}-${badge}`} className="rounded-full bg-[#f5ecd2] px-3 py-2 text-[#7a5a10]">{badge}</span>
                                    ))}
                                    <span className="rounded-full bg-[#e7ebf1] px-3 py-2 text-[#264778]">{formatHotelMetric(hotel.star_category, (value) => `${value}-star stay`)}</span>
                                    <span className="rounded-full bg-[#d9f4f2] px-3 py-2 text-[#00504c]">{formatHotelMetric(hotel.price_per_night, (value) => `${formatCurrency(value)} / night`)}</span>
                                    <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">Rating {Number(hotel.user_rating || 0).toFixed(1)}</span>
                                    <span className="rounded-full bg-[#edf0f2] px-3 py-2 text-[#43474e]">{hotel.distance_km} km from end</span>
                                    {getHotelSelectionKey(hotel) === defaultHotelKey ? (
                                      <span className="rounded-full bg-[#edf7ed] px-3 py-2 text-[#2c6a3d]">Default hotel selected</span>
                                    ) : null}
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
          masterAttractionPool={masterAttractionPool}
          replacementAttractionPool={replacementAttractionPool}
          restaurants={restaurants}
          metadata={metadata}
          pairingSuggestions={recommendationPairingSuggestions}
          pairingInterestLoading={pairingInterestLoading}
          tripDays={trip.days}
          loading={loadingRecommendations}
          generated={recommendationsGenerated}
          error={recommendationsError}
          onRefresh={fetchRecommendations}
          onApplyPairing={applyInterestPairing}
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
