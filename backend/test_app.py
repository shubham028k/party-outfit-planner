import json
import os
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import app as outfit_app
from PIL import Image


class OutfitPlannerTests(unittest.TestCase):
    def setUp(self):
        self.database_directory = tempfile.TemporaryDirectory()
        self.original_database = outfit_app.DATABASE
        outfit_app.DATABASE = Path(self.database_directory.name) / "test.db"
        outfit_app.initialize_database()
        outfit_app.app.config.update(TESTING=True, SECRET_KEY="test-secret")
        self.client = outfit_app.app.test_client()

    def tearDown(self):
        outfit_app.DATABASE = self.original_database
        self.database_directory.cleanup()

    def register(self, client=None, username="test_user"):
        client = client or self.client
        return client.post(
            "/register",
            data={"username": username, "password": "test-password"},
        )

    def test_registration_login_and_logout(self):
        response = self.register()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, "/")

        self.client.post("/logout")
        response = self.client.post(
            "/login",
            data={"username": "test_user", "password": "test-password"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, "/")

        self.client.post("/logout")
        self.assertEqual(self.client.get("/api/wardrobe").status_code, 401)

    def test_recommendation_respects_short_bottom_and_rejects_bad_input(self):
        self.register()
        response = self.client.post(
            "/api/recommend",
            json={
                "party_type": "birthday",
                "weather": "warm",
                "style": "casual",
                "audience": "men",
                "bottom_preference": "shorts",
                "size_preference": "M",
            },
        )
        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertIn("शॉर्ट्स", outfit["bottom"])
        self.assertTrue(outfit["weather_tip"])

        response = self.client.post("/api/recommend", json={"party_type": "unknown"})
        self.assertEqual(response.status_code, 400)

    def test_women_can_choose_ethnic_outfits(self):
        self.register()
        for party, style, expected in (
            ("wedding", "smart", "साड़ी"),
            ("wedding", "bold", "लहंगा"),
            ("birthday", "casual", "कुर्ती"),
            ("night", "smart", "साड़ी"),
        ):
            with self.subTest(party=party, style=style):
                response = self.client.post(
                    "/api/recommend",
                    json={
                        "party_type": party,
                        "weather": "warm",
                        "style": style,
                        "audience": "women",
                        "outfit_type": "ethnic",
                        "bottom_preference": "shorts",
                    },
                )
                self.assertEqual(response.status_code, 200)
                outfit = response.get_json()["outfit"]
                self.assertIn(expected, outfit["top"] + outfit["bottom"])
                self.assertNotIn("शॉर्ट्स", outfit["bottom"])
                self.assertIn(
                    outfit["design_type"], {"saree", "lehenga", "suit", "kurti"}
                )
                self.assertTrue(outfit["design_details"])
                self.assertEqual(len(outfit["design_colors"]), 3)

        invalid = self.client.post(
            "/api/recommend",
            json={
                "party_type": "wedding",
                "weather": "warm",
                "style": "smart",
                "audience": "women",
                "outfit_type": ["ethnic"],
            },
        )
        self.assertEqual(invalid.status_code, 400)

        saved = self.client.post(
            "/api/outfits",
            json={
                "party_type": "wedding",
                "weather": "warm",
                "style": "smart",
                "audience": "women",
                "outfit_type": "ethnic",
            },
        )
        self.assertEqual(saved.status_code, 201)
        stored = self.client.get("/api/outfits").get_json()["outfits"]
        self.assertIn("साड़ी", stored[0]["outfit"]["bottom"])
        self.assertIn("ज़री बॉर्डर", stored[0]["outfit"]["design_details"])

    def test_wardrobe_crud_and_user_isolation(self):
        self.register()
        response = self.client.post(
            "/api/wardrobe",
            json={
                "name": "Oxford shirt",
                "category": "top",
                "color": "Navy",
                "audience": "adult",
                "size": "M",
            },
        )
        self.assertEqual(response.status_code, 201)
        item_id = response.get_json()["id"]
        self.assertEqual(len(self.client.get("/api/wardrobe").get_json()["items"]), 1)

        other_client = outfit_app.app.test_client()
        self.register(other_client, username="other_user")
        self.assertEqual(other_client.get("/api/wardrobe").get_json()["items"], [])
        self.assertEqual(
            other_client.delete(f"/api/wardrobe/{item_id}").status_code, 404
        )

        self.assertEqual(self.client.delete(f"/api/wardrobe/{item_id}").status_code, 200)
        self.assertEqual(self.client.get("/api/wardrobe").get_json()["items"], [])

    def test_save_list_and_delete_outfit(self):
        self.register()
        response = self.client.post(
            "/api/recommend",
            json={
                "party_type": "wedding",
                "weather": "cold",
                "style": "smart",
                "audience": "women",
            },
        )
        outfit = response.get_json()["outfit"]
        response = self.client.post(
            "/api/outfits",
            json={
                "party_type": "wedding",
                "weather": "cold",
                "style": "smart",
                "audience": "women",
                "outfit": outfit,
            },
        )
        self.assertEqual(response.status_code, 201)
        outfit_id = response.get_json()["id"]

        saved = self.client.get("/api/outfits").get_json()["outfits"]
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["outfit"]["top"], outfit["top"])
        self.assertEqual(self.client.delete(f"/api/outfits/{outfit_id}").status_code, 200)
        self.assertEqual(self.client.get("/api/outfits").get_json()["outfits"], [])

    def test_photo_analysis_reports_missing_key_without_making_external_call(self):
        self.register()
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            response = self.client.post(
                "/api/analyze-photo",
                data={"photo_consent": "yes"},
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("GROQ_API_KEY", response.get_json()["error"])

    def test_photo_analysis_includes_ethnic_design_preview_data(self):
        self.register()
        image_buffer = BytesIO()
        Image.new("RGB", (4, 4), "white").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        fake_response = SimpleNamespace(
            output_text=json.dumps({
                "top": "साड़ी ब्लाउज़",
                "bottom": "साड़ी",
                "shoes": "हील्स",
                "accessory": "क्लासिक ज्वेलरी",
                "weather_tip": "हल्की परत रखें।"
            })
        )

        with (
            patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
            patch.object(outfit_app, "OpenAI") as openai_client,
        ):
            openai_client.return_value.responses.create.return_value = fake_response
            response = self.client.post(
                "/api/analyze-photo",
                data={
                    "photo": (image_buffer, "look.png"),
                    "photo_consent": "yes",
                    "party_type": "wedding",
                    "weather": "warm",
                    "style": "smart",
                    "audience": "women",
                    "outfit_type": "ethnic",
                    "bottom_preference": "trousers",
                    "size_preference": "any",
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertEqual(outfit["design_type"], "saree")
        self.assertIn("ज़री बॉर्डर", outfit["design_details"])

    def test_database_path_creates_missing_parent_directory(self):
        database_path = Path(self.database_directory.name) / "nested" / "app.db"
        outfit_app.DATABASE = database_path

        with outfit_app.connect_db() as connection:
            connection.execute("CREATE TABLE connectivity_check (id INTEGER)")

        self.assertTrue(database_path.is_file())


if __name__ == "__main__":
    unittest.main()
