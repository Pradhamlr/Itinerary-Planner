from pathlib import Path
import json
import math
from typing import List, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from place_tagging import build_place_tags

MODELS_DIR = Path("models")
SENTIMENT_MODEL_PATH = MODELS_DIR / "sentiment_model.pkl"
VECTORIZER_PATH = MODELS_DIR / "vectorizer.pkl"
SENTIMENT_SKIP_FLAG = MODELS_DIR / "sentiment_skipped.flag"
RECOMMENDATION_MODEL_PATH = MODELS_DIR / "recommendation_model.pkl"
RECOMMENDATION_METADATA_PATH = MODELS_DIR / "recommendation_metadata.json"
INTEREST_MODEL_PATH = MODELS_DIR / "interest_model.pkl"
INTEREST_METADATA_PATH = MODELS_DIR / "interest_metadata.json"
INTEREST_SKIP_FLAG = MODELS_DIR / "interest_skipped.flag"
HF_LABELS_PATH = Path("dataset/place_interest_labels_hf.csv")

DEFAULT_FEATURE_COLUMNS = [
    "rating",
    "sentiment",
    "review_count",
    "review_avg_rating",
    "user_ratings_total",
    "has_review",
    "review_length",
    "popularity_signal",
    "category",
]

app = FastAPI(title="Smart Itinerary Planner ML Service")

sentiment_model = None
vectorizer = None
recommendation_model = None
interest_model = None
recommendation_metadata = {
    "feature_columns": DEFAULT_FEATURE_COLUMNS,
}
interest_metadata = {
    "classes": [],
    "threshold": 0.35,
    "class_thresholds": {},
    "max_return_tags": 2,
    "secondary_gap": 0.18,
}
hf_interest_lookup = {}
hf_interest_lookup_fuzzy = {}


class SentimentPayload(BaseModel):
    review: str


class RecommendationPayload(BaseModel):
    rating: float
    sentiment: float = Field(ge=0.0, le=1.0)
    category: str = "other"
    review_count: int = 0
    review_avg_rating: Optional[float] = None
    user_ratings_total: int = 0
    has_review: int = 0
    review_length: int = 0
    popularity_signal: Optional[float] = None


class PlacePayload(BaseModel):
    place_id: Optional[str] = None
    name: Optional[str] = None
    category: str = "other"
    description: Optional[str] = None
    types: List[str] = Field(default_factory=list)
    rating: float = 0.0
    review: str = ""
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    reviews: List[str] = Field(default_factory=list)
    review_count: Optional[int] = None
    review_avg_rating: Optional[float] = None
    user_ratings_total: int = 0


class RecommendRequest(BaseModel):
    places: List[PlacePayload]
    top_k: Optional[int] = None


class InterestBatchRequest(BaseModel):
    places: List[PlacePayload]


def load_models():
    global sentiment_model, vectorizer, recommendation_model, recommendation_metadata, interest_model, interest_metadata, hf_interest_lookup, hf_interest_lookup_fuzzy

    if RECOMMENDATION_MODEL_PATH.exists():
        recommendation_model = joblib.load(RECOMMENDATION_MODEL_PATH)
    else:
        raise FileNotFoundError("Recommendation model missing. Run train_recommendation.py first.")

    if RECOMMENDATION_METADATA_PATH.exists():
        recommendation_metadata = json.loads(RECOMMENDATION_METADATA_PATH.read_text(encoding="utf-8"))

    if not SENTIMENT_SKIP_FLAG.exists() and SENTIMENT_MODEL_PATH.exists() and VECTORIZER_PATH.exists():
        sentiment_model = joblib.load(SENTIMENT_MODEL_PATH)
        vectorizer = joblib.load(VECTORIZER_PATH)

    if not INTEREST_SKIP_FLAG.exists() and INTEREST_MODEL_PATH.exists() and INTEREST_METADATA_PATH.exists():
        interest_model = joblib.load(INTEREST_MODEL_PATH)
        interest_metadata = json.loads(INTEREST_METADATA_PATH.read_text(encoding="utf-8"))

    hf_interest_lookup = {}
    hf_interest_lookup_fuzzy = {}
    if HF_LABELS_PATH.exists():
        hf_df = pd.read_csv(HF_LABELS_PATH)
        for _, row in hf_df.iterrows():
            exact_key = build_hf_lookup_key(
                row.get("name"),
                row.get("city"),
                row.get("lat"),
                row.get("lng"),
            )
            fuzzy_key = build_hf_lookup_fuzzy_key(
                row.get("name"),
                row.get("city"),
            )
            entry = {
                "interest_tags": parse_pipe_tags(row.get("interest_tags")),
                "intent_tags": parse_pipe_tags(row.get("intent_tags")),
                "interest_scores": parse_json_object(row.get("interest_scores_json")),
                "intent_scores": parse_json_object(row.get("intent_scores_json")),
            }
            if exact_key:
                hf_interest_lookup[exact_key] = entry
            if fuzzy_key and fuzzy_key not in hf_interest_lookup_fuzzy:
                hf_interest_lookup_fuzzy[fuzzy_key] = entry


