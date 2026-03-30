from __future__ import annotations

from argparse import ArgumentParser
from collections import Counter
from pathlib import Path
import json
import os
import re
import time

import numpy as np
import pandas as pd
import torch
from huggingface_hub import login
from transformers import AutoModel, AutoTokenizer, pipeline


BASE_DIR = Path(__file__).resolve().parent
BACKEND_ENV_PATH = BASE_DIR.parent / "Backend" / ".env"
INPUT_PATH = BASE_DIR / "dataset" / "place_interest_labels.csv"
OUTPUT_PATH = BASE_DIR / "dataset" / "place_interest_labels_hf.csv"
SUMMARY_PATH = BASE_DIR / "dataset" / "place_interest_labels_hf_summary.json"
FAILURES_PATH = BASE_DIR / "dataset" / "place_interest_labels_hf_failures.json"

PRIMARY_MODEL_ID = "MoritzLaurer/deberta-v3-base-zeroshot-v2.0"
FALLBACK_MODEL_ID = "sentence-transformers/all-mpnet-base-v2"

ROOT_INTERESTS = {
    "adventure": "adventure, trekking, boating, thrill, rides, or outdoor excitement",
    "art": "art, exhibitions, galleries, murals, or creative spaces",
    "beaches": "beaches, coastal views, waterfront walks, or sunset by the sea",
    "culture": "culture, spirituality, architecture, traditions, or cultural landmarks",
    "food": "restaurants, cafes, seafood, bakery stops, brunch, or memorable dining",
    "history": "history, heritage, forts, palaces, museums, or monuments",
    "nature": "nature, peaceful scenery, gardens, parks, backwaters, or scenic viewpoints",
    "nightlife": "nightlife, bars, cocktails, late evening socializing, or music venues",
    "shopping": "shopping, malls, markets, street shopping, local stores, or souvenirs",
    "sports": "sports, fitness, recreation, active movement, or stadium experiences",
}

INTENT_TAGS = {
    "mall shopping": "large indoor shopping with branded stores, food courts, and family-friendly retail",
    "street shopping": "market browsing, bazaar atmosphere, bargain hunting, or street shopping",
    "local shopping": "local stores, neighborhood retail, or city-center shopping",
    "souvenir shopping": "buying handicrafts, crafts, traditional items, or souvenirs",
    "fashion shopping": "clothing, apparel, boutique, or fashion-oriented retail",
    "electronics shopping": "electronics, gadgets, devices, or showroom-style shopping",
    "jewelry shopping": "gold, diamonds, jewelry, ornaments, or premium accessories",
    "budget shopping": "affordable shopping, value deals, or low-cost browsing",
    "premium": "premium, upscale, branded, luxury, or high-end experience",
    "tourist hotspot": "famous, iconic, must-visit place popular with travelers",
    "hidden gem": "special offbeat place with distinctive charm or quieter appeal",
    "local favorite": "authentic spot popular among locals or regulars",
    "family-friendly": "good for families, kids, or relaxed group outings",
    "group-friendly": "good for groups of friends or shared outings",
    "couples": "good for couples, dates, or shared experiences",
    "romantic dinner": "romantic dining, date-night meal, or intimate dinner",
    "casual dining": "relaxed restaurant meal, lunch, or casual dining stop",
    "fine dining": "refined chef-led meal or polished restaurant experience",
    "cafe stop": "coffee break, cafe hangout, or relaxed conversation spot",
    "cozy": "warm, intimate, laid-back, or cozy ambience",
    "work-friendly": "comfortable for laptop work, reading, or quiet cafe time",
    "bakery stop": "pastries, cakes, baked treats, or bakery visit",
    "brunch spot": "breakfast, brunch, or slow coffee-and-food experience",
    "street food": "quick local food, food-street vibe, or snack-style eating",
    "seafood": "fish, prawns, crab, tuna, or seafood-focused dining",
    "budget eats": "affordable food stop or value-for-money dining",
    "nightlife": "nightlife, cocktails, bars, or evening social scene",
    "bar hopping": "drinks-oriented social plan across bars or lounges",
    "late-night": "late-night hangout or after-dark stop",
    "live music": "live music, performances, or music-led evening atmosphere",
    "museum visit": "exhibits, collections, educational browsing, or museum-style visit",
    "heritage site": "historic, preserved, royal, colonial, or heritage architecture",
    "cultural landmark": "architectural, spiritual, or culturally symbolic landmark",
    "spiritual stop": "temple, church, mosque, synagogue, or reflective religious visit",
    "art experience": "art-led atmosphere, galleries, murals, or exhibitions",
    "beach walk": "shore stroll, beach walk, or sea-facing relaxation",
    "waterfront": "harbor, lakeside, coastal, or backwater setting",
    "sunset spot": "place known for sunset views or evening scenery",
    "scenic views": "beautiful views, photogenic vistas, or viewpoint appeal",
    "relaxing": "peaceful, calm, serene, or unwinding atmosphere",
    "nature escape": "green, scenic, backwater, park, or nature-first escape",
    "outdoor activity": "walking, boating, active sightseeing, or outdoor time",
    "adventure": "adventure-focused place with thrill, action, or active exploration",
    "thrill": "rides, excitement, thrill, or energetic experience",
    "hiking": "hiking, trekking, uphill walks, or trails",
    "sports": "sports, recreation, fitness, or active play",
}

