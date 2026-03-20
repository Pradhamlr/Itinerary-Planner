# Smart Itinerary Planner: Implementation Summary

This document summarizes the current state of the Smart Itinerary Planner project as implemented in the codebase.

## 1. Architecture Overview

The application is split into three layers:

1. `Client/`
   React + Vite + Tailwind frontend
2. `Backend/`
   Node.js + Express + MongoDB application layer
3. `ml-service/`
   FastAPI inference service for recommendation scoring

High-level flow:

1. User creates a trip in the frontend
2. Backend stores the trip in MongoDB
3. Backend pulls city-specific places from MongoDB
4. Backend applies tourism-aware filtering and ranking
5. Backend optionally calls the ML service for scoring
6. Backend returns recommendations and itinerary data
7. Frontend renders cards, day plans, and Google Maps routes

## 2. Data Pipeline

### Place Data

Places are stored in MongoDB with fields such as:

- `place_id`
- `name`
- `city`
- `lat`
- `lng`
- `rating`
- `types`
- `reviews`
- `user_ratings_total`
- `opening_hours`

### Enrichment

`Backend/scripts/enrichPlaceReviews.js` enriches stored places using Google Place Details and now supports:

- review text
- review rating data
- updated popularity signals
- opening hours

### Export + ML Pipeline

The backend exports place data into the ML dataset format through:

- `Backend/scripts/exportPlacesDataset.js`

The Python service trains and serves:

- sentiment model
- recommendation model

The ML service is used only for inference during recommendation generation. The backend controls the final tourism ranking.

## 3. Trip Model

Trips now support:

- `city`
- `days`
- `budget`
- `startDate`
- `interests`
- `hotelLocation`
- `recommendationSnapshot`
- `itinerarySnapshot`

`hotelLocation` stores:

- `place_id`
- `name`
- `lat`
- `lng`

Snapshots persist generated plans so the frontend can reopen trips with saved recommendations and itineraries immediately.

## 4. Recommendation Pipeline

The main recommendation logic lives in:

- `Backend/services/recommendationService.js`
- `Backend/config/recommendationConfig.js`

### 4.1 Candidate Fetch

The backend fetches popular places first:

- `find({ city: trip.city.toLowerCase() })`
- sort by `user_ratings_total desc`
- limit `600`

This ensures high-visibility places are included before filtering.

### 4.2 Attraction Type Filtering

Allowed attraction types:

- `tourist_attraction`
- `museum`
- `church`
- `hindu_temple`
- `temple`
- `mosque`
- `synagogue`
- `art_gallery`
- `park`
- `zoo`
- `aquarium`
- `amusement_park`
- `natural_feature`
- `beach`
- `historical_landmark`
- `monument`
- `landmark`

Blocked attraction types:

- `travel_agency`
- `tour_operator`
- `tour_agency`
- `tourist_information_center`
- `florist`
- `store`

Generic Google types are ignored during attraction validation:

- `establishment`
- `point_of_interest`
- `premise`

### 4.3 Quality Filters

Attractions must satisfy:

- `rating >= 4.2`
- `user_ratings_total >= 500`

### 4.4 Popularity Gate

Popularity uses:

- `popularity_signal = ln(user_ratings_total + 1)`

Gate logic:

1. build a strong popularity pool using `popularity_signal >= 7.5`
2. sort remaining candidates using:
   - `0.7 * popularity_signal + 0.3 * rating`
3. keep top `120`

### 4.5 Deduplication

Candidate attractions are deduplicated using:

- normalized attraction name
- nearby coordinates

If two records are near-duplicates, the stronger one is kept based on:

- `user_ratings_total`
- `rating`

### 4.6 Interest Filtering

Interest matching uses `interestTypeMap`.

Examples:

- `beaches -> beach, natural_feature`
- `culture -> museum, art_gallery, hindu_temple, temple, church, monument`
- `nature -> park, zoo, garden, natural_feature`
- `food -> restaurant, cafe`
- `shopping -> shopping_mall, store`
- `nightlife -> bar, night_club`
- `history -> museum, historical_landmark, monument, church, synagogue, temple`

The engine now builds two attraction streams:

- `popularPool` from the stronger popularity-ranked set
- `interestPool` from the broader quality-filtered set

When interests apply cleanly, the final candidate pool is blended from both, roughly:

