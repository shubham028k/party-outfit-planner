import json
import os
import tempfile
import unittest
from io import BytesIO
from datetime import datetime, timedelta, timezone
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

    def test_recommendation_accepts_location_without_size_preference(self):
        self.register()
        response = self.client.post(
            "/api/recommend",
            json={
                "party_type": "birthday",
                "weather": "warm",
                "style": "casual",
                "audience": "men",
                "location": "Jaipur",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["outfit"]["location"], "Jaipur")

        response = self.client.post(
            "/api/recommend",
            json={
                "party_type": "birthday",
                "weather": "warm",
                "style": "casual",
                "audience": "men",
                "location": "x" * 101,
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_party_plan_uses_forecast_and_returns_private_wardrobe_photos(self):
        self.register()
        image_buffer = BytesIO()
        Image.new("RGB", (20, 20), "navy").save(image_buffer, format="PNG")
        image_data = image_buffer.getvalue()
        for item in (
            ("Blue party shirt", "top", "men"),
            ("Black trousers", "bottom", "men"),
            ("Leather shoes", "shoes", "men")
        ):
            response = self.client.post(
                "/api/wardrobe",
                data={
                    "name": item[0],
                    "category": item[1],
                    "audience": item[2],
                    "size": "M" if item[1] in {"top", "bottom"} else "any",
                    "image": (BytesIO(image_data), f"{item[1]}.png")
                },
                content_type="multipart/form-data",
            )
            self.assertEqual(response.status_code, 201)
        self.assertEqual(
            {
                item["category"]
                for item in self.client.get("/api/wardrobe").get_json()["items"]
            },
            {"top", "bottom", "shoes"}
        )

        forecast = {
            "condition": "rainy",
            "temperature_min": 18,
            "temperature_max": 27,
            "precipitation_probability": 70,
            "weather_code": 61,
            "latitude": 26.9,
            "longitude": 75.8
        }
        with patch.object(outfit_app, "weather_for_event", return_value=forecast):
            response = self.client.post(
                "/api/plan",
                json={
                    "party_type": "wedding",
                    "event_date": (datetime.now().date() + timedelta(days=2)).isoformat(),
                    "location": "Jaipur",
                    "audience": "men"
                },
            )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["selection"]["weather"], "rainy")
        self.assertEqual(data["outfit"]["weather_details"], forecast)
        self.assertEqual(
            set(data["outfit"]["item_images"]),
            {"top", "bottom", "shoes"},
            data["outfit"]
        )
        self.assertTrue(
            data["outfit"]["item_images"]["top"].startswith("/api/wardrobe/")
        )
        saved = self.client.post(
            "/api/outfits",
            json={**data["selection"], "outfit": data["outfit"]}
        )
        self.assertEqual(saved.status_code, 201)
        stored = self.client.get("/api/outfits").get_json()["outfits"][0]["outfit"]
        self.assertEqual(stored["event_date"], data["selection"]["event_date"])
        self.assertEqual(stored["item_images"], data["outfit"]["item_images"])

    def test_weather_lookup_rejects_dates_without_a_supported_forecast(self):
        today = datetime.now().date()
        with self.assertRaisesRegex(ValueError, "आज या आने वाले दिनों"):
            outfit_app.weather_for_event("Jaipur", (today - timedelta(days=1)).isoformat())
        with self.assertRaisesRegex(ValueError, "अगले 16 दिनों"):
            outfit_app.weather_for_event("Jaipur", (today + timedelta(days=16)).isoformat())

    def test_weather_lookup_uses_geocoded_coordinates_and_actual_daily_data(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        geocoding = [{"lat": "26.9", "lon": "75.8"}]
        forecast = {
            "daily": {
                "time": [event_date],
                "temperature_2m_max": [29],
                "temperature_2m_min": [17],
                "precipitation_probability_max": [20],
                "weather_code": [2]
            }
        }
        with patch.object(
            outfit_app, "fetch_map_json", side_effect=[geocoding, forecast]
        ) as fetch:
            result = outfit_app.weather_for_event("Jaipur", event_date)

        self.assertEqual(result["condition"], "warm")
        self.assertEqual((result["temperature_min"], result["temperature_max"]), (17, 29))
        self.assertEqual(fetch.call_count, 2)
        self.assertIn("api.open-meteo.com", fetch.call_args_list[1].args[0])

    def test_manual_route_uses_the_user_entered_venue(self):
        self.register()
        route = {
            "geometry": {"type": "LineString", "coordinates": []},
            "distance_meters": 1200,
            "duration_seconds": 300,
            "destination": {"latitude": 26.9, "longitude": 75.8}
        }
        with patch.object(outfit_app, "route_to_event", return_value=route) as route_mock:
            response = self.client.post(
                "/api/route",
                json={
                    "location": "Jaipur venue",
                    "latitude": 26.91,
                    "longitude": 75.79
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), route)
        route_mock.assert_called_once_with("Jaipur venue", 26.91, 75.79)

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

    def test_wardrobe_photo_upload_preview_and_user_isolation(self):
        self.register()
        image_buffer = BytesIO()
        Image.new("RGB", (20, 20), "navy").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        response = self.client.post(
            "/api/wardrobe",
            data={
                "name": "Blue party shirt",
                "category": "top",
                "audience": "men",
                "size": "M",
                "image": (image_buffer, "shirt.png"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 201)
        item_id = response.get_json()["id"]
        item = self.client.get("/api/wardrobe").get_json()["items"][0]
        self.assertEqual(item["audience"], "men")
        self.assertTrue(item["image_url"].endswith(f"/{item_id}/image"))

        image_response = self.client.get(item["image_url"])
        self.assertEqual(image_response.status_code, 200)
        self.assertEqual(image_response.mimetype, "image/jpeg")

        other_client = outfit_app.app.test_client()
        self.register(other_client, username="image_user")
        self.assertEqual(
            other_client.get(item["image_url"]).status_code, 404
        )

        invalid = self.client.post(
            "/api/wardrobe",
            data={
                "name": "Invalid image",
                "category": "top",
                "audience": "women",
                "image": (BytesIO(b"not an image"), "invalid.png"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(invalid.status_code, 400)

    def test_wardrobe_distinguishes_mens_and_womens_items_and_keeps_legacy_adult(self):
        self.register()
        for name, audience in (
            ("Mens shirt", "men"),
            ("Womens top", "women"),
            ("Legacy adult shirt", "adult"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": "top",
                    "audience": audience,
                },
            )
            self.assertEqual(response.status_code, 201)

        men = self.client.post(
            "/api/recommend",
            json={
                "party_type": "birthday",
                "weather": "warm",
                "style": "casual",
                "audience": "men",
            },
        ).get_json()["outfit"]
        women = self.client.post(
            "/api/recommend",
            json={
                "party_type": "birthday",
                "weather": "warm",
                "style": "casual",
                "audience": "women",
            },
        ).get_json()["outfit"]
        self.assertIn(men["top"], {"Mens shirt", "Legacy adult shirt"})
        self.assertIn(women["top"], {"Womens top", "Legacy adult shirt"})

    def test_calendar_import_plans_next_event_from_wardrobe_and_saves(self):
        self.register()
        for name, category in (
            ("My blue shirt", "top"),
            ("My dark trousers", "bottom"),
            ("My party shoes", "shoes"),
            ("My watch", "accessory"),
            ("My glasses", "eyewear"),
        ):
            self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "adult",
                    "size": "any",
                },
            )

        now = datetime.now(timezone.utc)
        next_start = (now + timedelta(days=2)).strftime("%Y%m%dT%H%M%SZ")
        later_start = (now + timedelta(days=5)).strftime("%Y%m%dT%H%M%SZ")
        past_start = (now - timedelta(days=2)).strftime("%Y%m%dT%H%M%SZ")
        calendar_text = f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:later-event
DTSTART:{later_start}
SUMMARY:Birthday party
END:VEVENT
BEGIN:VEVENT
UID:next-event
DTSTART:{next_start}
SUMMARY:Wedding reception
LOCATION:Jaipur Convention Centre
END:VEVENT
BEGIN:VEVENT
UID:past-event
DTSTART:{past_start}
SUMMARY:Past party
END:VEVENT
END:VCALENDAR
"""
        imported = self.client.post(
            "/api/calendar/import",
            data={
                "calendar": (BytesIO(calendar_text.encode()), "events.ics"),
                "timezone": "UTC",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(imported.status_code, 200)
        self.assertEqual(imported.get_json()["event_count"], 3)
        self.assertEqual(imported.get_json()["event"]["summary"], "Wedding reception")

        planned = self.client.post("/api/calendar/plan")
        self.assertEqual(planned.status_code, 200)
        result = planned.get_json()
        self.assertEqual(result["selection"]["party_type"], "wedding")
        self.assertEqual(result["event"]["location"], "Jaipur Convention Centre")
        for expected_item in (
            "My blue shirt", "My dark trousers", "My party shoes",
            "My watch", "My glasses"
        ):
            self.assertTrue(any(
                expected_item in result["outfit"][field]
                for field in ("top", "bottom", "shoes", "accessory", "eyewear")
            ))

        saved = self.client.post(
            "/api/outfits",
            json={**result["selection"], "outfit": result["outfit"]},
        )
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(len(self.client.get("/api/outfits").get_json()["outfits"]), 1)

    def test_calendar_route_uses_only_the_signed_in_users_event(self):
        self.register()
        start = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
            "%Y%m%dT%H%M%SZ"
        )
        calendar_text = (
            "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:route-event\n"
            f"DTSTART:{start}\nSUMMARY:Party\nLOCATION:Jaipur\n"
            "END:VEVENT\nEND:VCALENDAR\n"
        )
        imported = self.client.post(
            "/api/calendar/import",
            data={
                "calendar": (BytesIO(calendar_text.encode()), "events.ics"),
                "timezone": "UTC",
            },
            content_type="multipart/form-data",
        )
        event_id = imported.get_json()["event"]["id"]
        route = {
            "geometry": {
                "type": "LineString",
                "coordinates": [[75.8, 26.9], [75.9, 27.0]],
            },
            "distance_meters": 1200,
            "duration_seconds": 600,
            "destination": {"latitude": 27.0, "longitude": 75.9},
        }
        with patch.object(outfit_app, "route_to_event", return_value=route) as route_mock:
            response = self.client.post(
                "/api/calendar/route",
                json={"event_id": event_id, "latitude": 26.9, "longitude": 75.8},
            )
        self.assertEqual(response.status_code, 200)
        route_mock.assert_called_once_with("Jaipur", 26.9, 75.8)

        other_client = outfit_app.app.test_client()
        self.register(other_client, username="other_user")
        hidden_event = other_client.post(
            "/api/calendar/route",
            json={"event_id": event_id, "latitude": 26.9, "longitude": 75.8},
        )
        self.assertEqual(hidden_event.status_code, 404)

    def test_calendar_validation_and_builtin_catalog(self):
        self.register()
        invalid_timezone = self.client.post(
            "/api/calendar/import",
            data={
                "calendar": (BytesIO(b"BEGIN:VCALENDAR\nEND:VCALENDAR"), "events.ics"),
                "timezone": "Not/A_Timezone",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(invalid_timezone.status_code, 400)

        catalog = self.client.get("/api/catalog")
        self.assertEqual(catalog.status_code, 200)
        categories = {item["category"] for item in catalog.get_json()["items"]}
        self.assertTrue({"top", "bottom", "shoes", "accessory", "eyewear"} <= categories)

        first_add = self.client.post("/api/wardrobe/sample")
        second_add = self.client.post("/api/wardrobe/sample")
        self.assertEqual(first_add.status_code, 200)
        self.assertGreater(first_add.get_json()["added"], 0)
        self.assertEqual(second_add.get_json()["added"], 0)
        wardrobe = self.client.get("/api/wardrobe").get_json()["items"]
        self.assertEqual(len(wardrobe), first_add.get_json()["added"])

    def test_calendar_expands_recurring_events_and_respects_excluded_dates(self):
        self.register()
        start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(days=2)
        excluded = (start + timedelta(days=3)).strftime("%Y%m%dT%H%M%SZ")
        calendar_text = (
            "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:weekly-party\n"
            f"DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}\n"
            "RRULE:FREQ=DAILY;COUNT=8\n"
            f"EXDATE:{excluded}\n"
            "SUMMARY:Weekly party\nLOCATION:Jaipur\n"
            "END:VEVENT\nEND:VCALENDAR\n"
        )
        response = self.client.post(
            "/api/calendar/import",
            data={
                "calendar": (BytesIO(calendar_text.encode()), "events.ics"),
                "timezone": "UTC",
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        next_event = response.get_json()["event"]
        expected = (start + timedelta(days=4)).isoformat(timespec="seconds")
        self.assertEqual(next_event["starts_at"], expected)
        self.assertNotEqual(next_event["starts_at"], (
            start + timedelta(days=3)
        ).isoformat(timespec="seconds"))

    def test_save_list_and_delete_outfit(self):
        self.register()
        response = self.client.post(
            "/api/recommend",
            json={
                "party_type": "wedding",
                "weather": "cold",
                "style": "smart",
                "audience": "women",
                "location": "Jaipur",
            },
        )
        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        response = self.client.post(
            "/api/outfits",
            json={
                "party_type": "wedding",
                "weather": "cold",
                "style": "smart",
                "audience": "women",
                "location": "Jaipur",
                "outfit": outfit,
            },
        )
        self.assertEqual(response.status_code, 201)
        outfit_id = response.get_json()["id"]

        saved = self.client.get("/api/outfits").get_json()["outfits"]
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["outfit"]["top"], outfit["top"])
        self.assertEqual(saved[0]["outfit"]["location"], "Jaipur")
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
                    "location": "Jaipur",
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertEqual(outfit["location"], "Jaipur")
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
