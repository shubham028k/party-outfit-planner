from flask import (
    Flask, jsonify, render_template, request,
    redirect, url_for, session
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from pathlib import Path
from datetime import datetime
import sqlite3
import json
import re
import os
from io import BytesIO
import base64
from PIL import Image, UnidentifiedImageError
from openai import OpenAI, OpenAIError
app = Flask(__name__)
app.secret_key = os.environ.get(
    "SECRET_KEY",
    "local-dev-key-change-before-deploy"
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax"
)

DATABASE = Path(__file__).with_name("outfits.db")

OUTFITS = {
    "birthday": {
        "casual": [
            "हल्की नीली ऑक्सफ़ोर्ड शर्ट", "डार्क ब्लू चिनोज़",
            "सफ़ेद स्नीकर्स", "क्लासिक घड़ी"
        ],
        "smart": [
            "सफ़ेद शर्ट और नेवी ब्लेज़र", "चारकोल ट्राउज़र",
            "ब्राउन लोफ़र्स", "लेदर बेल्ट"
        ],
        "bold": [
            "मरून टेक्सचर्ड शर्ट", "ब्लैक जींस",
            "ब्लैक बूट्स", "सिल्वर ब्रेसलेट"
        ]
    },
    "wedding": {
        "casual": [
            "हल्के रंग का कुर्ता", "सफ़ेद पायजामा",
            "ब्राउन जूती", "पॉकेट स्क्वेयर"
        ],
        "smart": [
            "आइवरी कुर्ता और नेहरू जैकेट", "क्रीम ट्राउज़र",
            "टैन लोफ़र्स", "क्लासिक घड़ी"
        ],
        "bold": [
            "ज्वेल-टोन बंदगला", "मैचिंग फॉर्मल ट्राउज़र",
            "फॉर्मल जूते", "पॉकेट स्क्वेयर"
        ]
    },
    "casual": {
        "casual": [
            "सॉलिड रंग की टी-शर्ट", "स्ट्रेट-फिट ब्लू जींस",
            "आरामदायक स्नीकर्स", "कैज़ुअल घड़ी"
        ],
        "smart": [
            "लिनेन शर्ट", "बेज चिनोज़",
            "सुएड लोफ़र्स", "लेदर बेल्ट"
        ],
        "bold": [
            "प्रिंटेड ओवरशर्ट", "ब्लैक कार्गो पैंट",
            "हाई-टॉप स्नीकर्स", "कैप"
        ]
    },
    "night": {
        "casual": [
            "ब्लैक पोलो टी-शर्ट", "डार्क जींस",
            "ब्लैक स्नीकर्स", "मिनिमल घड़ी"
        ],
        "smart": [
            "ब्लैक फिटेड शर्ट", "चारकोल ट्राउज़र",
            "ब्लैक लोफ़र्स", "लेदर बेल्ट"
        ],
        "bold": [
            "डीप वाइन रंग की शर्ट", "ब्लैक ट्राउज़र",
            "ब्लैक बूट्स", "सिल्वर चेन"
        ]
    }
}

WOMEN_OUTFITS = {
    "birthday": {
        "casual": [
            "पेस्टल ब्लाउज़", "हाई-वेस्ट जींस",
            "सफ़ेद स्नीकर्स", "हूप इयररिंग्स"
        ],
        "smart": [
            "पेस्टल ब्लेज़र और टॉप", "टेलर्ड ट्राउज़र",
            "ब्लॉक हील्स", "मिनिमल नेकलेस"
        ],
        "bold": [
            "सीक्विन टॉप", "ब्लैक स्कर्ट",
            "स्ट्रैपी हील्स", "स्टेटमेंट इयररिंग्स"
        ]
    },
    "wedding": {
        "casual": [
            "अनारकली कुर्ता", "चूड़ीदार",
            "एम्बेलिश्ड सैंडल", "चूड़ियाँ"
        ],
        "smart": [
            "साड़ी ब्लाउज़", "साड़ी",
            "हील्स", "क्लासिक ज्वेलरी"
        ],
        "bold": [
            "लहंगा चोली", "मैचिंग लहंगा स्कर्ट",
            "एम्बेलिश्ड हील्स", "स्टेटमेंट ज्वेलरी"
        ]
    },
    "casual": {
        "casual": [
            "आरामदायक टी-शर्ट", "स्ट्रेट-फिट जींस",
            "स्नीकर्स", "छोटे हूप्स"
        ],
        "smart": [
            "लिनेन ब्लाउज़", "बेज ट्राउज़र",
            "लोफ़र्स", "मिनिमल घड़ी"
        ],
        "bold": [
            "प्रिंटेड टॉप", "ब्लैक कार्गो पैंट",
            "हाई-टॉप स्नीकर्स", "कैप"
        ]
    },
    "night": {
        "casual": [
            "ब्लैक टॉप", "डार्क जींस",
            "ब्लैक स्नीकर्स", "मिनिमल इयररिंग्स"
        ],
        "smart": [
            "साटन शर्ट", "चारकोल ट्राउज़र",
            "लोफ़र्स", "स्टेटमेंट नेकलेस"
        ],
        "bold": [
            "मेटैलिक टॉप", "ब्लैक स्कर्ट",
            "ब्लॉक हील्स", "बोल्ड इयररिंग्स"
        ]
    }
}

AUDIENCE_NAMES = {
    "men": "पुरुष",
    "women": "महिला",
    "children": "बच्चे",
    "senior": "बुज़ुर्ग"
}

BOTTOM_NAMES = {
    "trousers": "लंबी पैंट",
    "shorts": "शॉर्ट्स"
}

SHORTS_OUTFITS = {
    "men": {
        "casual": "कॉटन शॉर्ट्स",
        "smart": "टेलर्ड चिनो शॉर्ट्स",
        "bold": "डेनिम या कार्गो शॉर्ट्स"
    },
    "women": {
        "casual": "डेनिम शॉर्ट्स",
        "smart": "टेलर्ड शॉर्ट्स",
        "bold": "हाई-वेस्ट शॉर्ट्स"
    },
    "children": {
        "casual": "आरामदायक कॉटन शॉर्ट्स",
        "smart": "सॉफ्ट-फिट चिनो शॉर्ट्स",
        "bold": "रंगीन कॉटन शॉर्ट्स"
    },
    "senior": {
        "casual": "हल्के कॉटन शॉर्ट्स",
        "smart": "आरामदायक इलास्टिक-कमर शॉर्ट्स",
        "bold": "सॉफ्ट-फिट शॉर्ट्स"
    }
}

AGE_GROUP_OUTFITS = {
    "children": {
        "birthday": {
            "casual": ["रंगीन कॉटन टी-शर्ट", "सॉफ्ट कॉटन ट्राउज़र", "ग्रिप वाले स्नीकर्स", "हल्की कैप"],
            "smart": ["आरामदायक कॉलर वाली शर्ट", "सॉफ्ट-फिट ट्राउज़र", "आरामदायक स्नीकर्स", "हल्की जैकेट"],
            "bold": ["मज़ेदार प्रिंट वाली टी-शर्ट", "आरामदायक कॉटन ट्राउज़र", "ग्रिप वाले स्नीकर्स", "रंगीन कैप"]
        },
        "wedding": {
            "casual": ["हल्का उत्सवी कुर्ता", "आरामदायक पायजामा", "ग्रिप वाले एथनिक जूते", "हल्की नेहरू जैकेट"],
            "smart": ["साफ़-सुथरा उत्सवी कुर्ता", "सॉफ्ट-फिट पायजामा", "आरामदायक एथनिक जूते", "हल्की जैकेट"],
            "bold": ["रंगीन उत्सवी कुर्ता", "सॉफ्ट कॉटन ट्राउज़र", "आरामदायक जूती", "हल्की जैकेट"]
        },
        "casual": {
            "casual": ["आरामदायक कॉटन टी-शर्ट", "सॉफ्ट कॉटन ट्राउज़र", "ग्रिप वाले स्नीकर्स", "हल्की कैप"],
            "smart": ["कॉलर वाली कॉटन शर्ट", "आरामदायक चिनो ट्राउज़र", "आरामदायक लो-टॉप स्नीकर्स", "हल्का स्वेटर"],
            "bold": ["प्रिंटेड शर्ट", "आरामदायक कार्गो ट्राउज़र", "ग्रिप वाले स्नीकर्स", "रंगीन कैप"]
        },
        "night": {
            "casual": ["गहरे रंग की आरामदायक टी-शर्ट", "सॉफ्ट कॉटन ट्राउज़र", "आरामदायक स्नीकर्स", "हल्की जैकेट"],
            "smart": ["कॉलर वाली गहरे रंग की शर्ट", "सॉफ्ट-फिट ट्राउज़र", "आरामदायक लो-टॉप स्नीकर्स", "हल्का स्वेटर"],
            "bold": ["रंगीन प्रिंट वाली शर्ट", "आरामदायक कार्गो ट्राउज़र", "ग्रिप वाले स्नीकर्स", "रंगीन कैप"]
        }
    },
    "senior": {
        "birthday": {
            "casual": ["सांस लेने वाला सूती टॉप", "इलास्टिक-कमर वाले ट्राउज़र", "कुशन वाले फ्लैट जूते", "हल्की घड़ी"],
            "smart": ["लिनेन शर्ट या ट्यूनिक", "आसान फिटिंग वाले ट्राउज़र", "ग्रिप वाले आरामदायक जूते", "हल्का स्टोल"],
            "bold": ["रंगीन आरामदायक टॉप", "सॉफ्ट-फिट ट्राउज़र", "कुशन वाले लो-हील जूते", "हल्का स्कार्फ"]
        },
        "wedding": {
            "casual": ["आरामदायक उत्सवी कुर्ता", "सॉफ्ट-फिट पायजामा", "कुशन वाले फ्लैट एथनिक जूते", "हल्का स्टोल"],
            "smart": ["सांस लेने वाला उत्सवी कुर्ता या ट्यूनिक", "इलास्टिक-कमर वाले ट्राउज़र", "ग्रिप वाले फ्लैट जूते", "हल्का स्टोल"],
            "bold": ["रंगीन आरामदायक उत्सवी टॉप", "सॉफ्ट-फिट ट्राउज़र", "कुशन वाले फ्लैट जूते", "हल्का स्कार्फ"]
        },
        "casual": {
            "casual": ["सांस लेने वाली कॉटन टी-शर्ट", "इलास्टिक-कमर वाले ट्राउज़र", "कुशन वाले स्नीकर्स", "हल्की घड़ी"],
            "smart": ["लिनेन शर्ट या ट्यूनिक", "आरामदायक चिनो ट्राउज़र", "ग्रिप वाले लो-हील जूते", "हल्का स्टोल"],
            "bold": ["रंगीन आरामदायक टॉप", "सॉफ्ट-फिट ट्राउज़र", "कुशन वाले फ्लैट जूते", "हल्का स्कार्फ"]
        },
        "night": {
            "casual": ["गहरे रंग का सांस लेने वाला टॉप", "इलास्टिक-कमर वाले ट्राउज़र", "कुशन वाले फ्लैट जूते", "हल्की जैकेट"],
            "smart": ["लिनेन शर्ट या ट्यूनिक", "आसान फिटिंग वाले ट्राउज़र", "ग्रिप वाले लो-हील जूते", "हल्का स्टोल"],
            "bold": ["रंगीन आरामदायक टॉप", "सॉफ्ट-फिट ट्राउज़र", "कुशन वाले फ्लैट जूते", "हल्का स्कार्फ"]
        }
    }
}

PARTY_NAMES = {
    "birthday": "बर्थडे पार्टी",
    "wedding": "शादी की पार्टी",
    "casual": "कैज़ुअल पार्टी",
    "night": "नाइट पार्टी"
}

STYLE_NAMES = {
    "casual": "कैज़ुअल",
    "smart": "स्मार्ट",
    "bold": "बोल्ड"
}
CATEGORIES = {"top", "bottom", "shorts", "shoes", "accessory"}


def connect_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection
def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "कृपया पहले लॉगिन करें।"}), 401
        return function(*args, **kwargs)

    return wrapper
