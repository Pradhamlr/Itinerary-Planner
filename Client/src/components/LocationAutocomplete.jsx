import { useRef } from 'react'
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '../utils/googleMaps'

function LocationAutocomplete({ value, onSelect, onClear, city }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const autocompleteRef = useRef(null)
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    id: GOOGLE_MAPS_LOADER_ID,
  })

  const handleLoad = (autocomplete) => {
    autocompleteRef.current = autocomplete
  }

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace()
    const lat = place?.geometry?.location?.lat?.()
    const lng = place?.geometry?.location?.lng?.()

    if (!place || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }

    onSelect({
      name: place.formatted_address || place.name || '',
      place_id: place.place_id || '',
      lat,
      lng,
    })
  }

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Add `VITE_GOOGLE_MAPS_API_KEY` to use place search for start location.
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Unable to load Google place search right now.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Loading place search...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Autocomplete
        onLoad={handleLoad}
        onPlaceChanged={handlePlaceChanged}
        options={{
          fields: ['formatted_address', 'geometry', 'name', 'place_id'],
          componentRestrictions: { country: 'in' },
        }}
      >
        <input
          type="text"
          placeholder={city ? `Search a hotel or start point in ${city}` : 'Search hotel or start point'}
          defaultValue={value?.name || ''}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
        />
      </Autocomplete>

      {value?.name ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected start location</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-800">{value.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {value.lat?.toFixed?.(4)}, {value.lng?.toFixed?.(4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default LocationAutocomplete
