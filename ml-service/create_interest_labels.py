"""
Generate weakly supervised interest labels for places.

This builds a training dataset for the interest-tagging model using heuristics
from place category, exported Google types, place name, and review text.
"""

from pathlib import Path
import json
import re

import pandas as pd

DATASET_PATH = Path("dataset/places.csv")
OUTPUT_PATH = Path("dataset/place_interest_labels.csv")

INTEREST_RULES = {
    "beaches": {
        "categories": {"beach", "natural_feature"},
        "types": {"beach", "natural_feature"},
        "name_keywords": {
            "beach", "coast", "coastal", "shore", "shoreline", "sea", "seaside",
            "ocean", "harbour", "harbor", "waterfront", "sunset beach", "beach view",
        },
        "review_keywords": {"beach", "shore", "seaside", "coast", "coastal"},
        "min_score": 1,
        "review_requires_structured_match": True,
    },
    "shopping": {
        "categories": {"shopping_mall", "store"},
        "types": {"shopping_mall", "store", "market", "supermarket", "clothing_store", "home_goods_store"},
        "name_keywords": {
            "mall", "shopping", "market", "bazaar", "souq", "marketplace",
            "jew town", "broadway", "avenue mall", "lulu", "centre square",
        },
        "review_keywords": {"shopping mall", "shopping", "market", "bazaar", "stores"},
        "min_score": 1,
        "review_requires_structured_match": True,
        "blocked_types": {"museum", "church", "hindu_temple", "temple", "mosque", "synagogue"},
    },
    "culture": {
        "categories": {"museum", "art_gallery", "church", "hindu_temple", "temple", "monument"},
        "types": {"museum", "art_gallery", "church", "hindu_temple", "temple", "mosque", "synagogue", "monument"},
        "name_keywords": {
            "culture", "cultural", "heritage", "cathedral", "basilica", "temple",
            "mosque", "church", "synagogue", "ritual", "spiritual", "palace",
        },
        "review_keywords": {
            "culture", "cultural", "heritage", "cathedral", "basilica", "temple",
            "mosque", "church", "synagogue", "ritual", "spiritual", "palace",
        },
        "min_score": 1,
    },
    "history": {
        "categories": {"museum", "historical_landmark", "monument", "church", "synagogue", "temple"},
        "types": {"museum", "historical_landmark", "monument", "landmark", "fort", "palace"},
        "name_keywords": {
            "history", "historic", "heritage", "fort", "palace", "colonial",
            "ancient", "royal", "museum", "maritime history",
        },
        "review_keywords": {
            "history", "historic", "heritage", "fort", "palace", "colonial",
            "ancient", "royal", "museum", "maritime history",
        },
        "min_score": 1,
    },
    "nature": {
        "categories": {"park", "zoo", "garden", "natural_feature"},
        "types": {"park", "zoo", "garden", "natural_feature", "aquarium"},
        "name_keywords": {
            "park", "garden", "nature", "green", "walkway", "mangrove",
            "lake", "island", "bird", "waterfront", "backwater",
        },
        "review_keywords": {
            "park", "garden", "nature", "green", "walkway", "mangrove",
            "lake", "island", "bird", "waterfront", "backwater",
        },
        "min_score": 1,
    },
    "food": {
        "categories": {"restaurant", "cafe", "bakery"},
        "types": {"restaurant", "cafe", "bakery", "meal_takeaway"},
        "name_keywords": {
            "restaurant", "cafe", "bakery", "food", "dining", "eatery",
            "bistro", "kitchen", "coffee", "tea house",
        },
        "review_keywords": {"restaurant", "cafe", "bakery", "food", "dining", "eatery", "meal"},
        "min_score": 1,
        "review_requires_structured_match": True,
    },
    "nightlife": {
        "categories": {"bar", "night_club"},
        "types": {"bar", "night_club"},
        "name_keywords": {
            "bar", "pub", "club", "nightlife", "cocktail", "lounge",
        },
        "review_keywords": {"bar", "pub", "club", "nightlife", "cocktail", "lounge"},
        "min_score": 1,
        "review_requires_structured_match": True,
        "blocked_types": {"church", "hindu_temple", "temple", "mosque", "synagogue", "museum"},
    },
    "art": {
        "categories": {"art_gallery", "museum"},
        "types": {"art_gallery", "museum"},
        "name_keywords": {
            "art", "gallery", "exhibition", "mural", "painting", "craft",
        },
        "review_keywords": {"art", "gallery", "exhibition", "mural", "painting", "craft"},
        "min_score": 1,
    },
    "adventure": {
        "categories": {"amusement_park", "park", "natural_feature"},
        "types": {"amusement_park", "park", "natural_feature"},
        "name_keywords": {
            "adventure", "amusement", "theme park", "boating", "kayak",
            "trek", "trail", "water sports",
        },
        "review_keywords": {"adventure", "amusement", "theme park", "boating", "kayak", "trek", "trail", "water sports"},
        "min_score": 1,
    },
    "sports": {
        "categories": {"park", "stadium"},
        "types": {"park", "stadium", "gym"},
        "name_keywords": {
            "sports", "stadium", "ground", "fitness", "football", "cricket",
            "walking track",
        },
        "review_keywords": {"sports", "stadium", "ground", "fitness", "football", "cricket", "walking track"},
        "min_score": 1,
    },
}


