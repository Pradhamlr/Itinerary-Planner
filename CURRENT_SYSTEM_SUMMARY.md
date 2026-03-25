# Smart Itinerary Planner: Current System Summary

## 1. Project Overview

This project is a full-stack Smart Itinerary Planner with three main layers:

- `Client/`: React + Vite frontend
- `Backend/`: Node.js + Express + MongoDB application layer
- `ml-service/`: Python FastAPI ML inference and training layer

The application already works as a real MVP+ travel planner. It supports:

- authentication
- trip creation and trip storage
- place recommendation generation
- day-wise itinerary generation
- map visualization
- editable itineraries
- saved and finalized itinerary snapshots

The system is hybrid:

- part rule-based / heuristic
- part ML-assisted

The most important thing to understand is that the app is **not ML-only**. The final user experience is produced by a combination of:

- place data quality
- backend business logic
- ML scoring
- clustering and routing logic
- frontend UX

---

## 2. Main Architecture

### Frontend

Main stack:

- React
- Vite
- Tailwind CSS
- Google Maps via `@react-google-maps/api`

Main responsibilities:

- trip creation
- recommendation display
- itinerary display
- swap / reorder / regenerate interactions
- Google Maps route display

Key frontend files:

- [App.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/App.jsx)
- [TripDetails.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/pages/TripDetails.jsx)
- [TripDetailsPanels.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/components/TripDetailsPanels.jsx)
- [ItineraryMap.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/components/ItineraryMap.jsx)
- [CreateTrip.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/pages/CreateTrip.jsx)
- [LocationAutocomplete.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/components/LocationAutocomplete.jsx)

### Backend

Main stack:

- Node.js
- Express
- MongoDB / Mongoose

Main responsibilities:

- auth and trip APIs
- recommendation orchestration
- itinerary generation
- snapshot persistence
- integration with the ML service
- integration with Google Maps APIs

Key backend files:

- [server.js](/c:/Users/pradh/Desktop/Itinerary/Backend/server.js)
- [recommendationService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/recommendationService.js)
- [itineraryService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/itineraryService.js)
- [tripService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/tripService.js)
- [Trip.js](/c:/Users/pradh/Desktop/Itinerary/Backend/models/Trip.js)
- [Place.js](/c:/Users/pradh/Desktop/Itinerary/Backend/models/Place.js)

### ML Service

Main stack:

- Python
- FastAPI
- scikit-learn
- pandas
- joblib

Main responsibilities:

- sentiment scoring
- generic recommendation scoring
- experimental interest-tag prediction
- training pipeline and dataset generation

Key ML files:

- [app.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/app.py)
- [train_pipeline.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_pipeline.py)
- [train_sentiment.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_sentiment.py)
- [create_features.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_features.py)
- [train_recommendation.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_recommendation.py)
- [create_interest_labels.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_interest_labels.py)
- [train_interest_model.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_interest_model.py)
- [create_interest_validation_candidates.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_interest_validation_candidates.py)

---

## 3. Data Flow

### Place Data Source

Places are stored in MongoDB using [Place.js](/c:/Users/pradh/Desktop/Itinerary/Backend/models/Place.js).

Stored fields include:

- `place_id`
- `name`
- `city`
- `lat`, `lng`
- `rating`
- `user_ratings_total`
- `types`
- `reviews`
- `opening_hours`

The export script [exportPlacesDataset.js](/c:/Users/pradh/Desktop/Itinerary/Backend/scripts/exportPlacesDataset.js) creates `ml-service/dataset/places.csv`.

Current exported columns include:

- `name`
- `category`
- `types`
- `rating`
- `review`
- `city`
- `lat`
- `lng`
- `review_count`
- `review_avg_rating`
- `user_ratings_total`

### Trip Data

Trips are stored in [Trip.js](/c:/Users/pradh/Desktop/Itinerary/Backend/models/Trip.js).

Important fields:

- `city`
- `days`
- `budget`
- `startDate`
- `interests`
- `hotelLocation`
- `recommendationSnapshot`
- `itinerarySnapshot`
- `finalizedItinerarySnapshot`

Snapshots persist generated data so the user can reopen a trip and continue from saved outputs.

---

## 4. Recommendation System

Main implementation:

- [recommendationService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/recommendationService.js)

### Current Recommendation Flow

