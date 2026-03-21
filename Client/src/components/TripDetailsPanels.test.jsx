import { render, screen } from '@testing-library/react'
import { ItineraryPanel, RecommendationsPanel } from './TripDetailsPanels'

vi.mock('./ItineraryMap', () => ({
  default: function MockItineraryMap() {
    return <div data-testid="itinerary-map">Map</div>
  },
}))

vi.mock('./PlaceCard', () => ({
  default: function MockPlaceCard({ place }) {
    return <div data-testid="place-card">{place.name}</div>
  },
}))

describe('RecommendationsPanel', () => {
  it('shows saved recommendation metadata when hydrated from snapshot', () => {
    render(
      <RecommendationsPanel
        attractions={[{ place_id: 'a1', name: 'Fort Kochi Beach' }]}
        restaurants={[{ place_id: 'r1', name: 'Paragon' }]}
        metadata={{ ranking_mode: 'hybrid', interest_filter_applied: true }}
        tripDays={3}
        loading={false}
        generated
        error=""
        onRefresh={() => {}}
        generatedAt="2026-03-20T10:00:00.000Z"
        hydratedFromSnapshot
      />,
    )

    expect(screen.getByText('Loaded saved recommendations')).toBeInTheDocument()
    expect(screen.getByText(/Last generated:/)).toBeInTheDocument()
    expect(screen.getByText('Fort Kochi Beach')).toBeInTheDocument()
  })
})

describe('ItineraryPanel', () => {
  it('renders saved itinerary state and day routes', () => {
    render(
      <ItineraryPanel
        itineraryDays={[
          {
            day: 1,
            center: { lat: 9.9, lng: 76.2 },
            route: [
              { place_id: 'a1', name: 'Fort Kochi Beach', category: 'beach', rating: 4.6, lat: 9.9, lng: 76.2 },
            ],
          },
        ]}
        itineraryRestaurants={[]}
        loading={false}
        generated
        error=""
        onRefresh={() => {}}
        generatedAt="2026-03-20T10:00:00.000Z"
        hydratedFromSnapshot
      />,
    )

    expect(screen.getByText('Loaded saved itinerary')).toBeInTheDocument()
    expect(screen.getByText('Day 1')).toBeInTheDocument()
    expect(screen.getByText('Fort Kochi Beach')).toBeInTheDocument()
    expect(screen.getByTestId('itinerary-map')).toBeInTheDocument()
  })
})
