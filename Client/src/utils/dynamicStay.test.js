import { buildDefaultHotelSelections, deriveDynamicAnchoredItinerary } from './dynamicStay'

describe('dynamicStay utilities', () => {
  it('applies default selections and reanchors days forward without changing route order', () => {
    const dynamicHotelDays = [
      {
        day: 1,
        suggested_hotels: [
          { _id: 'h1', name: 'Hotel One', location: { lat: 10, lng: 20 } },
          { _id: 'h1b', name: 'Backup One', location: { lat: 10.1, lng: 20.1 } },
        ],
      },
      {
        day: 2,
        suggested_hotels: [
          { _id: 'h2', name: 'Hotel Two', location: { lat: 11, lng: 21 } },
        ],
      },
      {
        day: 3,
        suggested_hotels: [
          { _id: 'h3', name: 'Hotel Three', location: { lat: 12, lng: 22 } },
        ],
      },
    ]

    const hotelSelections = buildDefaultHotelSelections(dynamicHotelDays)
    const itineraryDays = [
      {
        day: 1,
        start_location: { name: 'Initial Hotel', lat: 9, lng: 19 },
        route: [{ place_id: 'p1', name: 'Museum', lat: 9.5, lng: 19.5 }],
      },
      {
        day: 2,
        start_location: { name: 'Original Day 2 Start', lat: 9.6, lng: 19.6 },
        route: [{ place_id: 'p2', name: 'Beach', lat: 10.5, lng: 20.5 }],
      },
      {
        day: 3,
        start_location: { name: 'Original Day 3 Start', lat: 10.6, lng: 20.6 },
        route: [{ place_id: 'p3', name: 'Fort', lat: 11.5, lng: 21.5 }],
      },
    ]

    const derived = deriveDynamicAnchoredItinerary({
      itineraryDays,
      dynamicHotelDays,
      hotelSelections,
      continuedStayDays: { 2: true },
      initialHotelLocation: { name: 'Initial Hotel', lat: 9, lng: 19 },
      dynamicEnabled: true,
    })

    expect(derived[0].start_location.name).toBe('Hotel One')
    expect(derived[0].end_location.name).toBe('Hotel One')
    expect(derived[1].start_location.name).toBe('Hotel One')
    expect(derived[1].end_location.name).toBe('Hotel One')
    expect(derived[2].start_location.name).toBe('Hotel One')
    expect(derived[2].end_location.name).toBe('Hotel Three')
    expect(derived[2].route[0].name).toBe('Fort')
  })

  it('falls back to original itinerary anchors when no dynamic hotel is selected', () => {
    const derived = deriveDynamicAnchoredItinerary({
      itineraryDays: [
        {
          day: 1,
          start_location: { name: 'Original Start', lat: 8, lng: 18 },
          route: [{ place_id: 'p1', name: 'Park', lat: 8.5, lng: 18.5 }],
        },
      ],
      dynamicHotelDays: [{ day: 1, suggested_hotels: [] }],
      hotelSelections: {},
      continuedStayDays: {},
      initialHotelLocation: { name: 'Initial Hotel', lat: 7.9, lng: 17.9 },
      dynamicEnabled: true,
    })

    expect(derived[0].start_location.name).toBe('Original Start')
    expect(derived[0].end_location.name).toBe('Park')
  })
})
