# Party Outfit Planner

A Flask-based outfit planner for choosing party looks by occasion, weather, style, and audience. It includes:

- outfit recommendation generation with wardrobe-aware matching
- optional traditional Indian outfit recommendations for women, including sarees, lehengas, and suits, with design details and an animated preview
- personal wardrobe management and saved looks history
- login/registration flow with SQLite persistence
- optional photo-based recommendations using a Groq/OpenAI-compatible API
- optional city/current-location context and Google Images search links for outfit inspiration

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