def normalize_text(value):
    return str(value or "").strip().lower()


def tokenize_types(value):
    raw = normalize_text(value)
    if not raw:
        return set()
    return {
        part.strip().replace(" ", "_")
        for part in re.split(r"\||,|;", raw)
        if part.strip()
    }


def build_text_parts(row):
    return {
        "name": normalize_text(row.get("name")),
        "category": normalize_text(row.get("category")),
        "types": normalize_text(row.get("types")),
        "review": normalize_text(row.get("review")),
        "city": normalize_text(row.get("city")),
    }


def has_keyword(text, keywords):
    return any(keyword in text for keyword in keywords)


def infer_interest_tags(row):
    category = normalize_text(row.get("category")).replace(" ", "_")
    types = tokenize_types(row.get("types"))
    text_parts = build_text_parts(row)
    name_text = " ".join(part for part in [text_parts["name"], text_parts["category"], text_parts["types"]] if part)
    review_text = text_parts["review"]

    tags = []
    for interest, rules in INTEREST_RULES.items():
        blocked_types = set(rules.get("blocked_types", set()))
        if blocked_types and types & blocked_types:
            continue

        category_match = category in rules["categories"]
        type_match = bool(types & rules["types"])
        name_keyword_match = has_keyword(name_text, rules.get("name_keywords", set()))
        review_keyword_match = has_keyword(review_text, rules.get("review_keywords", set()))

        structured_match = category_match or type_match or name_keyword_match
        if rules.get("review_requires_structured_match") and review_keyword_match and not structured_match:
            review_keyword_match = False

        score = int(category_match) + int(type_match) + int(name_keyword_match) + int(review_keyword_match)
        minimum_score = int(rules.get("min_score", 1))
        if score >= minimum_score and (structured_match or review_keyword_match):
            tags.append(interest)

    return sorted(set(tags))


def main():
    print("\n" + "=" * 60)
    print("INTEREST LABEL DATASET GENERATION")
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

    if "types" not in df.columns:
        df["types"] = ""

    df["interest_tags"] = df.apply(infer_interest_tags, axis=1)
    df["interest_tag_count"] = df["interest_tags"].apply(len)
    df["interest_tags_json"] = df["interest_tags"].apply(json.dumps)

    output_df = df.copy()
    output_df["interest_tags"] = output_df["interest_tags"].apply(lambda tags: " | ".join(tags))
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)

    counts = {
        interest: int(df["interest_tags"].apply(lambda tags, key=interest: key in tags).sum())
        for interest in INTEREST_RULES
    }

    print(f"Saved: {OUTPUT_PATH}")
    print(f"Rows: {len(df)}")
    print(f"Labeled rows: {int((df['interest_tag_count'] > 0).sum())}")
    print("Interest counts:")
    for interest, count in counts.items():
        print(f"  {interest}: {count}")

    print("\nSample labeled rows:")
    sample = output_df[output_df["interest_tag_count"] > 0].head(5)[["name", "category", "types", "interest_tags"]]
    if len(sample) > 0:
        print(sample.to_string(index=False))
    else:
        print("No labels generated")

    print("\nInterest label generation complete\n")


if __name__ == "__main__":
    main()
