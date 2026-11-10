# Party Outfit Planner

A Flask-based party wardrobe planner. It includes:

- manual party planning by occasion, date, and venue
- date- and location-based weather forecasts for the next 16 days
- complete outfit suggestions matched to your wardrobe's saved item names and categories
- private wardrobe-item photos shown with and saved alongside the suggested outfit
- a built-in sample clothing catalog for wardrobes with missing items
- an in-app OpenStreetMap route from the user's location to the chosen venue
- optional traditional Indian outfit recommendations for women, including sarees, lehengas, and suits, with design details and an animated preview
- personal wardrobe management and saved looks history
- login/registration flow with SQLite persistence

## Local setup

1. Create and activate a virtual environment if needed.
2. Install dependencies:

   pip install -r backend/requirements.txt

3. Copy the example environment file if you want to configure local secrets:

   copy .env.example backend/.env

4. Start the app:

   cd backend
   python app.py

Or use the included Windows launcher:

   START_APP.bat

5. Run the backend tests from the `backend` folder:

   python -m unittest -v test_app

## Environment variables

- SECRET_KEY: Flask session secret. A random key is generated for local development if this is not set; set a stable secret for production.
- DATABASE_PATH: Optional path to the SQLite database file. If not set, the app uses backend/outfits.db or falls back to the project root outfits.db.

## Deployment

The included render.yaml config sets the app for Render, using Gunicorn and the backend directory as the app root. It also provisions a 1 GB persistent disk for SQLite at `/var/data`; persistent disks require a Render plan that supports them.

Choose an occasion, date, venue, and whose wardrobe to plan from. Weather is requested
from Open-Meteo after the venue is geocoded with OpenStreetMap. Forecasts are currently
available only for the next 16 days; the app reports when a date or location cannot be
forecast. A map route is requested only after the user grants browser location permission
and clicks the route button. Browser location requires HTTPS or localhost.