- 60% popularity-driven
- 40% interest-driven

This preserves tourism quality while improving personalization.

### 4.7 Dynamic Sampling

To avoid deterministic outputs:

- sample size = `max(candidateSampleSize, requiredAttractionCount * 4)`
- default candidate sample size = `40`

If interests exist:

- approximately 70% of the sample is drawn from interest matches
- the rest is drawn from the remaining candidate pool

This keeps recommendations relevant but still allows variety.

### 4.8 ML Scoring

Sampled attractions are sent to:

- `POST {ML_SERVICE_URL}/recommend`

The ML payload includes:

- place name
- category
- rating
- review text
- review count
- review average rating
- `user_ratings_total`
- coordinates

If the ML service fails or is unavailable:

- the backend uses a fallback ML score
- the request still succeeds

### 4.9 Final Ranking Formula

Each sampled attraction is scored using:

- `weighted_rating`
- `normalized_popularity_signal`
- `sentiment_score`
- `ml_score`
- `must_see_boost`
- slight randomness

Weighted rating:

- IMDb-style smoothing using
- `WEIGHTED_RATING_THRESHOLD = 2000`

Final score:

- `0.35 * ml_score`
- `0.30 * weighted_rating`
- `0.25 * normalized_popularity_signal`
- `0.10 * sentiment_score`
- `must_see_boost`
- `Math.random() * 0.02`

### 4.10 Must-See Boost

Landmark-like attractions receive a boost if they have strong popularity and rating.

Examples:

- `rating >= 4.6` and `user_ratings_total >= 5000` -> stronger boost
- slightly smaller boosts apply for lower but still strong popularity bands

### 4.11 Explanation Tags

Attractions return explanation tags such as:

- `Must-see`
- `Popular`
- `Highly rated`
- `Matches your interests`
- category label

These are surfaced in the UI.

### 4.12 Diversity Pass

Before final return, selected attractions go through a diversity step:

- avoids too many same-category attractions
- keeps output more itinerary-friendly
- lightly reshuffles the top recommendation band to reduce repeated refresh results

### 4.13 Attraction Count

Attractions returned:

- `placesPerDay * trip.days`
- default `placesPerDay = 4`

Examples:

- 1 day -> 4 attractions
- 3 days -> 12 attractions
- 5 days -> 20 attractions

### 4.14 Restaurant Pool

Restaurants are ranked separately and never compete with attractions.

Restaurant type pool:

- `restaurant`
- `cafe`
- `bar`
- `bakery`
- `meal_takeaway`
- `night_club`

Blocked restaurant types:

- `lodging`
- `hotel`
- `resort_hotel`
- `travel_agency`
- `tour_operator`
- `tour_agency`

Restaurant quality filters:

- `rating >= 4.2`
- `user_ratings_total >= 300`

Restaurant selection:

1. build top restaurant pool
2. sort by rating then review count
3. sample for variety
4. return top 8

### 4.15 Recommendation Response

The recommendation API returns:

- `attractions`
- `restaurants`
- `metadata`

Metadata currently includes:

- ranking mode
- total candidates
- whether interest filtering was applied
- deduplicated candidate count
- ranking strategy
- ML fallback status

## 5. Itinerary Generation Pipeline

The itinerary logic lives in:

- `Backend/services/itineraryService.js`

### 5.1 Input

The itinerary engine uses:

- `RecommendationService.getRecommendationsForTrip(trip)`

So itinerary generation starts from the curated attraction list, not raw MongoDB places.

### 5.2 Clustering

Daily grouping uses:

- `ml-kmeans`

Cluster count:

- `min(trip.days, attractionCount)`

Clusters are then rebalanced so day sizes differ by at most 1 where possible.

### 5.3 Start Location

If `trip.hotelLocation` exists:

- route starts from hotel/start location

Otherwise:

- route starts from the highest-rated attraction in the cluster

### 5.4 Travel-Time Routing

Routing tries to use real road travel times via:

- `Backend/utils/googleDistance.js`
- Google Distance Matrix API

If Distance Matrix fails:

- fallback uses Haversine-based estimated travel time

### 5.5 TSP-Style Ordering

Route ordering uses nearest-neighbor travel-time selection:

1. choose start point
2. repeatedly select next unvisited place with lowest travel time