def safe_sentiment(review_text: str) -> float:
    review_text = (review_text or "").strip()
    if not review_text or sentiment_model is None or vectorizer is None:
        return 0.5

    review_vec = vectorizer.transform([review_text])
    return float(sentiment_model.predict_proba(review_vec)[0][1])


def review_text_from_place(place: PlacePayload) -> str:
    if place.review.strip():
        return place.review.strip()

    cleaned_reviews = [review.strip() for review in place.reviews if isinstance(review, str) and review.strip()]
    return " || ".join(cleaned_reviews)


def normalize_lookup_text(value) -> str:
    return str(value or "").strip().lower()


def normalize_coord(value) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return ""
    return f"{numeric:.5f}"


def build_hf_lookup_key(name, city, lat, lng) -> str:
    normalized_name = normalize_lookup_text(name)
    normalized_city = normalize_lookup_text(city)
    normalized_lat = normalize_coord(lat)
    normalized_lng = normalize_coord(lng)
    if not normalized_name:
        return ""
    return " | ".join([normalized_name, normalized_city, normalized_lat, normalized_lng])


def build_hf_lookup_fuzzy_key(name, city) -> str:
    normalized_name = normalize_lookup_text(name)
    normalized_city = normalize_lookup_text(city)
    if not normalized_name:
        return ""
    return " | ".join([normalized_name, normalized_city])


def parse_pipe_tags(value) -> list[str]:
    raw = normalize_lookup_text(value)
    if not raw:
        return []
    return [tag.strip() for tag in raw.split("|") if tag.strip()]


def parse_json_object(value) -> dict:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return {}
    try:
        parsed = json.loads(str(value))
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def get_hf_interest_entry(place: PlacePayload) -> Optional[dict]:
    exact_key = build_hf_lookup_key(place.name, place.city, place.lat, place.lng)
    if exact_key and exact_key in hf_interest_lookup:
        return hf_interest_lookup[exact_key]

    fuzzy_key = build_hf_lookup_fuzzy_key(place.name, place.city)
    if fuzzy_key and fuzzy_key in hf_interest_lookup_fuzzy:
        return hf_interest_lookup_fuzzy[fuzzy_key]

    return None


def has_hf_interest_data() -> bool:
    return bool(hf_interest_lookup) or bool(hf_interest_lookup_fuzzy)


def build_feature_row(payload: RecommendationPayload) -> dict:
    review_avg_rating = payload.review_avg_rating if payload.review_avg_rating is not None else payload.rating
    popularity_signal = (
        payload.popularity_signal
        if payload.popularity_signal is not None
        else math.log1p(max(payload.user_ratings_total, 0))
    )

    return {
        "rating": float(payload.rating),
        "sentiment": float(payload.sentiment),
        "review_count": int(payload.review_count),
        "review_avg_rating": float(review_avg_rating),
        "user_ratings_total": int(payload.user_ratings_total),
        "has_review": int(payload.has_review),
        "review_length": int(payload.review_length),
        "popularity_signal": float(popularity_signal),
        "category": payload.category or "other",
    }


