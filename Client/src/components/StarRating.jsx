import { useId } from 'react'
import { getStarFillLevels } from '../utils/travel'

const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'

function StarSvg({ fill, clipId }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1em] w-[1em]" aria-hidden="true">
      <path d={STAR_PATH} fill="#dadce0" />
      {fill > 0 ? (
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={24 * (fill / 100)} height="24" />
          </clipPath>
        </defs>
      ) : null}
      {fill > 0 ? <path d={STAR_PATH} fill="#fbbc04" clipPath={`url(#${clipId})`} /> : null}
    </svg>
  )
}

function StarRating({ rating, size = 'text-sm', className = '' }) {
  const baseId = useId()
  const numericRating = Number(rating || 0)
  const isRated = numericRating > 0
  const fillLevels = getStarFillLevels(numericRating)

  return (
    <span
      className={`inline-flex items-center gap-[1px] leading-none ${size} ${className}`.trim()}
      aria-label={isRated ? `${numericRating.toFixed(1)} out of 5 stars` : 'Unrated'}
    >
      {fillLevels.map((fill, index) => (
        <span key={`${index}-${fill}`} className="inline-flex">
          <StarSvg fill={fill} clipId={`${baseId}-star-${index}`} />
        </span>
      ))}
    </span>
  )
}

export default StarRating