@app.post("/api/analyze-photo")
@login_required
def analyze_photo():
    if not os.environ.get("OPENAI_API_KEY"):
        return jsonify({"error": "OPENAI_API_KEY सेट नहीं है।"}), 503

    photo = request.files.get("photo")
    party = request.form.get("party_type")
    weather = request.form.get("weather")
    style = request.form.get("style")
    audience = request.form.get("audience")
    bottom_preference = request.form.get("bottom_preference", "trousers")
    language = request.form.get("language", "hi")

    if request.form.get("photo_consent") != "yes":
        return jsonify({"error": "फोटो विश्लेषण के लिए अनुमति दें।"}), 400

    if not photo or not photo.filename:
        return jsonify({"error": "पहले अपनी फोटो चुनें।"}), 400

    if (
        party not in PARTY_NAMES
        or weather not in {"warm", "cold", "rainy"}
        or style not in STYLE_NAMES
        or audience not in AUDIENCE_NAMES
        or bottom_preference not in BOTTOM_NAMES
    ):
        return jsonify({"error": "पार्टी, मौसम, स्टाइल और कपड़ों के विकल्प जाँचें।"}), 400

    raw_image = photo.read(5 * 1024 * 1024 + 1)
    if len(raw_image) > 5 * 1024 * 1024:
        return jsonify({"error": "फोटो 5 MB से छोटी होनी चाहिए।"}), 400

    try:
        image = Image.open(BytesIO(raw_image))
        if image.format not in {"JPEG", "PNG", "WEBP"}:
            return jsonify({"error": "JPG, PNG या WebP फोटो चुनें।"}), 400

        image.verify()
        image = Image.open(BytesIO(raw_image)).convert("RGB")
        image.thumbnail((1200, 1200))

        cleaned_image = BytesIO()
        image.save(cleaned_image, format="JPEG", quality=85)
        image_base64 = base64.b64encode(
            cleaned_image.getvalue()
        ).decode("utf-8")

    except (UnidentifiedImageError, OSError, ValueError):
        return jsonify({"error": "यह सही image फ़ाइल नहीं लगती।"}), 400

    with connect_db() as connection:
        items = connection.execute(
            """SELECT name, category, color
               FROM wardrobe_items
               WHERE user_id = ?
               ORDER BY id DESC LIMIT 50""",
            (session["user_id"],)
        ).fetchall()

    wardrobe_text = "\n".join(
        f"- {item['color']} {item['name']} ({item['category']})"
        for item in items
    ) or "यूज़र की अलमारी में अभी कोई कपड़ा दर्ज नहीं है।"

    answer_language = "English" if language == "en" else "Hindi"
    audience_guidance = {
        "children": (
            "Recommend comfortable, age-appropriate clothing and secure, "
            "well-fitting shoes. Avoid high heels and small detachable accessories."
        ),
        "senior": (
            "Prioritize comfort, breathable layers, easy-to-wear closures, "
            "and stable flat or low-heel footwear."
        )
    }.get(audience, "Use practical, comfortable party styling.")
    prompt = f"""
You are a practical personal fashion stylist.
Use the uploaded photo only for visible outfit colors and styling context.
Do not identify the person or infer age, gender, body shape, skin tone, or identity.
The user selected this styling category: {AUDIENCE_NAMES[audience]}.
Styling guidance: {audience_guidance}
Party: {PARTY_NAMES[party]}
Style: {STYLE_NAMES[style]}
Weather: {weather}
Bottom preference: {BOTTOM_NAMES[bottom_preference]}. Follow this choice exactly.
If shorts are selected, recommend shorts for the bottom; otherwise recommend long pants/trousers.
User's wardrobe:
{wardrobe_text}

Recommend a coordinated top, bottom, shoes, accessory, and weather tip.
Prefer items from the user's wardrobe when suitable.
Write all values in {answer_language}.
"""

    schema = {
        "type": "object",
        "properties": {
            "top": {"type": "string"},
            "bottom": {"type": "string"},
            "shoes": {"type": "string"},
            "accessory": {"type": "string"},
            "weather_tip": {"type": "string"}
        },
        "required": ["top", "bottom", "shoes", "accessory", "weather_tip"],
        "additionalProperties": False
    }

    try:
        response = OpenAI().responses.create(
            model="gpt-6-astra",
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{image_base64}",
                        "detail": "auto"
                    }
                ]
            }],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "outfit_recommendation",
                    "strict": True,
                    "schema": schema
                }
            }
        )

        outfit = json.loads(response.output_text)
        outfit["party_name"] = PARTY_NAMES[party]
        outfit["style_name"] = STYLE_NAMES[style]
        outfit["audience_name"] = AUDIENCE_NAMES[audience]
        return jsonify({"outfit": outfit})

    except (OpenAIError, json.JSONDecodeError):
        app.logger.exception("Photo outfit analysis failed")
        return jsonify({
            "error": "फोटो से सुझाव नहीं बन पाया। फिर कोशिश करें।"
        }), 502
