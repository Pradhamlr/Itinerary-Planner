"""
Train a weakly supervised multi-label interest classifier for places.
"""

from pathlib import Path
import json
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer

warnings.filterwarnings("ignore")

DATASET_PATH = Path("dataset/place_interest_labels.csv")
MODEL_PATH = Path("models/interest_model.pkl")
METADATA_PATH = Path("models/interest_metadata.json")
SKIP_FLAG_PATH = Path("models/interest_skipped.flag")

MIN_LABELED_ROWS = 100
MIN_CLASS_SAMPLES = 12
DEFAULT_CLASS_THRESHOLDS = {
    "shopping": 0.70,
    "beaches": 0.70,
    "nightlife": 0.75,
    "sports": 0.80,
    "adventure": 0.75,
    "food": 0.60,
    "art": 0.65,
    "nature": 0.70,
    "culture": 0.55,
    "history": 0.55,
}


def normalize_text(value):
    return str(value or "").strip().lower()


def parse_interest_tags(value):
    raw = normalize_text(value)
    if not raw:
        return []
    return [tag.strip() for tag in raw.split("|") if tag.strip()]


def build_text(row):
    parts = [
        normalize_text(row.get("name")),
        normalize_text(row.get("category")),
        normalize_text(row.get("types")),
        normalize_text(row.get("review")),
        normalize_text(row.get("city")),
    ]
    return " [SEP] ".join(part for part in parts if part)


def clear_skip_flag():
    if SKIP_FLAG_PATH.exists():
        SKIP_FLAG_PATH.unlink()


def write_skip_flag(reason):
    SKIP_FLAG_PATH.parent.mkdir(parents=True, exist_ok=True)
    SKIP_FLAG_PATH.write_text(reason, encoding="utf-8")
    print(f"Interest training skipped: {reason}")


def main():
    print("\n" + "=" * 60)
    print("INTEREST MODEL TRAINING")
    print("=" * 60 + "\n")

    if not DATASET_PATH.exists():
        print("Error: dataset/place_interest_labels.csv not found. Run python create_interest_labels.py")
        raise SystemExit(1)

    df = pd.read_csv(DATASET_PATH)
    if "interest_tags" not in df.columns:
        print("Error: interest_tags column missing from interest dataset")
        raise SystemExit(1)

    df["interest_tags"] = df["interest_tags"].fillna("").apply(parse_interest_tags)
    df["text"] = df.apply(build_text, axis=1)
    labeled_df = df[df["interest_tags"].apply(len) > 0].copy()

    if len(labeled_df) < MIN_LABELED_ROWS:
        write_skip_flag(f"insufficient labeled rows: found {len(labeled_df)}, need {MIN_LABELED_ROWS}")
        raise SystemExit(0)

    class_counts = {}
    for tags in labeled_df["interest_tags"]:
        for tag in tags:
            class_counts[tag] = class_counts.get(tag, 0) + 1

    active_classes = sorted([
        tag for tag, count in class_counts.items()
        if count >= MIN_CLASS_SAMPLES
    ])

    if not active_classes:
        write_skip_flag("no interest classes met minimum sample threshold")
        raise SystemExit(0)

    labeled_df["filtered_interest_tags"] = labeled_df["interest_tags"].apply(
        lambda tags: [tag for tag in tags if tag in active_classes]
    )
    labeled_df = labeled_df[labeled_df["filtered_interest_tags"].apply(len) > 0].copy()

    if len(labeled_df) < MIN_LABELED_ROWS:
        write_skip_flag("not enough rows remained after filtering rare classes")
        raise SystemExit(0)

    mlb = MultiLabelBinarizer(classes=active_classes)
    y = mlb.fit_transform(labeled_df["filtered_interest_tags"])
    X = labeled_df["text"].astype(str).values

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    model = Pipeline(
        steps=[
            (
                "vectorizer",
                TfidfVectorizer(
                    max_features=12000,
                    min_df=2,
                    max_df=0.92,
                    ngram_range=(1, 2),
                    stop_words="english",
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                OneVsRestClassifier(
                    LogisticRegression(
                        random_state=42,
                        max_iter=1400,
                        class_weight="balanced",
                    )
                ),
            ),
        ]
    )

    model.fit(X_train, y_train)
    probabilities = model.predict_proba(X_test)
    predictions = (probabilities >= 0.35).astype(int)

    micro_f1 = f1_score(y_test, predictions, average="micro", zero_division=0)
    macro_f1 = f1_score(y_test, predictions, average="macro", zero_division=0)

    print(f"Labeled training rows: {len(labeled_df)}")
    print(f"Active classes: {active_classes}")
    print(f"Micro F1: {micro_f1:.4f}")
    print(f"Macro F1: {macro_f1:.4f}")
    print("Per-class report:")
    print(classification_report(y_test, predictions, target_names=active_classes, zero_division=0, digits=4))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    clear_skip_flag()

    metadata = {
        "classes": active_classes,
        "threshold": 0.35,
        "class_thresholds": {
            label: float(DEFAULT_CLASS_THRESHOLDS.get(label, 0.60))
            for label in active_classes
        },
        "max_return_tags": 2,
        "secondary_gap": 0.18,
        "labeled_rows": int(len(labeled_df)),
        "class_counts": {key: int(class_counts[key]) for key in active_classes},
        "micro_f1": float(micro_f1),
        "macro_f1": float(macro_f1),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"Saved: {MODEL_PATH}")
    print(f"Saved: {METADATA_PATH}")

    sample_texts = [
        "Fort kochi beach sunset sea waterfront walk and relaxing views",
        "Large shopping mall with branded stores, food court and cinema",
        "Historic museum and palace with heritage murals and royal artifacts",
    ]
    sample_probabilities = model.predict_proba(sample_texts)
    print("Sample predictions:")
    for sample_text, probs in zip(sample_texts, sample_probabilities):
        ranked = sorted(
            zip(active_classes, probs),
            key=lambda item: item[1],
            reverse=True,
        )[:3]
        print(f"  {sample_text[:55]}... -> {ranked}")

    print("\nInterest model training complete\n")


if __name__ == "__main__":
    main()
