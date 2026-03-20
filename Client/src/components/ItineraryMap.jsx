import { Fragment } from 'react'
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '../utils/googleMaps'

const DAY_COLORS = ['#1E88E5', '#43A047', '#E53935', '#FB8C00', '#8E24AA']

const containerStyle = {
  width: '100%',
  height: '460px',
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

function ItineraryMap({ itinerary }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    id: GOOGLE_MAPS_LOADER_ID,
  })

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

  const center = getRouteCenter(itinerary)

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
      <GoogleMap
        center={center}
        zoom={13}
        mapContainerStyle={containerStyle}
        options={{
          mapTypeId: 'roadmap',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {itinerary.map((day, dayIndex) => {
          const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
          const path = (day.route || []).map((place) => ({ lat: place.lat, lng: place.lng }))

          return (
            <Fragment key={day.day}>
              {path.length > 1 ? (
                <Polyline
                  key={`polyline-${day.day}`}
                  path={path}
                  options={{
                    strokeColor: color,
                    strokeOpacity: 0.9,
                    strokeWeight: 4,
                  }}
                />
              ) : null}

              {(day.route || []).map((place, index) => (
                <Marker
                  key={`${day.day}-${place.place_id || place.name}-${index}`}
                  position={{ lat: place.lat, lng: place.lng }}
                  label={`${index + 1}`}
                  title={`${place.name} - Day ${day.day}`}
                />
              ))}
            </Fragment>
          )
        })}
      </GoogleMap>
    </div>
  )
}

export default ItineraryMap
