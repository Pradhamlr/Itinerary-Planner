"""
Review sentiment model training for Smart Itinerary Planner.

This script trains a TF-IDF + Logistic Regression classifier using exported
Google review text. When the dataset does not have enough review coverage, it
creates a skip flag so the rest of the pipeline can continue with neutral
sentiment defaults.
"""

from pathlib import Path
import warnings

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

DATASET_PATH = Path("dataset/places.csv")
MODELS_DIR = Path("models")
SENTIMENT_MODEL_PATH = MODELS_DIR / "sentiment_model.pkl"
VECTORIZER_PATH = MODELS_DIR / "vectorizer.pkl"
SKIP_FLAG_PATH = MODELS_DIR / "sentiment_skipped.flag"

QUALITY_THRESHOLD = 4.1
MIN_REVIEW_SAMPLES = 50


def has_review_text(value):
    return pd.notna(value) and str(value).strip() != ""


def load_dataset():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            "dataset/places.csv not found. Run: node ../Backend/scripts/exportPlacesDataset.js"
        )

    df = pd.read_csv(DATASET_PATH)
    required_columns = {"name", "category", "rating", "review", "city", "lat", "lng"}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"Missing columns in dataset: {sorted(missing_columns)}")

    df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
    return df.dropna(subset=["rating"]).copy()


def mark_sentiment_skipped(reason):
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    SKIP_FLAG_PATH.write_text(reason, encoding="utf-8")
    print(f"Sentiment training skipped: {reason}")


def clear_skip_flag():
    if SKIP_FLAG_PATH.exists():
        SKIP_FLAG_PATH.unlink()


def main():
    print("\n" + "=" * 60)
    print("SENTIMENT MODEL TRAINING")
    print("=" * 60 + "\n")

    try:
        df = load_dataset()
    except Exception as error:
        print(f"Error: {error}")
        raise SystemExit(1) from error

    print(f"Loaded {len(df)} places from dataset")

    df_with_reviews = df[df["review"].apply(has_review_text)].copy()
    print(f"Places with reviews: {len(df_with_reviews)}")

    if len(df_with_reviews) < MIN_REVIEW_SAMPLES:
        mark_sentiment_skipped(
            f"insufficient reviews: found {len(df_with_reviews)}, need {MIN_REVIEW_SAMPLES}"
        )
        raise SystemExit(0)

    X = df_with_reviews["review"].astype(str).str.strip().values
    y = (df_with_reviews["rating"] >= QUALITY_THRESHOLD).astype(int).values

    positive_count = int(y.sum())
    negative_count = int(len(y) - positive_count)

    print(f"Positive labels: {positive_count}")
    print(f"Negative labels: {negative_count}")

    if positive_count == 0 or negative_count == 0:
        mark_sentiment_skipped("dataset only contains one label class")
        raise SystemExit(0)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    vectorizer = TfidfVectorizer(
        max_features=6000,
        min_df=2,
        max_df=0.9,
        ngram_range=(1, 2),
        stop_words="english",
        sublinear_tf=True,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    model = LogisticRegression(
        random_state=42,
        max_iter=1200,
        class_weight="balanced",
    )
    model.fit(X_train_vec, y_train)

    y_pred = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"Accuracy: {accuracy:.4f}")
    print("Classification report:")
    print(classification_report(y_test, y_pred, target_names=["negative", "positive"], digits=4))

    cm = confusion_matrix(y_test, y_pred)
    print("Confusion matrix:")
    print(f"  true_negative={cm[0][0]} false_positive={cm[0][1]}")
    print(f"  false_negative={cm[1][0]} true_positive={cm[1][1]}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, SENTIMENT_MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    clear_skip_flag()

    print(f"Saved: {SENTIMENT_MODEL_PATH}")
    print(f"Saved: {VECTORIZER_PATH}")

    samples = [
        "Amazing place with beautiful views and a peaceful vibe.",
        "Crowded, dirty, and disappointing overall.",
        "Decent stop, but not something I would prioritize.",
    ]

    print("\nSample predictions:")
    for review in samples:
        review_vec = vectorizer.transform([review])
        probability = model.predict_proba(review_vec)[0][1]
        print(f'  "{review}" -> {probability:.3f}')

    print("\nSentiment training complete\n")


if __name__ == "__main__":
    main()
