import json
import os
import tempfile
import unittest
from io import BytesIO
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
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
                    "party_tag": "wedding",
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
        self.assertEqual(data["selection"]["location"], "Jaipur")
        self.assertEqual(data["selection"]["event_date"], (
            datetime.now().date() + timedelta(days=2)
        ).isoformat())
        self.assertEqual(data["outfit"]["weather_details"], forecast)
        self.assertEqual(
            set(data["outfit"]["item_images"]),
            {"top", "bottom", "shoes"},
            data["outfit"]
        )
        wardrobe_by_id = {
            item["id"]: item
            for item in self.client.get("/api/wardrobe").get_json()["items"]
        }
        for field, expected_category in (
            ("top", "top"), ("bottom", "bottom"), ("shoes", "shoes")
        ):
            image_path = urlsplit(data["outfit"]["item_images"][field]).path
            item_id = int(image_path.rsplit("/", 2)[-2])
            matched_item = wardrobe_by_id[item_id]
            self.assertEqual(matched_item["category"], expected_category)
            self.assertIn(matched_item["name"], data["outfit"][field])
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
        self.assertEqual(
            stored["weather_outfit"], data["outfit"]["weather_outfit"]
        )

    def test_catalog_previews_and_sample_wardrobe_include_local_images(self):
        self.register()
        catalog = self.client.get("/api/catalog")
        self.assertEqual(catalog.status_code, 200)
        items = catalog.get_json()["items"]
        self.assertTrue(items)
        self.assertTrue(items[0]["preview_url"].startswith("/api/catalog/"))

        preview = self.client.get(items[0]["preview_url"])
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.mimetype, "image/svg+xml")

        added = self.client.post("/api/wardrobe/sample")
        self.assertEqual(added.status_code, 200)
        wardrobe = self.client.get("/api/wardrobe").get_json()["items"]
        self.assertEqual(len(wardrobe), len(items))
        self.assertTrue(all(item.get("image_url") for item in wardrobe))

        stored_photo = self.client.get(wardrobe[0]["image_url"])
        self.assertEqual(stored_photo.status_code, 200)
        self.assertEqual(stored_photo.mimetype, "image/svg+xml")

    def test_party_plan_uses_forecast_condition_to_choose_my_closet_items(self):
        self.register()
        for name, category, weather in (
            ("My warm shirt", "top", "warm"),
            ("My winter jacket", "top", "cold"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": weather,
                    "party_tag": "wedding",
                },
            )
            self.assertEqual(response.status_code, 201)

        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        forecast = {
            "condition": "cold",
            "temperature_min": 7,
            "temperature_max": 15,
            "precipitation_probability": 90,
            "weather_code": 61,
            "latitude": 26.9,
            "longitude": 75.8,
        }
        with patch.object(
            outfit_app, "weather_for_event", return_value=forecast
        ) as get_weather:
            response = self.client.post(
                "/api/plan",
                json={
                    "party_name": "शादी की पार्टी",
                    "event_date": event_date,
                    "location": "Jaipur",
                    "audience": "men",
                },
            )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        get_weather.assert_called_once_with("Jaipur", event_date)
        self.assertEqual(data["selection"]["weather"], "cold")
        self.assertEqual(data["selection"]["location"], "Jaipur")
        self.assertEqual(data["selection"]["event_date"], event_date)
        self.assertEqual(data["outfit"]["top"], "My winter jacket")
        self.assertEqual(data["outfit"]["weather_details"], forecast)
        self.assertIn("थर्मल/ऊनी इनर", data["outfit"]["weather_outfit"])
        self.assertIn("वाटरप्रूफ जैकेट", data["outfit"]["weather_outfit"])
        self.assertIn("जैकेट या कोट", data["outfit"]["weather_tip"])
        self.assertIn("छाता", data["outfit"]["weather_tip"])

    def test_warm_weather_does_not_select_a_saved_winter_coat(self):
        self.register()
        for name in ("Black patterned long coat", "Blue birthday linen shirt"):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": "top",
                    "audience": "men",
                    "weather": "any",
                    "party_tag": "birthday",
                },
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/plan",
            json={
                "party_name": "birthday party",
                "audience": "men",
                "weather": "warm",
            },
        )
        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertEqual(outfit["top"], "Blue birthday linen shirt")
        self.assertNotIn("coat", outfit["top"].casefold())

    def test_party_plan_gives_light_clothing_advice_for_hot_destination(self):
        self.register()
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        forecast = {
            "condition": "warm",
            "temperature_min": 28,
            "temperature_max": 40,
            "precipitation_probability": 0,
            "weather_code": 0,
            "latitude": 26.9,
            "longitude": 75.8,
        }
        with patch.object(
            outfit_app, "weather_for_event", return_value=forecast
        ):
            response = self.client.post(
                "/api/plan",
                json={
                    "party_name": "birthday",
                    "event_date": event_date,
                    "location": "Rajasthan",
                    "audience": "men",
                },
            )

        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertIn("हल्के, सांस लेने वाले कपड़े", outfit["weather_tip"])
        self.assertIn("सूती/लिनेन", outfit["weather_outfit"])

    def test_weather_matched_outfit_changes_even_when_closet_items_are_all_weather(self):
        self.register()
        for name, category in (
            ("Birthday graphic everyday shirt", "top"),
            ("Birthday black everyday jeans", "bottom"),
            ("Birthday party everyday sneakers", "shoes"),
            ("Colorful birthday everyday watch", "accessory"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                    "party_tag": "birthday",
                },
            )
            self.assertEqual(response.status_code, 201)
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        rainy_date = (datetime.now().date() + timedelta(days=2)).isoformat()
        city_dates_and_forecasts = (
            ("Jaipur", event_date, {
                "condition": "warm", "temperature_min": 28,
                "temperature_max": 40, "precipitation_probability": 0,
            }),
            ("Srinagar", event_date, {
                "condition": "cold", "temperature_min": 2,
                "temperature_max": 8, "precipitation_probability": 20,
            }),
            ("Mumbai", rainy_date, {
                "condition": "rainy", "temperature_min": 20,
                "temperature_max": 27, "precipitation_probability": 90,
            }),
        )
        responses = []
        for location, requested_date, forecast in city_dates_and_forecasts:
            with patch.object(
                outfit_app, "weather_for_event", return_value=forecast
            ):
                response = self.client.post(
                    "/api/plan",
                    json={
                        "party_name": "birthday",
                        "event_date": requested_date,
                        "location": location,
                        "audience": "men",
                    },
                )
            self.assertEqual(response.status_code, 200)
            responses.append(response.get_json()["outfit"])

        for field in ("top", "bottom", "shoes", "accessory"):
            self.assertEqual(len({outfit[field] for outfit in responses}), 3)
            self.assertEqual(responses[0]["item_sources"][field], "saved")
            self.assertTrue(all(
                outfit["item_sources"][field] == "saved_weather_adjusted"
                for outfit in responses[1:]
            ))
        self.assertEqual(responses[1]["weather_details"]["condition"], "cold")
        self.assertEqual(responses[2]["weather_details"]["condition"], "rainy")
        self.assertIn("Srinagar", responses[1]["weather_outfit"])
        self.assertIn("Mumbai", responses[2]["weather_outfit"])
        self.assertIn("थर्मल इनर", responses[1]["bottom"])
        self.assertIn("गर्म मोज़े", responses[1]["shoes"])
        self.assertIn("छाता", responses[2]["accessory"])
        self.assertEqual(responses[2]["event_date"], rainy_date)

    def test_party_and_weather_plan_pick_matching_saved_top_and_shoes(self):
        self.register()
        party_items = {
            "wedding": ("Formal wedding blazer", "Formal brown loafers"),
            "birthday": ("Bright colorful graphic birthday top", "Bright birthday sneakers"),
            "casual": ("Casual denim t-shirt", "Casual white sneakers"),
            "night": ("Black satin night shirt", "Black night boots"),
        }
        party_searches = {
            "wedding": "wedding party",
            "birthday": "birthday party",
            "casual": "casual party",
            "night": "night party",
        }
        for weather in ("warm", "cold", "rainy"):
            for party, (top_name, shoe_name) in party_items.items():
                for name, category in ((top_name, "top"), (shoe_name, "shoes")):
                    response = self.client.post(
                        "/api/wardrobe",
                        json={
                            "name": f"{weather.title()} {name}",
                            "category": category,
                            "audience": "men",
                            "weather": weather,
                        },
                    )
                    self.assertEqual(response.status_code, 201)

        # Strong party matches marked for all weather must not override an
        # item saved for the actual forecast weather.
        for name, category in (
            ("Bright colorful graphic birthday party jacket", "top"),
            ("Bright birthday party sneakers", "shoes"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                },
            )
            self.assertEqual(response.status_code, 201)

        for weather in ("warm", "cold", "rainy"):
            for party, (top_name, shoe_name) in party_items.items():
                response = self.client.post(
                    "/api/plan",
                    json={
                        "party_name": party_searches[party],
                        "audience": "men",
                        "weather": weather,
                    },
                )
                self.assertEqual(response.status_code, 200)
                data = response.get_json()
                self.assertEqual(data["selection"]["weather"], weather)
                self.assertEqual(data["selection"]["party_type"], party)
                self.assertTrue(data["outfit"]["top"].startswith(
                    f"{weather.title()} {top_name}"
                ))
                self.assertTrue(data["outfit"]["shoes"].startswith(
                    f"{weather.title()} {shoe_name}"
                ))
                if weather == "cold":
                    self.assertIn("गर्म जैकेट/कोट", data["outfit"]["top"])
                    self.assertIn("गर्म मोज़े", data["outfit"]["shoes"])
                elif weather == "rainy":
                    self.assertIn("वाटरप्रूफ", data["outfit"]["top"])
                    self.assertIn("ग्रिप", data["outfit"]["shoes"])

    def test_party_and_weather_suggestions_work_without_wardrobe_items(self):
        self.register()
        party_searches = {
            "wedding": "wedding party",
            "birthday": "birthday party",
            "casual": "casual party",
            "night": "night party",
        }
        for weather in ("warm", "cold", "rainy"):
            outfits_by_party = {}
            for party_name in party_searches.values():
                response = self.client.post(
                    "/api/plan",
                    json={
                        "party_name": party_name,
                        "audience": "men",
                        "weather": weather,
                    },
                )
                self.assertEqual(response.status_code, 200)
                outfit = response.get_json()["outfit"]
                outfits_by_party[outfit["party_name"]] = outfit
                for field in ("top", "bottom", "shoes", "accessory"):
                    self.assertTrue(outfit[field])
                    self.assertEqual(outfit["item_sources"][field], "suggested")
                self.assertTrue(outfit["color_tip"]["hi"])
                if weather == "cold":
                    self.assertIn("थर्मल", outfit["weather_outfit"])
                if weather == "rainy":
                    self.assertIn("वाटरप्रूफ", outfit["weather_outfit"])

            wedding = outfits_by_party["शादी की पार्टी"]
            birthday = outfits_by_party["बर्थडे पार्टी"]
            night = outfits_by_party["नाइट पार्टी"]
            self.assertNotEqual(wedding["top"], birthday["top"])
            self.assertNotEqual(birthday["top"], night["top"])
            self.assertNotEqual(wedding["shoes"], birthday["shoes"])
            self.assertNotEqual(birthday["shoes"], night["shoes"])

    def test_party_plan_returns_three_distinct_outfit_combinations(self):
        self.register()
        party_names = {
            "wedding": "wedding party",
            "birthday": "birthday party",
            "night": "night party",
        }
        for party, party_name in party_names.items():
            for audience in ("men", "women"):
                combinations = []
                styles = []
                for variation in range(3):
                    response = self.client.post(
                        "/api/plan",
                        json={
                            "party_name": party_name,
                            "audience": audience,
                            "weather": "warm",
                            "variation": variation,
                        },
                    )
                    self.assertEqual(response.status_code, 200)
                    payload = response.get_json()
                    outfit = payload["outfit"]
                    combinations.append(tuple(
                        outfit[field]
                        for field in ("top", "bottom", "shoes", "accessory")
                    ))
                    styles.append(payload["selection"]["style"])

                self.assertEqual(len(set(styles)), 3, f"{party} styles for {audience}")
                self.assertEqual(
                    len(set(combinations)), 3,
                    f"{party} outfit combinations for {audience}"
                )

        invalid = self.client.post(
            "/api/plan",
            json={"party_name": "birthday", "audience": "men", "weather": "warm", "variation": 3},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_next_party_outfit_rotates_through_matching_saved_items(self):
        self.register()
        items = (
            ("Ivory wedding kurta", "top"),
            ("Navy formal wedding blazer", "top"),
            ("Cream formal wedding trousers", "bottom"),
            ("Black formal wedding trousers", "bottom"),
            ("Brown formal wedding loafers", "shoes"),
            ("Black formal wedding loafers", "shoes"),
            ("Classic wedding watch", "accessory"),
            ("Silver wedding jewelry", "accessory"),
        )
        for name, category in items:
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                    "party_tag": "wedding",
                },
            )
            self.assertEqual(response.status_code, 201)

        looks = []
        for variation in (0, 1):
            response = self.client.post(
                "/api/plan",
                json={
                    "party_name": "wedding",
                    "audience": "men",
                    "weather": "warm",
                    "variation": variation,
                },
            )
            self.assertEqual(response.status_code, 200)
            outfit = response.get_json()["outfit"]
            looks.append(tuple(outfit[field] for field in (
                "top", "bottom", "shoes", "accessory"
            )))

        self.assertNotEqual(looks[0], looks[1])

    def test_generic_closet_items_do_not_repeat_for_every_party(self):
        self.register()
        for name, category in (
            ("Navy shirt", "top"),
            ("Beige trousers", "bottom"),
            ("Brown loafers", "shoes"),
            ("Classic watch", "accessory"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                },
            )
            self.assertEqual(response.status_code, 201)

        looks = {}
        for party in ("wedding", "birthday", "night"):
            response = self.client.post(
                "/api/plan",
                json={"party_name": party, "audience": "men", "weather": "warm"},
            )
            self.assertEqual(response.status_code, 200)
            looks[party] = response.get_json()["outfit"]

        for field in ("top", "shoes", "accessory"):
            self.assertEqual(
                len({look[field] for look in looks.values()}), 3,
                f"generic closet items should not make every {field} result identical"
            )
        # Plain bottoms are neutral, so a saved pair of trousers is used for
        # every party that does not exclude it.
        for look in looks.values():
            self.assertEqual(look["bottom"], "Beige trousers")
            self.assertEqual(look["item_sources"]["bottom"], "saved")
        self.assertEqual(looks["birthday"]["top"], "मरून टेक्सचर्ड शर्ट")
        self.assertEqual(looks["night"]["shoes"], "ब्लैक बूट्स")

    def test_plain_saved_bottoms_are_used_but_wedding_still_skips_jeans(self):
        self.register()
        for name, category in (
            ("Black pants", "bottom"),
            ("Blue jeans", "bottom"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                },
            )
            self.assertEqual(response.status_code, 201)

        for party in ("birthday", "night", "wedding"):
            response = self.client.post(
                "/api/plan",
                json={"party_name": party, "audience": "men", "weather": "warm"},
            )
            self.assertEqual(response.status_code, 200)
            outfit = response.get_json()["outfit"]
            self.assertEqual(outfit["item_sources"]["bottom"], "saved", party)
            if party == "wedding":
                self.assertEqual(outfit["bottom"], "Black pants")

    def test_party_city_and_event_date_change_clothes_shoes_and_accessories(self):
        self.register()
        first_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        second_date = (datetime.now().date() + timedelta(days=2)).isoformat()
        forecasts = {
            "warm": {
                "condition": "warm", "temperature_min": 28,
                "temperature_max": 39, "precipitation_probability": 0
            },
            "cold": {
                "condition": "cold", "temperature_min": 4,
                "temperature_max": 12, "precipitation_probability": 10
            },
            "rainy": {
                "condition": "rainy", "temperature_min": 20,
                "temperature_max": 27, "precipitation_probability": 90
            },
        }

        def plan(party, city, event_date, forecast):
            with patch.object(
                outfit_app, "weather_for_event", return_value=forecast
            ) as get_weather:
                response = self.client.post(
                    "/api/plan",
                    json={
                        "party_name": party,
                        "audience": "men",
                        "location": city,
                        "event_date": event_date,
                    },
                )
            self.assertEqual(response.status_code, 200)
            get_weather.assert_called_once_with(city, event_date)
            return response.get_json()["outfit"]

        warm_party_looks = {
            party: plan(party, "Jaipur", first_date, forecasts["warm"])
            for party in ("wedding", "birthday", "night")
        }
        for field in ("top", "bottom", "shoes", "accessory"):
            self.assertEqual(
                len({look[field] for look in warm_party_looks.values()}), 3,
                f"{field} should change between wedding, birthday, and night party"
            )

        warm_birthday = warm_party_looks["birthday"]
        cold_birthday = plan("birthday", "Srinagar", first_date, forecasts["cold"])
        rainy_birthday = plan("birthday", "Mumbai", second_date, forecasts["rainy"])
        for weather_look in (cold_birthday, rainy_birthday):
            self.assertNotEqual(weather_look["top"], warm_birthday["top"])
            self.assertNotEqual(weather_look["bottom"], warm_birthday["bottom"])
            self.assertNotEqual(weather_look["shoes"], warm_birthday["shoes"])
            self.assertNotEqual(weather_look["accessory"], warm_birthday["accessory"])
        self.assertIn("Srinagar", cold_birthday["weather_outfit"])
        self.assertIn("Mumbai", rainy_birthday["weather_outfit"])
        self.assertEqual(cold_birthday["event_date"], first_date)
        self.assertEqual(rainy_birthday["event_date"], second_date)

    def test_wedding_avoids_saved_casual_clothes_but_casual_party_uses_them(self):
        self.register()
        for name, category in (
            ("Black graphic print t-shirt", "top"),
            ("Blue jeans", "bottom"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                },
            )
            self.assertEqual(response.status_code, 201)

        wedding = self.client.post(
            "/api/plan",
            json={"party_name": "wedding", "audience": "men", "weather": "warm"},
        )
        self.assertEqual(wedding.status_code, 200)
        wedding_outfit = wedding.get_json()["outfit"]
        self.assertNotEqual(wedding_outfit["top"], "Black graphic print t-shirt")
        self.assertNotEqual(wedding_outfit["bottom"], "Blue jeans")
        self.assertEqual(wedding_outfit["item_sources"]["top"], "suggested")
        self.assertTrue(wedding_outfit["top"])

        casual = self.client.post(
            "/api/plan",
            json={"party_name": "casual", "audience": "men", "weather": "warm"},
        )
        self.assertEqual(casual.status_code, 200)
        casual_outfit = casual.get_json()["outfit"]
        self.assertEqual(casual_outfit["top"], "Black graphic print t-shirt")
        self.assertEqual(casual_outfit["bottom"], "Blue jeans")
        self.assertEqual(casual_outfit["item_sources"]["top"], "saved")

    def test_saved_top_and_bottom_are_selected_as_a_coordinated_pair(self):
        self.register()
        for name, category in (
            ("Pink patterned long kurta", "top"),
            ("Grey side striped pants", "bottom"),
            ("Cream straight trousers", "bottom"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                    "party_tag": "wedding",
                },
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/plan",
            json={"party_name": "wedding", "audience": "men", "weather": "warm"},
        )
        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertEqual(outfit["top"], "Pink patterned long kurta")
        self.assertEqual(outfit["bottom"], "Cream straight trousers")
        self.assertEqual(outfit["item_sources"]["bottom"], "saved")

        other_client = outfit_app.app.test_client()
        self.register(other_client, username="kurta_user")
        for name, category in (
            ("Pink patterned long kurta", "top"),
            ("Grey side striped pants", "bottom"),
        ):
            response = other_client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "weather": "any",
                },
            )
            self.assertEqual(response.status_code, 201)
        fallback = other_client.post(
            "/api/plan",
            json={"party_name": "wedding", "audience": "men", "weather": "warm"},
        )
        self.assertEqual(fallback.status_code, 200)
        fallback_outfit = fallback.get_json()["outfit"]
        self.assertTrue(fallback_outfit["bottom"])
        self.assertEqual(fallback_outfit["item_sources"]["bottom"], "suggested")

    def test_party_tags_choose_matching_closet_items_and_suggest_missing_items(self):
        self.register()
        items = (
            ("Pink patterned long kurta", "top", "wedding"),
            ("Beige Pleated Trousers", "bottom", "wedding"),
            ("Tan loafers", "shoes", "wedding"),
            ("Classic watch", "accessory", "wedding"),
            ("Birthday graphic t-shirt", "top", "birthday"),
            ("Blue jeans", "bottom", "birthday"),
        )
        for name, category, party_tag in items:
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "men",
                    "party_tag": party_tag,
                },
            )
            self.assertEqual(response.status_code, 201)

        wedding = self.client.post(
            "/api/plan",
            json={"party_name": "wedding", "audience": "men", "weather": "warm"},
        )
        self.assertEqual(wedding.status_code, 200)
        wedding_outfit = wedding.get_json()["outfit"]
        self.assertEqual(wedding_outfit["top"], "Pink patterned long kurta")
        self.assertEqual(wedding_outfit["bottom"], "Beige Pleated Trousers")
        self.assertEqual(wedding_outfit["shoes"], "Tan loafers")
        self.assertEqual(wedding_outfit["accessory"], "Classic watch")
        self.assertNotIn("missing_wardrobe_items", wedding_outfit)
        self.assertIn(
            "गुलाबी + बेज + टैन",
            wedding_outfit["color_tip"]["hi"],
        )

        birthday = self.client.post(
            "/api/plan",
            json={"party_name": "birthday", "audience": "men", "weather": "warm"},
        )
        self.assertEqual(birthday.status_code, 200)
        birthday_outfit = birthday.get_json()["outfit"]
        self.assertEqual(birthday_outfit["top"], "Birthday graphic t-shirt")
        self.assertEqual(birthday_outfit["bottom"], "Blue jeans")
        self.assertEqual(birthday_outfit["item_sources"]["shoes"], "suggested")
        self.assertTrue(birthday_outfit["shoes"])
        self.assertIn("चटख टॉप", birthday_outfit["color_tip"]["hi"])

        wardrobe = self.client.get("/api/wardrobe").get_json()["items"]
        top = next(item for item in wardrobe if item["name"] == "Birthday graphic t-shirt")
        update = self.client.patch(
            f"/api/wardrobe/{top['id']}",
            json={"name": top["name"], "party_tag": "wedding"},
        )
        self.assertEqual(update.status_code, 200)
        updated_items = self.client.get("/api/wardrobe").get_json()["items"]
        updated_top = next(item for item in updated_items if item["id"] == top["id"])
        self.assertEqual(updated_top["party_tag"], "wedding")

    def test_google_images_links_use_distinct_party_and_outfit_queries(self):
        self.register()
        expected_terms = {
            "wedding": "Indian wedding guest outfit",
            "birthday": "Indian birthday party outfit",
            "night": "Indian night party outfit",
        }
        queries = {}

        for party, expected_term in expected_terms.items():
            response = self.client.post(
                "/api/plan",
                json={"party_name": party, "audience": "men", "weather": "warm"},
            )
            self.assertEqual(response.status_code, 200)
            outfit = response.get_json()["outfit"]
            parsed_url = urlsplit(outfit["google_images_url"])
            parameters = parse_qs(parsed_url.query)

            self.assertEqual(parsed_url.scheme, "https")
            self.assertEqual(parsed_url.netloc, "www.google.com")
            self.assertEqual(parameters.get("tbm"), ["isch"])
            query = parameters["q"][0]
            self.assertIn(expected_term, query)
            self.assertIn("for men", query)
            queries[party] = query

        self.assertEqual(len(set(queries.values())), 3)

    def test_womens_wedding_prioritizes_saved_ethnic_wear(self):
        self.register()
        items = (
            ("Blue casual jeans", "bottom", "any"),
            ("Red wedding saree", "saree", "warm"),
            ("Matching saree blouse", "top", "warm"),
        )
        for name, category, weather in items:
            response = self.client.post(
                "/api/wardrobe",
                json={
                    "name": name,
                    "category": category,
                    "audience": "women",
                    "weather": weather,
                },
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/plan",
            json={
                "party_name": "शादी की पार्टी",
                "audience": "women",
                "weather": "warm",
            },
        )
        self.assertEqual(response.status_code, 200)
        outfit = response.get_json()["outfit"]
        self.assertEqual(outfit["top"], "Matching saree blouse")
        self.assertEqual(outfit["bottom"], "Red wedding saree")
        self.assertEqual(outfit["item_categories"]["bottom"], "saree")

    def test_party_plan_requires_location_and_date_for_weather_forecast(self):
        self.register()
        response = self.client.post(
            "/api/plan",
            json={
                "party_name": "birthday",
                "event_date": (datetime.now().date() + timedelta(days=1)).isoformat(),
                "audience": "men",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("जगह", response.get_json()["error"])

    def test_weather_lookup_rejects_past_dates(self):
        today = datetime.now().date()
        forecast_dates = [
            (today + timedelta(days=offset)).isoformat()
            for offset in range(16)
        ]
        geocoding = {"results": [{"latitude": 26.9, "longitude": 75.8}]}
        forecast = {"daily": {"time": forecast_dates}}
        with self.assertRaisesRegex(ValueError, "आज या आने वाले दिनों"):
            with patch.object(
                outfit_app, "fetch_map_json", side_effect=[geocoding, forecast]
            ):
                outfit_app.weather_for_event(
                    "Jaipur", (today - timedelta(days=1)).isoformat()
                )

    def test_weather_lookup_uses_climate_estimate_after_forecast_window(self):
        today = datetime.now().date()
        event_date = (today + timedelta(days=16)).isoformat()
        geocoding = {"results": [{"latitude": 26.9, "longitude": 75.8}]}
        forecast = {
            "daily": {
                "time": [
                    (today + timedelta(days=offset)).isoformat()
                    for offset in range(16)
                ]
            }
        }
        climate = {
            "daily": {
                "time": [event_date],
                "temperature_2m_max": [18],
                "temperature_2m_min": [8],
                "precipitation_sum": [0.2],
                "snowfall_sum": [0],
            }
        }
        with patch.object(
            outfit_app,
            "fetch_map_json",
            side_effect=[geocoding, forecast, climate],
        ) as fetch:
            result = outfit_app.weather_for_event("Jaipur", event_date)

        self.assertEqual(result["condition"], "cold")
        self.assertTrue(result["is_estimate"])
        self.assertEqual(result["source"], "climate_estimate")
        self.assertEqual(fetch.call_count, 3)

    def test_weather_lookup_falls_back_to_recent_monthly_weather_when_forecast_fails(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        requested_date = datetime.strptime(event_date, "%Y-%m-%d").date()
        monthly_dates = [
            f"{requested_date.year - year_offset}-{requested_date.month:02d}-15"
            for year_offset in range(1, 6)
        ]
        geocoding = {"results": [{"latitude": 34.1, "longitude": 74.8}]}
        archive = {
            "daily": {
                "time": monthly_dates,
                "temperature_2m_max": [10, 11, 12, 10, 9],
                "temperature_2m_min": [1, 2, 3, 1, 0],
                "precipitation_sum": [0, 0, 0, 0, 0],
                "snowfall_sum": [0, 0, 0, 0, 0],
            }
        }
        with patch.object(
            outfit_app,
            "fetch_map_json",
            side_effect=[
                geocoding,
                RuntimeError("live forecast timeout"),
                archive,
            ],
        ) as fetch:
            result = outfit_app.weather_for_event("Srinagar", event_date)

        self.assertEqual(result["condition"], "cold")
        self.assertTrue(result["is_estimate"])
        self.assertEqual(result["source"], "historical_monthly_normal")
        self.assertEqual(fetch.call_count, 3)
        self.assertIn("archive-api.open-meteo.com", fetch.call_args_list[2].args[0])

    def test_party_plan_returns_outfit_when_live_weather_service_fails(self):
        self.register()
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        requested_date = datetime.strptime(event_date, "%Y-%m-%d").date()
        archive = {
            "daily": {
                "time": [
                    f"{requested_date.year - year_offset}-{requested_date.month:02d}-15"
                    for year_offset in range(1, 6)
                ],
                "temperature_2m_max": [10, 11, 12, 10, 9],
                "temperature_2m_min": [1, 2, 3, 1, 0],
                "precipitation_sum": [0, 0, 0, 0, 0],
                "snowfall_sum": [0, 0, 0, 0, 0],
            }
        }
        with patch.object(
            outfit_app,
            "fetch_map_json",
            side_effect=[
                {"results": [{"latitude": 34.1, "longitude": 74.8}]},
                RuntimeError("live forecast timeout"),
                archive,
            ],
        ):
            response = self.client.post(
                "/api/plan",
                json={
                    "party_name": "birthday",
                    "event_date": event_date,
                    "location": "Srinagar",
                    "person_name": "Aarav",
                },
            )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(
            data["outfit"]["weather_details"]["source"],
            "historical_monthly_normal"
        )
        self.assertEqual(data["outfit"]["person_name"], "Aarav")
        self.assertEqual(data["selection"]["person_name"], "Aarav")
        self.assertEqual(data["selection"]["audience"], "men")
        self.assertIn("थर्मल/ऊनी इनर", data["outfit"]["weather_outfit"])
        saved = self.client.post(
            "/api/outfits",
            json={**data["selection"], "outfit": data["outfit"]},
        )
        self.assertEqual(saved.status_code, 201)
        saved_outfits = self.client.get("/api/outfits").get_json()["outfits"]
        self.assertEqual(saved_outfits[0]["outfit"]["person_name"], "Aarav")

    def test_weather_lookup_uses_secondary_geocoder_when_primary_fails(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        forecast = {
            "daily": {
                "time": [event_date],
                "temperature_2m_max": [29],
                "temperature_2m_min": [17],
                "precipitation_probability_max": [20],
                "weather_code": [2],
            }
        }
        with patch.object(
            outfit_app,
            "fetch_map_json",
            side_effect=[
                RuntimeError("primary geocoder timeout"),
                [{"lat": "26.9", "lon": "75.8"}],
                forecast,
            ],
        ) as fetch:
            result = outfit_app.weather_for_event("Jaipur", event_date)

        self.assertEqual(result["condition"], "warm")
        self.assertEqual(fetch.call_count, 3)
        self.assertIn("nominatim.openstreetmap.org", fetch.call_args_list[1].args[0])

    def test_weather_lookup_uses_geocoded_coordinates_and_actual_daily_data(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        geocoding = {"results": [{"latitude": 26.9, "longitude": 75.8}]}
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
        self.assertIn("geocoding-api.open-meteo.com", fetch.call_args_list[0].args[0])
        self.assertIn("api.open-meteo.com", fetch.call_args_list[1].args[0])
        self.assertTrue(all(call.kwargs["timeout"] == 8 for call in fetch.call_args_list))

    def test_weather_lookup_classifies_cold_rain_as_cold_for_closet_matching(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        geocoding = {"results": [{"latitude": 34.1, "longitude": 74.8}]}
        forecast = {
            "daily": {
                "time": [event_date],
                "temperature_2m_max": [11],
                "temperature_2m_min": [6],
                "precipitation_probability_max": [100],
                "weather_code": [61],
            }
        }
        with patch.object(
            outfit_app, "fetch_map_json", side_effect=[geocoding, forecast]
        ):
            result = outfit_app.weather_for_event("Srinagar", event_date)

        self.assertEqual(result["condition"], "cold")
        self.assertEqual(result["precipitation_probability"], 100)

    def test_weather_lookup_accepts_region_names_using_regional_coordinates(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        forecast = {
            "daily": {
                "time": [event_date],
                "temperature_2m_max": [40],
                "temperature_2m_min": [28],
                "precipitation_probability_max": [0],
                "weather_code": [0],
            }
        }
        with patch.object(
            outfit_app, "fetch_map_json", return_value=forecast
        ) as fetch:
            result = outfit_app.weather_for_event("Rajasthan, India", event_date)

        self.assertEqual(result["condition"], "warm")
        self.assertEqual(result["latitude"], 26.5)
        self.assertEqual(result["longitude"], 73.8)
        self.assertIn("api.open-meteo.com", fetch.call_args.args[0])
        self.assertEqual(fetch.call_count, 1)

    def test_weather_lookup_reports_unknown_location(self):
        event_date = (datetime.now().date() + timedelta(days=1)).isoformat()
        with patch.object(
            outfit_app, "fetch_map_json", return_value={"results": []}
        ):
            with self.assertRaisesRegex(ValueError, "map पर नहीं मिला"):
                outfit_app.weather_for_event("Unknown place", event_date)

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
                "color": "Navy",
                "audience": "adult",
                "size": "M",
            },
        )
        self.assertEqual(response.status_code, 201)
        item_id = response.get_json()["id"]
        items = self.client.get("/api/wardrobe").get_json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["category"], "top")

        other_client = outfit_app.app.test_client()
        self.register(other_client, username="other_user")
        self.assertEqual(other_client.get("/api/wardrobe").get_json()["items"], [])
        self.assertEqual(
            other_client.delete(f"/api/wardrobe/{item_id}").status_code, 404
        )

        self.assertEqual(self.client.delete(f"/api/wardrobe/{item_id}").status_code, 200)
        self.assertEqual(self.client.get("/api/wardrobe").get_json()["items"], [])

    def test_wardrobe_infers_category_from_item_name(self):
        self.register()
        for name, expected_category in (
            ("Blue jeans", "bottom"),
            ("Running shoes", "shoes"),
            ("Silk saree", "saree"),
            ("Gold watch", "accessory"),
            ("IMG_1234", "top"),
        ):
            response = self.client.post(
                "/api/wardrobe",
                json={"name": name, "audience": "adult"},
            )
            self.assertEqual(response.status_code, 201)
            self.assertEqual(
                self.client.get("/api/wardrobe").get_json()["items"][0]["category"],
                expected_category,
            )

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

    def test_wardrobe_photo_identification_reports_missing_key_without_external_call(self):
        self.register()
        image_buffer = BytesIO()
        Image.new("RGB", (4, 4), "white").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        with (
            patch.dict(os.environ, {"GROQ_API_KEY": ""}),
            patch.object(outfit_app, "OpenAI") as openai_client,
        ):
            response = self.client.post(
                "/api/wardrobe",
                data={
                    "auto_identify": "true",
                    "image": (image_buffer, "look.png"),
                },
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("GROQ_API_KEY", response.get_json()["error"])
        openai_client.assert_not_called()

    def test_wardrobe_photo_identification_names_and_categorizes_the_item(self):
        self.register()
        image_buffer = BytesIO()
        Image.new("RGB", (4, 4), "white").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        fake_response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({
                "is_fashion_item": True,
                "name": "लाल साड़ी",
                "category": "saree",
            })))]
        )

        with (
            patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
            patch.object(outfit_app, "OpenAI") as openai_client,
        ):
            openai_client.return_value.chat.completions.create.return_value = (
                fake_response
            )
            response = self.client.post(
                "/api/wardrobe",
                data={
                    "auto_identify": "true",
                    "audience": "women",
                    "image": (image_buffer, "look.png"),
                },
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 201)
        item = self.client.get("/api/wardrobe").get_json()["items"][0]
        self.assertEqual(item["name"], "लाल साड़ी")
        self.assertEqual(item["category"], "saree")

    def test_database_path_creates_missing_parent_directory(self):
        database_path = Path(self.database_directory.name) / "nested" / "app.db"
        outfit_app.DATABASE = database_path

        with outfit_app.connect_db() as connection:
            connection.execute("CREATE TABLE connectivity_check (id INTEGER)")

        self.assertTrue(database_path.is_file())


if __name__ == "__main__":
    unittest.main()