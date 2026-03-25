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
      <div className="rounded-2xl bg-[#efe8cd] px-4 py-3 text-sm text-[#6d6a51]">
        Add `VITE_GOOGLE_MAPS_API_KEY` to use place search for start location.
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">
        Unable to load Google place search right now.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="rounded-2xl bg-[#efe8cd] px-4 py-3 text-sm text-[#6d6a51]">
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
          className="input-minimal"
        />
      </Autocomplete>

      {value?.name ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-[#efe8cd] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b886f]">Selected start location</p>
            <p className="mt-1 break-words text-sm font-medium leading-6 text-brand-palm">{value.name}</p>
            <p className="mt-1 text-xs text-[#6d6a51]">
              {value.lat?.toFixed?.(4)}, {value.lng?.toFixed?.(4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="btn-ghost shrink-0 px-4 py-2 text-xs"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default LocationAutocomplete