This gives practical route ordering without retraining or route optimization infrastructure.

### 5.6 Time Slot Assignment

After ordering, attractions are assigned time slots such as:

- `Morning`
- `Late Morning`
- `Afternoon`
- `Evening`
- `Flexible`

The slot assignment is sensitive to:

- route length
- opening-hours compatibility where available

### 5.7 Opening-Hours Awareness

Places with `opening_hours.periods` are checked against:

- the trip day date
- the relevant slot window

The system now supports weekday-aware opening-hours matching using:

- `trip.startDate`

If a place has no opening-hours periods:

- it is treated as usable

### 5.8 Meal Suggestions

Each day route can include:

- lunch suggestion
- dinner suggestion

Meal logic:

- lunch is chosen near the midpoint of the day route
- dinner is chosen near the last stop
- meal insertion is skipped when the day is too short to justify both breaks

Restaurants come from the separate recommendation restaurant pool.

### 5.9 Daily Pacing Controls

The itinerary engine now applies pacing constraints after route ordering.

Current pacing controls:

- estimated visit duration per stop
- maximum day stop count
- maximum total day travel minutes
- maximum total day minutes
- overflow carry-forward into later days

Each attraction receives a simple visit-duration estimate based on attraction type.

If a day becomes too heavy:

1. the last stop is removed
2. route stats are recomputed
3. excess stops are carried into later days when possible

### 5.10 Itinerary Response

Each day currently returns:

- `day`
- `date`
- `route`
- `center`
- `start_location`
- `routing_mode`
- `meal_suggestions`
- `route_stats`
- `opening_hours_applied`

Each route stop may include:

- `travel_time_to_next`
- `time_slot`
- `visit_duration_minutes`
- `locked`

Global itinerary metadata includes:

- `trip_start_date`
- routing mode
- whether start location is enabled
- whether opening hours were applied
- schedule intelligence summary
- pacing limits
- unscheduled overflow places
- editable-itinerary capability flags

## 6. Persistence

Trips persist generated outputs in MongoDB.

### Recommendation Snapshot

Saved on trip:

- generated timestamp
- attractions
- restaurants
- recommendation metadata

### Itinerary Snapshot

Saved on trip:

- generated timestamp
- itinerary days
- restaurants
- itinerary metadata

Saved itinerary days now also preserve:

- lock state on individual places
- route stats
- visit duration estimates

Frontend reads these snapshots so reopening a trip restores previously generated plans.

## 7. Frontend Experience

### 7.1 Trip Creation

Users can create trips with:

- destination
- days
- budget
- interests
- start date
- hotel/start location via Google Places Autocomplete

Manual latitude/longitude entry is no longer required.

### 7.2 Trip Details

Trip details now support:

- generate smart recommendations
- generate day-wise itinerary
- load saved recommendation snapshot automatically
- load saved itinerary snapshot automatically
- refresh/regenerate actions
- lock individual itinerary places
- regenerate a single day
- explanation tags on place cards
- clear loading, empty, and error states

### 7.3 Google Maps UI

The itinerary map now supports:

- real road-route rendering using Google Directions on the frontend
- start marker
- custom colored numbered markers
- selected marker bounce
- synced marker/card selection
- fit-bounds behavior
- collapsible day legend
- per-day visibility toggles
- show-all reset

## 8. Reliability and Quality Work

Implemented quality improvements include:

- centralized recommendation config
- environment validation
- ML-service fallback
- structured backend logging
- saved-plan hydration
- backend test baseline
- frontend component test baseline

## 9. Test Coverage in Place

Current baseline tests include:

- recommendation API test
- itinerary API test
- frontend trip details panel rendering tests

## 10. Current State Summary

The system currently supports:

- user auth and trip management
- large-place MongoDB tourism dataset
- review and opening-hours enrichment
- ML-assisted recommendation ranking
- tourism-specific filtering and scoring
- saved recommendations
- saved itineraries
- day-wise itinerary generation
- editable itinerary day regeneration
- locked places within itinerary days
- hotel-start routing
- Google travel-time-aware ordering
- opening-hours-aware time slots
- day-aware scheduling with `startDate`
- pacing-aware daily planning
- Google Maps route visualization with synced UI interactions

This is now a working smart itinerary planner MVP+ with real recommendation, planning, persistence, and map support.