INTENT_ROOT_MAP = {
    "mall shopping": {"shopping"},
    "street shopping": {"shopping"},
    "local shopping": {"shopping"},
    "souvenir shopping": {"shopping", "culture", "history"},
    "fashion shopping": {"shopping"},
    "electronics shopping": {"shopping"},
    "jewelry shopping": {"shopping"},
    "budget shopping": {"shopping"},
    "premium": {"shopping", "food", "nightlife"},
    "tourist hotspot": {"shopping", "culture", "history", "beaches", "nature", "art"},
    "hidden gem": {"culture", "history", "art", "nature", "food"},
    "local favorite": {"shopping", "culture", "history", "art", "nature", "food"},
    "family-friendly": {"shopping", "food", "nature", "beaches", "sports", "adventure"},
    "group-friendly": {"nightlife", "adventure", "sports", "food"},
    "couples": {"food", "beaches", "nature", "nightlife", "art", "culture"},
    "romantic dinner": {"food", "nightlife"},
    "casual dining": {"food"},
    "fine dining": {"food"},
    "cafe stop": {"food"},
    "cozy": {"food", "art"},
    "work-friendly": {"food"},
    "bakery stop": {"food"},
    "brunch spot": {"food"},
    "street food": {"food"},
    "seafood": {"food", "beaches"},
    "budget eats": {"food"},
    "nightlife": {"nightlife"},
    "bar hopping": {"nightlife"},
    "late-night": {"nightlife"},
    "live music": {"nightlife", "art", "food"},
    "museum visit": {"history", "culture", "art"},
    "heritage site": {"history", "culture"},
    "cultural landmark": {"culture", "history", "art"},
    "spiritual stop": {"culture", "history"},
    "art experience": {"art", "culture", "history"},
    "beach walk": {"beaches", "nature"},
    "waterfront": {"beaches", "nature"},
    "sunset spot": {"beaches", "nature"},
    "scenic views": {"beaches", "nature", "history", "culture"},
    "relaxing": {"beaches", "nature", "food"},
    "nature escape": {"nature", "beaches"},
    "outdoor activity": {"nature", "adventure", "sports", "beaches"},
    "adventure": {"adventure", "nature"},
    "thrill": {"adventure"},
    "hiking": {"adventure", "nature"},
    "sports": {"sports"},
}

ROOT_KEYWORD_BONUSES = {
    "shopping": {"mall", "market", "bazaar", "shopping", "store", "souvenir", "shopping centre", "food court"},
    "food": {"restaurant", "cafe", "bakery", "food", "dining", "brunch", "coffee", "seafood"},
    "history": {"fort", "palace", "heritage", "historic", "museum", "colonial", "royal", "monument"},
    "culture": {"temple", "church", "mosque", "synagogue", "cultural", "architecture", "spiritual"},
    "art": {"art", "gallery", "exhibition", "mural", "painting", "craft"},
    "beaches": {"beach", "shore", "sea", "coast", "waterfront", "sunset"},
    "nature": {"park", "garden", "lake", "backwater", "green", "viewpoint", "waterfall", "island"},
    "adventure": {"adventure", "trek", "trail", "kayak", "water sports", "ride", "boating"},
    "nightlife": {"bar", "cocktail", "nightlife", "club", "pub", "live music", "late night"},
    "sports": {"sports", "stadium", "fitness", "gym", "football", "cricket"},
}

