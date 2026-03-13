"""
Recommendation model training for Smart Itinerary Planner.

The model uses engineered place signals to estimate whether a place belongs in
the upper-quality tier used for ranking recommendations.
"""

from pathlib import Path
import json
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

warnings.filterwarnings("ignore")

FEATURES_PATH = Path("dataset/place_features.csv")
MODEL_PATH = Path("models/recommendation_model.pkl")
METADATA_PATH = Path("models/recommendation_metadata.json")

NUMERIC_FEATURES = [
    "rating",
    "sentiment",
    "review_count",
    "review_avg_rating",
    "user_ratings_total",
    "has_review",
    "review_length",
    "popularity_signal",
]
CATEGORICAL_FEATURES = ["category"]
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def normalize_numeric(series, default=0.0):
    return pd.to_numeric(series, errors="coerce").fillna(default)


def build_target(df):
    rating_component = df["rating"].clip(0, 5) / 5.0
    sentiment_component = df["sentiment"].clip(0, 1)
    review_avg_component = df["review_avg_rating"].clip(0, 5) / 5.0
    popularity_raw = df["user_ratings_total"].clip(lower=0)
    popularity_scale = popularity_raw.max() or 1
    popularity_component = np.log1p(popularity_raw) / np.log1p(popularity_scale)

    quality_score = (
        (rating_component * 0.50)
        + (sentiment_component * 0.20)
        + (review_avg_component * 0.15)
        + (popularity_component * 0.10)
        + (df["has_review"] * 0.05)
    )

    threshold = float(np.quantile(quality_score, 0.65))
    labels = (quality_score >= threshold).astype(int)
    return quality_score, labels, threshold


def main():
    print("\n" + "=" * 60)
    print("RECOMMENDATION MODEL TRAINING")
    print("=" * 60 + "\n")

    if not FEATURES_PATH.exists():
        print("Error: dataset/place_features.csv not found. Run python create_features.py")
        raise SystemExit(1)

    df = pd.read_csv(FEATURES_PATH)
    missing_columns = set(ALL_FEATURES) - set(df.columns)
    if missing_columns:
        print(f"Error: Missing columns in feature dataset: {sorted(missing_columns)}")
        raise SystemExit(1)

    for column in NUMERIC_FEATURES:
        df[column] = normalize_numeric(df[column])
    df["category"] = df["category"].fillna("other").astype(str)
    df = df.dropna(subset=["rating", "sentiment"]).copy()

    if len(df) < 20:
        print("Error: Not enough valid samples to train recommendation model")
        raise SystemExit(1)

    quality_score, y, threshold = build_target(df)
    df["quality_score"] = quality_score

    positive_count = int(y.sum())
    negative_count = int(len(y) - positive_count)

    print(f"Training rows: {len(df)}")
    print(f"Positive labels: {positive_count}")
    print(f"Negative labels: {negative_count}")
    print(f"Quality-score threshold: {threshold:.4f}")

    X = df[ALL_FEATURES]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))]), NUMERIC_FEATURES),
            ("category", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=250,
                    max_depth=12,
                    min_samples_split=6,
                    min_samples_leaf=2,
                    class_weight="balanced_subsample",
                    random_state=42,
                    n_jobs=1,
                ),
            ),
        ]
    )

    sample_weight = 1.0 + np.clip(np.log1p(df.loc[X_train.index, "user_ratings_total"]), 0, None)
    model.fit(X_train, y_train, classifier__sample_weight=sample_weight)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f}")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy", n_jobs=1)
    print(f"CV accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")

    print("Classification report:")
    print(classification_report(y_test, y_pred, target_names=["other", "recommended"], digits=4))

    cm = confusion_matrix(y_test, y_pred)
    print("Confusion matrix:")
    print(f"  true_negative={cm[0][0]} false_positive={cm[0][1]}")
    print(f"  false_negative={cm[1][0]} true_positive={cm[1][1]}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    metadata = {
        "feature_columns": ALL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "quality_threshold": threshold,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"Saved: {MODEL_PATH}")
    print(f"Saved: {METADATA_PATH}")

    test_cases = pd.DataFrame([
        {
            "rating": 4.8,
            "sentiment": 0.92,
            "review_count": 5,
            "review_avg_rating": 4.8,
            "user_ratings_total": 2000,
            "has_review": 1,
            "review_length": 35,
            "popularity_signal": np.log1p(2000),
            "category": "tourist attraction",
        },
        {
            "rating": 3.8,
            "sentiment": 0.52,
            "review_count": 0,
            "review_avg_rating": 3.8,
            "user_ratings_total": 20,
            "has_review": 0,
            "review_length": 0,
            "popularity_signal": np.log1p(20),
            "category": "museum",
        },
    ])

    probabilities = model.predict_proba(test_cases)[:, 1]
    print("Sample recommendation scores:")
    for index, probability in enumerate(probabilities, start=1):
        print(f"  case_{index}: {probability:.4f}")

    print("\nRecommendation training complete\n")


if __name__ == "__main__":
    main()
