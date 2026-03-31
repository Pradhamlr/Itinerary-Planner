import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { DirectionsRenderer, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '../utils/googleMaps'

const DAY_COLORS = ['#1E88E5', '#43A047', '#E53935', '#FB8C00', '#8E24AA']

const containerStyle = {
  width: '100%',
  height: '560px',
}

function getRouteCenter(itinerary) {
  const firstDayWithCenter = itinerary.find((day) => day.center && Number.isFinite(day.center.lat) && Number.isFinite(day.center.lng))
  if (firstDayWithCenter) {
    return firstDayWithCenter.center
  }

  const fallbackPlace = itinerary.flatMap((day) => day.route || [])[0]
  if (fallbackPlace) {
    return { lat: fallbackPlace.lat, lng: fallbackPlace.lng }
  }

  return { lat: 10.1632, lng: 76.6413 }
}

function getStopKey(day, place, index) {
  return `${day.day}-${place.place_id || place.name}-${index}`
}

function buildDirectionsRequest(day) {
  const route = day.route || []
  const startLocation = day.start_location && Number.isFinite(day.start_location.lat) && Number.isFinite(day.start_location.lng)
    ? { lat: day.start_location.lat, lng: day.start_location.lng }
    : null
  const endLocation = day.end_location && Number.isFinite(day.end_location.lat) && Number.isFinite(day.end_location.lng)
    ? { lat: day.end_location.lat, lng: day.end_location.lng }
    : null

  if (route.length === 0 || (route.length === 1 && !startLocation && !endLocation)) {
    return null
  }

  const origin = startLocation || { lat: route[0].lat, lng: route[0].lng }
  const destination = endLocation || { lat: route[route.length - 1].lat, lng: route[route.length - 1].lng }
  const waypoints = startLocation
    ? route.slice(0, endLocation ? route.length : -1).map((place) => ({
      location: { lat: place.lat, lng: place.lng },
      stopover: true,
    }))
    : route.slice(1, endLocation ? route.length : -1).map((place) => ({
      location: { lat: place.lat, lng: place.lng },
      stopover: true,
    }))

  return {
    origin,
    destination,
    waypoints,
    travelMode: 'DRIVING',
    optimizeWaypoints: false,
  }
}

function createStopMarkerIcon(color, markerText, selected = false) {
  const size = selected ? 54 : 46
  const radius = selected ? 18 : 16
  const centerX = size / 2
  const centerY = 18
  const haloRadius = selected ? radius + 6 : 0

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${selected ? `<circle cx="${centerX}" cy="${centerY}" r="${haloRadius}" fill="${color}" opacity="0.18" />` : ''}
        <path d="M${centerX} ${size - 2} C${centerX - 10} ${size - 14}, ${centerX - 16} ${size - 22}, ${centerX - 16} ${centerY}
                 C${centerX - 16} ${centerY - 9}, ${centerX - 9} ${centerY - 16}, ${centerX} ${centerY - 16}
                 C${centerX + 9} ${centerY - 16}, ${centerX + 16} ${centerY - 9}, ${centerX + 16} ${centerY}
                 C${centerX + 16} ${size - 22}, ${centerX + 10} ${size - 14}, ${centerX} ${size - 2} Z"
              fill="${color}" stroke="#ffffff" stroke-width="${selected ? 3 : 2.5}" />
        <text x="${centerX}" y="${centerY + 4}" text-anchor="middle" font-family="Arial, sans-serif"
              font-size="${selected ? 13 : 12}" font-weight="700" fill="#ffffff">${String(markerText)}</text>
      </svg>
    `)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(centerX, size - 2),
  }
}

function ItineraryMap({ itinerary, selectedStopKey, onSelectStop }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const mapRef = useRef(null)
  const [directionsByDay, setDirectionsByDay] = useState({})
  const [legendOpen, setLegendOpen] = useState(true)
  const [visibleDays, setVisibleDays] = useState(() => itinerary.map((day) => day.day))
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    id: GOOGLE_MAPS_LOADER_ID,
  })
  const mapCenter = useMemo(() => getRouteCenter(itinerary), [itinerary])
  const visibleItinerary = useMemo(
    () => itinerary.filter((day) => visibleDays.includes(day.day)),
    [itinerary, visibleDays],
  )

  useEffect(() => {
    setVisibleDays((currentVisibleDays) => {
      const nextDays = itinerary.map((day) => day.day)
      if (
        currentVisibleDays.length === nextDays.length &&
        currentVisibleDays.every((day, index) => day === nextDays[index])
      ) {
        return currentVisibleDays
      }

      const retainedDays = currentVisibleDays.filter((day) => nextDays.includes(day))
      return retainedDays.length > 0 ? retainedDays : nextDays
    })
  }, [itinerary])

  useEffect(() => {
    if (!isLoaded || !window.google || itinerary.length === 0) {
      return
    }

    let cancelled = false
    const directionsService = new window.google.maps.DirectionsService()

    const loadDirections = async () => {
      const entries = await Promise.all(itinerary.map(async (day) => {
        const request = buildDirectionsRequest(day)
        if (!request) {
          return [day.day, null]
        }

        try {
          const result = await directionsService.route(request)
          return [day.day, result]
        } catch (error) {
          return [day.day, null]
        }
      }))

      if (!cancelled) {
        setDirectionsByDay(Object.fromEntries(entries))
      }
    }

    loadDirections()

    return () => {
      cancelled = true
    }
  }, [isLoaded, itinerary])

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google || visibleItinerary.length === 0) {
      return
    }

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    visibleItinerary.forEach((day) => {
      if (day.start_location && Number.isFinite(day.start_location.lat) && Number.isFinite(day.start_location.lng)) {
        bounds.extend(day.start_location)
        hasPoints = true
      }

      if (day.end_location && Number.isFinite(day.end_location.lat) && Number.isFinite(day.end_location.lng)) {
        bounds.extend(day.end_location)
        hasPoints = true
      }

      ;(day.route || []).forEach((place) => {
        if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
          bounds.extend({ lat: place.lat, lng: place.lng })
          hasPoints = true
        }
      })
    })

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, 64)
    }
  }, [isLoaded, visibleItinerary, directionsByDay])

  const toggleDayVisibility = (dayNumber) => {
    setVisibleDays((currentVisibleDays) => {
      if (currentVisibleDays.includes(dayNumber)) {
        return currentVisibleDays.length === 1
          ? currentVisibleDays
          : currentVisibleDays.filter((day) => day !== dayNumber)
      }

      return [...currentVisibleDays, dayNumber].sort((first, second) => first - second)
    })
  }

  const showAllDays = () => {
    setVisibleDays(itinerary.map((day) => day.day))
  }

  if (!apiKey) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
        <div>
          <h3 className="text-2xl font-semibold text-slate-950">Map unavailable</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">
            Add `VITE_GOOGLE_MAPS_API_KEY` to the client environment to visualize itinerary routes on Google Maps.
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-[28px] border border-dashed border-rose-200 bg-rose-50/80 p-8 text-center">
        <div>
          <h3 className="text-2xl font-semibold text-rose-700">Unable to load Google Maps</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-rose-600">
            Check the configured API key and Google Maps JavaScript API access.
          </p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <p className="text-slate-600">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Route legend</p>
            <p className="mt-1 text-sm text-slate-600">
              Showing {visibleItinerary.length} of {itinerary.length} day{itinerary.length !== 1 ? 's' : ''}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLegendOpen((current) => !current)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {legendOpen ? 'Hide legend' : 'Show legend'}
            </button>
            <button
              type="button"
              onClick={showAllDays}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Show all
            </button>
          </div>
        </div>

        {legendOpen ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {itinerary.map((day, dayIndex) => {
              const isVisible = visibleDays.includes(day.day)
              return (
                <button
                  key={`legend-${day.day}`}
                  type="button"
                  onClick={() => toggleDayVisibility(day.day)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition ${
                    isVisible
                      ? 'bg-white text-slate-700 ring-2 ring-offset-2'
                      : 'border border-transparent bg-slate-100 text-slate-400'
                  }`}
                  style={isVisible ? { boxShadow: `0 0 0 2px ${DAY_COLORS[dayIndex % DAY_COLORS.length]}` } : undefined}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: DAY_COLORS[dayIndex % DAY_COLORS.length] }}
                  />
                  Day {day.day}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <GoogleMap
          center={mapCenter}
          zoom={13}
          mapContainerStyle={containerStyle}
          onLoad={(map) => {
            mapRef.current = map
          }}
          options={{
            mapTypeId: 'roadmap',
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {visibleItinerary.map((day, dayIndex) => {
            const originalDayIndex = itinerary.findIndex((entry) => entry.day === day.day)
            const color = DAY_COLORS[(originalDayIndex >= 0 ? originalDayIndex : dayIndex) % DAY_COLORS.length]
            const directions = directionsByDay[day.day]

            return (
              <Fragment key={day.day}>
                {directions ? (
                  <DirectionsRenderer
                    key={`directions-${day.day}`}
                    directions={directions}
                    options={{
                      suppressMarkers: true,
                      polylineOptions: {
                        strokeColor: color,
                        strokeOpacity: 0.9,
                        strokeWeight: 5,
                      },
                    }}
                  />
                ) : null}

                {day.start_location ? (
                  <Marker
                    key={`start-${day.day}`}
                    position={{ lat: day.start_location.lat, lng: day.start_location.lng }}
                    title={`${day.start_location.name || 'Start'} - Day ${day.day}`}
                    onClick={() => onSelectStop?.(`start-${day.day}`)}
                    icon={createStopMarkerIcon(color, 'S', selectedStopKey === `start-${day.day}`)}
                    animation={selectedStopKey === `start-${day.day}` ? window.google.maps.Animation.BOUNCE : undefined}
                  />
                ) : null}

                {day.end_location ? (
                  <Marker
                    key={`end-${day.day}`}
                    position={{ lat: day.end_location.lat, lng: day.end_location.lng }}
                    title={`${day.end_location.name || 'End'} - Day ${day.day}`}
                    onClick={() => onSelectStop?.(`end-${day.day}`)}
                    icon={createStopMarkerIcon(color, 'E', selectedStopKey === `end-${day.day}`)}
                    animation={selectedStopKey === `end-${day.day}` ? window.google.maps.Animation.BOUNCE : undefined}
                  />
                ) : null}

                {(day.route || []).map((place, index) => {
                  const stopKey = getStopKey(day, place, index)
                  return (
                    <Marker
                      key={stopKey}
                      position={{ lat: place.lat, lng: place.lng }}
                      title={`${place.name} - Day ${day.day}`}
                      onClick={() => onSelectStop?.(stopKey)}
                      icon={createStopMarkerIcon(color, index + 1, selectedStopKey === stopKey)}
                      animation={selectedStopKey === stopKey ? window.google.maps.Animation.BOUNCE : undefined}
                    />
                  )
                })}
              </Fragment>
            )
          })}
        </GoogleMap>
      </div>
    </div>
  )
}

export default ItineraryMap