INTENT_KEYWORD_BONUSES = {
    "mall shopping": {"mall", "shopping mall", "food court", "cinema"},
    "street shopping": {"market", "bazaar", "marketplace", "street shopping", "broadway", "jew town"},
    "local shopping": {"shopping area", "shopping centre", "stores"},
    "souvenir shopping": {"souvenir", "handicraft", "craft", "traditional items", "artisan"},
    "fashion shopping": {"fashion", "clothing", "boutique", "apparel", "branded"},
    "electronics shopping": {"electronics", "gadgets", "mobile", "laptop", "showroom"},
    "jewelry shopping": {"jewellery", "jewelry", "gold", "diamonds"},
    "budget shopping": {"budget", "cheap", "affordable", "reasonable"},
    "premium": {"luxury", "premium", "upscale", "high-end", "branded"},
    "tourist hotspot": {"must visit", "iconic", "popular destination", "must-see"},
    "hidden gem": {"hidden gem", "off the beaten track"},
    "local favorite": {"authentic", "popular among locals", "local favorite"},
    "family-friendly": {"family", "kids", "children", "spacious"},
    "group-friendly": {"friends", "group", "hangout"},
    "couples": {"romantic", "date", "candlelight"},
    "romantic dinner": {"romantic", "date night", "candlelight"},
    "casual dining": {"restaurant", "lunch", "dinner"},
    "fine dining": {"fine dining", "chef", "elegant"},
    "cafe stop": {"cafe", "coffee", "tea"},
    "cozy": {"cozy", "warm", "laid-back", "courtyard"},
    "work-friendly": {"wifi", "laptop", "work", "study"},
    "bakery stop": {"bakery", "cake", "pastry"},
    "brunch spot": {"brunch", "breakfast", "coffee"},
    "street food": {"street food", "food street", "quick bite"},
    "seafood": {"seafood", "fish", "prawns", "crab", "calamari", "tuna"},
    "budget eats": {"budget", "cheap", "affordable", "reasonable"},
    "nightlife": {"nightlife", "bar", "club", "pub", "cocktail"},
    "bar hopping": {"bar", "pub", "cocktail", "lounge"},
    "late-night": {"late night", "nightlife"},
    "live music": {"live music", "music"},
    "museum visit": {"museum", "exhibits", "collections"},
    "heritage site": {"heritage", "historic", "fort", "palace", "colonial", "royal"},
    "cultural landmark": {"cultural", "architecture", "cathedral", "basilica"},
    "spiritual stop": {"temple", "church", "mosque", "synagogue", "spiritual", "prayer"},
    "art experience": {"art", "gallery", "exhibition", "mural", "painting"},
    "beach walk": {"beach", "shore", "coast", "seaside"},
    "waterfront": {"waterfront", "harbor", "harbour", "backwater", "lakeside"},
    "sunset spot": {"sunset", "evening view"},
    "scenic views": {"view", "viewpoint", "scenic"},
    "relaxing": {"peaceful", "calm", "serene", "relaxing", "tranquil"},
    "nature escape": {"park", "garden", "lake", "backwater", "green", "island"},
    "outdoor activity": {"walking", "boating", "outdoor", "stroll"},
    "adventure": {"adventure", "trek", "trail", "kayak", "water sports", "ride"},
    "thrill": {"thrill", "exciting", "ride"},
    "hiking": {"hiking", "trek", "trail", "hike"},
    "sports": {"sports", "stadium", "fitness", "gym", "football", "cricket"},
}