def build_interest_text(place: PlacePayload) -> str:
    category = place.category or "other"
    review_text = review_text_from_place(place)
    parts = [
        (place.name or "").strip(),
        str(category).strip(),
        review_text,
        (place.city or "").strip(),
    ]
    return " [SEP] ".join(part for part in parts if part)


def predict_interest_scores(place: PlacePayload) -> dict:
    if interest_model is None:
        return {}

    classes = interest_metadata.get("classes", [])
    if not classes:
        return {}

    text = build_interest_text(place)
    probabilities = interest_model.predict_proba([text])[0]
    return {
        label: float(probability)
        for label, probability in zip(classes, probabilities)
    }


def extract_interest_tags(interest_scores: dict) -> list[str]:
    default_threshold = float(interest_metadata.get("threshold", 0.35))
    class_thresholds = interest_metadata.get("class_thresholds", {})
    max_return_tags = int(interest_metadata.get("max_return_tags", 2))
    secondary_gap = float(interest_metadata.get("secondary_gap", 0.18))
    ranked = sorted(interest_scores.items(), key=lambda item: item[1], reverse=True)
    accepted = []

    for index, (label, score) in enumerate(ranked):
        label_threshold = float(class_thresholds.get(label, default_threshold))
        if score < label_threshold:
            continue

        if index > 0 and accepted:
            top_score = ranked[0][1]
            if (top_score - score) > secondary_gap:
                continue

        accepted.append(label)
        if len(accepted) >= max_return_tags:
            break

    if accepted:
        return accepted

    return [label for label, _ in ranked[:1]]


def predict_recommendation_score(feature_row: dict) -> float:
    feature_columns = recommendation_metadata.get("feature_columns", DEFAULT_FEATURE_COLUMNS)
    frame = pd.DataFrame([{column: feature_row.get(column) for column in feature_columns}])
    probabilities = recommendation_model.predict_proba(frame)[0]
    return float(probabilities[1])


@app.on_event("startup")
def startup_event():
    load_models()


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "ok",
        "sentiment_model_loaded": sentiment_model is not None and vectorizer is not None,
        "recommendation_model_loaded": recommendation_model is not None,
        "interest_model_loaded": interest_model is not None,
        "hf_interest_labels_loaded": has_hf_interest_data(),
    }


@app.post("/predict/sentiment")
def predict_sentiment(payload: SentimentPayload):
    if not payload.review.strip():
        raise HTTPException(status_code=400, detail="review is required")

    sentiment_score = safe_sentiment(payload.review)
    return {
        "success": True,
        "data": {
            "sentiment_label": "positive" if sentiment_score >= 0.5 else "negative",
            "sentiment_score": sentiment_score,
        },
    }


@app.post("/predict/recommendation")
def predict_recommendation(payload: RecommendationPayload):
    feature_row = build_feature_row(payload)
    score = predict_recommendation_score(feature_row)

    return {
        "success": True,
        "data": {
            "recommend": int(score >= 0.5),
            "confidence": score,
            "score": score,
        },
    }


@app.post("/predict/place")
def predict_place(payload: PlacePayload):
    review_text = review_text_from_place(payload)
    review_count = payload.review_count if payload.review_count is not None else len(payload.reviews)
    sentiment_score = safe_sentiment(review_text)
    hf_entry = get_hf_interest_entry(payload)

    recommendation_payload = RecommendationPayload(
        rating=payload.rating,
        sentiment=sentiment_score,
        category=payload.category,
        review_count=review_count,
        review_avg_rating=payload.review_avg_rating if payload.review_avg_rating is not None else payload.rating,
        user_ratings_total=payload.user_ratings_total,
        has_review=1 if review_text else 0,
        review_length=len(review_text.split()) if review_text else 0,
    )
    feature_row = build_feature_row(recommendation_payload)
    score = predict_recommendation_score(feature_row)

    return {
        "success": True,
        "data": {
            "sentiment_score": sentiment_score,
            "recommend": int(score >= 0.5),
            "confidence": score,
            "score": score,
            "interest_tags": (
                hf_entry.get("interest_tags", [])
                if hf_entry
                else extract_interest_tags(predict_interest_scores(payload)) if interest_model is not None else []
            ),
            "intent_tags": (
                hf_entry.get("intent_tags", []) or build_place_tags(payload)
                if hf_entry
                else build_place_tags(payload)
            ),
        },
    }


