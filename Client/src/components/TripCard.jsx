import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency, getCityGradient, getCityHeroImage, getInterestMeta } from '../utils/travel'

function TripCard({ trip, onDelete }) {
  const interests = trip.interests || []
  const gradient = getCityGradient(trip.city)
  const cityHero = getCityHeroImage(trip.city)
  const [imageFailed, setImageFailed] = useState(false)
  const createdDate = new Date(trip.createdAt)
  const formattedDate = Number.isNaN(createdDate.getTime())
    ? 'Flexible dates'
    : new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(createdDate)
  const destinationCount = trip.recommendationSnapshot?.attractions?.length
    || trip.itinerarySnapshot?.itinerary?.reduce((sum, day) => sum + (day.route?.length || 0), 0)
    || Math.max(trip.days * 4, 0)

  return (
    <article className="group overflow-hidden rounded-[28px] border border-white/70 bg-brand-surfaceLowest shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_-28px_rgba(15,23,42,0.45)]">
      <div className={`relative h-48 bg-gradient-to-br ${gradient}`}>
        {cityHero && !imageFailed ? (
          <img
            src={cityHero.url}
            alt={trip.city}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            style={{ objectPosition: cityHero.position || 'center' }}
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(90,248,251,0.16),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,5,20,0.38))]" />
        <div className="relative flex h-full flex-col justify-between p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-palm backdrop-blur">
              {formattedDate}
            </span>
            <div className="flex -space-x-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-surfaceHigh text-xs font-semibold text-brand-palm">A</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-surfaceHigh text-xs font-semibold text-brand-palm">M</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-secondary text-xs font-semibold text-white">
                +{Math.max(interests.length, 1)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="editorial-title text-3xl font-semibold">{trip.city}</h3>
            <div className="flex items-center justify-between text-sm text-white/90">
              <span>{trip.days} day{trip.days > 1 ? 's' : ''}</span>
              <span>{formatCurrency(trip.budget)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex min-h-[52px] flex-wrap gap-2">
          {interests.length > 0 ? (
            interests.slice(0, 4).map((interest) => {
              const meta = getInterestMeta(interest)
              return (
                <span
                  key={interest}
                  className={`inline-flex items-center rounded-md px-2.5 py-1 leading-none text-[11px] font-semibold ${meta.accent}`}
                >
                  {meta.label}
                </span>
              )
            })
          ) : (
            <span className="text-sm text-brand-onSurfaceVariant">No interests added yet</span>
          )}
          {interests.length > 4 ? (
            <span className="inline-flex items-center rounded-md bg-brand-surfaceHigh px-2.5 py-1 leading-none text-[11px] font-semibold text-brand-onSurfaceVariant">
              +{interests.length - 4} more
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-brand-surfaceHigh pt-4 text-sm">
          <div>
            <p className="text-brand-onSurfaceVariant">{trip.city}, {trip.country || 'Journey planned'}</p>
            <p className="mt-1 inline-flex items-center rounded-md bg-[#def7f7] px-2.5 py-1 text-xs font-medium text-brand-secondary">
              {destinationCount} destinations
            </p>
          </div>
          <Link
            to={`/trip/${trip._id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-palm transition hover:text-brand-secondary"
          >
            View plan
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-brand-onSurfaceVariant">
            {trip.days >= 6 ? 'Slow travel' : trip.days >= 3 ? 'Balanced pace' : 'Quick escape'}
          </div>
          <button
            type="button"
            onClick={() => onDelete(trip._id)}
            className="rounded-full bg-[#ffdad6] px-4 py-2 text-sm font-semibold text-[#93000a] transition hover:brightness-95"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

export default TripCard
