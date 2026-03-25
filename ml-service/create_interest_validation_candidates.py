"""
Create a manual-review validation set for place interest tags.

This script samples a balanced subset from the weak-label dataset so you can
manually verify tags like shopping, beaches, culture, and history. It preserves
previous manual edits when rerun after adding more exported place data.
"""

from pathlib import Path
import csv
import random

import pandas as pd

LABEL_DATASET_PATH = Path("dataset/place_interest_labels.csv")
OUTPUT_PATH = Path("dataset/interest_validation_candidates.csv")

FOCUS_INTERESTS = ["shopping", "beaches", "culture", "history"]
ROWS_PER_INTEREST = 60
NEGATIVE_ROWS = 60
RANDOM_SEED = 42


def normalize_text(value):
    return str(value or "").strip()


def parse_tags(value):
    return [tag.strip() for tag in normalize_text(value).split("|") if tag.strip()]


def build_row_key(row):
    return " | ".join([
        normalize_text(row.get("name")),
        normalize_text(row.get("city")),
        normalize_text(row.get("lat")),
        normalize_text(row.get("lng")),
    ])


def load_existing_annotations():
    if not OUTPUT_PATH.exists():
        return {}

    existing = {}
    with OUTPUT_PATH.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = row.get("validation_key")
            if key:
                existing[key] = row
    return existing


def build_review_excerpt(review_text, limit=220):
    review_text = normalize_text(review_text)
    return review_text[:limit]


def sample_balanced_rows(df):
    rng = random.Random(RANDOM_SEED)
    working_df = df.copy()
    working_df["interest_tags_list"] = working_df["interest_tags"].fillna("").apply(parse_tags)
    working_df["quality_score"] = (
        pd.to_numeric(working_df["rating"], errors="coerce").fillna(0) * 1000
        + pd.to_numeric(working_df["user_ratings_total"], errors="coerce").fillna(0)
    )

    sampled_keys = set()
    sampled_rows = []

    for interest in FOCUS_INTERESTS:
        interest_rows = working_df[
            working_df["interest_tags_list"].apply(lambda tags, target=interest: target in tags)
        ].copy()

        interest_rows = interest_rows.sort_values(
            by=["quality_score", "city", "name"],
            ascending=[False, True, True],
        )

        interest_candidates = interest_rows.to_dict("records")
        rng.shuffle(interest_candidates[: min(25, len(interest_candidates))])

        selected_count = 0
        for row in interest_candidates:
            key = build_row_key(row)
            if key in sampled_keys:
                continue
            sampled_keys.add(key)
            sampled_rows.append(row)
            selected_count += 1
            if selected_count >= ROWS_PER_INTEREST:
                break

    negative_rows = working_df[
        working_df["interest_tags_list"].apply(len) == 0
    ].copy()
    negative_rows = negative_rows.sort_values(
        by=["quality_score", "city", "name"],
        ascending=[False, True, True],
    )

    negative_candidates = negative_rows.to_dict("records")
    selected_negative = 0
    for row in negative_candidates:
        key = build_row_key(row)
        if key in sampled_keys:
            continue
        sampled_keys.add(key)
        sampled_rows.append(row)
        selected_negative += 1
        if selected_negative >= NEGATIVE_ROWS:
            break

    return sampled_rows


def main():
    print("\n" + "=" * 60)
    print("INTEREST VALIDATION CANDIDATE GENERATION")
    print("=" * 60 + "\n")

    if not LABEL_DATASET_PATH.exists():
        print("Error: dataset/place_interest_labels.csv not found")
        raise SystemExit(1)

    df = pd.read_csv(LABEL_DATASET_PATH)
    required_columns = {
        "name", "category", "types", "rating", "review", "city",
        "lat", "lng", "user_ratings_total", "interest_tags",
    }
    missing = required_columns - set(df.columns)
    if missing:
        print(f"Error: Missing columns in interest dataset: {sorted(missing)}")
        raise SystemExit(1)

    sampled_rows = sample_balanced_rows(df)
    existing_annotations = load_existing_annotations()

    output_rows = []
    for row in sampled_rows:
        key = build_row_key(row)
        existing = existing_annotations.get(key, {})
        output_rows.append({
            "validation_key": key,
            "name": normalize_text(row.get("name")),
            "city": normalize_text(row.get("city")),
            "category": normalize_text(row.get("category")),
            "types": normalize_text(row.get("types")),
            "rating": normalize_text(row.get("rating")),
            "user_ratings_total": normalize_text(row.get("user_ratings_total")),
            "weak_interest_tags": normalize_text(row.get("interest_tags")),
            "focus_interests": " | ".join([interest for interest in FOCUS_INTERESTS if interest in parse_tags(row.get("interest_tags"))]),
            "review_excerpt": build_review_excerpt(row.get("review")),
            "verified_interest_tags": normalize_text(existing.get("verified_interest_tags")),
            "status": normalize_text(existing.get("status")) or "pending",
            "notes": normalize_text(existing.get("notes")),
        })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df = pd.DataFrame(output_rows)
    output_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved: {OUTPUT_PATH}")
    print(f"Rows: {len(output_df)}")
    print("Focus coverage:")
    for interest in FOCUS_INTERESTS:
        count = int(output_df["focus_interests"].fillna("").str.contains(interest).sum())
        print(f"  {interest}: {count}")

    print("\nHow to review:")
    print("  Fill 'verified_interest_tags' with your true tags, separated by ' | '")
    print("  Set 'status' to reviewed when done")
    print("  Add any comments in 'notes'")
    print("\nValidation candidate generation complete\n")


if __name__ == "__main__":
    main()
