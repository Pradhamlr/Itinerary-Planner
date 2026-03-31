import { useState } from 'react'
import ItineraryMap from './ItineraryMap'
import PlaceCard from './PlaceCard'
import StarRating from './StarRating'
import {
  formatCategory,
  getDayDifficulty,
  getPlaceInsightBadges,
  getTripTypeLabel,
  getWhyThisPlaceText,
} from '../utils/travel'

function ActionIcon({ type }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
    className: 'h-4 w-4',
  }

  if (type === 'lock') {
    return (
      <svg {...commonProps}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      </svg>
    )
  }

  if (type === 'unlock') {
    return (
      <svg {...commonProps}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 7.2-2.4" />
      </svg>
    )
  }

  if (type === 'swap') {
    return (
      <svg {...commonProps}>
        <path d="M16 3h5v5" />
        <path d="M21 3l-7 7" />
        <path d="M8 21H3v-5" />
        <path d="M3 21l7-7" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

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

function RecommendationSkeletons({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[26px] bg-white shadow-soft">
          <div className="h-48 animate-pulse bg-[#ddd7be]" />
          <div className="space-y-4 p-4">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#ddd7be]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[#ddd7be]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ItinerarySkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(340px,0.86fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[26px] bg-white p-4 shadow-soft">
            <div className="h-5 w-32 animate-pulse rounded-full bg-[#ddd7be]" />
            <div className="mt-4 h-32 animate-pulse rounded-[22px] bg-[#ece4c9]" />
          </div>
        ))}
      </div>
      <div className="min-h-[560px] rounded-[30px] bg-[#ece4c9]" />
    </div>
  )
}

function formatMinutes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 mins'
  }

  if (value < 60) {
    return `${value} mins`
  }

  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return minutes ? `${hours} hr ${minutes} mins` : `${hours} hr`
}

function InfoHint({ label, hint }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-surfaceLow text-[11px] font-bold text-brand-secondary"
      title={hint}
      aria-label={`${label}: ${hint}`}
    >
      i
    </span>
  )
}

function getDifficultyTone(difficulty) {
  const tones = {
    Low: 'bg-[#edf7ed] text-[#2c6a3d]',
    Medium: 'bg-[#fff3e2] text-[#8a5418]',
    High: 'bg-[#fbe3e3] text-[#9c2f2f]',
  }

  return tones[difficulty] || 'bg-brand-surfaceLow text-brand-onSurfaceVariant'
}

function parseMealStopIndex(label) {
  if (!label) {
    return null
  }

  const match = label.match(/Near stop\s+(\d+)/i)
  if (!match) {
    return null
  }

  const stopNumber = Number(match[1])
  if (!Number.isFinite(stopNumber) || stopNumber <= 0) {
    return null
  }

  return stopNumber - 1
}

