from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import json

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
INPUT_PATH = BASE_DIR / "dataset" / "place_interest_labels_hf_clean.csv"
OUTPUT_PATH = BASE_DIR / "dataset" / "shopping_debug_scores.csv"

WEIGHTED_RATING_THRESHOLD = 2000


def parse_score_map(raw_value) -> dict[str, float]:
    if not isinstance(raw_value, str) or not raw_value.strip():
        return {}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    result = {}
    for key, value in parsed.items():
        try:
            result[str(key)] = float(value)
        except (TypeError, ValueError):
            continue
    return result


def build_weighted_rating(rating: float, review_count: float, average_rating: float) -> float:
    return ((review_count / (review_count + WEIGHTED_RATING_THRESHOLD)) * rating) + (
        (WEIGHTED_RATING_THRESHOLD / (review_count + WEIGHTED_RATING_THRESHOLD)) * average_rating
    )


def main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--interest", default="shopping")
    args = parser.parse_args()

    if not INPUT_PATH.exists():
        raise SystemExit(f"Missing input file: {INPUT_PATH}")

    interest = str(args.interest or "shopping").strip().lower()
    df = pd.read_csv(INPUT_PATH)

    ratings = pd.to_numeric(df.get("rating"), errors="coerce").fillna(0)
    review_totals = pd.to_numeric(df.get("user_ratings_total"), errors="coerce").fillna(0)
    average_rating = float(ratings[ratings > 0].mean()) if (ratings > 0).any() else 0.0

    popularity_signal = np.log(review_totals + 1)
    popularity_min = float(popularity_signal.min()) if len(popularity_signal) else 0.0
    popularity_max = float(popularity_signal.max()) if len(popularity_signal) else 0.0
    popularity_range = popularity_max - popularity_min

    rows = []
    for _, row in df.iterrows():
        interest_scores = parse_score_map(row.get("interest_scores_json"))
        interest_score = float(interest_scores.get(interest, 0.0))
        rating = float(pd.to_numeric(pd.Series([row.get("rating")]), errors="coerce").fillna(0).iloc[0])
        user_ratings_total = float(pd.to_numeric(pd.Series([row.get("user_ratings_total")]), errors="coerce").fillna(0).iloc[0])
        weighted_rating = build_weighted_rating(rating, user_ratings_total, average_rating)
        signal = float(np.log(user_ratings_total + 1))
        normalized_popularity = ((signal - popularity_min) / popularity_range) if popularity_range > 0 else 0.0

        rows.append({
            "name": row.get("name", ""),
            "city": row.get("city", ""),
            f"{interest}_score": round(interest_score, 4),
            "user_ratings_total": int(user_ratings_total),
            "weighted_rating": round(weighted_rating, 4),
            "popularity_score": round(normalized_popularity, 4),
        })

    output_df = pd.DataFrame(rows).sort_values(
        by=[f"{interest}_score", "weighted_rating", "popularity_score", "user_ratings_total"],
        ascending=[False, False, False, False],
    )
    output_df.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
