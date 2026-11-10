# Party Outfit Planner

A Flask-based party wardrobe planner. It includes:

- `.ics` calendar import (including recurring events) and automatic recommendations for the next upcoming event
- complete outfit suggestions from your own wardrobe, including shoes, accessories, and eyewear
- a built-in sample clothing catalog for wardrobes with missing items
- an in-app OpenStreetMap route from the user's location to the event venue
- optional traditional Indian outfit recommendations for women, including sarees, lehengas, and suits, with design details and an animated preview
- personal wardrobe management and saved looks history
- login/registration flow with SQLite persistence
- optional photo-based recommendations using a Groq/OpenAI-compatible API

## Local setup

1. Create and activate a virtual environment if needed.
2. Install dependencies:

   pip install -r backend/requirements.txt

3. Copy the example environment file and add your Groq key if you want photo analysis:

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
- GROQ_API_KEY: Optional API key for the photo analysis route.
- DATABASE_PATH: Optional path to the SQLite database file. If not set, the app uses backend/outfits.db or falls back to the project root outfits.db.

## Deployment

The included render.yaml config sets the app for Render, using Gunicorn and the backend directory as the app root. It also provisions a 1 GB persistent disk for SQLite at `/var/data`; persistent disks require a Render plan that supports them. Configure `GROQ_API_KEY` in the Render dashboard to enable photo analysis.

Import an `.ics` calendar file in the app to plan for the next event. Importing a new file
replaces the previously imported events for that account. The map uses OpenStreetMap
geocoding/routing and map tiles; a route is requested only after the user grants browser
location permission and clicks the route button. Browser location requires HTTPS or localhost.
