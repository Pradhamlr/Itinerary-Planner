import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCityName, getCityGradient, getCityHeroImage, getInterestMeta } from '../utils/travel'

function TripCard({ trip, onDelete, onComplete }) {
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
    <article className="group overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.15)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_40px_-12px_rgba(15,23,42,0.2)]">
      <div className={`relative h-48 overflow-hidden bg-gradient-to-br ${gradient}`}>
        {cityHero && !imageFailed ? (
          <img
            src={cityHero.url}
            alt={formatCityName(trip.city)}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            style={{ objectPosition: cityHero.position || 'center' }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between">
          <span className="inline-flex items-center rounded-full bg-white/90 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-palm backdrop-blur-sm">
            {formattedDate}
          </span>
        </div>
        <div className="absolute inset-x-4 bottom-4 text-white">
          <h3 className="editorial-title text-2xl font-bold">{formatCityName(trip.city)}</h3>
          <div className="mt-2 flex items-center justify-between text-sm font-semibold">
            <span>{trip.days} day{trip.days > 1 ? 's' : ''}</span>
            <span>{trip.completed ? 'Completed' : 'Active trip'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex min-h-[40px] flex-wrap gap-2">
          {interests.length > 0 ? (
            interests.slice(0, 3).map((interest) => {
              const meta = getInterestMeta(interest)
              return (
                <span
                  key={interest}
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold ${meta.accent}`}
                >
                  {meta.label}
                </span>
              )
            })
          ) : (
            <span className="text-sm text-gray-500">No interests added yet</span>
          )}
          {interests.length > 3 ? (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
              +{interests.length - 3} more
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div>
            <p className="text-sm text-gray-600">{formatCityName(trip.city)}, {trip.country || 'Journey planned'}</p>
            <p className="mt-2 text-xs font-semibold text-brand-secondary">
              {destinationCount} destinations
            </p>
          </div>
          <Link
            to={`/trip/${trip._id}`}
            className="text-sm font-semibold text-brand-palm transition hover:text-brand-secondary"
          >
            View plan →
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-sm text-gray-600">
            {trip.days >= 6 ? 'Slow travel' : trip.days >= 3 ? 'Balanced pace' : 'Quick escape'}
          </span>
          <div className="flex items-center gap-2">
            {!trip.completed ? (
              <button
                type="button"
                onClick={() => onComplete?.(trip)}
                className="rounded-full bg-[#edf7ed] px-4 py-2 text-sm font-semibold text-[#2c6a3d] transition hover:bg-[#dff0e2]"
              >
                Mark as Completed
              </button>
            ) : (
              <span className="rounded-full bg-[#edf7ed] px-4 py-2 text-sm font-semibold text-[#2c6a3d]">
                Completed
              </span>
            )}
            <button
              type="button"
              onClick={() => onDelete(trip._id)}
              className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default TripCard
