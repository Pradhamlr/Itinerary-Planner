import unittest

from place_tagging import build_place_tags


class PlaceTaggingTests(unittest.TestCase):
    def test_shopping_place_gets_specific_tags(self):
        tags = build_place_tags({
            "name": "Lulu Mall",
            "category": "shopping_mall",
            "types": ["shopping_mall", "point_of_interest", "establishment"],
            "description": "Large shopping mall with branded stores, food court and cinema",
            "review": "Very popular mall for family shopping and dining",
            "city": "kochi",
            "user_ratings_total": 18000,
        })

        self.assertIn("mall shopping", tags)
        self.assertIn("family-friendly", tags)
        self.assertIn("tourist hotspot", tags)
        self.assertTrue(5 <= len(tags) <= 12)

    def test_heritage_place_gets_cultural_tags(self):
        tags = build_place_tags({
            "name": "Mattancherry Palace",
            "category": "museum",
            "types": ["museum", "historical_landmark", "point_of_interest"],
            "description": "Historic palace museum with heritage murals and royal artifacts",
            "review": "A must visit heritage and history spot in Kochi",
            "city": "kochi",
            "user_ratings_total": 6200,
        })

        self.assertIn("museum visit", tags)
        self.assertIn("heritage site", tags)
        self.assertIn("history", tags)


if __name__ == "__main__":
    unittest.main()
