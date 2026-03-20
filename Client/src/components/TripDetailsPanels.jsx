import ItineraryMap from './ItineraryMap'
import PlaceCard from './PlaceCard'
import { formatCategory, renderStars } from '../utils/travel'

function formatGeneratedAt(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDayDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function RecommendationSkeletons({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[26px] border border-white/70 bg-white/90 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div className="h-44 animate-pulse bg-slate-200" />
          <div className="space-y-4 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ItinerarySkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="rounded-[26px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((__, placeIndex) => (
              <div key={placeIndex} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DayPlaceRow({ place, order }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
          {order}
        </div>
        <div>
          <h4 className="font-semibold text-slate-950">{place.name}</h4>
          <p className="mt-1 text-sm text-slate-500">{formatCategory(place.category || place.types?.[0] || 'place')}</p>
          {place.time_slot ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              {place.time_slot}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-medium text-amber-500">{renderStars(place.rating)}</p>
          {place.travel_time_to_next ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Next stop in {place.travel_time_to_next}
            </p>
          ) : null}
        </div>
      </div>

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}&query_place_id=${place.place_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
      >
        Open map
      </a>
    </div>
  )
}

const DAY_COLORS = ['#1E88E5', '#43A047', '#E53935', '#FB8C00', '#8E24AA']

export function RecommendationsPanel({
  attractions,
  restaurants,
  metadata,
  tripDays,
  loading,
  generated,
  error,
  onRefresh,
  generatedAt,
  hydratedFromSnapshot,
}) {
  const formattedGeneratedAt = formatGeneratedAt(generatedAt)

  return (
    <div className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-950">Recommended Attractions</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Attractions are filtered by your interests, re-ranked with popularity-aware scoring, and trimmed into an itinerary-ready pool.
          </p>
        </div>

        {generated && !loading ? (
          <button
            onClick={onRefresh}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Refresh results
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[24px] bg-rose-50 p-5 text-rose-700">
          <p className="font-semibold">Unable to generate recommendations</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-8">
          <RecommendationSkeletons count={6} />
          <RecommendationSkeletons count={3} />
        </div>
      ) : !generated ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
          <h3 className="text-2xl font-semibold text-slate-950">Ready when you are</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Generate smart recommendations to prepare attraction candidates for itinerary planning and separate nearby food options.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              {hydratedFromSnapshot ? 'Loaded saved recommendations' : 'Freshly generated recommendations'}
            </span>
            {formattedGeneratedAt ? (
              <span>Last generated: {formattedGeneratedAt}</span>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Attractions selected</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{attractions.length}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Food options</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{restaurants.length}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Interest filter</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {metadata?.interest_filter_applied ? 'Applied' : 'Fallback'}
              </p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Ranking mode</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{metadata?.ranking_mode || 'hybrid'}</p>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-semibold text-slate-950">Recommended Attractions</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Top sites selected for route optimization across {tripDays} day{tripDays > 1 ? 's' : ''}.
            </p>

            {attractions.length === 0 ? (
              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
                <h4 className="text-xl font-semibold text-slate-950">No attractions matched</h4>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
                  We couldn't assemble an attraction pool for this trip yet. Try broadening interests or refreshing after more place data is available.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {attractions.map((place) => (
                  <PlaceCard key={place.place_id || place._id} place={place} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-2xl font-semibold text-slate-950">Nearby Food Options</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              High-confidence restaurant suggestions are kept separate so they can be slotted into lunch and dinner stops later.
            </p>

            {restaurants.length === 0 ? (
              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
                <h4 className="text-xl font-semibold text-slate-950">No restaurant suggestions yet</h4>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
                  We couldn't find enough highly rated food options for this city right now.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {restaurants.map((place) => (
                  <PlaceCard key={place.place_id || place._id} place={place} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ItineraryPanel({
  itineraryDays,
  itineraryRestaurants,
  loading,
  generated,
  error,
  onRefresh,
  generatedAt,
  hydratedFromSnapshot,
}) {
  const formattedGeneratedAt = formatGeneratedAt(generatedAt)

  return (
    <div className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-950">Day-wise Itinerary</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Clustered attraction groups are ordered with a nearest-neighbor route to preview daily travel flow.
          </p>
        </div>

        {generated && !loading ? (
          <button
            onClick={onRefresh}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Refresh itinerary
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[24px] bg-rose-50 p-5 text-rose-700">
          <p className="font-semibold">Unable to generate itinerary</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <ItinerarySkeleton />
      ) : !generated ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
          <h3 className="text-2xl font-semibold text-slate-950">Build your day plan</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Generate a day-wise itinerary to inspect how attractions are grouped and ordered before map routes are added.
          </p>
        </div>
      ) : itineraryDays.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-10 text-center">
          <h3 className="text-2xl font-semibold text-slate-950">No itinerary yet</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
            We couldn't build daily routes for this trip yet. Generate recommendations first or try a different trip setup.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              {hydratedFromSnapshot ? 'Loaded saved itinerary' : 'Freshly generated itinerary'}
            </span>
            {formattedGeneratedAt ? (
              <span>Last generated: {formattedGeneratedAt}</span>
            ) : null}
          </div>

          <div>
            <h3 className="text-2xl font-semibold text-slate-950">Smart Itinerary Map</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Routes are drawn directly on the map with a different color for each day, using the optimized order returned by the backend.
            </p>
            <div className="mt-5">
              <ItineraryMap itinerary={itineraryDays} />
            </div>
          </div>

          {itineraryDays.map((dayPlan) => {
            const route = dayPlan.route || []
            const formattedDayDate = formatDayDate(dayPlan.date)

            return (
              <article
                key={dayPlan.day}
                className="rounded-[28px] border border-slate-100 bg-slate-50/60 p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-950">Day {dayPlan.day}</h3>
                    <p className="mt-1 text-sm text-slate-500">{route.length} planned stops</p>
                    {formattedDayDate ? (
                      <p className="mt-1 text-sm text-slate-500">{formattedDayDate}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: DAY_COLORS[(dayPlan.day - 1) % DAY_COLORS.length] }}
                    />
                    <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm">
                      Clustered route
                    </div>
                  </div>
                </div>

                {dayPlan.center ? (
                  <p className="mb-2 text-sm text-slate-500">
                    Cluster center: {dayPlan.center.lat.toFixed(4)}, {dayPlan.center.lng.toFixed(4)}
                  </p>
                ) : null}

                {dayPlan.start_location ? (
                  <p className="mb-2 text-sm text-slate-500">
                    Start from: {dayPlan.start_location.lat.toFixed(4)}, {dayPlan.start_location.lng.toFixed(4)}
                  </p>
                ) : null}

                {dayPlan.routing_mode ? (
                  <p className="mb-2 text-sm text-slate-500">Routing mode: {dayPlan.routing_mode}</p>
                ) : null}

                {typeof dayPlan.opening_hours_applied === 'boolean' ? (
                  <p className="mb-4 text-sm text-slate-500">
                    Opening hours: {dayPlan.opening_hours_applied ? 'Applied where available' : 'Not available yet'}
                  </p>
                ) : null}

                <div className="space-y-3">
                  {route.map((place, index) => (
                    <DayPlaceRow
                      key={place.place_id || `${dayPlan.day}-${index}`}
                      place={place}
                      order={index + 1}
                    />
                  ))}
                </div>

                {dayPlan.meal_suggestions?.length ? (
                  <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Suggested meals</p>
                    <div className="mt-3 space-y-2">
                      {dayPlan.meal_suggestions.map((meal) => (
                        <div key={`${dayPlan.day}-${meal.type}-${meal.restaurant?.place_id || meal.restaurant?.name}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-slate-700">{meal.type}</span>
                          <span className="text-slate-600">{meal.restaurant?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}

          {itineraryRestaurants.length > 0 ? (
            <div className="rounded-[28px] border border-slate-100 bg-slate-50/60 p-5 shadow-sm">
              <h3 className="text-2xl font-semibold text-slate-950">Meal Suggestions</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                These restaurants came along with the itinerary response and can be used for lunch or dinner planning later.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {itineraryRestaurants.map((place) => (
                  <PlaceCard key={place.place_id || place._id} place={place} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
