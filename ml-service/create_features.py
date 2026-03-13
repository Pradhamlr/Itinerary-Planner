"""
Feature dataset generation for Smart Itinerary Planner.

Creates a stable feature table from `dataset/places.csv` that can be consumed by
the recommendation model and the inference API.
"""

from pathlib import Path
import math
import warnings

import joblib
import pandas as pd

warnings.filterwarnings("ignore")

DATASET_PATH = Path("dataset/places.csv")
FEATURES_PATH = Path("dataset/place_features.csv")
MODELS_DIR = Path("models")
SENTIMENT_MODEL_PATH = MODELS_DIR / "sentiment_model.pkl"
VECTORIZER_PATH = MODELS_DIR / "vectorizer.pkl"
SKIP_FLAG_PATH = MODELS_DIR / "sentiment_skipped.flag"


def has_review_text(value):
    return pd.notna(value) and str(value).strip() != ""


def normalize_numeric(series, default=0.0):
    return pd.to_numeric(series, errors="coerce").fillna(default)


def get_numeric_column(df, column_name, default=0.0):
    if column_name in df.columns:
        return normalize_numeric(df[column_name], default=default)

    return pd.Series([default] * len(df), index=df.index)


def load_sentiment_artifacts():
    if SKIP_FLAG_PATH.exists():
        print("Sentiment model skipped earlier; using neutral sentiment defaults")
        return None, None

    if not SENTIMENT_MODEL_PATH.exists() or not VECTORIZER_PATH.exists():
        print("Sentiment artifacts missing; using neutral sentiment defaults")
        return None, None

    try:
        return joblib.load(SENTIMENT_MODEL_PATH), joblib.load(VECTORIZER_PATH)
    except Exception as error:
        print(f"Failed to load sentiment artifacts: {error}")
        print("Falling back to neutral sentiment defaults")
        return None, None


def infer_sentiment(review, sentiment_model, vectorizer):
    if not has_review_text(review) or sentiment_model is None or vectorizer is None:
        return 0.5

    review_vec = vectorizer.transform([str(review).strip()])
    return float(sentiment_model.predict_proba(review_vec)[0][1])


def main():
    print("\n" + "=" * 60)
    print("FEATURE DATASET GENERATION")
    print("=" * 60 + "\n")

    if not DATASET_PATH.exists():
        print("Error: dataset/places.csv not found")
        raise SystemExit(1)

    df = pd.read_csv(DATASET_PATH)
    required_columns = {"name", "category", "rating", "review", "city", "lat", "lng"}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        print(f"Error: Missing columns in dataset: {sorted(missing_columns)}")
        raise SystemExit(1)

    df["rating"] = normalize_numeric(df["rating"])
    df["review_count"] = get_numeric_column(df, "review_count", default=0).astype(int)
    df["review_avg_rating"] = get_numeric_column(df, "review_avg_rating", default=0.0)
    df["user_ratings_total"] = get_numeric_column(df, "user_ratings_total", default=0.0)
    df["lat"] = normalize_numeric(df["lat"])
    df["lng"] = normalize_numeric(df["lng"])
    df = df.dropna(subset=["rating", "lat", "lng"]).copy()
    df["review_avg_rating"] = df["review_avg_rating"].where(df["review_avg_rating"] > 0, df["rating"])

    sentiment_model, vectorizer = load_sentiment_artifacts()

    print(f"Loaded {len(df)} places")
    print("Generating sentiment scores...")

    df["review"] = df["review"].fillna("").astype(str)
    df["sentiment"] = df["review"].apply(lambda review: infer_sentiment(review, sentiment_model, vectorizer))
    df["has_review"] = df["review"].apply(lambda review: 1 if has_review_text(review) else 0)
    df["review_length"] = df["review"].apply(lambda review: len(review.split()) if has_review_text(review) else 0)
    df["popularity_signal"] = df["user_ratings_total"].apply(lambda value: round(math.log1p(max(value, 0)), 6))

    feature_df = pd.DataFrame({
        "name": df["name"].fillna("Unknown"),
        "category": df["category"].fillna("other"),
        "rating": df["rating"],
        "sentiment": df["sentiment"],
        "city": df["city"].fillna("unknown"),
        "lat": df["lat"],
        "lng": df["lng"],
        "review_count": df["review_count"],
        "review_avg_rating": df["review_avg_rating"],
        "user_ratings_total": df["user_ratings_total"],
        "has_review": df["has_review"],
        "review_length": df["review_length"],
        "popularity_signal": df["popularity_signal"],
    })

    FEATURES_PATH.parent.mkdir(parents=True, exist_ok=True)
    feature_df.to_csv(FEATURES_PATH, index=False)

    print(f"Saved: {FEATURES_PATH}")
    print(f"Average rating: {feature_df['rating'].mean():.2f}")
    print(f"Average sentiment: {feature_df['sentiment'].mean():.2f}")
    print(f"Places with reviews: {int(feature_df['has_review'].sum())}")
    print(f"Places without reviews: {len(feature_df) - int(feature_df['has_review'].sum())}")
    print("\nSample data:")
    print(feature_df.head(5).to_string(index=False))
    print("\nFeature generation complete\n")


if __name__ == "__main__":
    main()