TYPE_ROOT_BONUSES = {
    "shopping_mall": {"shopping": 0.24},
    "market": {"shopping": 0.22},
    "clothing_store": {"shopping": 0.18},
    "electronics_store": {"shopping": 0.18},
    "restaurant": {"food": 0.18},
    "cafe": {"food": 0.18},
    "bakery": {"food": 0.18},
    "bar": {"nightlife": 0.22, "food": 0.04},
    "night_club": {"nightlife": 0.28},
    "museum": {"history": 0.18, "culture": 0.12, "art": 0.08},
    "historical_landmark": {"history": 0.22, "culture": 0.08},
    "monument": {"history": 0.18, "culture": 0.08},
    "art_gallery": {"art": 0.22, "culture": 0.08},
    "church": {"culture": 0.16, "history": 0.06},
    "temple": {"culture": 0.16, "history": 0.06},
    "hindu_temple": {"culture": 0.16, "history": 0.06},
    "mosque": {"culture": 0.16, "history": 0.06},
    "synagogue": {"culture": 0.16, "history": 0.06},
    "beach": {"beaches": 0.26, "nature": 0.08},
    "park": {"nature": 0.20, "sports": 0.04},
    "garden": {"nature": 0.20},
    "natural_feature": {"nature": 0.18, "adventure": 0.06},
    "stadium": {"sports": 0.28},
    "gym": {"sports": 0.22},
    "amusement_park": {"adventure": 0.24},
}

TYPE_INTENT_BONUSES = {
    "shopping_mall": {"mall shopping": 0.28, "family-friendly": 0.10},
    "market": {"street shopping": 0.28, "local shopping": 0.16},
    "clothing_store": {"fashion shopping": 0.28},
    "electronics_store": {"electronics shopping": 0.28},
    "jewelry_store": {"jewelry shopping": 0.30},
    "restaurant": {"casual dining": 0.20},
    "cafe": {"cafe stop": 0.28},
    "bakery": {"bakery stop": 0.28},
    "bar": {"nightlife": 0.22, "bar hopping": 0.20},
    "night_club": {"nightlife": 0.28, "late-night": 0.22},
    "museum": {"museum visit": 0.28, "heritage site": 0.08},
    "historical_landmark": {"heritage site": 0.28},
    "monument": {"heritage site": 0.24},
    "art_gallery": {"art experience": 0.30},
    "church": {"spiritual stop": 0.28, "cultural landmark": 0.08},
    "temple": {"spiritual stop": 0.28, "cultural landmark": 0.08},
    "hindu_temple": {"spiritual stop": 0.28, "cultural landmark": 0.08},
    "mosque": {"spiritual stop": 0.28, "cultural landmark": 0.08},
    "synagogue": {"spiritual stop": 0.28, "cultural landmark": 0.08},
    "beach": {"beach walk": 0.28, "sunset spot": 0.10, "waterfront": 0.10},
    "park": {"nature escape": 0.22, "relaxing": 0.10},
    "garden": {"nature escape": 0.22, "relaxing": 0.10},
    "natural_feature": {"nature escape": 0.18, "scenic views": 0.10},
    "stadium": {"sports": 0.30},
    "gym": {"sports": 0.24},
    "amusement_park": {"adventure": 0.22, "thrill": 0.18},
}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_hf_token() -> str:
    load_env_file(BACKEND_ENV_PATH)
    token = os.getenv("HF_TOKEN", "").strip()
    if not token:
      raise RuntimeError(f"HF_TOKEN not found in environment or {BACKEND_ENV_PATH}")
    return token


def authenticate_hf(token: str) -> None:
    os.environ["HF_TOKEN"] = token
    os.environ["HUGGING_FACE_HUB_TOKEN"] = token
    login(token=token, add_to_git_credential=False)


def normalize_text(value) -> str:
    return str(value or "").strip().lower()


def tokenize_types(value) -> set[str]:
    raw = normalize_text(value)
    if not raw:
        return set()
    return {
        part.strip().replace(" ", "_")
        for part in re.split(r"\||,|;", raw)
        if part.strip()
    }


def build_place_text(row) -> str:
    parts = [
        f"name: {normalize_text(row.get('name'))}",
        f"category: {normalize_text(row.get('category'))}",
        f"types: {normalize_text(row.get('types'))}",
        f"location: {normalize_text(row.get('city'))}",
        f"context: lat {row.get('lat')} lng {row.get('lng')}",
        f"description: {normalize_text(row.get('review'))[:1400]}",
    ]
    return " | ".join(part for part in parts if part)