function MealFlowCard({ meal }) {
  const mealTone =
    meal.type?.toLowerCase() === 'lunch'
      ? 'bg-[#fff3e2] text-[#8a5418]'
      : 'bg-[#efe9ff] text-[#5b43a9]'

  return (
    <div className="relative ml-10 rounded-[22px] border border-brand-surfaceHigh bg-white p-4 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.2)]">
      <div className="absolute -left-10 top-5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f4eee6] text-[11px] font-semibold text-brand-palm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M8 3v8" />
          <path d="M5 3v8" />
          <path d="M5 7h3" />
          <path d="M16 3v18" />
          <path d="M19 3v6a3 3 0 0 1-3 3h0" />
        </svg>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-secondary">
        {meal.type?.toLowerCase() === 'lunch' ? 'Afternoon food' : 'Evening food'}
      </p>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-brand-palm">
            {meal.restaurant?.name || 'Food suggestion'}
          </h4>
          <p className="mt-1 text-sm text-brand-onSurfaceVariant">
            {meal.type || 'Meal stop'} suggestion placed naturally into your day flow.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mealTone}`}>
          {meal.type || 'Meal'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {meal.highlight_label ? (
          <span className="rounded-full bg-[#f5d9c2] px-3 py-1 text-xs font-semibold text-[#7a3d11]">
            {meal.highlight_label}
          </span>
        ) : null}
        {meal.near_stop_label ? (
          <span className="rounded-full bg-brand-surfaceHigh px-3 py-1 text-xs font-semibold text-brand-onSurfaceVariant">
            {meal.near_stop_label}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function DayPlaceRow({
  place,
  order,
  selected,
  onSelect,
  onToggleLock,
  onRequestSwap,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragTarget,
}) {
  const [imageVisible, setImageVisible] = useState(true)
  const clientMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const fallbackPhotoUrl = place.photo_reference && clientMapsApiKey
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(place.photo_reference)}&key=${encodeURIComponent(clientMapsApiKey)}`
    : null
  const photoUrl = place.photo_url || fallbackPhotoUrl
  const showPhoto = Boolean(photoUrl) && imageVisible
  const whyThisPlace = getWhyThisPlaceText(place)
  const insightBadges = getPlaceInsightBadges(place)

  return (
    <div className="relative pl-10">
      <div className="absolute left-[11px] top-[18px] bottom-[-28px] w-px bg-brand-surfaceHigh last:hidden" />
      <div className="absolute left-0 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-semibold text-white">
        {order}
      </div>

      {place.time_slot ? (
        <p className="mb-2 ml-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-secondary">
          {place.time_slot}
        </p>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        draggable={draggable}
        onClick={onSelect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect()
          }
        }}
        className={`group flex gap-4 rounded-[24px] border p-4 text-left transition ${
          selected
            ? 'border-brand-secondary/20 bg-[#edf9f8] shadow-[0_18px_32px_-24px_rgba(0,105,107,0.35)]'
            : isDragTarget
            ? 'border-[#d2ece7] bg-[#f2fbfb]'
            : 'border-brand-surfaceHigh bg-white shadow-[0_14px_32px_-26px_rgba(15,23,42,0.22)] hover:-translate-y-0.5'
        }`}
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px] bg-[linear-gradient(160deg,#d2edf0,#73c7d3,#0f4c81)]">
          {showPhoto ? (
            <img
              src={photoUrl}
              alt={place.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              onError={() => setImageVisible(false)}
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.2))]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xl font-semibold leading-tight text-brand-palm">{place.name}</h4>
              <p className="mt-2 text-sm leading-6 text-brand-onSurfaceVariant">
                {place.description || place.reviewSnippet || 'A thoughtfully selected stop for this day.'}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleLock?.()
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-surfaceLow text-brand-palm transition hover:bg-brand-surfaceHigh"
                title={place.locked ? 'Unlock' : 'Lock'}
              >
                <ActionIcon type={place.locked ? 'unlock' : 'lock'} />
              </button>
              <button
                type="button"
                disabled={place.locked}
                onClick={(event) => {
                  event.stopPropagation()
                  onRequestSwap?.()
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-surfaceLow text-brand-palm transition hover:bg-brand-surfaceHigh disabled:cursor-not-allowed disabled:opacity-40"
                title="Swap"
              >
                <ActionIcon type="swap" />
              </button>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-surfaceLow text-brand-palm">
                <ActionIcon type="more" />
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#dcf7f7] px-3 py-1 text-xs font-semibold text-brand-secondary">
              {formatCategory(place.category || place.types?.[0] || 'place')}
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-palm">
              <StarRating rating={place.rating} />
              {Number(place.rating || 0) > 0 ? Number(place.rating || 0).toFixed(1) : 'Unrated'}
            </span>
            {insightBadges.map((badge) => (
              <span key={`${place.place_id || place.name}-${badge}`} className="rounded-full bg-[#f5ecd2] px-3 py-1 text-xs font-semibold text-[#7a5a10]">
                {badge}
              </span>
            ))}
            {place.locked ? (
              <span className="rounded-full bg-[#edf7ed] px-3 py-1 text-xs font-semibold text-[#2c6a3d]">Locked</span>
            ) : null}
          </div>

          <div className="mt-4 rounded-[18px] bg-brand-surfaceLow px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-secondary">Why this place?</p>
            <p className="mt-2 text-sm leading-6 text-brand-onSurfaceVariant">{whyThisPlace}</p>
          </div>
        </div>
      </div>

      {place.travel_time_to_next ? (
        <div className="ml-2 mt-4 flex items-center gap-3">
          <div className="h-8 border-l-2 border-dashed border-brand-outlineVariant/70" />
          <span className="inline-flex items-center rounded-full bg-brand-surfaceHigh px-3 py-1 text-xs font-semibold text-brand-onSurfaceVariant">
            ~ {place.travel_time_to_next} travel to next stop
          </span>
        </div>
      ) : null}
    </div>
  )
}

const DAY_COLORS = ['#00696b', '#4f46e5', '#f97316', '#0ea5e9', '#a855f7']

export function RecommendationsPanel({
  attractions,
  masterAttractionPool = [],
  replacementAttractionPool = [],
  restaurants,
  metadata,
  pairingSuggestions = [],
  pairingInterestLoading = '',
  tripDays,
  loading,
  generated,
  error,
  onRefresh,
  onApplyPairing,
  generatedAt,
  hydratedFromSnapshot,
  onGenerateItinerary,
  itineraryLoading,
}) {
  const formattedGeneratedAt = formatGeneratedAt(generatedAt)
  const universePlaces = [
    ...attractions,
    ...replacementAttractionPool,
    ...masterAttractionPool,
  ].reduce((accumulator, place) => {
    const placeKey = place?.place_id || place?._id || place?.name
    if (!placeKey || accumulator.some((entry) => (entry.place_id || entry._id || entry.name) === placeKey)) {
      return accumulator
    }
    return [...accumulator, place]
  }, [])
  const extendedPool = universePlaces.filter((place) => !attractions.some((selected) => (selected.place_id || selected._id || selected.name) === (place.place_id || place._id || place.name)))

  return (
    <section className="space-y-8 rounded-[30px] bg-white p-6 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="field-label">Discovery</p>
          <h2 className="editorial-title mt-2 text-[1.8rem] font-semibold text-brand-palm">Top Attractions</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-onSurfaceVariant sm:text-base">
            Smart recommendations based on ratings, popularity, and interest-aware hybrid scoring, shaped for a {tripDays}-day journey.
          </p>
        </div>
        {generated && !loading ? (
          <button onClick={onRefresh} className="btn-secondary">
            Refresh Results
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[24px] bg-[#f5ddd8] p-5 text-[#8a3022]">
          <p className="font-semibold">Unable to generate recommendations</p>
          <p className="mt-2 text-sm">{error}</p>
          {pairingSuggestions.length > 0 ? (
            <div className="mt-4 rounded-[18px] bg-white/55 p-4 text-sm text-[#713127]">
              <p className="font-semibold">Pair this vibe with a close match:</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {pairingSuggestions.map((suggestion) => {
                  const isLoading = pairingInterestLoading === suggestion.interest
                  return (
                    <button
                      key={`${suggestion.primary_interest}-${suggestion.interest}`}
                      type="button"
                      onClick={() => onApplyPairing?.(suggestion.interest)}
                      disabled={Boolean(pairingInterestLoading)}
                      className="inline-flex items-center gap-2 rounded-full bg-[#0c3f46] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(12,63,70,0.9)] transition hover:bg-[#125963] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/16 text-xs">
                        +
                      </span>
                      {isLoading ? `Pairing ${suggestion.suggested_interest_label}...` : `Pair with ${suggestion.suggested_interest_label}`}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 space-y-2">
                {pairingSuggestions.map((suggestion) => (
                  <p
                    key={`${suggestion.primary_interest}-${suggestion.interest}-reason`}
                    className="text-xs leading-6 text-[#8a3022]"
                  >
                    <span className="font-semibold">{suggestion.suggested_interest_label}:</span> {suggestion.reason}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : loading ? (
        <div className="space-y-8">
          <RecommendationSkeletons count={3} />
          <RecommendationSkeletons count={2} />
        </div>
      ) : !generated ? (
        <div className="rounded-[28px] bg-brand-surfaceLow p-10 text-center">
          <h3 className="text-2xl font-semibold text-brand-palm">Generate your first curated collection</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-brand-onSurfaceVariant">
            We'll prepare attractions, food spots, and explanation tags before sequencing them into an itinerary.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex flex-wrap items-center gap-3 text-sm text-brand-onSurfaceVariant">
            <span className="rounded-full bg-brand-surfaceLow px-3 py-1 font-semibold text-brand-palm">
              {hydratedFromSnapshot ? 'Loaded saved recommendations' : 'Fresh recommendations'}
            </span>
            {formattedGeneratedAt ? <span>Last generated: {formattedGeneratedAt}</span> : null}
            <span className="rounded-full bg-[#def7f7] px-3 py-1 font-semibold text-brand-secondary">
              {metadata?.ranking_mode || 'hybrid'} ranking
            </span>
          </div>

          {pairingSuggestions.length > 0 ? (
            <div className="rounded-[24px] border border-[#f1dfbf] bg-[#fff9ef] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9a5b03]">Smart Pairing</p>
                  <p className="mt-2 text-sm leading-7 text-[#6f5313]">
                    Pair {pairingSuggestions[0]?.primary_interest_label} with {pairingSuggestions.map((suggestion) => suggestion.suggested_interest_label).join(' or ')} to widen the pool and regenerate both recommendations and itinerary with one click.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {pairingSuggestions.map((suggestion) => {
                    const isLoading = pairingInterestLoading === suggestion.interest
                    return (
                      <button
                        key={`${suggestion.primary_interest}-${suggestion.interest}-banner`}
                        type="button"
                        onClick={() => onApplyPairing?.(suggestion.interest)}
                        disabled={Boolean(pairingInterestLoading)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#0c3f46] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(12,63,70,0.9)] transition hover:bg-[#125963] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/16 text-xs">
                          +
                        </span>
                        {isLoading ? `Pairing ${suggestion.suggested_interest_label}...` : `Pair with ${suggestion.suggested_interest_label}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <h3 className="text-[1.35rem] font-semibold text-brand-palm">Top Attractions</h3>
              <span className="rounded-full bg-brand-surfaceHigh px-3 py-1 text-sm font-medium text-brand-onSurfaceVariant">
                {attractions.length} selected
              </span>
            </div>
            {attractions.length === 0 ? (
              <div className="rounded-[28px] bg-brand-surfaceLow p-10 text-center">
                <p className="text-lg font-semibold text-brand-palm">No attractions matched this trip yet.</p>
                {pairingSuggestions.length > 0 ? (
                  <div className="mx-auto mt-4 max-w-xl space-y-4">
                    <p className="text-sm leading-7 text-brand-onSurfaceVariant">
                      Pair {pairingSuggestions[0]?.primary_interest_label} with {pairingSuggestions.map((suggestion) => suggestion.suggested_interest_label).join(' or ')} to widen the pool without drifting too far from the same vibe.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {pairingSuggestions.map((suggestion) => {
                        const isLoading = pairingInterestLoading === suggestion.interest
                        return (
                          <button
                            key={`${suggestion.primary_interest}-${suggestion.interest}-empty`}
                            type="button"
                            onClick={() => onApplyPairing?.(suggestion.interest)}
                            disabled={Boolean(pairingInterestLoading)}
                            className="inline-flex items-center gap-2 rounded-full bg-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(0,94,104,0.85)] transition hover:bg-[#0b747f] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                              +
                            </span>
                            {isLoading ? `Pairing ${suggestion.suggested_interest_label}...` : `Pair with ${suggestion.suggested_interest_label}`}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {attractions.map((place) => (
                  <PlaceCard key={place.place_id || place._id} place={place} />
                ))}
              </div>
            )}
          </section>

          {extendedPool.length > 0 ? (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <h3 className="text-[1.35rem] font-semibold text-brand-palm">Extended Itinerary Pool</h3>
                <span className="rounded-full bg-[#edf6f7] px-3 py-1 text-sm font-medium text-brand-secondary">
                  {extendedPool.length} additional picks
                </span>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-brand-onSurfaceVariant">
                These are extra recommendation candidates from the broader master and replacement pools. Itinerary generation may draw from this set, so any place you see later in the route still comes from your recommendation universe.
              </p>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {extendedPool.slice(0, 12).map((place) => (
                  <PlaceCard key={place.place_id || place._id} place={place} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <h3 className="text-[1.35rem] font-semibold text-brand-palm">Top Restaurants</h3>
              <span className="rounded-full bg-brand-surfaceHigh px-3 py-1 text-sm font-medium text-brand-onSurfaceVariant">
                {restaurants.length} selected
              </span>
            </div>
            {restaurants.length === 0 ? (
              <div className="rounded-[28px] bg-brand-surfaceLow p-10 text-center">
                <p className="text-lg font-semibold text-brand-palm">No restaurant suggestions yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {restaurants.slice(0, 4).map((place) => (
                  <PlaceCard key={place.place_id || place._id} place={place} />
                ))}
              </div>
            )}
          </section>

          <div className="rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(90,248,251,0.12),transparent_20%),linear-gradient(135deg,#000514,#001e43)] px-8 py-10 text-center text-white shadow-[0_24px_56px_-30px_rgba(15,23,42,0.6)]">
            <h3 className="editorial-title text-[1.75rem] font-semibold">Ready for your itinerary?</h3>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
              We'll sequence these selections into a logical, high-efficiency route across your trip.
            </p>
            <button
              type="button"
              onClick={onGenerateItinerary}
              disabled={itineraryLoading}
              className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-10 py-4 text-base font-semibold text-brand-palm transition hover:bg-[#f2f7fb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {itineraryLoading ? 'Generating...' : 'Generate Itinerary'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function ItineraryPanel({
  itineraryDays,
  loading,
  generated,
  error,
  onRefresh,
  generatedAt,
  hydratedFromSnapshot,
  onToggleLock,
  onRegenerateDay,
  onReorderDay,
  actionDay,
  onFinalize,
  savingFinalized,
  finalizedGeneratedAt,
  onRequestSwap,
  onApplySwap,
  onCloseSwap,
  swapState,
}) {
  const formattedGeneratedAt = formatGeneratedAt(generatedAt)
  const formattedFinalizedAt = formatGeneratedAt(finalizedGeneratedAt)
  const [selectedStopKey, setSelectedStopKey] = useState(null)
  const [draggedStop, setDraggedStop] = useState(null)
  const [dragTarget, setDragTarget] = useState(null)
  const tripType = getTripTypeLabel(itineraryDays)

  const getStopKey = (dayPlan, place, index) => `${dayPlan.day}-${place.place_id || place.name}-${index}`

  return (
    <section className="space-y-6 rounded-[30px] bg-white p-6 shadow-[0_18px_46px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="editorial-title text-[1.8rem] font-semibold text-brand-palm">Day-by-Day Journey</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-onSurfaceVariant sm:text-base">
            Optimized for minimal travel time, then balanced for meals, pacing, and stop variety.
          </p>
        </div>

        {generated && !loading ? (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onFinalize}
              disabled={savingFinalized}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingFinalized ? 'Saving final...' : 'Save Finalized'}
            </button>
            <button onClick={onRefresh} className="btn-secondary">
              Refresh Itinerary
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[24px] bg-[#f5ddd8] p-5 text-[#8a3022]">
          <p className="font-semibold">Unable to generate itinerary</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <ItinerarySkeleton />
      ) : !generated ? (
        <div className="rounded-[28px] bg-brand-surfaceLow p-10 text-center">
          <h3 className="text-2xl font-semibold text-brand-palm">Build your day-by-day plan</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-brand-onSurfaceVariant">
            Generate an itinerary to enter the workspace view with grouped attractions, travel pacing, and map routing.
          </p>
        </div>
      ) : itineraryDays.length === 0 ? (
        <div className="rounded-[28px] bg-brand-surfaceLow p-10 text-center">
          <h3 className="text-2xl font-semibold text-brand-palm">No itinerary available yet</h3>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-brand-onSurfaceVariant">
            <span className="rounded-full bg-brand-surfaceLow px-3 py-1 font-semibold text-brand-palm">
              {hydratedFromSnapshot ? 'Loaded saved itinerary' : 'Freshly generated itinerary'}
            </span>
            <span className="rounded-full bg-[#def7f7] px-3 py-1 font-semibold text-brand-secondary">
              Trip Type: {tripType}
            </span>
            {formattedGeneratedAt ? <span>Last generated: {formattedGeneratedAt}</span> : null}
            {formattedFinalizedAt ? (
              <span className="rounded-full bg-[#edf7ed] px-3 py-1 font-semibold text-[#2c6a3d]">
                Finalized at {formattedFinalizedAt}
              </span>
            ) : null}
          </div>

          <div className="space-y-8">
            <div className="overflow-hidden rounded-[30px] bg-white shadow-[0_18px_46px_-30px_rgba(15,23,42,0.35)]">
              <div className="border-b border-brand-surfaceHigh px-5 py-4">
                <h3 className="text-[1.3rem] font-semibold text-brand-palm">Map View</h3>
                <p className="mt-1 text-sm text-brand-onSurfaceVariant">See how your day-by-day journey flows across the city.</p>
              </div>
              <div className="p-3">
                <ItineraryMap
                  itinerary={itineraryDays}
                  selectedStopKey={selectedStopKey}
                  onSelectStop={setSelectedStopKey}
                />
              </div>
            </div>

            <div className="space-y-6">
              {itineraryDays.map((dayPlan) => {
                const route = dayPlan.route || []
                const mealsByStopIndex = (dayPlan.meal_suggestions || []).reduce((accumulator, meal) => {
                  const stopIndex = parseMealStopIndex(meal.near_stop_label)
                  if (stopIndex === null) {
                    return accumulator
                  }

                  if (!accumulator[stopIndex]) {
                    accumulator[stopIndex] = []
                  }

                  accumulator[stopIndex].push(meal)
                  return accumulator
                }, {})
                const formattedDayDate = formatDayDate(dayPlan.date)
                const travelAvg = dayPlan.route_stats?.total_travel_minutes
                  ? Math.round(dayPlan.route_stats.total_travel_minutes / Math.max(route.length, 1))
                  : 0
                const dayDifficulty = getDayDifficulty(dayPlan)

                return (
                  <article key={dayPlan.day} className="rounded-[26px] bg-[#fbfcfd] p-4 ring-1 ring-brand-surfaceHigh">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: DAY_COLORS[(dayPlan.day - 1) % DAY_COLORS.length] }}
                        >
                          {dayPlan.day}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-secondary">Day {dayPlan.day} Plan</p>
                          <h3 className="editorial-title text-[1.55rem] font-semibold text-brand-palm">
                            {dayPlan.day_title || `Day ${dayPlan.day}`}
                          </h3>
                          <p className="mt-2 text-sm text-brand-onSurfaceVariant">
                            {formattedDayDate || `${route.length} planned stops`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-2 text-sm font-semibold ${getDifficultyTone(dayDifficulty)}`}>
                          Difficulty: {dayDifficulty}
                        </span>
                        {formattedDayDate ? (
                          <span className="rounded-full bg-brand-surfaceLow px-3 py-2 text-sm font-medium text-brand-onSurfaceVariant">
                            {formattedDayDate}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onRegenerateDay?.(dayPlan.day)}
                          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-secondary ring-1 ring-brand-surfaceHigh transition hover:bg-brand-surfaceLow"
                        >
                          {actionDay === dayPlan.day ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.2)]">
                      <p className="text-sm text-brand-onSurfaceVariant">Travel Info</p>
                      <p className="mt-1 text-sm text-brand-onSurfaceVariant">
                        ~{formatMinutes(travelAvg)} travel between stops
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary">
                        Total travel time: {formatMinutes(dayPlan.route_stats?.total_travel_minutes || 0)}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-[24px] bg-white p-4 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.2)] md:grid-cols-2">
                      <div className="rounded-[18px] bg-[#edf7ed] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2c6a3d]">Start from</p>
                        <p className="mt-2 text-sm font-semibold text-[#20502d]">{dayPlan.start_location?.name || 'Trip start'}</p>
                      </div>
                      <div className="rounded-[18px] bg-[#fbe3e3] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c2f2f]">End at</p>
                        <p className="mt-2 text-sm font-semibold text-[#7f2323]">{dayPlan.end_location?.name || route[route.length - 1]?.name || 'Day end'}</p>
                      </div>
                    </div>

                    {dayPlan.customized_order ? (
                      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                        Stop order was customized manually. Travel timings and day totals were recalculated for this arrangement.
                      </div>
                    ) : null}

                    <div className="mt-5">
                      <div className="mb-4 flex items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-secondary">Places</p>
                        <InfoHint label="Places" hint="These places stay in the same order unless you explicitly recalculate or reorder them." />
                      </div>
                    </div>

                    <div className="space-y-6">
                      {route.map((place, index) => (
                        <div key={place.place_id || `${dayPlan.day}-${index}`} className="space-y-4">
                          <DayPlaceRow
                            place={place}
                            order={index + 1}
                            selected={selectedStopKey === getStopKey(dayPlan, place, index)}
                            onSelect={() => setSelectedStopKey(getStopKey(dayPlan, place, index))}
                            onToggleLock={() => onToggleLock?.(dayPlan.day, place.place_id)}
                            onRequestSwap={() => onRequestSwap?.(dayPlan.day, place)}
                            draggable
                            onDragStart={() => {
                              setDraggedStop({ day: dayPlan.day, index })
                              setDragTarget({ day: dayPlan.day, index })
                            }}
                            onDragEnd={() => {
                              setDraggedStop(null)
                              setDragTarget(null)
                            }}
                            onDragOver={(event) => {
                              event.preventDefault()
                              setDragTarget({ day: dayPlan.day, index })
                            }}
                            onDrop={(event) => {
                              event.preventDefault()
                              if (draggedStop && draggedStop.day === dayPlan.day && draggedStop.index !== index) {
                                onReorderDay?.(dayPlan.day, draggedStop.index, index)
                              }
                              setDraggedStop(null)
                              setDragTarget(null)
                            }}
                            isDragTarget={dragTarget?.day === dayPlan.day && dragTarget?.index === index}
                          />

                          {(mealsByStopIndex[index] || []).map((meal) => (
                            <MealFlowCard
                              key={`${dayPlan.day}-${index}-${meal.type}-${meal.restaurant?.place_id || meal.restaurant?.name}`}
                              meal={meal}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          {swapState?.open ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-2xl rounded-[30px] bg-white p-6 shadow-[0_34px_80px_-34px_rgba(15,23,42,0.5)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="editorial-title text-[1.55rem] font-semibold text-brand-palm">Similar places you might like</h3>
                    <p className="mt-2 text-sm leading-7 text-brand-onSurfaceVariant">
                      Replace <span className="font-semibold text-brand-palm">{swapState.place?.name}</span> with a similar stop that keeps the day feeling coherent.
                    </p>
                  </div>
                  <button type="button" onClick={onCloseSwap} className="btn-ghost px-4 py-2">
                    Close
                  </button>
                </div>

                {swapState.loading ? (
                  <div className="mt-6 rounded-2xl bg-brand-surfaceLow p-5 text-sm text-brand-onSurfaceVariant">
                    Finding swap suggestions...
                  </div>
                ) : swapState.suggestions?.length ? (
                  <div className="mt-6 space-y-3">
                    {swapState.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.place_id}
                        className="flex flex-col gap-4 rounded-[24px] bg-brand-surfaceLow p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <h4 className="text-xl font-semibold text-brand-palm">{suggestion.name}</h4>
                          <p className="mt-1 text-sm text-brand-onSurfaceVariant">{formatCategory(suggestion.category || suggestion.types?.[0] || 'place')}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(suggestion.inferred_interest_tags || []).slice(0, 3).map((tag) => (
                              <span key={`${suggestion.place_id}-${tag}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-onSurfaceVariant">
                                {formatCategory(tag)}
                              </span>
                            ))}
                          </div>
                          {suggestion.swap_match_reason ? (
                            <p className="mt-2 text-xs font-semibold text-brand-secondary">{suggestion.swap_match_reason}</p>
                          ) : null}
                          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-brand-palm">
                            <StarRating rating={suggestion.rating} />
                            {Number(suggestion.rating || 0) > 0 ? Number(suggestion.rating || 0).toFixed(1) : 'Unrated'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplySwap?.(suggestion.place_id)}
                          disabled={swapState.applyingPlaceId === suggestion.place_id}
                          className="btn-primary px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {swapState.applyingPlaceId === suggestion.place_id ? 'Swapping...' : 'Use this'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl bg-brand-surfaceLow p-5 text-sm text-brand-onSurfaceVariant">
                    No good swap suggestions are available for this stop right now.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
