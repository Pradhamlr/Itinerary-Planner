from __future__ import annotations

import re
from collections import defaultdict


def normalize_text(value) -> str:
    return str(value or "").strip().lower()


def parse_types(value) -> set[str]:
    if isinstance(value, list):
        return {
            normalize_text(part).replace(" ", "_")
            for part in value
            if normalize_text(part)
        }

    raw = normalize_text(value)
    if not raw:
        return set()
    return {
        part.strip().replace(" ", "_")
        for part in re.split(r"\||,|;", raw)
        if part.strip()
    }


def has_any(text: str, keywords: set[str] | list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def get_place_value(place, key, default=None):
    if isinstance(place, dict):
        return place.get(key, default)

    return getattr(place, key, default)


def build_place_tags(place) -> list[str]:
    name = normalize_text(get_place_value(place, "name"))
    category = normalize_text(get_place_value(place, "category"))
    description = normalize_text(get_place_value(place, "description"))
    city = normalize_text(get_place_value(place, "city"))
    review = normalize_text(get_place_value(place, "review"))
    types = parse_types(get_place_value(place, "types"))
    rating = float(get_place_value(place, "rating") or 0)
    user_ratings_total = int(get_place_value(place, "user_ratings_total") or 0)

    text = " ".join(part for part in [name, category, description, review, city, " ".join(sorted(types))] if part)

    scored_tags: dict[str, float] = defaultdict(float)
    tag_groups: dict[str, str] = {}

    def add(tag: str, score: float, group: str):
        if len(tag.split()) > 3:
            return
        scored_tags[tag] += score
        tag_groups[tag] = group

    def add_one(tags: list[tuple[str, float]], group: str):
        for tag, score in tags:
            add(tag, score, group)

    if types & {"shopping_mall"} or has_any(text, {"mall", "food court", "cinema"}):
        add_one([("mall shopping", 4.0), ("family-friendly", 2.4)], "shopping_mode")
    if types & {"market"} or has_any(text, {"bazaar", "market", "marketplace", "broadway", "jew town"}):
        add_one([("street shopping", 4.0), ("local shopping", 2.8)], "shopping_mode")
    if types & {"clothing_store"} or has_any(text, {"fashion", "apparel", "boutique", "clothing"}):
        add("fashion shopping", 3.8, "retail_focus")
    if types & {"electronics_store"} or has_any(text, {"electronics", "laptop", "mobile", "gadgets"}):
        add("electronics shopping", 3.8, "retail_focus")
    if types & {"jewelry_store"} or has_any(text, {"jewellery", "jewelry", "gold", "diamonds"}):
        add("jewelry shopping", 3.8, "retail_focus")
    if types & {"home_goods_store", "furniture_store"} or has_any(text, {"home decor", "furniture", "home goods", "interiors"}):
        add("home shopping", 3.4, "retail_focus")
    if has_any(text, {"handicraft", "craft", "souvenir", "artisan", "traditional items"}):
        add("souvenir shopping", 3.8, "retail_focus")

    if types & {"restaurant"}:
        add("casual dining", 2.8, "dining_style")
    if types & {"cafe"}:
        add("cafe stop", 3.2, "dining_style")
        if has_any(text, {"cozy", "calm", "laid-back", "courtyard", "warm ambience"}):
            add("cozy", 2.2, "vibe")
        if has_any(text, {"work", "study", "wifi", "laptop"}):
            add("work-friendly", 2.4, "vibe")
    if types & {"bakery"} or has_any(text, {"cake", "pastry", "bakehouse"}):
        add("bakery stop", 3.0, "dining_style")
    if types & {"bar", "night_club"} or has_any(text, {"cocktail", "pub", "lounge", "late night", "live music"}):
        add("nightlife", 4.0, "time")
    if has_any(text, {"fine dining", "chef", "luxury dining", "elegant"}):
        add("fine dining", 4.0, "dining_style")
    if has_any(text, {"seafood", "prawns", "fish", "crab", "tuna", "calamari"}):
        add("seafood", 3.4, "food_focus")
    if has_any(text, {"street food", "food street", "quick bite"}):
        add("street food", 3.6, "food_focus")
    if has_any(text, {"breakfast", "brunch", "coffee"}):
        add("brunch spot", 2.2, "meal_focus")

    if types & {"museum"}:
        add("museum visit", 4.0, "museum_mode")
    if types & {"art_gallery"} or has_any(text, {"gallery", "exhibition", "art cafe", "mural", "painting"}):
        add("art experience", 4.0, "art_mode")
    if types & {"church", "temple", "hindu_temple", "mosque", "synagogue"}:
        add("spiritual stop", 3.8, "culture_mode")
        add("cultural landmark", 3.2, "heritage")
    if types & {"historical_landmark", "monument", "landmark"} or has_any(text, {"fort", "palace", "colonial", "heritage", "historic", "royal"}):
        add("heritage site", 4.0, "heritage")
    if has_any(text, {"museum", "history", "historic", "heritage"}):
        add("history", 2.8, "history_mode")

    if types & {"beach"} or has_any(text, {"beach", "coast", "seaside", "shore", "waterfront"}):
        add("beach walk", 3.8, "nature_mode")
        add("scenic views", 2.8, "vibe")
    if types & {"park", "garden", "natural_feature"} or has_any(text, {"park", "garden", "backwater", "island", "lake", "waterfall", "hill"}):
        add("nature escape", 3.6, "nature_mode")
    if has_any(text, {"sunset", "sunset view", "evening view"}):
        add("sunset spot", 3.8, "time")
    if has_any(text, {"peaceful", "calm", "serene", "relaxing", "tranquil"}):
        add("relaxing", 3.0, "vibe")

    if types & {"amusement_park"} or has_any(text, {"adventure", "trek", "trail", "hike", "kayak", "boating", "water sports"}):
        add("adventure", 3.8, "activity")
        add("outdoor activity", 3.0, "activity")
    if has_any(text, {"thrill", "exciting", "ride"}):
        add("thrill", 2.4, "activity")
    if types & {"stadium", "gym"} or has_any(text, {"sports", "football", "cricket", "fitness", "walking track"}):
        add("sports", 3.6, "activity")

    if has_any(text, {"family", "kids", "children", "spacious", "cinema"}):
        add("family-friendly", 2.6, "audience")
    if has_any(text, {"romantic", "candlelight", "date night"}):
        add("couples", 2.8, "audience")
    if has_any(text, {"friends", "hangout", "group"}):
        add("group-friendly", 2.2, "audience")

    if has_any(text, {"budget", "affordable", "reasonable", "low cost", "cheap"}):
        add("budget", 3.0, "price")
    if has_any(text, {"luxury", "premium", "upscale", "branded", "five star"}):
        add("premium", 3.0, "price")
    if has_any(text, {"must visit", "must-see", "iconic"}) or user_ratings_total >= 8000:
        add("tourist hotspot", 2.8, "popularity")
    if has_any(text, {"hidden gem", "off the beaten track"}):
        add("hidden gem", 3.0, "popularity")
    if has_any(text, {"local favorite", "locals love", "popular among locals", "authentic"}):
        add("local favorite", 2.4, "popularity")

    if not scored_tags:
        fallback_tags = []
        if category in {"shopping_mall", "store"} or "store" in types:
            fallback_tags = ["shopping", "local shopping"]
        elif category in {"restaurant", "cafe", "bakery"}:
            fallback_tags = ["dining", "casual stop"]
        elif category in {"museum", "art_gallery"}:
            fallback_tags = ["culture", "history"]
        elif category in {"park", "natural_feature", "beach"}:
            fallback_tags = ["nature", "scenic views"]
        else:
            fallback_tags = ["travel stop"]
        for index, tag in enumerate(fallback_tags):
            add(tag, 2.0 - (index * 0.2), f"fallback_{index}")

    best_by_group: dict[str, tuple[str, float]] = {}
    for tag, score in scored_tags.items():
        group = tag_groups.get(tag, tag)
        current = best_by_group.get(group)
        if current is None or score > current[1]:
            best_by_group[group] = (tag, score)

    ranked = [
        tag for tag, _ in sorted(
            best_by_group.values(),
            key=lambda item: (-item[1], item[0]),
        )
    ]

    if len(ranked) < 5:
        fill_candidates = []
        if types & {"shopping_mall", "market", "store"}:
            fill_candidates.extend(["shopping", "family-friendly", "local shopping"])
        if types & {"restaurant", "cafe", "bakery", "bar"}:
            fill_candidates.extend(["dining", "casual stop", "local favorite"])
        if types & {"museum", "historical_landmark", "monument", "church", "temple", "synagogue", "mosque", "art_gallery"}:
            fill_candidates.extend(["culture", "history", "cultural landmark"])
        if types & {"beach", "park", "garden", "natural_feature"}:
            fill_candidates.extend(["nature", "scenic views", "relaxing"])
        fill_candidates.extend(["local favorite", "family-friendly", "scenic views"])
        for tag in fill_candidates:
            if tag not in ranked:
                ranked.append(tag)
            if len(ranked) >= 5:
                break

    return ranked[:12]