def initialize_database():
    with connect_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS saved_outfits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                party_type TEXT NOT NULL,
                style TEXT NOT NULL,
                outfit_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                user_id INTEGER NOT NULL DEFAULT 1
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS wardrobe_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                user_id INTEGER NOT NULL DEFAULT 1
            )
        """)

        # पुराने डेटाबेस में user_id न हो तो उसे जोड़ें।
        for table in ("saved_outfits", "wardrobe_items"):
            columns = [
                row["name"]
                for row in connection.execute(
                    f"PRAGMA table_info({table})"
                ).fetchall()
            ]

            if "user_id" not in columns:
                connection.execute(
                    f"""ALTER TABLE {table}
                        ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1"""
                )





def wardrobe_pick(user_id, category, fallback):
    with connect_db() as connection:
        item = connection.execute(
            """SELECT name, color
               FROM wardrobe_items
               WHERE user_id = ? AND category = ?
               ORDER BY id
               LIMIT 1""",
            (user_id, category)
        ).fetchone()

    if not item:
        return fallback

    return f"{item['color']} {item['name']}".strip()


def make_recommendation(
    user_id, party_type, weather, style, audience,
    bottom_preference="trousers"
):
    outfit_options = AGE_GROUP_OUTFITS.get(
        audience,
        WOMEN_OUTFITS if audience == "women" else OUTFITS
    )
    defaults = outfit_options[party_type][style]

    if bottom_preference == "shorts":
        bottom = wardrobe_pick(
            user_id,
            "shorts",
            SHORTS_OUTFITS[audience][style]
        )
    else:
        bottom = wardrobe_pick(user_id, "bottom", defaults[1])

    outfit = {
        "top": wardrobe_pick(user_id, "top", defaults[0]),
        "bottom": bottom,
        "shoes": wardrobe_pick(user_id, "shoes", defaults[2]),
        "accessory": wardrobe_pick(user_id, "accessory", defaults[3]),
        "party_name": PARTY_NAMES[party_type],
        "style_name": STYLE_NAMES[style],
        "audience_name": AUDIENCE_NAMES[audience]
    }

    if audience == "children" and weather == "cold":
        outfit["weather_tip"] = "बच्चे के लिए आरामदायक गर्म परतें साथ रखें।"
    elif audience == "children" and weather == "rainy":
        outfit["weather_tip"] = "बारिश में बच्चे के लिए ग्रिप वाले, पानी से बचाने वाले जूते चुनें।"
    elif audience == "children":
        outfit["weather_tip"] = "गर्मी में बच्चे के लिए हल्के, सांस लेने वाले कपड़े चुनें।"
    elif audience == "senior" and weather == "cold":
        outfit["weather_tip"] = "ठंड में आरामदायक, हल्की परतें रखें जिन्हें आसानी से पहना जा सके।"
    elif audience == "senior" and weather == "rainy":
        outfit["weather_tip"] = "बारिश में ग्रिप वाले, आरामदायक जूते चुनें।"
    elif audience == "senior":
        outfit["weather_tip"] = "गर्मी में हल्के, सांस लेने वाले और आरामदायक कपड़े चुनें।"
    elif weather == "cold":
        outfit["weather_tip"] = "ठंड के लिए जैकेट या ब्लेज़र साथ रखें।"
    elif weather == "rainy":
        outfit["weather_tip"] = "बारिश में पानी से कम खराब होने वाले जूते चुनें।"
    else:
        outfit["weather_tip"] = "गर्मी में हल्के और आरामदायक कपड़े चुनें।"

    return outfit


@app.get("/")
def home():
    if not session.get("user_id"):
        return redirect(url_for("login"))

    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect(url_for("home"))

    error = None

    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")

        with connect_db() as connection:
            user = connection.execute(
                """SELECT id, password_hash
                   FROM users
                   WHERE username = ?""",
                (username,)
            ).fetchone()

        if user and check_password_hash(user["password_hash"], password):
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = username
            return redirect(url_for("home"))

        error = "यूज़रनेम या पासवर्ड सही नहीं है।"

    return render_template("login.html", mode="login", error=error)


@app.route("/register", methods=["GET", "POST"])
def register():
    if session.get("user_id"):
        return redirect(url_for("home"))

    error = None

    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")

        if not re.fullmatch(r"[a-z0-9_.-]{3,30}", username):
            error = (
                "यूज़रनेम 3–30 अक्षरों का हो; अंग्रेज़ी अक्षर, "
                "अंक, dot, _ या - इस्तेमाल करें।"
            )
        elif len(password) < 8:
            error = "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।"
        else:
            try:
                with connect_db() as connection:
                    cursor = connection.execute(
                        """INSERT INTO users
                           (username, password_hash, created_at)
                           VALUES (?, ?, ?)""",
                        (
                            username,
                            generate_password_hash(password),
                            datetime.now().isoformat(timespec="seconds")
                        )
                    )

                session.clear()
                session["user_id"] = cursor.lastrowid
                session["username"] = username
                return redirect(url_for("home"))

            except sqlite3.IntegrityError:
                error = "यह यूज़रनेम पहले से इस्तेमाल हो रहा है।"

    return render_template("login.html", mode="register", error=error)


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.post("/api/recommend")
@login_required
def recommend():
    data = request.get_json(silent=True) or {}
    party = data.get("party_type")
    weather = data.get("weather")
    style = data.get("style")
    audience = data.get("audience")
    bottom_preference = data.get("bottom_preference", "trousers")

    if (
        party not in PARTY_NAMES
        or weather not in {"warm", "cold", "rainy"}
        or style not in STYLE_NAMES
        or audience not in AUDIENCE_NAMES
        or bottom_preference not in BOTTOM_NAMES
    ):
        return jsonify({
            "error": "पार्टी, मौसम, स्टाइल, किसके लिए और नीचे के कपड़े जाँचें।"
        }), 400

    outfit = make_recommendation(
        session["user_id"], party, weather, style, audience,
        bottom_preference
    )
    return jsonify({"outfit": outfit})


@app.get("/api/wardrobe")
@login_required
def get_wardrobe():
    with connect_db() as connection:
        rows = connection.execute(
            """SELECT id, name, category, color
               FROM wardrobe_items
               WHERE user_id = ?
               ORDER BY id DESC""",
            (session["user_id"],)
        ).fetchall()

    return jsonify({"items": [dict(row) for row in rows]})


@app.post("/api/wardrobe")
@login_required
def add_wardrobe_item():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    category = data.get("category")
    color = str(data.get("color", "")).strip()

    if not name or len(name) > 60:
        return jsonify({
            "error": "कपड़े का नाम लिखें (अधिकतम 60 अक्षर)।"
        }), 400

    if category not in CATEGORIES:
        return jsonify({"error": "कपड़े का सही प्रकार चुनें।"}), 400

    if len(color) > 30:
        return jsonify({"error": "रंग का नाम 30 अक्षरों से छोटा रखें।"}), 400

    with connect_db() as connection:
        cursor = connection.execute(
            """INSERT INTO wardrobe_items
               (name, category, color, created_at, user_id)
               VALUES (?, ?, ?, ?, ?)""",
            (
                name,
                category,
                color,
                datetime.now().isoformat(timespec="seconds"),
                session["user_id"]
            )
        )

    return jsonify({
        "id": cursor.lastrowid,
        "message": "कपड़ा अलमारी में जोड़ दिया गया।"
    }), 201


@app.delete("/api/wardrobe/<int:item_id>")
@login_required
def delete_wardrobe_item(item_id):
    with connect_db() as connection:
        cursor = connection.execute(
            """DELETE FROM wardrobe_items
               WHERE id = ? AND user_id = ?""",
            (item_id, session["user_id"])
        )

    if cursor.rowcount == 0:
        return jsonify({"error": "यह कपड़ा नहीं मिला।"}), 404

    return jsonify({"message": "कपड़ा अलमारी से हटा दिया गया।"})


@app.post("/api/outfits")
@login_required
def save_outfit():
    data = request.get_json(silent=True) or {}
    party = data.get("party_type")
    weather = data.get("weather")
    style = data.get("style")
    audience = data.get("audience")
    bottom_preference = data.get("bottom_preference", "trousers")

    if (
        party not in PARTY_NAMES
        or weather not in {"warm", "cold", "rainy"}
        or style not in STYLE_NAMES
        or audience not in AUDIENCE_NAMES
        or bottom_preference not in BOTTOM_NAMES
    ):
        return jsonify({
            "error": "पहले सही पार्टी, मौसम, स्टाइल और कपड़ों के विकल्प चुनें।"
        }), 400

    supplied_outfit = data.get("outfit")
    if supplied_outfit is not None:
        outfit_fields = ("top", "bottom", "shoes", "accessory", "weather_tip")
        if not isinstance(supplied_outfit, dict) or any(
            not isinstance(supplied_outfit.get(field), str)
            or not supplied_outfit[field].strip()
            or len(supplied_outfit[field]) > 300
            for field in outfit_fields
        ):
            return jsonify({"error": "दिख रहे लुक की जानकारी सही नहीं है।"}), 400

        outfit = {field: supplied_outfit[field].strip() for field in outfit_fields}
        outfit.update({
            "party_name": PARTY_NAMES[party],
            "style_name": STYLE_NAMES[style],
            "audience_name": AUDIENCE_NAMES[audience]
        })
    else:
        outfit = make_recommendation(
            session["user_id"], party, weather, style, audience,
            bottom_preference
        )

    with connect_db() as connection:
        cursor = connection.execute(
            """INSERT INTO saved_outfits
               (party_type, style, outfit_json, created_at, user_id)
               VALUES (?, ?, ?, ?, ?)""",
            (
                party,
                style,
                json.dumps(outfit, ensure_ascii=False),
                datetime.now().strftime("%d %b %Y, %I:%M %p"),
                session["user_id"]
            )
        )

    return jsonify({
        "message": "लुक सेव हो गया!",
        "id": cursor.lastrowid
    }), 201


@app.get("/api/outfits")
@login_required
def get_saved_outfits():
    with connect_db() as connection:
        rows = connection.execute(
            """SELECT id, party_type, style, outfit_json, created_at
               FROM saved_outfits
               WHERE user_id = ?
               ORDER BY id DESC
               LIMIT 20""",
            (session["user_id"],)
        ).fetchall()

    outfits = [
        {
            "id": row["id"],
            "party_type": row["party_type"],
            "style": row["style"],
            "outfit": json.loads(row["outfit_json"]),
            "created_at": row["created_at"]
        }
        for row in rows
    ]

    return jsonify({"outfits": outfits})


@app.delete("/api/outfits/<int:outfit_id>")
@login_required
def delete_outfit(outfit_id):
    with connect_db() as connection:
        cursor = connection.execute(
            """DELETE FROM saved_outfits
               WHERE id = ? AND user_id = ?""",
            (outfit_id, session["user_id"])
        )

    if cursor.rowcount == 0:
        return jsonify({"error": "यह सेव किया हुआ लुक नहीं मिला।"}), 404

    return jsonify({"message": "लुक हटा दिया गया।"})


initialize_database()

if __name__ == "__main__":
    app.run(debug=True)