def mean_pool(last_hidden_state: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
    summed = torch.sum(last_hidden_state * mask, dim=1)
    counts = torch.clamp(mask.sum(dim=1), min=1e-9)
    return summed / counts


def encode_texts(tokenizer, model, texts: list[str], batch_size: int = 32) -> np.ndarray:
    embeddings = []
    model.eval()
    with torch.no_grad():
        for start in range(0, len(texts), batch_size):
            batch = texts[start:start + batch_size]
            encoded = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=256,
                return_tensors="pt",
            )
            outputs = model(**encoded)
            pooled = mean_pool(outputs.last_hidden_state, encoded["attention_mask"])
            pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
            embeddings.append(pooled.cpu().numpy())
    return np.vstack(embeddings) if embeddings else np.empty((0, 0), dtype=np.float32)


def cosine_scores(vector: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    return np.dot(matrix, vector)


def similarity_to_confidence(similarity: float) -> float:
    return max(0.0, min(1.0, (float(similarity) + 1.0) / 2.0))


def get_keyword_bonus(text: str, label: str, mapping: dict[str, set[str]]) -> float:
    keywords = mapping.get(label, set())
    hits = sum(1 for keyword in keywords if keyword in text)
    return min(0.24, hits * 0.08) if hits else 0.0


def get_type_bonus(types: set[str], label: str, mapping: dict[str, dict[str, float]]) -> float:
    score = 0.0
    for place_type in types:
        score += mapping.get(place_type, {}).get(label, 0.0)
    return min(0.35, score)


def get_popularity_bonus(row, label: str) -> float:
    total = int(row.get("user_ratings_total") or 0)
    rating = float(row.get("rating") or 0.0)
    if label == "tourist hotspot" and total >= 5000 and rating >= 4.2:
        return 0.15
    if label == "local favorite" and total >= 1000 and rating >= 4.2:
        return 0.10
    return 0.0


def choose_root_interests(scores: dict[str, float]) -> list[str]:
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    selected = [label for label, score in ranked if score >= 0.56][:3]
    if not selected and ranked and ranked[0][1] >= 0.46:
        selected = [ranked[0][0]]
    return selected


def choose_intent_tags(scores: dict[str, float]) -> list[str]:
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    selected = [label for label, score in ranked if score >= 0.60][:8]
    if len(selected) < 5:
        for label, score in ranked:
            if label not in selected and score >= 0.52:
                selected.append(label)
            if len(selected) >= 5:
                break
    return selected[:12]


def choose_candidate_intent_labels(text: str, types: set[str], selected_roots: list[str]) -> list[str]:
    selected_root_set = set(selected_roots)
    candidates = set()

    if not selected_root_set:
        selected_root_set = {"culture"}

    for label, roots in INTENT_ROOT_MAP.items():
        if roots & selected_root_set:
            candidates.add(label)

    for label, keywords in INTENT_KEYWORD_BONUSES.items():
        if any(keyword in text for keyword in keywords):
            candidates.add(label)

    for place_type in types:
        for label in TYPE_INTENT_BONUSES.get(place_type, {}):
            candidates.add(label)

    candidates.update({"tourist hotspot", "local favorite", "family-friendly"})
    return sorted(candidates)


def build_root_scores_zero_shot(classifier, texts: list[str], batch_size: int) -> list[dict[str, float]]:
    label_texts = list(ROOT_INTERESTS.values())
    label_lookup = {value: key for key, value in ROOT_INTERESTS.items()}
    results = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        outputs = classifier(
            batch,
            candidate_labels=label_texts,
            hypothesis_template="Travelers would choose this place for {}.",
            multi_label=True,
            batch_size=batch_size,
        )
        if isinstance(outputs, dict):
            outputs = [outputs]
        for item in outputs:
            mapped = {
                label_lookup[label]: float(score)
                for label, score in zip(item["labels"], item["scores"])
            }
            results.append(mapped)
    return results


def build_root_scores_embedding(place_embeddings: np.ndarray, root_embeddings: np.ndarray) -> list[dict[str, float]]:
    scores = []
    root_labels = list(ROOT_INTERESTS.keys())
    for vector in place_embeddings:
        raw = cosine_scores(vector, root_embeddings)
        scores.append({
            label: similarity_to_confidence(similarity)
            for label, similarity in zip(root_labels, raw)
        })
    return scores


def validate_and_fill(root_tags: list[str], intent_tags: list[str], root_scores: dict[str, float], intent_scores: dict[str, float]) -> tuple[list[str], list[str]]:
    if not root_tags:
        ranked_roots = sorted(root_scores.items(), key=lambda item: item[1], reverse=True)
        root_tags = [ranked_roots[0][0]] if ranked_roots else ["culture"]
    if not intent_tags:
        ranked_intents = sorted(intent_scores.items(), key=lambda item: item[1], reverse=True)
        intent_tags = [label for label, _ in ranked_intents[:5]]
    root_tags = [tag for tag in root_tags if tag][:3]
    intent_tags = [tag for tag in intent_tags if tag][:12]
    if len(intent_tags) < 5:
        ranked_intents = sorted(intent_scores.items(), key=lambda item: item[1], reverse=True)
        for label, _ in ranked_intents:
            if label not in intent_tags:
                intent_tags.append(label)
            if len(intent_tags) >= 5:
                break
    return root_tags, intent_tags[:12]


def process_dataset(df: pd.DataFrame, batch_size: int, token: str) -> tuple[pd.DataFrame, dict, list[dict]]:
    active_model = FALLBACK_MODEL_ID
    root_strategy = "embedding"
    failures = []
    primary_model_loaded = False

    try:
        print(f"Loading primary zero-shot model: {PRIMARY_MODEL_ID}")
        root_classifier = pipeline(
            "zero-shot-classification",
            model=PRIMARY_MODEL_ID,
            token=token,
            device=-1,
        )
        primary_model_loaded = True
        embed_tokenizer = AutoTokenizer.from_pretrained(FALLBACK_MODEL_ID, token=token)
        embed_model = AutoModel.from_pretrained(FALLBACK_MODEL_ID, token=token)
    except Exception as error:
        print(f"Primary model failed, falling back to semantic encoder: {error}")
        root_classifier = None
        embed_tokenizer = AutoTokenizer.from_pretrained(FALLBACK_MODEL_ID, token=token)
        embed_model = AutoModel.from_pretrained(FALLBACK_MODEL_ID, token=token)

    place_texts = [build_place_text(row) for _, row in df.iterrows()]
    print(f"Encoding {len(place_texts)} place texts with {FALLBACK_MODEL_ID}")
    place_embeddings = encode_texts(embed_tokenizer, embed_model, place_texts, batch_size=batch_size)
    intent_labels = list(INTENT_TAGS.keys())
    intent_embeddings = encode_texts(embed_tokenizer, embed_model, list(INTENT_TAGS.values()), batch_size=16)

    if primary_model_loaded and len(df) <= 250:
        root_strategy = "zero-shot"
        print("Scoring root interests with zero-shot classifier")
        raw_root_scores = build_root_scores_zero_shot(root_classifier, place_texts, batch_size=max(1, min(8, batch_size)))
    else:
        if primary_model_loaded and len(df) > 250:
            print("Primary zero-shot model loaded, but using semantic fallback for full-scale throughput")
        print("Scoring root interests with semantic fallback")
        root_embeddings = encode_texts(embed_tokenizer, embed_model, list(ROOT_INTERESTS.values()), batch_size=16)
        raw_root_scores = build_root_scores_embedding(place_embeddings, root_embeddings)

    interest_counter = Counter()
    intent_counter = Counter()
    output_rows = []

    for index, (_, row) in enumerate(df.iterrows(), start=1):
        if index % 50 == 0 or index == 1:
            print(f"Processed {index}/{len(df)}")

        error_message = ""
        row_output = None
        for attempt in range(1, 4):
            try:
                text = place_texts[index - 1]
                types = tokenize_types(row.get("types"))
                root_scores = {
                    label: min(
                        1.0,
                        float(score)
                        + get_type_bonus(types, label, TYPE_ROOT_BONUSES)
                        + get_keyword_bonus(text, label, ROOT_KEYWORD_BONUSES),
                    )
                    for label, score in raw_root_scores[index - 1].items()
                }
                root_tags = choose_root_interests(root_scores)

                candidate_intent_labels = choose_candidate_intent_labels(text, types, root_tags)
                semantic_intent_scores = cosine_scores(place_embeddings[index - 1], intent_embeddings)
                intent_scores = {}
                for label, similarity in zip(intent_labels, semantic_intent_scores):
                    if label not in candidate_intent_labels:
                        continue
                    intent_scores[label] = min(
                        1.0,
                        similarity_to_confidence(similarity)
                        + get_type_bonus(types, label, TYPE_INTENT_BONUSES)
                        + get_keyword_bonus(text, label, INTENT_KEYWORD_BONUSES)
                        + get_popularity_bonus(row, label),
                    )

                intent_tags = choose_intent_tags(intent_scores)
                root_tags, intent_tags = validate_and_fill(root_tags, intent_tags, root_scores, intent_scores)

                row_output = {
                    **row.to_dict(),
                    "original_interest_tags": row.get("interest_tags", ""),
                    "interest_tags": " | ".join(root_tags),
                    "interest_tag_count": len(root_tags),
                    "interest_tags_json": json.dumps(root_tags),
                    "intent_tags": " | ".join(intent_tags),
                    "intent_tag_count": len(intent_tags),
                    "intent_tags_json": json.dumps(intent_tags),
                    "interest_scores_json": json.dumps(root_scores, sort_keys=True),
                    "intent_scores_json": json.dumps(intent_scores, sort_keys=True),
                    "tagging_model": active_model,
                    "tagging_backend": root_strategy,
                    "tagging_error": "",
                }
                break
            except Exception as error:
                error_message = str(error)
                print(f"Error on row {index} attempt {attempt}: {error_message}")
                time.sleep(1.0 * attempt)

        if row_output is None:
            failures.append({
                "row_index": index,
                "name": row.get("name"),
                "error": error_message,
            })
            fallback_roots = ["culture"]
            fallback_intents = ["local favorite", "family-friendly", "scenic views", "relaxing", "tourist hotspot"]
            row_output = {
                **row.to_dict(),
                "original_interest_tags": row.get("interest_tags", ""),
                "interest_tags": " | ".join(fallback_roots),
                "interest_tag_count": len(fallback_roots),
                "interest_tags_json": json.dumps(fallback_roots),
                "intent_tags": " | ".join(fallback_intents),
                "intent_tag_count": len(fallback_intents),
                "intent_tags_json": json.dumps(fallback_intents),
                "interest_scores_json": json.dumps({}),
                "intent_scores_json": json.dumps({}),
                "tagging_model": active_model,
                "tagging_backend": root_strategy,
                "tagging_error": error_message,
            }

        interest_counter.update(row_output["interest_tags"].split(" | "))
        intent_counter.update(row_output["intent_tags"].split(" | "))
        output_rows.append(row_output)

    summary = {
        "input_file": str(INPUT_PATH),
        "output_file": str(OUTPUT_PATH),
        "rows": len(output_rows),
        "model_used": active_model,
        "root_strategy": root_strategy,
        "primary_model_loaded": primary_model_loaded,
        "failure_count": len(failures),
        "avg_interest_tag_count": round(sum(row["interest_tag_count"] for row in output_rows) / max(1, len(output_rows)), 4),
        "avg_intent_tag_count": round(sum(row["intent_tag_count"] for row in output_rows) / max(1, len(output_rows)), 4),
        "interest_counts": dict(sorted(interest_counter.items())),
        "top_intent_tags": dict(intent_counter.most_common(40)),
    }
    return pd.DataFrame(output_rows), summary, failures


def main():
    parser = ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=24)
    args = parser.parse_args()

    if not INPUT_PATH.exists():
        raise SystemExit(f"Missing input file: {INPUT_PATH}")

    token = load_hf_token()
    authenticate_hf(token)

    df = pd.read_csv(INPUT_PATH)
    if args.limit and args.limit > 0:
        df = df.head(args.limit).copy()

    output_df, summary, failures = process_dataset(df, batch_size=max(4, args.batch_size), token=token)

    if output_df["interest_tags"].fillna("").str.strip().eq("").any():
        raise RuntimeError("Validation failed: empty interest_tags found")
    if output_df["intent_tags"].fillna("").str.strip().eq("").any():
        raise RuntimeError("Validation failed: empty intent_tags found")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(OUTPUT_PATH, index=False)
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    FAILURES_PATH.write_text(json.dumps(failures, indent=2), encoding="utf-8")

    print(f"Saved: {OUTPUT_PATH}")
    print(f"Saved: {SUMMARY_PATH}")
    print(f"Saved: {FAILURES_PATH}")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
