function getHotelSelectionKey(hotel) {
  if (!hotel) {
    return ''
  }

  return String(hotel._id || hotel.place_id || hotel.name || '')
}

function isValidCoordinate(value) {
  return Number.isFinite(Number(value))
}

function normalizeAnchorLocation(location, fallbackName = 'Selected hotel') {
  if (!location) {
    return null
  }

  const lat = location.location?.lat ?? location.lat
  const lng = location.location?.lng ?? location.lng
  if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
    return null
  }

  return {
    place_id: location.place_id || location._id || '',
    name: location.name || fallbackName,
    lat: Number(lat),
    lng: Number(lng),
  }
}

function getOriginalDayEndLocation(day) {
  const route = Array.isArray(day?.route) ? day.route : []
  return normalizeAnchorLocation(route[route.length - 1], 'Day end')
}

function getOriginalDayStartLocation(day, initialHotelLocation) {
  return (
    normalizeAnchorLocation(day?.start_location, 'Trip start')
    || normalizeAnchorLocation(initialHotelLocation, 'Trip start')
    || normalizeAnchorLocation(day?.route?.[0], 'Trip start')
    || null
  )
}

export function buildDefaultHotelSelections(dynamicHotelDays, previousSelections = {}) {
  const nextSelections = { ...previousSelections }

  ;(dynamicHotelDays || []).forEach((dayEntry) => {
    const hotels = Array.isArray(dayEntry?.suggested_hotels) ? dayEntry.suggested_hotels : []
    if (hotels.length === 0) {
      delete nextSelections[dayEntry.day]
      return
    }

    const existingKey = nextSelections[dayEntry.day]
    const hasExistingHotel = hotels.some((hotel) => getHotelSelectionKey(hotel) === existingKey)
    if (!hasExistingHotel) {
      nextSelections[dayEntry.day] = getHotelSelectionKey(hotels[0])
    }
  })

  return nextSelections
}

export function getSelectedHotelForDay(dayEntry, hotelSelections, continuedStayDays, previousSelectedHotel) {
  if (!dayEntry) {
    return null
  }

  if (continuedStayDays?.[dayEntry.day] && dayEntry.day > 1) {
    return previousSelectedHotel || null
  }

  const hotels = Array.isArray(dayEntry.suggested_hotels) ? dayEntry.suggested_hotels : []
  if (hotels.length === 0) {
    return null
  }

  const selectedKey = hotelSelections?.[dayEntry.day]
  return hotels.find((hotel) => getHotelSelectionKey(hotel) === selectedKey) || hotels[0]
}

export function deriveDynamicAnchoredItinerary({
  itineraryDays = [],
  dynamicHotelDays = [],
  hotelSelections = {},
  continuedStayDays = {},
  initialHotelLocation = null,
  dynamicEnabled = false,
}) {
  if (!dynamicEnabled) {
    return itineraryDays
  }

  const dynamicDayMap = Object.fromEntries((dynamicHotelDays || []).map((dayEntry) => [dayEntry.day, dayEntry]))
  let previousDaySelectedHotel = null

  return itineraryDays.map((day) => {
    const dayEntry = dynamicDayMap[day.day]
    const continuingPreviousStay = Boolean(continuedStayDays?.[day.day] && day.day > 1 && previousDaySelectedHotel)
    const selectedHotel = getSelectedHotelForDay(dayEntry, hotelSelections, continuedStayDays, previousDaySelectedHotel)
    const selectedHotelAnchor = normalizeAnchorLocation(selectedHotel)
    const originalStart = getOriginalDayStartLocation(day, day.day === 1 ? initialHotelLocation : null)
    const originalEnd = getOriginalDayEndLocation(day)

    const startLocation = day.day === 1
      ? (selectedHotelAnchor || originalStart)
      : (normalizeAnchorLocation(previousDaySelectedHotel) || originalStart)

    const endLocation = selectedHotelAnchor || originalEnd || originalStart

    previousDaySelectedHotel = selectedHotel || null

    return {
      ...day,
      start_location: startLocation,
      end_location: endLocation,
      selected_hotel: selectedHotel,
      continued_previous_stay: continuingPreviousStay,
    }
  })
}

export { getHotelSelectionKey, normalizeAnchorLocation }
