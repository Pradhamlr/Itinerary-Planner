import { useEffect, useMemo, useState } from 'react'
import GooglePlacePicker from '../components/GooglePlacePicker'
import ItineraryMap from '../components/ItineraryMap'
import LocationAutocomplete from '../components/LocationAutocomplete'
import api from '../services/api'
import { formatCategory, formatCityName } from '../utils/travel'

const RANDOM_CITY_KEY = '__random__'

function formatMinutes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 mins'
  if (value < 60) return `${value} mins`
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes ? `${hours} hr ${minutes} mins` : `${hours} hr`
}

function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.28)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-onSurfaceVariant">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brand-palm">{value}</p>
      {helper ? <p className="mt-1 text-xs text-brand-onSurfaceVariant">{helper}</p> : null}
    </div>
  )
}

export default function RouteOptimizer() {
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [places, setPlaces] = useState([])
  const [selectedPlaces, setSelectedPlaces] = useState([])
  const [placeSearch, setPlaceSearch] = useState('')
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [error, setError] = useState('')
  const [optimizationMode, setOptimizationMode] = useState('time')
  const [startLocation, setStartLocation] = useState(null)
  const [optimizedRoute, setOptimizedRoute] = useState(null)
  const [optimizedSummary, setOptimizedSummary] = useState(null)

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await api.get('/places/cities')
        const cityList = response.data.data || []
        setCities(cityList)
        setSelectedCity(cityList[0] || RANDOM_CITY_KEY)
      } catch (apiError) {
        setError(apiError.response?.data?.message || 'Failed to load cities.')
      }
    }

    fetchCities()
  }, [])

  useEffect(() => {
    const fetchPlaces = async () => {
      if (!selectedCity) return

      try {
        setLoadingPlaces(true)
        const response = selectedCity === RANDOM_CITY_KEY
          ? await api.get('/places/random?limit=80')
          : await api.get(`/places/${selectedCity}`)
        const sorted = [...(response.data.data || [])].sort(
          (a, b) => (Number(b.rating || 0) - Number(a.rating || 0))
            || (Number(b.user_ratings_total || 0) - Number(a.user_ratings_total || 0)),
        )
        setPlaces(sorted)
        setSelectedPlaces([])
        setOptimizedRoute(null)
        setOptimizedSummary(null)
        setError('')
      } catch (apiError) {
        setError(apiError.response?.data?.message || 'Failed to load destinations.')
      } finally {
        setLoadingPlaces(false)
      }
    }

    fetchPlaces()
  }, [selectedCity])

  useEffect(() => {
    setOptimizedRoute(null)
    setOptimizedSummary(null)
  }, [optimizationMode, selectedPlaces, startLocation])

  const routeSummary = optimizedSummary || optimizedRoute?.summary || null

  const selectedCityLabel = selectedCity === RANDOM_CITY_KEY
    ? 'Random Places'
    : formatCityName(selectedCity)

  const visiblePlaces = useMemo(() => {
    const query = placeSearch.trim().toLowerCase()
    return places.filter((place) => {
      if (!query) return true
      return String(place.name || '').toLowerCase().includes(query)
        || (place.types || []).some((type) => String(type).toLowerCase().includes(query))
    })
  }, [placeSearch, places])

  const togglePlace = (place) => {
    setSelectedPlaces((prev) => {
      const exists = prev.some((item) => item.place_id === place.place_id)
      if (exists) {
        return prev.filter((item) => item.place_id !== place.place_id)
      }

      setPlaceSearch('')
      return [...prev, place]
    })
  }

  const handleGooglePlaceSelect = (place) => {
    if (!place?.place_id) {
      return
    }

    setSelectedPlaces((prev) => (
      prev.some((item) => item.place_id === place.place_id)
        ? prev
        : [...prev, place]
    ))
    setPlaceSearch('')
  }

  const displayedRoute = useMemo(() => {
    const route = optimizedRoute?.route || selectedPlaces
    if (!startLocation) {
      return route
    }

    return [
      {
        place_id: startLocation.place_id || '__start__',
        name: startLocation.name || 'Start Location',
        lat: Number(startLocation.lat),
        lng: Number(startLocation.lng),
        category: 'start_location',
        sequence: 0,
        is_start_location: true,
      },
      ...route,
    ]
  }, [optimizedRoute?.route, selectedPlaces, startLocation])

  const handleOptimize = async () => {
    if (selectedPlaces.length < 2) {
      setError('Choose at least 2 destinations to optimize a route.')
      return
    }

    try {
      setOptimizing(true)
      setError('')
      const response = await api.post('/route-optimizer/optimize', {
        places: selectedPlaces,
        startLocation: startLocation
          ? {
              name: startLocation.name,
              place_id: startLocation.place_id,
              lat: Number(startLocation.lat),
              lng: Number(startLocation.lng),
            }
          : null,
        optimizationMode,
      })
      setOptimizedRoute(response.data.data)
      setOptimizedSummary(response.data?.data?.summary || null)
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to optimize route.')
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <section className="space-y-8">
      <div className="rounded-[32px] bg-brand-palm px-8 py-8 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.55)]">
        <p className="field-label text-[#8cf0f2]">Custom route lab</p>
        <h1 className="editorial-title mt-3 text-4xl font-semibold">Route optimizer for hand-picked destinations.</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[#d6e3ff]">
          Build your own destination circuit, then optimize it by travel time or distance without creating a full itinerary first.
        </p>
      </div>

      {error ? <p className="rounded-2xl bg-[#f5ddd8] px-4 py-3 text-sm text-[#8a3022]">{error}</p> : null}

      <div className="overflow-hidden rounded-[32px] bg-white shadow-[0_24px_56px_-32px_rgba(15,23,42,0.28)] xl:grid xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-0">
        <aside className="border-b border-brand-surfaceHigh bg-[#fbfcfd] p-5 xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div>
            <p className="field-label">Route controls</p>
            <h2 className="mt-2 text-[1.6rem] font-semibold text-brand-palm">Configure your route</h2>
            <p className="mt-2 text-sm leading-6 text-brand-onSurfaceVariant">
              Choose a city, add your preferred stops, then optimize the path between them.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="route-city" className="field-label mb-2 block">Destination city</label>
              <select
                id="route-city"
                value={selectedCity}
                onChange={(event) => setSelectedCity(event.target.value)}
                className="input-minimal"
              >
                <option value={RANDOM_CITY_KEY}>Random places</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{formatCityName(city)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label mb-2 block">Starting point</label>
              <LocationAutocomplete
                city={selectedCity === RANDOM_CITY_KEY ? '' : selectedCity}
                value={startLocation}
                onSelect={setStartLocation}
                onClear={() => setStartLocation(null)}
              />
            </div>

            <div>
              <label htmlFor="place-search" className="field-label mb-2 block">Planned stops</label>
              <input
                id="place-search"
                value={placeSearch}
                onChange={(event) => setPlaceSearch(event.target.value)}
                placeholder="Add more places..."
                className="input-minimal"
              />
            </div>

            <div>
              <label className="field-label mb-2 block">Add place from Google</label>
              <GooglePlacePicker
                city={selectedCity === RANDOM_CITY_KEY ? '' : selectedCity}
                onSelect={handleGooglePlaceSelect}
                placeholder={selectedCity && selectedCity !== RANDOM_CITY_KEY ? `Search Google places in ${formatCityName(selectedCity)}` : 'Search Google places'}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedPlaces.length > 0 ? (
                selectedPlaces.map((place) => (
                  <button
                    key={place.place_id}
                    type="button"
                    onClick={() => togglePlace(place)}
                    className="rounded-full bg-brand-surfaceLow px-3 py-1.5 text-xs font-semibold text-brand-palm"
                  >
                    {place.name} x
                  </button>
                ))
              ) : (
                <span className="text-sm text-brand-onSurfaceVariant">No stops selected yet.</span>
              )}
            </div>

            <div>
              <p className="field-label mb-2 block">Optimization mode</p>
              <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-brand-surfaceLow p-2">
                {['time', 'distance'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOptimizationMode(mode)}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      optimizationMode === mode
                        ? 'bg-white text-brand-palm shadow-[0_14px_24px_-20px_rgba(15,23,42,0.35)]'
                        : 'text-brand-onSurfaceVariant'
                    }`}
                  >
                    Optimize by {mode}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleOptimize}
              disabled={optimizing}
              className="btn-primary w-full justify-center rounded-full py-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {optimizing ? 'Optimizing route...' : 'Optimize selected route'}
            </button>

            <div className="rounded-[22px] bg-brand-surfaceLow p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-palm">Concierge tip</p>
              <p className="mt-2 text-sm leading-6 text-brand-onSurfaceVariant">
                Use `time` when you care about faster driving flow. Use `distance` for tighter local circuits and less geographic spread.
              </p>
            </div>
          </div>
        </aside>

        <div className="space-y-6 p-5 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:pr-4">
          <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#eef2f7,#dde4ed)] p-6 shadow-[0_24px_56px_-32px_rgba(15,23,42,0.2)]">
            <div className="relative">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-onSurfaceVariant">Optimized route</p>
                  <h2 className="mt-2 text-4xl font-semibold text-brand-palm">
                    {selectedCityLabel ? `${selectedCityLabel} route` : 'Custom route'}
                  </h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="Total stops" value={routeSummary?.total_stops ?? selectedPlaces.length} helper="selected destinations" />
                  <StatCard label="Travel time" value={formatMinutes(routeSummary?.total_travel_minutes ?? 0)} helper="estimated total drive" />
                  <StatCard label="Distance" value={`${routeSummary?.total_distance_km ?? 0} km`} helper="route span" />
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[26px] bg-white p-3">
                <ItineraryMap itinerary={[{ day: 1, start_location: startLocation, route: optimizedRoute?.route || selectedPlaces }]} />
              </div>
            </div>
          </section>

          <section className="rounded-[30px] bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.38)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="field-label">Discoverable places</p>
                <h2 className="mt-2 text-2xl font-semibold text-brand-palm">{selectedCityLabel || 'Selected city'}</h2>
                <p className="mt-2 text-sm text-brand-onSurfaceVariant">
                  {selectedCity === RANDOM_CITY_KEY
                    ? `Showing ${visiblePlaces.length} of ${places.length} randomly selected places.`
                    : `Showing ${visiblePlaces.length} of ${places.length} places in this city.`}
                </p>
              </div>
              <span className="rounded-full bg-brand-surfaceLow px-4 py-2 text-sm font-semibold text-brand-onSurfaceVariant">
                {selectedPlaces.length} selected
              </span>
            </div>

            <div className="mt-6 max-h-[520px] overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                {loadingPlaces ? (
                  <div className="rounded-[24px] bg-brand-surfaceLow p-5 text-sm text-brand-onSurfaceVariant">Loading places...</div>
                ) : visiblePlaces.length === 0 ? (
                  <div className="rounded-[24px] bg-brand-surfaceLow p-8 text-center md:col-span-2">
                    <p className="text-lg font-semibold text-brand-palm">No places matched your search</p>
                    <p className="mt-2 text-sm text-brand-onSurfaceVariant">Try another keyword or clear the search field.</p>
                  </div>
                ) : (
                  visiblePlaces.map((place) => {
                    const selected = selectedPlaces.some((item) => item.place_id === place.place_id)
                    return (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() => togglePlace(place)}
                        className={`rounded-[22px] border p-4 text-left transition ${
                          selected
                            ? 'border-brand-secondary bg-[#edf9f8] shadow-[0_18px_32px_-24px_rgba(0,105,107,0.35)]'
                            : 'border-brand-surfaceHigh bg-brand-surfaceLowest hover:-translate-y-0.5'
                        }`}
                      >
                        <h3 className="text-lg font-semibold text-brand-palm">{place.name}</h3>
                        <p className="mt-2 text-sm text-brand-onSurfaceVariant">{formatCategory(place.category || place.types?.[0] || 'place')}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-[#def7f7] px-3 py-1 text-xs font-semibold text-brand-secondary">
                            Rating {Number(place.rating || 0).toFixed(1)}
                          </span>
                          <span className="text-xs font-medium text-brand-onSurfaceVariant">
                            {Number(place.user_ratings_total || 0).toLocaleString('en-IN')} reviews
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.38)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="field-label">Step-by-step</p>
                <h2 className="mt-2 text-2xl font-semibold text-brand-palm">Optimized order</h2>
              </div>
              {routeSummary ? (
                <span className="rounded-full bg-brand-surfaceLow px-4 py-2 text-sm font-semibold text-brand-onSurfaceVariant">
                  {routeSummary.optimization_mode}
                </span>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              {displayedRoute.length ? (
                displayedRoute.map((place, index) => (
                  <div key={place.place_id} className="rounded-[24px] border border-brand-surfaceHigh bg-brand-surfaceLowest p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-secondary">
                          {place.is_start_location ? 'Start Location' : `Stop ${place.sequence || index}`}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-brand-palm">{place.name}</h3>
                        <p className="mt-2 text-sm text-brand-onSurfaceVariant">
                          {place.is_start_location ? 'Route begins here' : formatCategory(place.category || place.types?.[0] || 'place')}
                        </p>
                      </div>
                      <div className="text-right text-sm text-brand-onSurfaceVariant">
                        {!place.is_start_location && place.travel_time_from_previous ? <p>{place.travel_time_from_previous}</p> : null}
                        {!place.is_start_location && place.travel_distance_from_previous_text ? <p className="mt-1">{place.travel_distance_from_previous_text}</p> : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                      {!place.is_start_location && place.travel_time_to_next ? (
                        <span className="rounded-full bg-brand-surfaceHigh px-3 py-1 text-brand-onSurfaceVariant">
                          Next leg: {place.travel_time_to_next}
                        </span>
                      ) : null}
                      {!place.is_start_location && place.travel_distance_to_next_text ? (
                        <span className="rounded-full bg-[#def7f7] px-3 py-1 text-brand-secondary">
                          {place.travel_distance_to_next_text}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] bg-brand-surfaceLow p-8 text-center">
                  <p className="text-lg font-semibold text-brand-palm">Build a custom route</p>
                  <p className="mt-2 text-sm text-brand-onSurfaceVariant">Choose destinations on the left, then optimize by time or distance to generate a route.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