1. Fetch city places from MongoDB.
2. Filter candidate attractions by allowed attraction types.
3. Apply quality filtering.
4. Build an elite popularity-based attraction pool.
5. Build a softer exploration pool.
6. Blend pools depending on whether interests are selected.
7. If interests are present, attach inferred interest tags from the interest model.
8. Sample candidates.
9. Send sampled candidates to the ML recommendation model.
10. Combine ML score with backend tourism logic.
11. Apply diversity selection.
12. Return:
   - visible `attractions`
   - `masterAttractionPool`
   - `replacementAttractionPool`
   - `restaurants`

### What the Final Attraction Score Uses

Each attraction gets a final score built from:

- `ml_score`
- `weighted_rating`
- `popularity_score`
- `sentiment_score`
- `interest_match_score`
- `must_see_boost`
- a tiny randomness term

This means recommendations are hybrid:

- learned score from ML
- plus strong backend ranking logic

### Interest Handling

Interest support is currently a hybrid of:

- manual interest-to-type mapping
- inferred interest tags from the new interest model

The backend still remains the primary controller of relevance.

### Restaurants

Restaurants are handled separately from attractions.

The system:
 
- builds a restaurant pool
- scores restaurants separately
- rotates results across refreshes
- keeps them out of the main attraction list

Current restaurant behavior is one of the better-tuned parts of the system.

---

## 5. Itinerary System

Main implementation:

- [itineraryService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/itineraryService.js)

### Current Itinerary Flow

1. Use the saved visible recommendation snapshot when available.
2. Cluster the selected attractions into day groups.
3. Rebalance clusters.
4. Route each day using nearest-neighbor style travel-time-aware ordering.
5. Use start location if hotel/start location exists.
6. Use Google Distance Matrix when available.
7. Apply pacing logic:
   - travel time caps
   - visit duration estimates
   - meal break time
8. Assign time slots.
9. Apply opening-hours-aware slot scheduling where possible.
10. Generate meal suggestions.
11. Save itinerary snapshot.

### Editable Itinerary Features

Current editable features:

- lock a place
- regenerate one day
- drag-drop reorder
- save finalized itinerary
- swap a place

### Swap / Regeneration

These use a broader hidden replacement pool so they are not limited to the visible itinerary list alone.

There is also exclusion memory so rejected places do not immediately bounce back.

---

## 6. Map and Routing

Frontend map:

- [ItineraryMap.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/components/ItineraryMap.jsx)

Current map features:

- Google map display
- real route visualization
- markers
- custom marker styling
- selected marker sync
- day color coding
- fit-bounds
- day toggles

Routing backend support:

- start location support
- Distance Matrix API support
- Haversine fallback when Google travel times are unavailable

---

## 7. Current ML Architecture

## 7.1 Sentiment Model

Training file:

- [train_sentiment.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_sentiment.py)

Model:

- `TF-IDF + LogisticRegression`

Input:

- review text

Output:

- `sentiment_score` in `0..1`

How it is labeled:

- weakly supervised from rating
- `rating >= 4.1` => positive
- otherwise negative

How it is used:

- feature generation
- ML inference API
- final attraction ranking as a small auxiliary signal

Current role:

- useful helper feature
- not a dominant model in the project

## 7.2 Recommendation Model

Training file:

- [train_recommendation.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_recommendation.py)

Model:

- `RandomForestClassifier`

Features:

- rating
- sentiment
- review_count
- review_avg_rating
- user_ratings_total
- has_review
- review_length
- popularity_signal
- category

Output:

- `recommendation_score`

How it is used:

- backend sends sampled attraction candidates to `/recommend`
- ML returns `recommendation_score`
- backend includes it in final attraction scoring

Current role:

- main learned place-quality signal
- still generic, not truly personalized

## 7.3 Interest Model

Files:

- [create_interest_labels.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_interest_labels.py)
- [train_interest_model.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_interest_model.py)
- [app.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/app.py)

Model:

- `TF-IDF + OneVsRest LogisticRegression`

Task:

- predict interest tags such as:
  - beaches
  - shopping
  - culture
  - history
  - nature
  - food
  - nightlife
  - art
  - adventure
  - sports

Training data:

- weakly supervised labels generated from:
  - category
  - types
  - place name
  - review text

Current post-processing:

- per-class thresholds
- top-2 cap
- secondary-gap rule

How it is used:

- backend requests inferred interest tags for candidate places
- inferred tags help with:
  - interest filtering
  - interest matching score

Current role:

- assist layer only
- not safe enough yet to replace manual heuristics completely

### Important Current Status of the Interest Model

This model is improving, but it still has noise.

It is useful as:

- a support signal
- especially for weak categories like shopping/beaches

