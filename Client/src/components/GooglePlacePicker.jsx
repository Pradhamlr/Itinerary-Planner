import { useEffect, useRef, useState } from 'react'
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '../utils/googleMaps'
import { formatCityName } from '../utils/travel'

function GooglePlacePicker({ city, onSelect, placeholder }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const autocompleteRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
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
    console.info('GooglePlacePicker place result:', place)
    const lat = place?.geometry?.location?.lat?.()
    const lng = place?.geometry?.location?.lng?.()

    if (!place || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('GooglePlacePicker received an empty or invalid place result.')
      return
    }

    onSelect({
      name: place.name || place.formatted_address || '',
      place_id: place.place_id || '',
      lat,
      lng,
      types: place.types || [],
      category: place.types?.[0] || 'place',
      rating: Number(place.rating || 0),
      user_ratings_total: Number(place.user_ratings_total || 0),
    })
    setInputValue('')
  }

  useEffect(() => {
    setInputValue('')
  }, [city])

  if (!apiKey) {
    return (
      <div className="rounded-2xl bg-[#efe8cd] px-4 py-3 text-sm text-[#6d6a51]">
        Add `VITE_GOOGLE_MAPS_API_KEY` to search places from Google Maps.
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
        Loading Google place search...
      </div>
    )
  }

  return (
    <Autocomplete
      onLoad={handleLoad}
      onPlaceChanged={handlePlaceChanged}
      options={{
        fields: ['formatted_address', 'geometry', 'name', 'place_id', 'types', 'rating', 'user_ratings_total'],
        componentRestrictions: { country: 'in' },
      }}
    >
      <input
        type="text"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder={placeholder || (city ? `Search places in ${formatCityName(city)}` : 'Search places')}
        className="input-minimal"
      />
    </Autocomplete>
  )
}

export default GooglePlacePicker