@app.post("/predict/interests")
def predict_interests(payload: PlacePayload):
    hf_entry = get_hf_interest_entry(payload)
    if hf_entry:
        return {
            "success": True,
            "data": {
                "interest_tags": hf_entry.get("interest_tags", []),
                "interest_scores": hf_entry.get("interest_scores", {}),
                "intent_tags": hf_entry.get("intent_tags", []) or build_place_tags(payload),
            },
        }

    if interest_model is None:
        raise HTTPException(
            status_code=503,
            detail="Interest model unavailable and no HF interest labels matched this place.",
        )

    interest_scores = predict_interest_scores(payload)
    return {
        "success": True,
        "data": {
            "interest_tags": extract_interest_tags(interest_scores),
            "interest_scores": interest_scores,
            "intent_tags": build_place_tags(payload),
        },
    }


@app.post("/predict/interests/batch")
def predict_interests_batch(payload: InterestBatchRequest):
    results = []
    for place in payload.places:
        hf_entry = get_hf_interest_entry(place)
        if hf_entry:
            results.append({
                "place_id": place.place_id,
                "name": place.name,
                "interest_tags": hf_entry.get("interest_tags", []),
                "interest_scores": hf_entry.get("interest_scores", {}),
                "intent_tags": hf_entry.get("intent_tags", []) or build_place_tags(place),
            })
            continue

        if interest_model is None:
            results.append({
                "place_id": place.place_id,
                "name": place.name,
                "interest_tags": [],
                "interest_scores": {},
                "intent_tags": build_place_tags(place),
            })
            continue

        interest_scores = predict_interest_scores(place)
        results.append({
            "place_id": place.place_id,
            "name": place.name,
            "interest_tags": extract_interest_tags(interest_scores),
            "interest_scores": interest_scores,
            "intent_tags": build_place_tags(place),
        })

    return {
        "success": True,
        "results": results,
        "total": len(results),
    }


@app.post("/recommend")
def recommend_places(payload: RecommendRequest):
    ranked_places = []

    for place in payload.places:
        review_text = review_text_from_place(place)
        review_count = place.review_count if place.review_count is not None else len(place.reviews)
        sentiment_score = safe_sentiment(review_text)

        recommendation_payload = RecommendationPayload(
            rating=place.rating,
            sentiment=sentiment_score,
            category=place.category,
            review_count=review_count,
            review_avg_rating=place.review_avg_rating if place.review_avg_rating is not None else place.rating,
            user_ratings_total=place.user_ratings_total,
            has_review=1 if review_text else 0,
            review_length=len(review_text.split()) if review_text else 0,
        )
        feature_row = build_feature_row(recommendation_payload)
        score = predict_recommendation_score(feature_row)

        ranked_places.append({
            "place_id": place.place_id,
            "name": place.name,
            "category": place.category,
            "city": place.city,
            "lat": place.lat,
            "lng": place.lng,
            "rating": place.rating,
            "sentiment_score": sentiment_score,
            "recommendation_score": score,
            "recommend": int(score >= 0.5),
        })

    ranked_places.sort(key=lambda place: place["recommendation_score"], reverse=True)
    top_k = payload.top_k or len(ranked_places)

    return {
        "recommendations": ranked_places[:top_k],
        "total": len(ranked_places),
    }
