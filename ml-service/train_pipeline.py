"""
Complete ML training pipeline for Smart Itinerary Planner.
"""

from pathlib import Path
import subprocess
import sys

import pandas as pd

MODELS_DIR = Path("models")


def run_script(script_name, description):
    print("\n" + "=" * 70)
    print(f"STEP: {description}")
    print("=" * 70 + "\n")

    try:
        subprocess.run([sys.executable, script_name], check=True)
        print(f"\n{description} completed")
        return True
    except subprocess.CalledProcessError as error:
        print(f"\n{description} failed: {error}")
        return False
    except FileNotFoundError:
        print(f"\nScript not found: {script_name}")
        return False


def check_dataset():
    dataset_path = Path("dataset/places.csv")
    if not dataset_path.exists():
        print("Dataset not found: dataset/places.csv")
        print("Run: node ../Backend/scripts/exportPlacesDataset.js")
        return False
    return True


def check_columns(file_path, required_columns):
    try:
        df = pd.read_csv(file_path)
    except Exception as error:
        print(f"Unable to read {file_path}: {error}")
        return False

    missing = set(required_columns) - set(df.columns)
    if missing:
        print(f"{file_path} missing columns: {sorted(missing)}")
        return False

    if len(df) == 0:
        print(f"{file_path} has no rows")
        return False

    return True


def sentiment_step_succeeded():
    return (
        (MODELS_DIR / "sentiment_model.pkl").exists()
        and (MODELS_DIR / "vectorizer.pkl").exists()
    ) or (MODELS_DIR / "sentiment_skipped.flag").exists()


def main():
    print("\n" + "=" * 70)
    print("ML TRAINING PIPELINE")
    print("=" * 70 + "\n")

    if not check_dataset():
        print("\nPipeline aborted: dataset missing\n")
        raise SystemExit(1)

    if not check_columns(
        "dataset/places.csv",
        ["name", "category", "rating", "review", "city", "lat", "lng"],
    ):
        print("\nPipeline aborted: dataset schema invalid\n")
        raise SystemExit(1)

    if not run_script("train_sentiment.py", "Training sentiment model"):
        print("\nPipeline failed at sentiment training\n")
        raise SystemExit(1)

    if not sentiment_step_succeeded():
        print("\nPipeline aborted: sentiment step produced neither model artifacts nor a skip flag\n")
        raise SystemExit(1)

    if not run_script("create_features.py", "Generating feature dataset"):
        print("\nPipeline failed at feature generation\n")
        raise SystemExit(1)

    if not check_columns(
        "dataset/place_features.csv",
        [
            "name",
            "category",
            "rating",
            "sentiment",
            "city",
            "lat",
            "lng",
            "review_count",
            "review_avg_rating",
            "user_ratings_total",
            "has_review",
            "review_length",
            "popularity_signal",
        ],
    ):
        print("\nPipeline aborted: feature dataset schema invalid\n")
        raise SystemExit(1)

    if not run_script("train_recommendation.py", "Training recommendation model"):
        print("\nPipeline failed at recommendation training\n")
        raise SystemExit(1)

    if not (MODELS_DIR / "recommendation_model.pkl").exists():
        print("\nPipeline aborted: recommendation artifact missing\n")
        raise SystemExit(1)

    if not run_script("create_interest_labels.py", "Generating interest label dataset"):
        print("\nPipeline failed at interest label generation\n")
        raise SystemExit(1)

    if not check_columns(
        "dataset/place_interest_labels.csv",
        ["name", "category", "review", "city", "interest_tags"],
    ):
        print("\nPipeline aborted: interest label dataset schema invalid\n")
        raise SystemExit(1)

    if not run_script("train_interest_model.py", "Training interest model"):
        print("\nPipeline failed at interest model training\n")
        raise SystemExit(1)

    print("\n" + "=" * 70)
    print("PIPELINE COMPLETE")
    print("=" * 70 + "\n")
    print("Generated artifacts:")
    for artifact in [
        "models/sentiment_model.pkl",
        "models/vectorizer.pkl",
        "models/sentiment_skipped.flag",
        "dataset/place_features.csv",
        "dataset/place_interest_labels.csv",
        "models/recommendation_model.pkl",
        "models/recommendation_metadata.json",
        "models/interest_model.pkl",
        "models/interest_metadata.json",
        "models/interest_skipped.flag",
    ]:
        if Path(artifact).exists():
            print(f"  {artifact}")


if __name__ == "__main__":
    main()
