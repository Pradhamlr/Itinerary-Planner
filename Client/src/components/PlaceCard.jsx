import { formatCategory, getPlaceTypeTheme, getPlaceVisual, getPrimaryPlaceType, renderStars } from '../utils/travel'

function ScoreBadge({ label, value, tone }) {
  if (value === undefined || value === null) {
    return null
  }

  return (
    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}: {value}
    </div>
  )
}

function PlaceCard({ place }) {
  const primaryType = getPrimaryPlaceType(place)
  const visual = getPlaceVisual(place)
  const reviewSnippet = place.reviewSnippet || place.description || 'A promising stop for your itinerary.'
  const rating = Number(place.rating || 0)
  const explanationTags = Array.isArray(place.explanation_tags) ? place.explanation_tags.slice(0, 3) : []

  return (
    <article className="group overflow-hidden rounded-[26px] border border-white/70 bg-white/90 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
      <div className={`relative h-44 bg-gradient-to-br ${visual.gradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.42))]" />
        <div className="relative flex h-full flex-col justify-between p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] backdrop-blur">
              {visual.icon}
            </span>
            {rating > 0 ? (
              <div className="rounded-full bg-white/18 px-3 py-1 text-sm font-semibold backdrop-blur">
                {rating.toFixed(1)}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
              {formatCategory(primaryType)}
            </p>
            <h3 className="mt-2 text-xl font-semibold leading-tight">{place.name}</h3>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPlaceTypeTheme(primaryType)}`}>
            {formatCategory(primaryType)}
          </span>
          {place.user_ratings_total > 0 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {place.user_ratings_total} ratings
            </span>
          ) : null}
          <ScoreBadge
            label="Smart"
            value={place.final_score ? Number(place.final_score).toFixed(2) : null}
            tone="bg-sky-100 text-sky-800"
          />
          <ScoreBadge
            label="ML"
            value={place.ml_score ? Number(place.ml_score).toFixed(2) : null}
            tone="bg-violet-100 text-violet-800"
          />
          {place.interest_match_score ? (
            <ScoreBadge label="Match" value="Yes" tone="bg-emerald-100 text-emerald-800" />
          ) : null}
        </div>

        {explanationTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {explanationTags.map((tag) => (
              <span
                key={`${place.place_id || place.name}-${tag}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <p className="text-sm font-semibold text-amber-500">{renderStars(rating)}</p>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{reviewSnippet}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{place.city}</p>
            <p className="truncate text-xs text-slate-500">
              {place.lat?.toFixed?.(4)}, {place.lng?.toFixed?.(4)}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}&query_place_id=${place.place_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            View location
          </a>
        </div>
      </div>
    </article>
  )
}

export default PlaceCard
