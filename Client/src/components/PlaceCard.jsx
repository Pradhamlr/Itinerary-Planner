import { formatCategory, getPlaceTypeTheme, getPlaceVisual, getPrimaryPlaceType, renderStars } from '../utils/travel'

function PlaceCard({ place }) {
  const primaryType = getPrimaryPlaceType(place)
  const visual = getPlaceVisual(place)
  const reviewSnippet = place.reviewSnippet || place.description || 'A promising stop for your itinerary.'
  const rating = Number(place.rating || 0)
  const explanationTags = Array.isArray(place.why_recommended) && place.why_recommended.length > 0
    ? place.why_recommended.slice(0, 3)
    : Array.isArray(place.explanation_tags) ? place.explanation_tags.slice(0, 3) : []

  return (
    <article className="group overflow-hidden rounded-[26px] bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_54px_-30px_rgba(15,23,42,0.42)]">
      <div className={`relative h-48 bg-gradient-to-br ${visual.gradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,5,20,0.28))]" />
        <div className="absolute right-4 top-4 rounded-full bg-[#081120]/78 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          {(place.match_score || place.final_score || rating).toFixed(1)} {place.match_score ? 'Match' : 'Score'}
        </div>
        <div className="relative flex h-full items-end p-4 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b8fbff]">
              {formatCategory(primaryType)}
            </p>
            <h3 className="editorial-title mt-2 line-clamp-2 text-[1.7rem] font-semibold leading-tight">{place.name}</h3>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getPlaceTypeTheme(primaryType)}`}>
            {formatCategory(primaryType)}
          </span>
          {place.user_ratings_total > 0 ? (
            <span className="rounded-full bg-brand-surfaceLow px-3 py-1 text-xs font-semibold text-brand-onSurfaceVariant">
              {place.user_ratings_total} ratings
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-[#e49e00]">{renderStars(rating)}</span>
          <span className="font-semibold text-brand-palm">{rating ? rating.toFixed(1) : 'Unrated'}</span>
          {place.price_level ? (
            <span className="ml-auto text-brand-onSurfaceVariant">{'$'.repeat(Number(place.price_level))}</span>
          ) : null}
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-brand-onSurfaceVariant">{reviewSnippet}</p>

        {explanationTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {explanationTags.map((tag) => (
              <span
                key={`${place.place_id || place.name}-${tag}`}
                className="rounded-full bg-[#e7e3ca] px-3 py-1 text-[11px] font-semibold text-[#6d6a51]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-brand-surfaceHigh pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-palm">{place.city}</p>
            <p className="truncate text-xs text-brand-onSurfaceVariant">
              {place.lat?.toFixed?.(4)}, {place.lng?.toFixed?.(4)}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}&query_place_id=${place.place_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-palm transition hover:text-brand-secondary"
          >
            Explore
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </article>
  )
}

export default PlaceCard