It is **not yet reliable enough** to fully replace rule-based interest mapping.

## 7.4 Training Pipeline

Main file:

- [train_pipeline.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_pipeline.py)

Current pipeline order:

1. train sentiment model
2. generate feature dataset
3. train recommendation model
4. generate weak interest labels
5. train interest model

Artifacts produced:

- `sentiment_model.pkl`
- `vectorizer.pkl`
- `place_features.csv`
- `recommendation_model.pkl`
- `recommendation_metadata.json`
- `place_interest_labels.csv`
- `interest_model.pkl`
- `interest_metadata.json`

---

## 8. What Works Well Right Now

### Strong areas

- recommendation refresh variation for no-interest trips
- restaurant rotation
- religious-place overdominance reduced
- day-wise itinerary generation
- route visualization
- start-location support
- editable itinerary flow
- snapshot persistence
- final itinerary save
- logging and test baseline

### In practice

The app is already a solid MVP+ and works well as a complete travel-planning demo/product prototype.

---

## 9. Current Limitations

### Recommendation limitations

- interest-based recommendations are still not perfectly reliable
- shopping and beaches still depend heavily on dataset quality
- some recommendation paths can still become too restrictive
- the recommender is still mostly controlled by backend heuristics rather than fully learned personalization

### Interest model limitations

- weak-label training still introduces noise
- some secondary inferred tags are clearly wrong
- top-1 / top-2 is more trustworthy than full multi-tag output
- not ready to fully drive recommendations by itself

### Dataset limitations

- categories are sometimes too coarse
- many shopping-like places are not truly tourism-grade shopping destinations
- beaches and shopping are underrepresented or inconsistently represented in some cities
- single exported category is less expressive than full Google `types`

### Itinerary limitations

- regenerate / swap can still need tuning in edge cases
- clustering and pacing are good but not perfect
- meal suggestions are improved but still heuristic
- travel realism is good, but still rule-driven

---

## 10. Current Manual Review Workflow for Interest Quality

Files:

- [create_interest_validation_candidates.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_interest_validation_candidates.py)
- [interest_validation_candidates.csv](/c:/Users/pradh/Desktop/Itinerary/ml-service/dataset/interest_validation_candidates.csv)

Purpose:

- create a manually reviewable sample
- preserve reviewed rows over time
- improve interest-model quality as the dataset grows

This workflow is designed to continue working when more data is added later.

Suggested use:

1. export updated dataset
2. regenerate weak labels
3. regenerate validation candidates
4. keep manual reviewed tags
5. tune thresholds / retrain

---

## 11. Current Best Summary

The app today is:

- a working full-stack travel planner
- powered by a hybrid recommendation architecture
- with itinerary generation, map routing, and editable user flows

The strongest logic today still lives in:

- backend recommendation heuristics
- itinerary service
- route and pacing logic

The ML layer is relevant and useful, but currently acts as:

- learned scoring support
- not the sole intelligence layer

The next major quality improvements will likely come from:

- better interest-label quality
- better manual validation data
- cleaner dataset/category coverage
- cautious expansion of ML-assisted interest handling

---

## 12. Key Files Reference

### Backend

- [recommendationService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/recommendationService.js)
- [itineraryService.js](/c:/Users/pradh/Desktop/Itinerary/Backend/services/itineraryService.js)
- [Trip.js](/c:/Users/pradh/Desktop/Itinerary/Backend/models/Trip.js)
- [Place.js](/c:/Users/pradh/Desktop/Itinerary/Backend/models/Place.js)
- [exportPlacesDataset.js](/c:/Users/pradh/Desktop/Itinerary/Backend/scripts/exportPlacesDataset.js)

### Frontend

- [TripDetails.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/pages/TripDetails.jsx)
- [TripDetailsPanels.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/components/TripDetailsPanels.jsx)
- [ItineraryMap.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/components/ItineraryMap.jsx)
- [CreateTrip.jsx](/c:/Users/pradh/Desktop/Itinerary/Client/src/pages/CreateTrip.jsx)

### ML Service

- [app.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/app.py)
- [train_pipeline.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_pipeline.py)
- [train_sentiment.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_sentiment.py)
- [create_features.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_features.py)
- [train_recommendation.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_recommendation.py)
- [create_interest_labels.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_interest_labels.py)
- [train_interest_model.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/train_interest_model.py)
- [create_interest_validation_candidates.py](/c:/Users/pradh/Desktop/Itinerary/ml-service/create_interest_validation_candidates.py)
