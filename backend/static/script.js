const form = document.getElementById("outfitForm");
const errorMessage = document.getElementById("errorMessage");
const saveMessage = document.getElementById("saveMessage");
const saveButton = document.getElementById("saveButton");
const nextOutfitButton = document.getElementById("nextOutfitButton");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const outfitResult = document.getElementById("outfitResult");
const partySearchInput = document.getElementById("partySearch");
const eventDateInput = document.getElementById("eventDate");
const eventDatePreview = document.getElementById("eventDatePreview");
const eventLocationInput = document.getElementById("eventLocation");
const wardrobeSearch = document.getElementById("wardrobeSearch");
const wardrobeSearchEmpty = document.getElementById("wardrobeSearchEmpty");
let wardrobeItemsCache = [];

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

eventDateInput.min = dateInputValue(new Date());
eventDateInput.value = eventDateInput.min;

function updateEventDatePreview() {
  if (!eventDatePreview || !eventDateInput.value) return;
  const date = new Date(eventDateInput.value + "T00:00:00");
  const formattedDate = new Intl.DateTimeFormat(
    appLanguage === "en" ? "en-IN" : "hi-IN",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  ).format(date);
  eventDatePreview.textContent = appLanguage === "en"
    ? "Selected date: " + formattedDate
    : "चुनी हुई तारीख: " + formattedDate;
}

eventDateInput.addEventListener("change", updateEventDatePreview);

async function readJsonResponse(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("json")) return response.json();
  const endpoint = new URL(response.url).pathname;

  const message = response.status === 404
    ? (appLanguage === "en"
      ? `Backend route ${endpoint} is missing (404). Restart Flask or deploy the latest code.`
      : `Backend route ${endpoint} नहीं मिला (404)। ऐप restart करो या नवीनतम बदलाव तैनात करो।`)
    : response.status >= 500
      ? (appLanguage === "en"
        ? `Backend error (${response.status}) at ${endpoint}. Check the Flask terminal or hosting logs.`
        : `Backend error (${response.status}) ${endpoint} पर आया। Flask terminal या hosting logs देखो।`)
      : (appLanguage === "en"
        ? `The server returned a web page instead of JSON (HTTP ${response.status}). Sign in again and retry.`
        : `सर्वर ने डेटा की जगह वेब पेज दिया (${response.status})। फिर लॉगिन करके कोशिश करो।`);
  const error = new Error(message);
  error.code = "NON_JSON_RESPONSE";
  throw error;
}

const wardrobeForm = document.getElementById("wardrobeForm");
const wardrobeCategoryInput = document.getElementById("wardrobeCategory");
const wardrobeMessage = document.getElementById("wardrobeMessage");
const wardrobeList = document.getElementById("wardrobeList");
const emptyWardrobe = document.getElementById("emptyWardrobe");
const wardrobeCount = document.getElementById("wardrobeCount");
const wardrobeImageInput = document.getElementById("wardrobeImage");
const wardrobeImagePreviewBox = document.getElementById("wardrobeImagePreviewBox");
const wardrobeImagePreview = document.getElementById("wardrobeImagePreview");
let wardrobeImagePreviewUrl = null;

let currentSelection = null;
let currentOutfit = null;
let lastOutfit = null;
let currentVariation = 0;
let outfitTranslationRequest = 0;
let planRequestGeneration = 0;
let planRequestPending = false;

form.addEventListener("input", invalidateCurrentLook);
form.addEventListener("change", invalidateCurrentLook);

function invalidateCurrentLook() {
  const hadLook = Boolean(currentSelection || currentOutfit || lastOutfit);
  planRequestGeneration += 1;
  if (!hadLook && !planRequestPending) return;
  currentSelection = null;
  currentOutfit = null;
  lastOutfit = null;
  outfitTranslationRequest += 1;
  outfitResult.hidden = true;
  resultPlaceholder.hidden = false;
  const placeholderText = resultPlaceholder.querySelector("p");
  if (placeholderText) {
    placeholderText.textContent = appLanguage === "en"
      ? "Your details changed. Generate a new look to see updated clothes."
      : "जानकारी बदल गई है। नए कपड़े देखने के लिए लुक फिर से बनाओ।";
  }
  errorMessage.textContent = "";
  saveButton.disabled = true;
  nextOutfitButton.hidden = true;
  nextOutfitButton.disabled = true;
  currentVariation = 0;
  saveMessage.textContent = translateText("तुमने जानकारी बदली है; लुक फिर से बनाओ।");
}

function updateNextOutfitLabel() {
  if (!nextOutfitButton) return;
  const nextVariation = (currentVariation + 1) % 3;
  const label = appLanguage === "en"
    ? `Next outfit combination (${nextVariation + 1}/3)`
    : `अगला कपड़ों का मेल (${nextVariation + 1}/3)`;
  const text = nextOutfitButton.querySelector("span");
  if (text && !planRequestPending) text.textContent = label;
}

const categoryNames = {
  top: "शर्ट / टॉप",
  bottom: "पैंट",
  shorts: "शॉर्ट्स",
  shoes: "जूते",
  accessory: "एक्सेसरी",
  eyewear: "चश्मा",
  perfume: "परफ्यूम",
  saree: "साड़ी",
  salwar: "सलवार-सूट",
  lehenga: "लहंगा",
  kurti: "कुर्ती"
};

const wardrobeSearchCategoryAliases = {
  top: ["top", "shirt", "shirts", "t-shirt", "tshirt", "blouse", "sweater", "jacket", "coat", "शर्ट", "टॉप", "कमीज़", "कमीज", "ब्लाउज़", "ब्लाउज", "स्वेटर", "जैकेट", "कोट"],
  bottom: ["bottom", "pants", "pant", "trousers", "trouser", "jeans", "skirt", "leggings", "पैंट", "पतलून", "जींस", "जीन", "स्कर्ट", "लेगिंग"],
  shorts: ["short", "shorts", "शॉर्ट्स"],
  shoes: ["shoe", "shoes", "sneaker", "sneakers", "boots", "heels", "sandals", "जूते", "जूता", "जूती", "सैंडल"],
  accessory: ["accessory", "accessories", "watch", "belt", "jewelry", "jewellery", "bag", "scarf", "घड़ी", "बेल्ट", "गहना", "बैग", "दुपट्टा", "एक्सेसरी"],
  eyewear: ["glasses", "eyewear", "sunglasses", "चश्मा", "ऐनक"],
  perfume: ["perfume", "cologne", "fragrance", "परफ्यूम", "इत्र"],
  saree: ["saree", "sari", "साड़ी", "साड़ी"],
  salwar: ["salwar", "सलवार", "सलवार-सूट"],
  lehenga: ["lehenga", "लहंगा", "लहँगा"],
  kurti: ["kurti", "कुर्ती"]
};

const wardrobeAudienceNames = {
  men: "पुरुष",
  women: "महिला",
  adult: "वयस्क",
  children: "बच्चे",
  senior: "बुज़ुर्ग",
  all: "सबके लिए"
};

const wardrobePartyNames = {
  any: ["सभी पार्टियाँ", "All parties"],
  wedding: ["शादी की पार्टी", "Wedding party"],
  birthday: ["बर्थडे पार्टी", "Birthday party"],
  casual: ["कैज़ुअल पार्टी", "Casual party"],
  night: ["नाइट पार्टी", "Night party"]
};

const colorCombinationIdeas = [
  {
    title: ["क्लासिक न्यूट्रल", "Classic neutrals"],
    combo: ["नेवी टॉप · बेज पैंट · सफ़ेद या टैन जूते", "Navy top · beige trousers · white or tan shoes"],
    colors: ["#263b67", "#d9c8a4", "#f4f1e8"]
  },
  {
    title: ["अर्थी टोन", "Earth tones"],
    combo: ["ऑलिव टॉप · क्रीम पैंट · ब्राउन जूते", "Olive top · cream trousers · brown shoes"],
    colors: ["#69734b", "#e7dfc8", "#79523a"]
  },
  {
    title: ["सॉफ्ट पेस्टल", "Soft pastels"],
    combo: ["लैवेंडर टॉप · ऑफ़-व्हाइट पैंट · सफ़ेद जूते", "Lavender top · off-white trousers · white shoes"],
    colors: ["#b8a2df", "#e9e5dd", "#f4f1e8"]
  },
  {
    title: ["बोल्ड कॉन्ट्रास्ट", "Bold contrast"],
    combo: ["मरून टॉप · चारकोल पैंट · काले जूते", "Burgundy top · charcoal trousers · black shoes"],
    colors: ["#792d49", "#41414b", "#24232a"]
  },
  {
    title: ["डेनिम क्लासिक", "Denim classic"],
    combo: ["सफ़ेद शर्ट · ब्लू जींस · सफ़ेद स्नीकर्स", "White shirt · blue jeans · white sneakers"],
    colors: ["#f4f1e8", "#416b9a", "#f4f1e8"]
  },
  {
    title: ["ब्लैक एंड ग्रे", "Black and gray"],
    combo: ["ब्लैक टॉप · ग्रे पैंट · सफ़ेद या काले जूते", "Black top · gray trousers · white or black shoes"],
    colors: ["#292832", "#96959b", "#f4f1e8"]
  },
  {
    title: ["स्काई ब्लू", "Sky blue"],
    combo: ["स्काई ब्लू टॉप · बेज पैंट · टैन जूते", "Sky-blue top · beige trousers · tan shoes"],
    colors: ["#79b9dc", "#d9c8a4", "#b48758"]
  },
  {
    title: ["ज्वेल टोन", "Jewel tones"],
    combo: ["एमराल्ड टॉप · काली पैंट · काले जूते", "Emerald top · black trousers · black shoes"],
    colors: ["#14745b", "#292832", "#24232a"]
  },
  {
    title: ["रस्ट और नेवी", "Rust and navy"],
    combo: ["रस्ट टॉप · नेवी पैंट · ब्राउन जूते", "Rust top · navy trousers · brown shoes"],
    colors: ["#b65e3b", "#263b67", "#79523a"]
  },
  {
    title: ["क्रीम और ऑलिव", "Cream and olive"],
    combo: ["क्रीम टॉप · ऑलिव पैंट · टैन जूते", "Cream top · olive trousers · tan shoes"],
    colors: ["#e7dfc8", "#69734b", "#b48758"]
  },
  {
    title: ["पिंक पेस्टल", "Pink pastel"],
    combo: ["सॉफ्ट पिंक टॉप · ग्रे पैंट · सफ़ेद जूते", "Soft-pink top · gray trousers · white shoes"],
    colors: ["#e9a6b8", "#96959b", "#f4f1e8"]
  }
];

function createOutfitIllustration(idea, title) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 120 140");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", title);
  svg.setAttribute("focusable", "false");

  const backdrop = document.createElementNS(namespace, "rect");
  backdrop.setAttribute("x", "5");
  backdrop.setAttribute("y", "5");
  backdrop.setAttribute("width", "110");
  backdrop.setAttribute("height", "130");
  backdrop.setAttribute("rx", "18");
  backdrop.setAttribute("fill", "rgba(183, 162, 255, 0.1)");
  svg.appendChild(backdrop);

  const garments = [
    {
      path: "M36 16 22 23 12 43 25 49 31 38 31 63 89 63 89 38 95 49 108 43 98 23 84 16 70 23 50 23Z",
      color: idea.colors[0]
    },
    {
      path: "M34 66 86 66 81 112 65 112 60 81 55 112 39 112Z",
      color: idea.colors[1]
    },
    {
      path: "M39 111 53 111 53 119Q50 124 29 124L23 122Q26 117 39 111Z",
      color: idea.colors[2]
    },
    {
      path: "M67 111 81 111 96 120Q99 121 97 124L67 124Z",
      color: idea.colors[2]
    }
  ];

  for (const garment of garments) {
    const shape = document.createElementNS(namespace, "path");
    shape.setAttribute("d", garment.path);
    shape.setAttribute("fill", garment.color);
    shape.setAttribute("stroke", "rgba(255, 255, 255, 0.45)");
    shape.setAttribute("stroke-width", "1.5");
    shape.setAttribute("stroke-linejoin", "round");
    svg.appendChild(shape);
  }

  return svg;
}

function createEthnicDesignVisual(type, colors, title) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 160 180");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", title);
  svg.setAttribute("focusable", "false");

  const backdrop = document.createElementNS(namespace, "rect");
  backdrop.setAttribute("x", "8");
  backdrop.setAttribute("y", "8");
  backdrop.setAttribute("width", "144");
  backdrop.setAttribute("height", "164");
  backdrop.setAttribute("rx", "28");
  backdrop.setAttribute("fill", "rgba(255, 255, 255, 0.045)");
  svg.appendChild(backdrop);

  const garmentGroup = document.createElementNS(namespace, "g");
  garmentGroup.classList.add("design-fabric");
  const garments = type === "saree"
    ? [
      ["M48 53 111 53 103 157 55 157Z", colors[0], "design-skirt"],
      ["M49 28 35 35 27 58 45 64 52 48 53 62 93 62 94 48 101 64 119 58 108 35 94 28 82 36 61 36Z", colors[1], "design-blouse"],
      ["M82 34Q96 43 112 58L133 102Q115 93 101 85L91 61Z", colors[2], "design-pallu"],
      ["M54 145Q79 151 105 145", "none", "design-border"]
    ]
    : type === "lehenga"
      ? [
        ["M49 34 36 40 29 62 48 66 54 51 57 64 91 64 94 51 101 66 120 62 110 40 96 34 83 42 61 42Z", colors[1], "design-blouse"],
        ["M60 66 91 66Q101 106 124 153Q80 166 36 153Q54 111 60 66Z", colors[0], "design-skirt"],
        ["M51 112Q80 121 109 112M44 137Q80 147 116 137", "none", "design-border"],
        ["M95 38Q120 44 131 74L117 83 105 64Z", colors[2], "design-pallu"]
      ]
      : type === "salwar"
        ? [
          ["M53 30 39 36 31 63 48 68 55 52 57 119 103 119 105 52 112 68 129 63 118 36 103 30 88 39 68 39Z", colors[0], "design-suit"],
          ["M68 39 80 54 92 39 87 119 73 119Z", colors[1], "design-detail"],
          ["M59 117 78 117 73 158 50 158 54 143ZM84 117 103 117 110 143 114 158 90 158Z", colors[1], "design-pants"],
          ["M105 37Q128 49 132 84L119 103 106 91 115 68Z", colors[2], "design-pallu"]
        ]
      : [
        ["M53 30 39 36 31 63 48 68 55 52 57 119 102 119 104 52 111 68 128 63 118 36 103 30 88 39 68 39Z", colors[0], "design-suit"],
        ["M68 40 80 54 92 40 88 119 72 119Z", colors[1], "design-detail"],
        ["M109 38Q131 51 131 91L118 115 106 103 115 78Z", colors[2], "design-pallu"],
        ["M57 115 73 115 69 158 54 158ZM87 115 102 115 107 158 92 158Z", colors[1], "design-pants"]
      ];

  for (const [pathData, color, className] of garments) {
    const shape = document.createElementNS(namespace, "path");
    shape.setAttribute("d", pathData);
    shape.setAttribute("fill", color);
    shape.setAttribute("stroke", "#f2d89b");
    shape.setAttribute("stroke-width", className === "design-border" ? "2" : "1.5");
    shape.setAttribute("stroke-linejoin", "round");
    shape.classList.add(className);
    garmentGroup.appendChild(shape);
  }

  svg.appendChild(garmentGroup);
  return svg;
}

function renderEthnicDesign(outfit) {
  const section = document.getElementById("designIdea");
  const visual = document.getElementById("designVisual");
  if (!section || !visual) return;

  if (!outfit.design_type || !outfit.design_details) {
    section.hidden = true;
    visual.replaceChildren();
    return;
  }

  const title = translateText(outfit.design_title || "डिज़ाइन आइडिया");
  const palette = Array.isArray(outfit.design_colors)
    ? outfit.design_colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 3)
    : [];
  const colors = palette.length === 3
    ? palette
    : ["#842c52", "#d5b36a", "#f1dfbd"];
  visual.replaceChildren(createEthnicDesignVisual(
    outfit.design_type,
    colors,
    title
  ));
  document.getElementById("designIdeaTitle").textContent = title;
  document.getElementById("designDetails").textContent =
    translateText(outfit.design_details);
  section.hidden = false;
}

function renderColorCombinations() {
  const list = document.getElementById("colorCombinationList");
  if (!list) return;

  list.replaceChildren();
  const languageIndex = appLanguage === "en" ? 1 : 0;

  for (const [index, idea] of colorCombinationIdeas.entries()) {
    const card = document.createElement("article");
    card.className = "color-combination-card";
    card.style.animationDelay = `${index * 35}ms`;

    const titleText = idea.title[languageIndex];
    const illustration = createOutfitIllustration(idea, titleText);
    illustration.classList.add("color-combination-illustration");

    const details = document.createElement("div");
    details.className = "color-combination-details";

    const title = document.createElement("strong");
    title.textContent = titleText;

    const combination = document.createElement("p");
    combination.textContent = idea.combo[languageIndex];

    details.append(title, combination);
    card.append(illustration, details);
    list.appendChild(card);
  }
}


function translateVisibleMessages() {
  document.querySelectorAll(
    "#errorMessage, #saveMessage, #wardrobeMessage"
  ).forEach((element) => {
    element.textContent = translateText(element.textContent);
  });
}

function renderWeatherOutfitImages(outfit) {
  const container = document.getElementById("weatherOutfitImages");
  const itemFields = [
    { field: "top", labels: ["ऊपर", "Top"] },
    { field: "bottom", labels: ["नीचे", "Bottom"] },
    { field: "shoes", labels: ["जूते", "Shoes"] }
  ];
  const figures = itemFields.flatMap(({ field, labels }) => {
    const imageUrl = outfit.item_images?.[field];
    if (typeof imageUrl !== "string" || !imageUrl) return [];

    const figure = document.createElement("button");
    figure.type = "button";
    figure.className = "weather-outfit-image";
    figure.title = appLanguage === "en"
      ? `View ${outfit[field]} larger`
      : `${outfit[field]} की बड़ी फोटो देखें`;
    figure.addEventListener("click", () => showOutfitImagePreview(imageUrl, outfit[field]));
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = outfit[field] || labels[0];
    image.loading = "lazy";
    const caption = document.createElement("span");
    caption.className = "weather-outfit-image-label";
    caption.textContent = labels[appLanguage === "en" ? 1 : 0];
    figure.append(image, caption);
    return [figure];
  });
  container.replaceChildren(...figures);
  container.hidden = figures.length === 0;
}

function showOutfitImagePreview(imageUrl, itemName) {
  const dialog = document.getElementById("outfitImageDialog");
  const image = document.getElementById("outfitImageDialogPhoto");
  const name = document.getElementById("outfitImageDialogName");
  if (!dialog || !image || !name || typeof imageUrl !== "string" || !imageUrl) return;
  image.src = imageUrl;
  image.alt = itemName || "";
  name.textContent = itemName || "";
  if (!dialog.open) dialog.showModal();
}

const outfitImageDialog = document.getElementById("outfitImageDialog");
const closeOutfitImageDialog = document.getElementById("closeOutfitImageDialog");
if (outfitImageDialog && closeOutfitImageDialog) {
  closeOutfitImageDialog.addEventListener("click", () => outfitImageDialog.close());
  outfitImageDialog.addEventListener("click", (event) => {
    if (event.target === outfitImageDialog) outfitImageDialog.close();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const requestGeneration = ++planRequestGeneration;
  planRequestPending = true;
  errorMessage.textContent = "";
  saveMessage.textContent = "";

  const selection = {
    party_name: partySearchInput.value.trim(),
    audience: document.getElementById("outfitAudience").value,
    event_date: eventDateInput.value,
    location: eventLocationInput.value.trim(),
    language: appLanguage,
    variation: 0
  };
  currentVariation = 0;
  currentSelection = null;
  currentOutfit = null;
  lastOutfit = null;
  outfitTranslationRequest += 1;
  saveButton.disabled = true;
  nextOutfitButton.hidden = true;
  nextOutfitButton.disabled = true;
  outfitResult.hidden = true;
  resultPlaceholder.hidden = false;
  const placeholderText = resultPlaceholder.querySelector("p");
  if (placeholderText) {
    placeholderText.textContent = appLanguage === "en"
      ? "Building your updated party look…"
      : "तुम्हारा नया पार्टी लुक बनाया जा रहा है…";
  }
  const resultPanel = document.getElementById("resultPanel");
  resultPanel?.setAttribute("aria-busy", "true");

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector("span").textContent = translateText("मौसम और लुक देख रहे हैं…");

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection)
    });

    const data = await readJsonResponse(response);
    if (requestGeneration !== planRequestGeneration) return;

    if (!response.ok) {
      throw new Error(data.error || "लुक बनाते समय समस्या आई।");
    }

    currentSelection = data.selection;
    saveButton.disabled = false;
    showOutfit(data.outfit);
  } catch (error) {
    if (requestGeneration === planRequestGeneration) {
      errorMessage.textContent = translateText(error.message);
      if (placeholderText) {
        placeholderText.textContent = appLanguage === "en"
          ? "A new look could not be created. Check the message above and try again."
          : "नया लुक नहीं बन पाया। ऊपर का संदेश देखें और फिर कोशिश करें।";
      }
    }
  } finally {
    planRequestPending = false;
    updateNextOutfitLabel();
    button.disabled = false;
    resultPanel?.removeAttribute("aria-busy");
  button.querySelector("span").textContent = appLanguage === "en"
    ? "Suggest a party look"
    : "मेरी पार्टी का लुक बताओ";
  }
});

nextOutfitButton.addEventListener("click", async () => {
  if (!currentSelection || !currentOutfit || nextOutfitButton.disabled) return;

  const previousSelection = { ...currentSelection };
  const previousOutfit = { ...currentOutfit };
  const nextVariation = (currentVariation + 1) % 3;
  const requestGeneration = ++planRequestGeneration;
  planRequestPending = true;
  errorMessage.textContent = "";
  saveMessage.textContent = "";
  nextOutfitButton.disabled = true;
  saveButton.disabled = true;
  nextOutfitButton.querySelector("span").textContent = appLanguage === "en"
    ? "Finding another combination…"
    : "अगला मेल ढूँढ़ रहे हैं…";
  document.getElementById("resultPanel")?.setAttribute("aria-busy", "true");

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        party_name: previousSelection.party_type,
        audience: previousSelection.audience,
        weather: previousSelection.weather,
        language: appLanguage,
        ...(previousSelection.person_name
          ? { person_name: previousSelection.person_name }
          : {}),
        variation: nextVariation
      })
    });
    const data = await readJsonResponse(response);
    if (requestGeneration !== planRequestGeneration) return;
    if (!response.ok) throw new Error(data.error || "अगला लुक नहीं बन पाया।");

    currentVariation = nextVariation;
    currentSelection = {
      ...data.selection,
      location: previousSelection.location || "",
      event_date: previousSelection.event_date || null
    };
    const nextOutfit = {
      ...data.outfit,
      location: previousOutfit.location || "",
      event_date: previousOutfit.event_date,
      weather_details: previousOutfit.weather_details,
      weather_outfit: previousOutfit.weather_outfit,
      weather_tip: previousOutfit.weather_tip
    };
    saveButton.disabled = false;
    showOutfit(nextOutfit);
  } catch (error) {
    if (requestGeneration === planRequestGeneration) {
      errorMessage.textContent = translateText(error.message);
    }
  } finally {
    if (requestGeneration === planRequestGeneration) {
      planRequestPending = false;
      nextOutfitButton.disabled = !currentSelection;
      updateNextOutfitLabel();
      saveButton.disabled = !currentSelection;
      document.getElementById("resultPanel")?.removeAttribute("aria-busy");
    }
  }
});

function displayWardrobeItemName(name, category) {
  const rawName = typeof name === "string" ? name.trim() : "";
  const cleanName = rawName
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[._ -]?\d+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const compact = cleanName.toLowerCase().replace(/[^a-z]/g, "");
  const labels = {
    top: ["टी-शर्ट / टॉप", "T-shirt / top"],
    bottom: ["पैंट", "Pants"],
    shorts: ["शॉर्ट्स", "Shorts"],
    shoes: ["जूते", "Shoes"],
    accessory: ["एक्सेसरी", "Accessory"],
    eyewear: ["चश्मा", "Glasses"],
    perfume: ["परफ्यूम", "Perfume"],
    saree: ["साड़ी", "Saree"],
    salwar: ["सलवार-सूट", "Salwar suit"],
    lehenga: ["लहंगा", "Lehenga"],
    kurti: ["कुर्ती", "Kurti"]
  };
  const languageIndex = appLanguage === "en" ? 1 : 0;
  if (/^(tshirt|tshart|tee|tshirtshirt)$/.test(compact)) return appLanguage === "en" ? "T-shirt" : "टी-शर्ट";
  if (/^(jeans?|jeance|jens|denim)$/.test(compact)) return appLanguage === "en" ? "Jeans" : "जींस";
  if (/^(jute\d*|shoes?|footwear|sneakers?)$/.test(compact)) return appLanguage === "en" ? "Shoes" : "जूते";
  if (/^(shirt|shirts)$/.test(compact)) return appLanguage === "en" ? "Shirt" : "शर्ट";
  if (!cleanName || /\d/.test(cleanName)) return labels[category]?.[languageIndex] || (appLanguage === "en" ? "Clothing item" : "कपड़े का आइटम");
  const translated = translateText(cleanName);
  if (hasWrongLanguageScript(translated)) return labels[category]?.[languageIndex] || translated;
  return translated;
}

function renderAvoidTip(hasItems) {
  const section = document.getElementById("avoidSection");
  const tip = document.getElementById("avoidTip");
  const weather = currentSelection?.weather;
  section.hidden = !hasItems || !weather;
  if (!hasItems || !weather) return;
  const tips = {
    warm: ["भारी जैकेट, मोटे स्वेटर और बहुत गर्म कपड़ों से बचें। हल्के, हवादार कपड़े चुनें।", "Avoid heavy jackets, thick sweaters, and overly warm layers. Choose light, breathable clothes."],
    cold: ["पतले कपड़े और खुले जूते न पहनें। स्वेटर या जैकेट की परत और बंद जूते चुनें।", "Avoid thin layers and open shoes. Add a sweater or jacket and wear closed shoes."],
    rainy: ["फिसलने वाले जूते और जल्दी भीगने वाले कपड़ों से बचें। ग्रिप वाले बंद जूते चुनें।", "Avoid slippery shoes and clothes that soak easily. Choose closed shoes with good grip."]
  };
  tip.textContent = tips[weather]?.[appLanguage === "en" ? 1 : 0] || "";
}

function renderSavedWardrobeItems(outfit) {
  const fields = [
    ["outfitTopCard", "outfitTop", "top", "outfitTopSource"],
    ["outfitBottomCard", "outfitBottom", "bottom", "outfitBottomSource"],
    ["outfitShoesCard", "outfitShoes", "shoes", "outfitShoesSource"],
    ["outfitAccessoryCard", "outfitAccessory", "accessory", "outfitAccessorySource"],
  ];
  let visibleCount = 0;
  for (const [cardId, textId, field, sourceId] of fields) {
    const value = typeof outfit[field] === "string" ? outfit[field].trim() : "";
    const category = outfit.item_categories?.[field] || (field === "top" ? "top" : field === "bottom" ? currentSelection?.outfit_type || "bottom" : field);
    document.getElementById(textId).textContent = displayWardrobeItemName(value, category);
    document.getElementById(cardId).hidden = !value;
    const sourceBadge = document.getElementById(sourceId);
    const source = outfit.item_sources?.[field];
    sourceBadge.textContent = source === "saved_weather_adjusted"
      ? (appLanguage === "en" ? "Closet item + weather layer" : "अलमारी का कपड़ा + मौसम की परत")
      : source === "saved"
        ? (appLanguage === "en" ? "In your closet" : "तुम्हारी अलमारी")
        : (appLanguage === "en" ? "Suggested" : "सुझाव");
    sourceBadge.hidden = !value || !source;
    if (value) visibleCount += 1;
  }
  document.getElementById("emptyWardrobeLook").hidden = visibleCount > 0;
  document.getElementById("wearTitle").hidden = visibleCount === 0;
  const suitabilityWarning = document.getElementById("partySuitabilityWarning");
  const missingWardrobeItems = Array.isArray(outfit.missing_wardrobe_items)
    ? outfit.missing_wardrobe_items
    : Array.isArray(outfit.suggested_wedding_items)
      ? outfit.suggested_wedding_items
      : [];
  suitabilityWarning.hidden = missingWardrobeItems.length === 0;
  if (missingWardrobeItems.length) {
    const labels = appLanguage === "en"
      ? { top: "a suitable top", bottom: "a matching bottom", shoes: "party shoes", accessory: "a party accessory" }
      : { top: "उपयुक्त टॉप", bottom: "मैचिंग बॉटम", shoes: "पार्टी के जूते", accessory: "पार्टी एक्सेसरी" };
    const missing = missingWardrobeItems.map((item) => labels[item] || item).join(", ");
    suitabilityWarning.textContent = appLanguage === "en"
      ? `Not in your closet yet: ${missing}. Add them to complete your saved-clothes look.`
      : `ये चीज़ें अभी अलमारी में नहीं हैं: ${missing}। इन्हें जोड़ने पर पूरा लुक बनेगा।`;
  }
  updateGoogleImagesButton(outfit, visibleCount);
  renderAvoidTip(visibleCount > 0);
  saveButton.disabled = visibleCount === 0;
  return visibleCount;
}

function updateGoogleImagesButton(outfit, visibleCount) {
  const button = document.getElementById("googleImagesButton");
  if (!button) return;

  const partyTerms = {
    wedding: "Indian wedding guest outfit",
    birthday: "Indian birthday party outfit",
    casual: "Indian casual party outfit",
    night: "Indian night party outfit"
  };
  const audienceTerms = {
    men: "for men",
    women: "for women",
    children: "for children",
    senior: "comfortable outfit for older adults"
  };
  const styleTerms = {
    casual: "casual style",
    smart: "smart style",
    bold: "bold style"
  };
  const query = [
    partyTerms[currentSelection?.party_type],
    audienceTerms[currentSelection?.audience],
    styleTerms[currentSelection?.style],
    outfit.top,
    outfit.bottom,
    outfit.shoes
  ].filter((part) => typeof part === "string" && part.trim()).join(" ");
  const generatedUrl = outfit.google_images_url;
  button.href = typeof generatedUrl === "string"
    && generatedUrl.startsWith("https://www.google.com/search?tbm=isch&q=")
    ? generatedUrl
    : `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  button.hidden = visibleCount === 0;
}

function showOutfit(outfit) {
  currentOutfit = outfit;
  renderEthnicDesign(outfit);
  updateOutfitItemLabels(
    currentSelection?.audience,
    currentOutfit?.item_categories?.bottom || currentSelection?.outfit_type
  );
  document.getElementById("partyName").textContent = outfit.party_name;
  document.getElementById("styleName").textContent =
    `${outfit.audience_name} · ${outfit.style_name} स्टाइल`;
  renderSavedWardrobeItems(outfit);
  document.getElementById("weatherTip").textContent = outfit.weather_tip;
  const colorTip = outfit.color_tip;
  const colorTipBox = document.getElementById("colorTipBox");
  document.getElementById("colorTip").textContent =
    colorTip && typeof colorTip === "object"
      ? (colorTip[appLanguage] || colorTip.hi || "")
      : "";
  colorTipBox.hidden = !document.getElementById("colorTip").textContent;
  document.getElementById("weatherOutfit").textContent = outfit.weather_outfit || "";
  document.getElementById("weatherOutfitBox").hidden = !outfit.weather_outfit;
  document.querySelector(".weather-tip").hidden = !outfit.weather_tip;
  renderWeatherOutfitImages(outfit);
  renderLookWeather(
    currentSelection?.weather,
    currentOutfit?.weather_details,
    currentSelection?.location,
    currentSelection?.event_date
  );
  const imageFields = {
    outfitTopImage: "top",
    outfitBottomImage: "bottom",
    outfitShoesImage: "shoes",
    outfitAccessoryImage: "accessory"
  };
  for (const [elementId, field] of Object.entries(imageFields)) {
    const image = document.getElementById(elementId);
    const imageLink = image.closest(".outfit-image-link");
    const imageUrl = outfit.item_images?.[field];
    if (typeof imageUrl === "string" && imageUrl) {
      image.alt = outfit[field] || "";
      image.hidden = true;
      imageLink.classList.remove("has-wardrobe-image");
      imageLink.disabled = true;
      imageLink.removeAttribute("title");
      image.dataset.requestedUrl = imageUrl;
      const updateImageState = () => {
        if (image.dataset.requestedUrl !== imageUrl) return;
        const loaded = image.naturalWidth > 0;
        image.hidden = !loaded;
        imageLink.classList.toggle("has-wardrobe-image", loaded);
        if (loaded) {
          imageLink.disabled = false;
          imageLink.title = appLanguage === "en"
            ? `View ${outfit[field]} larger`
            : `${outfit[field]} की बड़ी फोटो देखें`;
          imageLink.onclick = () => showOutfitImagePreview(imageUrl, outfit[field]);
        } else {
          imageLink.disabled = true;
          imageLink.onclick = null;
          imageLink.removeAttribute("title");
        }
      };
      image.onload = updateImageState;
      image.onerror = updateImageState;
      image.removeAttribute("src");
      image.src = imageUrl;
    } else {
      image.dataset.requestedUrl = "";
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.alt = "";
      image.hidden = true;
      imageLink.classList.remove("has-wardrobe-image");
      imageLink.disabled = true;
      imageLink.onclick = null;
      imageLink.removeAttribute("title");
    }
  }

  resultPlaceholder.hidden = true;
  outfitResult.hidden = false;
  nextOutfitButton.hidden = false;
  nextOutfitButton.disabled = false;
  updateNextOutfitLabel();
  outfitResult.classList.remove("outfit-enter");
  requestAnimationFrame(() => outfitResult.classList.add("outfit-enter"));
}

function updateOutfitItemLabels(audience, outfitType) {
  const labelsByType = {
    saree: ["ब्लाउज़", "साड़ी", "जूते", "एक्सेसरी", "चश्मा", "परफ्यूम"],
    salwar: ["कुर्ती / सूट", "सलवार / पैंट", "जूते", "एक्सेसरी", "चश्मा", "परफ्यूम"],
    lehenga: ["चोली", "लहंगा", "जूते", "एक्सेसरी", "चश्मा", "परफ्यूम"],
    kurti: ["कुर्ती", "पैंट / स्कर्ट", "जूते", "एक्सेसरी", "चश्मा", "परफ्यूम"]
  };
  const labelsEnglish = {
    saree: ["Blouse", "Saree", "Shoes", "Accessory", "Glasses", "Perfume"],
    salwar: ["Kurta / suit", "Salwar / pants", "Shoes", "Accessory", "Glasses", "Perfume"],
    lehenga: ["Choli", "Lehenga", "Shoes", "Accessory", "Glasses", "Perfume"],
    kurti: ["Kurti", "Pants / skirt", "Shoes", "Accessory", "Glasses", "Perfume"]
  };
  const defaultHindi = ["ऊपर", "नीचे", "जूते", "एक्सेसरी", "चश्मा", "परफ्यूम"];
  const defaultEnglish = ["Top", "Bottom", "Shoes", "Accessory", "Glasses", "Perfume"];
  const isTraditionalLook = audience === "women" && labelsByType[outfitType];
  const labels = isTraditionalLook
    ? (appLanguage === "en" ? labelsEnglish[outfitType] : labelsByType[outfitType])
    : (appLanguage === "en" ? defaultEnglish : defaultHindi);

  document.querySelectorAll(".outfit-category-label").forEach((item, index) => {
    item.textContent = labels[index] || "";
  });
}

function renderLookWeather(weather, details, location, eventDate) {
  const element = document.getElementById("lookWeather");
  if (!element || !weather) return;
  const labels = {
    warm: ["गर्मी", "Warm"],
    cold: ["ठंड", "Cold"],
    rainy: ["बारिश", "Rainy"]
  };
  const label = labels[weather]?.[appLanguage === "en" ? 1 : 0] || weather;
  const temperature = details
    && Number.isFinite(details.temperature_min)
    && Number.isFinite(details.temperature_max)
    ? ` · ${Math.round(details.temperature_min)}–${Math.round(details.temperature_max)}°C`
    : "";
  const rainChance = details && Number.isFinite(details.precipitation_probability)
    ? appLanguage === "en"
      ? ` · ${Math.round(details.precipitation_probability)}% rain chance`
      : ` · बारिश की संभावना ${Math.round(details.precipitation_probability)}%`
    : "";
  const climateRain = details && Number.isFinite(details.precipitation_sum)
    ? appLanguage === "en"
      ? ` · estimated precipitation ${details.precipitation_sum.toFixed(1)} mm`
      : ` · अनुमानित वर्षा ${details.precipitation_sum.toFixed(1)} मिमी`
    : "";
  const snow = details && Number.isFinite(details.snowfall_sum) && details.snowfall_sum > 0
    ? appLanguage === "en"
      ? ` · possible snow ${details.snowfall_sum.toFixed(1)} cm`
      : ` · संभावित बर्फ़ ${details.snowfall_sum.toFixed(1)} सेमी`
    : "";
  const date = eventDate
    ? ` · ${new Intl.DateTimeFormat(
      appLanguage === "en" ? "en" : "hi",
      { dateStyle: "medium" }
    ).format(new Date(`${eventDate}T00:00:00`))}`
    : "";
  const place = location ? ` · ${location}` : "";
  const isEstimate = details?.is_estimate === true;
  const estimateLabel = details?.source === "historical_monthly_normal"
    ? appLanguage === "en"
      ? "Past 5-year monthly average (estimate)"
      : "पिछले 5 वर्षों का मासिक औसत (अनुमान)"
    : appLanguage === "en"
      ? "Climate estimate (not a forecast; CMIP6 / Open-Meteo)"
      : "जलवायु अनुमान (वास्तविक पूर्वानुमान नहीं; CMIP6 / Open-Meteo)";
  element.textContent = appLanguage === "en"
    ? `${isEstimate ? estimateLabel : "Weather"}: ${label}${temperature}${isEstimate ? climateRain : rainChance}${snow}${place}${date}`
    : `${isEstimate ? estimateLabel : "मौसम"}: ${label}${temperature}${isEstimate ? climateRain : rainChance}${snow}${place}${date}`;
}

saveButton.addEventListener("click", async () => {
  if (!currentSelection) {
    saveMessage.textContent = translateText("पहले अपना लुक बनाओ।");
    return;
  }

  saveButton.disabled = true;
  saveMessage.textContent = translateText("सेव हो रहा है…");

  try {
    const response = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...currentSelection, outfit: currentOutfit })
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "लुक सेव नहीं हो पाया।");
    }

    saveMessage.textContent = "✓ " + translateText(data.message);
    await loadHistory();
  } catch (error) {
    saveMessage.textContent = translateText(error.message);
  } finally {
    saveButton.disabled = false;
  }
});

function wardrobePhotoName(file, index) {
  const sourceName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const translated = translateText(sourceName);
  if (
    translated
    && !hasWrongLanguageScript(translated)
    && !/^(?:img|dsc|pxl|screenshot|photo|image)\s*\d*$/i.test(translated)
  ) {
    return translated.slice(0, 60);
  }
  return (appLanguage === "en" ? `Clothing item ${index + 1}` : `कपड़ा ${index + 1}`).slice(0, 60);
}

function selectedWardrobePhotoCount() {
  return wardrobeImageInput.files?.length || 0;
}

function updateWardrobePhotoCount() {
  const count = selectedWardrobePhotoCount();
  const countLabel = document.getElementById("wardrobeImageCount");
  countLabel.hidden = count === 0;
  const categoryName = translateText(categoryNames[wardrobeCategoryInput.value] || "कपड़े");
  countLabel.textContent = appLanguage === "en"
    ? `${count} photo${count === 1 ? "" : "s"} selected for ${categoryName}.`
    : `${categoryName} के लिए ${count} फोटो चुनी गईं।`;
}

function wardrobeItemMatchesSearch(item, query) {
  const queryTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (queryTerms.length === 0) return true;

  const searchableText = [
    item.name,
    item.category,
    categoryNames[item.category],
    item.audience,
    wardrobeAudienceNames[item.audience],
    ...(wardrobePartyNames[item.party_tag] || [])
  ].filter(Boolean).join(" ").toLocaleLowerCase();
  const categoryAliases = wardrobeSearchCategoryAliases[item.category] || [];
  return queryTerms.every((term) =>
    searchableText.includes(term) || categoryAliases.includes(term)
  );
}

wardrobeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  wardrobeMessage.textContent = "";

  const selectedPhotos = Array.from(wardrobeImageInput.files || []);
  const enteredName = document.getElementById("wardrobeName").value.trim();
  const aiIdentifyEnabled = document.getElementById("wardrobeAiIdentify").checked;
  if (!enteredName && selectedPhotos.length === 0) {
    wardrobeMessage.textContent = translateText("कपड़े का नाम लिखें या फोटो चुनें।");
    return;
  }
  if (selectedPhotos.length > 20) {
    wardrobeMessage.textContent = translateText("एक बार में अधिकतम 20 फोटो चुनें।");
    return;
  }

  const addButton = wardrobeForm.querySelector('button[type="submit"]');
  addButton.disabled = true;
  let added = 0;
  const failures = [];
  const itemsToAdd = selectedPhotos.length ? selectedPhotos : [null];

  try {
    for (const [index, photo] of itemsToAdd.entries()) {
      const formData = new FormData();
      const autoIdentify = Boolean(photo && aiIdentifyEnabled);
      const itemName = autoIdentify
        ? (selectedPhotos.length === 1 ? enteredName : "")
        : (selectedPhotos.length > 1 || (!enteredName && photo)
          ? wardrobePhotoName(photo, index)
          : enteredName);
      formData.set("name", itemName);
      formData.set("category", wardrobeCategoryInput.value);
      formData.set("audience", document.getElementById("wardrobeAudience").value);
      formData.set("party_tag", document.getElementById("wardrobeParty").value);
      formData.set("auto_identify", String(autoIdentify));
      formData.set("language", appLanguage);
      if (photo) formData.set("image", photo);

      addButton.textContent = autoIdentify
        ? (appLanguage === "en"
          ? `Recognizing ${index + 1}/${itemsToAdd.length}…`
          : `${index + 1}/${itemsToAdd.length} फोटो पहचान रहे हैं…`)
        : selectedPhotos.length > 1
          ? (appLanguage === "en" ? `Adding ${index + 1}/${itemsToAdd.length}…` : `${index + 1}/${itemsToAdd.length} जोड़े जा रहे हैं…`)
          : translateText("जोड़ा जा रहा है…");

      try {
        const response = await fetch("/api/wardrobe", { method: "POST", body: formData });
        const data = await readJsonResponse(response);
        if (!response.ok) throw new Error(data.error || "कपड़ा नहीं जुड़ पाया।");
        added += 1;
      } catch (error) {
        failures.push(error.message);
      }
    }

    if (added > 0) {
      wardrobeForm.reset();
      clearWardrobeImagePreview();
      updateWardrobePhotoCount();
      await loadWardrobe();
    }

    if (failures.length) {
      const summary = appLanguage === "en"
        ? `${added} of ${itemsToAdd.length} items added; ${failures.length} could not be added.`
        : `${itemsToAdd.length} में से ${added} कपड़े जुड़ गए; ${failures.length} नहीं जुड़ पाए।`;
      wardrobeMessage.textContent = `${summary} ${translateText(failures[0])}`;
    } else {
      wardrobeMessage.textContent = appLanguage === "en"
        ? `${added} item${added === 1 ? "" : "s"} added to your wardrobe.`
        : `${added} कपड़े अलमारी में जोड़ दिए गए।`;
    }
  } finally {
    addButton.disabled = false;
    addButton.textContent = translateText("＋ अलमारी में जोड़ो");
  }
});

async function loadWardrobe() {
  try {
    const response = await fetch("/api/wardrobe");
    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "अलमारी लोड नहीं हो पाई।");
    }

    wardrobeItemsCache = Array.isArray(data.items) ? data.items : [];
    wardrobeCount.textContent = wardrobeItemsCache.length;
    emptyWardrobe.hidden = wardrobeItemsCache.length > 0;
    renderWardrobeItems();
  } catch (error) {
    wardrobeItemsCache = [];
    wardrobeList.replaceChildren();
    emptyWardrobe.hidden = false;
    emptyWardrobe.textContent = translateText(error.message);
    wardrobeSearchEmpty.hidden = true;
  }
  translateCards();
}

function renderWardrobeItems() {
  const query = wardrobeSearch.value.trim().toLocaleLowerCase();
  const matchingItems = wardrobeItemsCache.filter((item) =>
    wardrobeItemMatchesSearch(item, query)
  );

  wardrobeList.replaceChildren(
    ...matchingItems.map((item) => createWardrobeCard(item))
  );
  emptyWardrobe.hidden = wardrobeItemsCache.length > 0;
  wardrobeSearchEmpty.hidden = !query || matchingItems.length > 0;
}

wardrobeSearch.addEventListener("input", renderWardrobeItems);

function createWardrobeCard(item) {
  const card = document.createElement("article");
  card.className = "history-card";

  const title = document.createElement("h3");
  title.textContent = displayWardrobeItemName(item.name, item.category);

  const details = document.createElement("p");
  const category = translateText(categoryNames[item.category] || item.category);
  const audience = translateText(wardrobeAudienceNames[item.audience] || item.audience);
  const partyTag = wardrobePartyNames[item.party_tag]?.[appLanguage === "en" ? 1 : 0]
    || wardrobePartyNames.any[appLanguage === "en" ? 1 : 0];
  details.textContent = `${audience} · ${category} · ${partyTag}`;

  const actions = document.createElement("div");
  actions.className = "wardrobe-card-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "wardrobe-edit-button";
  editButton.dataset.action = "rename";
  editButton.textContent = "✎";
  editButton.title = appLanguage === "en" ? "Edit item name and party tag" : "नाम या पार्टी tag बदलें";
  editButton.setAttribute("aria-label", editButton.title);
  editButton.addEventListener("click", () => startWardrobeItemRename(item, title, actions));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = appLanguage === "en" ? "Delete" : "हटाएँ";
  deleteButton.addEventListener("click", () => deleteWardrobeItem(item.id));
  actions.append(editButton, deleteButton);

  if (item.image_url) {
    const image = document.createElement("img");
    image.className = "wardrobe-item-image";
    image.src = item.image_url;
    image.alt = title.textContent;
    image.loading = "lazy";
    card.append(image);
  }
  card.append(title, details, actions);
  return card;
}

function startWardrobeItemRename(item, title, actions) {
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 60;
  input.className = "wardrobe-rename-input";
  input.value = item.name;
  input.setAttribute("aria-label", appLanguage === "en" ? "New item name" : "कपड़े का नया नाम");

  const partySelect = document.createElement("select");
  partySelect.className = "wardrobe-party-edit-select";
  partySelect.setAttribute("aria-label", appLanguage === "en" ? "Party tag" : "पार्टी tag");
  for (const [value, labels] of Object.entries(wardrobePartyNames)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[appLanguage === "en" ? 1 : 0];
    partySelect.append(option);
  }
  partySelect.value = item.party_tag || "any";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "wardrobe-rename-save";
  saveButton.textContent = appLanguage === "en" ? "Save" : "सेव";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "wardrobe-rename-cancel";
  cancelButton.textContent = appLanguage === "en" ? "Cancel" : "रद्द";
  cancelButton.addEventListener("click", renderWardrobeItems);

  const editingControls = document.createElement("div");
  editingControls.className = "wardrobe-card-actions";
  editingControls.append(saveButton, cancelButton);
  const editor = document.createElement("div");
  editor.className = "wardrobe-item-editor";
  editor.append(input, partySelect);
  title.replaceWith(editor);
  actions.replaceWith(editingControls);
  input.focus();
  input.select();

  const saveName = async () => {
    const name = input.value.trim();
    if (!name) {
      wardrobeMessage.textContent = translateText("नाम खाली नहीं हो सकता।");
      input.focus();
      return;
    }
    const partyTag = partySelect.value;
    if (name === item.name && partyTag === (item.party_tag || "any")) {
      renderWardrobeItems();
      return;
    }

    saveButton.disabled = true;
    try {
      const response = await fetch(`/api/wardrobe/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, party_tag: partyTag })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "नाम सेव नहीं हो पाया।");
      wardrobeMessage.textContent = "✓ " + translateText(data.message);
      await loadWardrobe();
    } catch (error) {
      wardrobeMessage.textContent = translateText(error.message);
      saveButton.disabled = false;
      input.focus();
    }
  };

  saveButton.addEventListener("click", saveName);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveName();
    if (event.key === "Escape") renderWardrobeItems();
  });
}

function clearWardrobeImagePreview() {
  wardrobeImageInput.value = "";
  wardrobeImagePreview.removeAttribute("src");
  wardrobeImagePreviewBox.hidden = true;
  updateWardrobePhotoCount();
  if (wardrobeImagePreviewUrl) URL.revokeObjectURL(wardrobeImagePreviewUrl);
  wardrobeImagePreviewUrl = null;
}

wardrobeImageInput.addEventListener("change", () => {
  wardrobeMessage.textContent = "";
  const photos = Array.from(wardrobeImageInput.files || []);
  if (!photos.length) {
    clearWardrobeImagePreview();
    return;
  }
  if (selectedWardrobePhotoCount() > 20) {
    wardrobeMessage.textContent = translateText("एक बार में अधिकतम 20 फोटो चुनें।");
    clearWardrobeImagePreview();
    return;
  }
  if (photos.some((photo) => !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) {
    wardrobeMessage.textContent = translateText("JPG, PNG या WebP कपड़ों की फोटो चुनें।");
    clearWardrobeImagePreview();
    return;
  }
  if (photos.some((photo) => photo.size > 5 * 1024 * 1024)) {
    wardrobeMessage.textContent = translateText("कपड़ों की फोटो 5 MB से छोटी होनी चाहिए।");
    clearWardrobeImagePreview();
    return;
  }

  if (wardrobeImagePreviewUrl) URL.revokeObjectURL(wardrobeImagePreviewUrl);
  wardrobeImagePreviewUrl = URL.createObjectURL(photos[0]);
  wardrobeImagePreview.src = wardrobeImagePreviewUrl;
  wardrobeImagePreviewBox.hidden = false;
  updateWardrobePhotoCount();
});

document.getElementById("removeWardrobeImage").addEventListener(
  "click",
  clearWardrobeImagePreview
);

async function deleteWardrobeItem(id) {
  wardrobeMessage.textContent = "";

  try {
    const response = await fetch(`/api/wardrobe/${id}`, {
      method: "DELETE"
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "कपड़ा हटाया नहीं जा सका।");
    }

    wardrobeMessage.textContent = "✓ " + translateText(data.message);
    await loadWardrobe();
  } catch (error) {
    wardrobeMessage.textContent = translateText(error.message);
  }
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  const emptyHistory = document.getElementById("emptyHistory");
  const historyCount = document.getElementById("historyCount");

  try {
    const response = await fetch("/api/outfits");
    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "सेव किए लुक लोड नहीं हो पाए।");
    }

    historyList.replaceChildren();
    historyCount.textContent = data.outfits.length;
    emptyHistory.hidden = data.outfits.length > 0;

    for (const saved of data.outfits) {
      historyList.appendChild(createHistoryCard(saved));
    }
  } catch (error) {
    historyList.replaceChildren();
    emptyHistory.hidden = false;
    emptyHistory.textContent = translateText(error.message);
  }
  translateCards();
}

function createHistoryCard(saved) {
  const card = document.createElement("article");
  card.className = "history-card";

  const title = document.createElement("h3");
  const translatedTitle = translateText(
    `${saved.outfit.party_name} · ${saved.outfit.style_name}`
  );
  title.textContent = hasWrongLanguageScript(translatedTitle)
    ? (appLanguage === "en" ? "Saved look" : "सेव किया लुक")
    : translatedTitle;

  const details = document.createElement("p");
  const outfitParts = [
    ["👕", saved.outfit.top], ["👖", saved.outfit.bottom],
    ["👟", saved.outfit.shoes], ["⌚", saved.outfit.accessory]
  ].filter(([, value]) => typeof value === "string" && value.trim())
    .map(([icon, value]) => `${icon} ${value.trim()}`);
  const translatedDetails = translateText(
    outfitParts.join(" · ") || (appLanguage === "en" ? "No wardrobe items saved" : "कोई कपड़ा सेव नहीं था")
  );
  details.textContent = hasWrongLanguageScript(translatedDetails)
    ? (appLanguage === "en" ? "Outfit details" : "लुक का विवरण")
    : translatedDetails;

  const designDetails = saved.outfit.design_details
    ? document.createElement("p")
    : null;
  if (designDetails) {
    const translatedDesign = translateText(
      `🎨 ${saved.outfit.design_title}: ${saved.outfit.design_details}`
    );
    designDetails.textContent = hasWrongLanguageScript(translatedDesign)
      ? (appLanguage === "en" ? "Design details" : "डिज़ाइन का विवरण")
      : translatedDesign;
  }

  const date = document.createElement("p");
  const eventDate = saved.outfit.event_date
    ? `${saved.outfit.event_date} · `
    : "";
  date.textContent = translateText(`${eventDate}सेव किया: ${saved.created_at}`);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = translateText("हटाएँ");
  deleteButton.addEventListener("click", () => deleteOutfit(saved.id));

  const images = document.createElement("div");
  images.className = "saved-look-images";
  for (const [field, imageUrl] of Object.entries(saved.outfit.item_images || {})) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = saved.outfit[field] || field;
    image.loading = "lazy";
    images.append(image);
  }

  card.append(title, details);
  if (images.childElementCount) card.appendChild(images);
  if (designDetails) card.appendChild(designDetails);
  card.append(date, deleteButton);
  return card;
}

async function deleteOutfit(id) {
  try {
    const response = await fetch(`/api/outfits/${id}`, {
      method: "DELETE"
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "लुक हटाया नहीं जा सका।");
    }

    await loadHistory();
  } catch (error) {
    alert(translateText(error.message));
  }
}

loadWardrobe();
loadHistory();
const languageSelect = document.getElementById("languageSelect");
let appLanguage = localStorage.getItem("lookbook-language") || "hi";

const englishText = {
  "पुरुष": "Men", "महिला": "Women",
  "बच्चे": "Children", "बुज़ुर्ग": "Older adult",
  "वयस्क": "Adult", "सबके लिए": "Everyone",
  "सलवार-सूट": "Salwar suit", "लहंगा": "Lehenga", "कुर्ती": "Kurti",
  "एआई": "AI", "तस्वीर": "image", "झलक": "preview", "चश्मा": "Glasses",
  "परफ्यूम": "Perfume",
  "आरामदायक इलास्टिक-कमर शॉर्ट्स": "Comfortable elastic-waist shorts",
  "आरामदायक उत्सवी कुर्ता": "Comfortable festive kurta",
  "आरामदायक एथनिक जूते": "Comfortable ethnic shoes",
  "आरामदायक कार्गो ट्राउज़र": "Comfortable cargo trousers",
  "आरामदायक कॉटन टी-शर्ट": "Comfortable cotton T-shirt",
  "आरामदायक कॉटन ट्राउज़र": "Comfortable cotton trousers",
  "आरामदायक कॉटन शॉर्ट्स": "Comfortable cotton shorts",
  "आरामदायक कॉलर वाली शर्ट": "Comfortable collared shirt",
  "आरामदायक चिनो ट्राउज़र": "Comfortable chino trousers",
  "आरामदायक जूती": "Comfortable jutti",
  "आरामदायक पायजामा": "Comfortable pajama trousers",
  "आरामदायक लो-टॉप स्नीकर्स": "Comfortable low-top sneakers",
  "आसान फिटिंग वाले ट्राउज़र": "Easy-fit trousers",
  "इलास्टिक-कमर वाले ट्राउज़र": "Elastic-waist trousers",
  "कुशन वाले फ्लैट एथनिक जूते": "Cushioned flat ethnic shoes",
  "कुशन वाले फ्लैट जूते": "Cushioned flat shoes",
  "कुशन वाले लो-हील जूते": "Cushioned low-heel shoes",
  "कुशन वाले स्नीकर्स": "Cushioned sneakers",
  "कॉलर वाली कॉटन शर्ट": "Collared cotton shirt",
  "कॉलर वाली गहरे रंग की शर्ट": "Collared dark-colored shirt",
  "गहरे रंग का सांस लेने वाला टॉप": "Breathable dark-colored top",
  "गहरे रंग की आरामदायक टी-शर्ट": "Comfortable dark-colored T-shirt",
  "ग्रिप वाले आरामदायक जूते": "Comfortable shoes with grip",
  "ग्रिप वाले एथनिक जूते": "Ethnic shoes with grip",
  "ग्रिप वाले फ्लैट जूते": "Flat shoes with grip",
  "ग्रिप वाले लो-हील जूते": "Low-heel shoes with grip",
  "ग्रिप वाले स्नीकर्स": "Sneakers with grip",
  "प्रिंटेड शर्ट": "Printed shirt",
  "मज़ेदार प्रिंट वाली टी-शर्ट": "Fun printed T-shirt",
  "रंगीन आरामदायक उत्सवी टॉप": "Colorful comfortable festive top",
  "रंगीन आरामदायक टॉप": "Colorful comfortable top",
  "रंगीन उत्सवी कुर्ता": "Colorful festive kurta",
  "रंगीन कैप": "Colorful cap",
  "रंगीन कॉटन टी-शर्ट": "Colorful cotton T-shirt",
  "रंगीन कॉटन शॉर्ट्स": "Colorful cotton shorts",
  "रंगीन प्रिंट वाली शर्ट": "Colorful printed shirt",
  "लिनेन शर्ट या ट्यूनिक": "Linen shirt or tunic",
  "सांस लेने वाला उत्सवी कुर्ता या ट्यूनिक": "Breathable festive kurta or tunic",
  "सांस लेने वाला सूती टॉप": "Breathable cotton top",
  "सांस लेने वाली कॉटन टी-शर्ट": "Breathable cotton T-shirt",
  "साफ़-सुथरा उत्सवी कुर्ता": "Neat festive kurta",
  "सॉफ्ट कॉटन ट्राउज़र": "Soft cotton trousers",
  "सॉफ्ट-फिट चिनो शॉर्ट्स": "Soft-fit chino shorts",
  "सॉफ्ट-फिट ट्राउज़र": "Soft-fit trousers",
  "सॉफ्ट-फिट पायजामा": "Soft-fit pajama trousers",
  "सॉफ्ट-फिट शॉर्ट्स": "Soft-fit shorts",
  "हल्का उत्सवी कुर्ता": "Lightweight festive kurta",
  "हल्का स्कार्फ": "Lightweight scarf",
  "हल्का स्टोल": "Lightweight stole",
  "हल्का स्वेटर": "Lightweight sweater",
  "हल्की कैप": "Lightweight cap",
  "हल्की घड़ी": "Lightweight watch",
  "हल्की जैकेट": "Lightweight jacket",
  "हल्की नेहरू जैकेट": "Lightweight Nehru jacket",
  "हल्के कॉटन शॉर्ट्स": "Lightweight cotton shorts",
  "बर्थडे पार्टी": "Birthday party", "शादी की पार्टी": "Wedding party",
  "कैज़ुअल पार्टी": "Casual party", "नाइट पार्टी": "Night party",
  "कैज़ुअल": "Casual", "स्मार्ट": "Smart", "बोल्ड": "Bold",
  "पारंपरिक पोशाक": "Traditional outfit",
  "कोई भी स्टाइल": "Any style",
  "साड़ी, लहंगा या सूट": "Saree, lehenga, or suit",
  "स्ट्रेट-फिट जींस": "Straight-fit jeans",
  "ग्रिप वाले लो-हील जूते": "Low-heel shoes with grip",
  "कपड़ों का साइज़": "Clothing size",
  "कोई भी / फ्री साइज़": "Any / free size",
  "साइज़": "Size",

  "हल्की नीली ऑक्सफ़ोर्ड शर्ट": "Light blue Oxford shirt",
  "सफ़ेद शर्ट और नेवी ब्लेज़र": "White shirt with navy blazer",
  "मरून टेक्सचर्ड शर्ट": "Maroon textured shirt",
  "हल्के रंग का कुर्ता": "Light-colored kurta",
  "आइवरी कुर्ता और नेहरू जैकेट": "Ivory kurta with Nehru jacket",
  "ज्वेल-टोन बंदगला": "Jewel-tone bandhgala",
  "सॉलिड रंग की टी-शर्ट": "Solid-color T-shirt",
  "लिनेन शर्ट": "Linen shirt",
  "प्रिंटेड ओवरशर्ट": "Printed overshirt",
  "ब्लैक पोलो टी-शर्ट": "Black polo T-shirt",
  "ब्लैक फिटेड शर्ट": "Fitted black shirt",
  "डीप वाइन रंग की शर्ट": "Deep wine shirt",

  "डार्क ब्लू चिनोज़": "Dark blue chinos",
  "चारकोल ट्राउज़र": "Charcoal trousers",
  "ब्लैक जींस": "Black jeans",
  "सफ़ेद पायजामा": "White pajama",
  "क्रीम ट्राउज़र": "Cream trousers",
  "मैचिंग फॉर्मल ट्राउज़र": "Matching formal trousers",
  "स्ट्रेट-फिट ब्लू जींस": "Straight-fit blue jeans",
  "बेज चिनोज़": "Beige chinos",
  "ब्लैक कार्गो पैंट": "Black cargo pants",
  "डार्क जींस": "Dark jeans",
  "ब्लैक ट्राउज़र": "Black trousers",
  "कॉटन शॉर्ट्स": "Cotton shorts",
  "टेलर्ड चिनो शॉर्ट्स": "Tailored chino shorts",
  "डेनिम या कार्गो शॉर्ट्स": "Denim or cargo shorts",
  "डेनिम शॉर्ट्स": "Denim shorts",
  "टेलर्ड शॉर्ट्स": "Tailored shorts",
  "हाई-वेस्ट शॉर्ट्स": "High-waisted shorts",
  "लंबी पैंट": "Long pants",
  "शॉर्ट्स": "Shorts",

  "सफ़ेद स्नीकर्स": "White sneakers",
  "ब्राउन लोफ़र्स": "Brown loafers",
  "ब्लैक बूट्स": "Black boots",
  "ब्राउन जूती": "Brown jutti",
  "टैन लोफ़र्स": "Tan loafers",
  "फॉर्मल जूते": "Formal shoes",
  "आरामदायक स्नीकर्स": "Comfortable sneakers",
  "सुएड लोफ़र्स": "Suede loafers",
  "हाई-टॉप स्नीकर्स": "High-top sneakers",
  "ब्लैक स्नीकर्स": "Black sneakers",
  "ब्लैक लोफ़र्स": "Black loafers",

  "क्लासिक घड़ी": "Classic watch",
  "लेदर बेल्ट": "Leather belt",
  "सिल्वर ब्रेसलेट": "Silver bracelet",
  "पॉकेट स्क्वेयर": "Pocket square",
  "कैज़ुअल घड़ी": "Casual watch",
  "कैप": "Cap",
  "मिनिमल घड़ी": "Minimal watch",
  "सिल्वर चेन": "Silver chain",

  "पेस्टल ब्लाउज़": "Pastel blouse",
  "हाई-वेस्ट जींस": "High-waisted jeans",
  "हूप इयररिंग्स": "Hoop earrings",
  "पेस्टल ब्लेज़र और टॉप": "Pastel blazer and top",
  "टेलर्ड ट्राउज़र": "Tailored trousers",
  "ब्लॉक हील्स": "Block heels",
  "मिनिमल नेकलेस": "Minimal necklace",
  "सीक्विन टॉप": "Sequin top",
  "ब्लैक स्कर्ट": "Black skirt",
  "स्ट्रैपी हील्स": "Strappy heels",
  "स्टेटमेंट इयररिंग्स": "Statement earrings",
  "अनारकली कुर्ता": "Anarkali kurta",
  "चूड़ीदार": "Churidar",
  "एम्बेलिश्ड सैंडल": "Embellished sandals",
  "चूड़ियाँ": "Bangles",
  "साड़ी ब्लाउज़": "Saree blouse",
  "साड़ी": "Saree",
  "सिल्क साड़ी": "Silk saree",
  "फ्लोरल कॉटन साड़ी ब्लाउज़": "Floral cotton saree blouse",
  "हल्की फ्लोरल कॉटन साड़ी": "Light floral cotton saree",
  "फ्लैट एथनिक सैंडल": "Flat ethnic sandals",
  "सिल्क साड़ी ब्लाउज़": "Silk saree blouse",
  "आरामदायक ब्लॉक हील्स": "Comfortable block heels",
  "ज्वेल-टोन साड़ी ब्लाउज़": "Jewel-tone saree blouse",
  "बॉर्डर वाली साटन साड़ी": "Satin saree with a border",
  "कॉटन सलवार-कुर्ती सेट": "Cotton salwar-kurti set",
  "कॉटन सलवार और आरामदायक पैंट": "Cotton salwar with comfortable pants",
  "कढ़ाईदार अनारकली सलवार सूट": "Embroidered Anarkali salwar suit",
  "आरामदायक चूड़ीदार": "Comfortable churidar",
  "ब्लॉक हील्स या फ्लैट जूती": "Block heels or flat juttis",
  "हल्का मैचिंग दुपट्टा": "Light matching dupatta",
  "ज्वेल-टोन सलवार सूट": "Jewel-tone salwar suit",
  "पलाज़ो या चूड़ीदार": "Palazzo pants or churidar",
  "कॉन्ट्रास्ट दुपट्टा": "Contrast dupatta",
  "हल्की फ्यूज़न चोली": "Light fusion choli",
  "फ्लोरल प्रिंट लहंगा": "Floral-print lehenga",
  "बारीक कढ़ाईदार चोली": "Finely embroidered choli",
  "मिरर-वर्क लहंगा स्कर्ट": "Mirror-work lehenga skirt",
  "फ्लोई स्कर्ट": "Flowy skirt",
  "आरामदायक लो-हील जूते": "Comfortable low-heel shoes",
  "अगर बच्चा चश्मा पहनता है तो उसका अच्छी फिटिंग वाला अपना चश्मा रखें।": "If the child wears glasses, use their own well-fitting pair.",
  "बच्चों के लिए हल्की, अभिभावक द्वारा चुनी खुशबू।": "A mild, parent-approved fragrance for children.",
  "हल्की खुशबू वाला परफ्यूम; थोड़ी मात्रा में लगाएँ।": "Light perfume; use a small amount.",
  "अपना रोज़ का चश्मा; आरामदायक फ्रेम चुनें।": "Wear your usual glasses with a comfortable frame.",
  "ज़रूरत हो तो अपना पसंदीदा चश्मा; बाहर की पार्टी में धूप का चश्मा।": "Wear your preferred glasses if needed; choose sunglasses for an outdoor party.",
  "सलवार-सूट डिज़ाइन": "Salwar suit design",
  "हल्के कॉटन का आरामदायक सलवार सूट, छोटे प्रिंट और आसानी से बाँधा जाने वाला दुपट्टा।": "Comfortable light-cotton salwar suit with a small print and an easy-to-drape dupatta.",
  "अनारकली कट सलवार सूट, नाज़ुक कढ़ाई और हल्का मैचिंग दुपट्टा।": "Anarkali-cut salwar suit with delicate embroidery and a light matching dupatta.",
  "ज्वेल-टोन सलवार सूट, कॉन्ट्रास्ट बॉर्डर और आकर्षक दुपट्टा।": "Jewel-tone salwar suit with a contrast border and a statement dupatta.",
  "हील्स": "Heels",
  "क्लासिक ज्वेलरी": "Classic jewelry",
  "लहंगा चोली": "Lehenga choli",
  "मैचिंग लहंगा स्कर्ट": "Matching lehenga skirt",
  "एम्बेलिश्ड हील्स": "Embellished heels",
  "स्टेटमेंट ज्वेलरी": "Statement jewelry",
  "आरामदायक टी-शर्ट": "Comfortable T-shirt",
  "स्नीकर्स": "Sneakers",
  "छोटे हूप्स": "Small hoops",
  "लिनेन ब्लाउज़": "Linen blouse",
  "बेज ट्राउज़र": "Beige trousers",
  "लोफ़र्स": "Loafers",
  "प्रिंटेड टॉप": "Printed top",
  "ब्लैक टॉप": "Black top",
  "मिनिमल इयररिंग्स": "Minimal earrings",
  "साटन शर्ट": "Satin shirt",
  "स्टेटमेंट नेकलेस": "Statement necklace",
  "मेटैलिक टॉप": "Metallic top",
  "बोल्ड इयररिंग्स": "Bold earrings",
  "फ्लोरल कुर्ती": "Floral kurti",
  "पलाज़ो पैंट": "Palazzo pants",
  "जूतियाँ": "Juttis",
  "छोटे झुमके": "Small jhumka earrings",
  "कढ़ाईदार अनारकली सूट": "Embroidered Anarkali suit",
  "झुमके": "Jhumka earrings",
  "फ्यूज़न लहंगा चोली": "Fusion lehenga choli",
  "हल्का उत्सवी सलवार सूट": "Light festive salwar suit",
  "हल्का दुपट्टा": "Light dupatta",
  "कॉटन कुर्ती": "Cotton kurti",
  "आरामदायक जूतियाँ": "Comfortable juttis",
  "लिनेन कुर्ता": "Linen kurta",
  "प्रिंटेड फ्यूज़न कुर्ती": "Printed fusion kurti",
  "मैचिंग स्कर्ट": "Matching skirt",
  "सॉफ्ट फैब्रिक कुर्ती": "Soft-fabric kurti",
  "आरामदायक सैंडल": "Comfortable sandals",
  "साटन साड़ी ब्लाउज़": "Satin saree blouse",
  "साटन साड़ी": "Satin saree",
  "ज्वेल-टोन लहंगा चोली": "Jewel-tone lehenga choli",
  "डिज़ाइन आइडिया": "Design idea",
  "साड़ी डिज़ाइन": "Saree design",
  "लहंगा डिज़ाइन": "Lehenga design",
  "सूट डिज़ाइन": "Suit design",
  "कुर्ती डिज़ाइन": "Kurti design",
  "हल्की कॉटन साड़ी पर छोटे फ्लोरल प्रिंट, पतला कॉन्ट्रास्ट बॉर्डर और आरामदायक मैचिंग ब्लाउज़।": "Light cotton saree with small floral prints, a slim contrast border, and a comfortable matching blouse.",
  "सिल्क साड़ी पर नाज़ुक ज़री बॉर्डर, सादा मैचिंग ब्लाउज़ और साफ़-सुथरी प्लीटेड ड्रेप।": "Silk saree with a delicate zari border, a simple matching blouse, and a neatly pleated drape.",
  "ज्वेल-टोन साटन साड़ी पर उभरा हुआ एम्बेलिश्ड बॉर्डर और स्टेटमेंट ब्लाउज़।": "Jewel-tone satin saree with a detailed embellished border and a statement blouse.",
  "हल्के फ्लोरल प्रिंट वाला फ्लोई लहंगा, सिंपल चोली और हल्का दुपट्टा।": "Flowy lehenga with a light floral print, simple choli, and lightweight dupatta.",
  "सॉफ्ट शिमर फैब्रिक का फ्लेयर्ड लहंगा, बारीक कढ़ाई वाली चोली और मैचिंग दुपट्टा।": "Flared lehenga in soft shimmer fabric with a finely embroidered choli and matching dupatta.",
  "ज्वेल-टोन लहंगे पर मिरर या सीक्विन वर्क, आकर्षक चोली और ड्रेप्ड दुपट्टा।": "Jewel-tone lehenga with mirror or sequin work, a statement choli, and a draped dupatta.",
  "सांस लेने वाले कॉटन का स्ट्रेट-कट सूट, हल्का प्रिंट और सॉफ्ट कॉन्ट्रास्ट दुपट्टा।": "Straight-cut suit in breathable cotton with a light print and soft contrast dupatta.",
  "अनारकली कट पर नाज़ुक एम्ब्रॉयडरी, साफ़ चूड़ीदार और हल्का मैचिंग दुपट्टा।": "Anarkali cut with delicate embroidery, neat churidar, and a lightweight matching dupatta.",
  "रिच ज्वेल-टोन सूट पर कढ़ाईदार नेकलाइन, स्लीव बॉर्डर और मैचिंग दुपट्टा।": "Rich jewel-tone suit with an embroidered neckline, sleeve borders, and matching dupatta.",
  "सॉफ्ट कॉटन कुर्ती पर छोटे फ्लोरल प्रिंट, आरामदायक पलाज़ो और सिंपल जूतियाँ।": "Soft cotton kurti with small floral prints, comfortable palazzo pants, and simple juttis.",
  "लिनेन कुर्ती में साफ़ स्ट्रेट कट, हल्की कढ़ाई और मिनिमल एक्सेसरीज़।": "Linen kurti with a clean straight cut, subtle embroidery, and minimal accessories.",
  "कॉन्ट्रास्ट प्रिंट या मिरर-वर्क कुर्ती के साथ फ्लोई स्कर्ट और बोल्ड इयररिंग्स।": "Kurti with contrast print or mirror work, paired with a flowy skirt and bold earrings.",

  "रंगीन कॉटन टी-शर्ट": "Colorful cotton T-shirt",
  "आरामदायक कॉलर वाली शर्ट": "Comfortable collared shirt",
  "मज़ेदार प्रिंट वाली टी-शर्ट": "Fun printed T-shirt",
  "हल्का उत्सवी कुर्ता": "Lightweight festive kurta",
  "साफ़-सुथरा उत्सवी कुर्ता": "Neat festive kurta",
  "रंगीन उत्सवी कुर्ता": "Colorful festive kurta",
  "आरामदायक कॉटन टी-शर्ट": "Comfortable cotton T-shirt",
  "कॉलर वाली कॉटन शर्ट": "Collared cotton shirt",
  "प्रिंटेड शर्ट": "Printed shirt",
  "गहरे रंग की आरामदायक टी-शर्ट": "Comfortable dark-colored T-shirt",
  "कॉलर वाली गहरे रंग की शर्ट": "Collared dark-colored shirt",
  "रंगीन प्रिंट वाली शर्ट": "Colorful printed shirt",
  "सॉफ्ट कॉटन ट्राउज़र": "Soft cotton trousers",
  "सॉफ्ट-फिट ट्राउज़र": "Soft-fit trousers",
  "आरामदायक कॉटन ट्राउज़र": "Comfortable cotton trousers",
  "आरामदायक पायजामा": "Comfortable pajama trousers",
  "सॉफ्ट-फिट पायजामा": "Soft-fit pajama trousers",
  "आरामदायक चिनो ट्राउज़र": "Comfortable chino trousers",
  "आरामदायक कार्गो ट्राउज़र": "Comfortable cargo trousers",
  "ग्रिप वाले स्नीकर्स": "Sneakers with grip",
  "आरामदायक स्नीकर्स": "Comfortable sneakers",
  "ग्रिप वाले एथनिक जूते": "Ethnic shoes with grip",
  "आरामदायक एथनिक जूते": "Comfortable ethnic shoes",
  "आरामदायक जूती": "Comfortable jutti",
  "आरामदायक लो-टॉप स्नीकर्स": "Comfortable low-top sneakers",
  "हल्की कैप": "Lightweight cap",
  "रंगीन कैप": "Colorful cap",
  "हल्की जैकेट": "Lightweight jacket",
  "हल्का स्वेटर": "Lightweight sweater",
  "हल्की नेहरू जैकेट": "Lightweight Nehru jacket",
  "सांस लेने वाला सूती टॉप": "Breathable cotton top",
  "इलास्टिक-कमर वाले ट्राउज़र": "Elastic-waist trousers",
  "कुशन वाले फ्लैट जूते": "Cushioned flat shoes",
  "हल्की घड़ी": "Lightweight watch",
  "लिनेन शर्ट या ट्यूनिक": "Linen shirt or tunic",
  "आसान फिटिंग वाले ट्राउज़र": "Easy-fit trousers",
  "ग्रिप वाले आरामदायक जूते": "Comfortable shoes with grip",
  "हल्का स्टोल": "Lightweight stole",
  "रंगीन आरामदायक टॉप": "Colorful comfortable top",
  "कुशन वाले लो-हील जूते": "Cushioned low-heel shoes",
  "हल्का स्कार्फ": "Lightweight scarf",
  "आरामदायक उत्सवी कुर्ता": "Comfortable festive kurta",
  "कुशन वाले फ्लैट एथनिक जूते": "Cushioned flat ethnic shoes",
  "सांस लेने वाला उत्सवी कुर्ता या ट्यूनिक": "Breathable festive kurta or tunic",
  "ग्रिप वाले फ्लैट जूते": "Flat shoes with grip",
  "रंगीन आरामदायक उत्सवी टॉप": "Colorful comfortable festive top",
  "सांस लेने वाली कॉटन टी-शर्ट": "Breathable cotton T-shirt",
  "कुशन वाले स्नीकर्स": "Cushioned sneakers",
  "आरामदायक लो-हील जूते": "Comfortable low-heel shoes",
  "गहरे रंग का सांस लेने वाला टॉप": "Breathable dark-colored top",
  "आरामदायक कॉटन शॉर्ट्स": "Comfortable cotton shorts",
  "सॉफ्ट-फिट चिनो शॉर्ट्स": "Soft-fit chino shorts",
  "रंगीन कॉटन शॉर्ट्स": "Colorful cotton shorts",
  "हल्के कॉटन शॉर्ट्स": "Lightweight cotton shorts",
  "आरामदायक इलास्टिक-कमर शॉर्ट्स": "Comfortable elastic-waist shorts",
  "सॉफ्ट-फिट शॉर्ट्स": "Soft-fit shorts",
  "बच्चे के लिए आरामदायक गर्म परतें साथ रखें।": "Bring comfortable warm layers for the child.",
  "बारिश में बच्चे के लिए ग्रिप वाले, पानी से बचाने वाले जूते चुनें।": "For rainy weather, choose water-resistant shoes with grip for the child.",
  "गर्मी में बच्चे के लिए हल्के, सांस लेने वाले कपड़े चुनें।": "Choose light, breathable clothes for the child in warm weather.",
  "ठंड में आरामदायक, हल्की परतें रखें जिन्हें आसानी से पहना जा सके।": "Choose comfortable, lightweight layers that are easy to put on in cold weather.",
  "बारिश में ग्रिप वाले, आरामदायक जूते चुनें।": "Choose comfortable shoes with grip for rainy weather.",
  "गर्मी में हल्के, सांस लेने वाले और आरामदायक कपड़े चुनें।": "Choose light, breathable, comfortable clothes for warm weather.",

  " + गर्म जैकेट/कोट": " + a warm jacket or coat",
  " + गर्म शॉल": " + a warm shawl",
  " + थर्मल इनर": " + thermal base layer",
  "गर्म मोज़ों के साथ बंद पार्टी जूते": "Closed party shoes with warm socks",
  " + गर्म स्कार्फ": " + a warm scarf",
  " + हल्की वाटरप्रूफ जैकेट": " + a light waterproof jacket",
  "जल्दी सूखने वाला ": "Quick-drying ",
  "ग्रिप वाले वाटरप्रूफ बंद जूते": "Grippy waterproof closed-toe shoes",
  " + छाता": " + an umbrella",

  "ठंड के लिए जैकेट या ब्लेज़र साथ रखें।": "Bring a jacket or blazer for cold weather.",
  "बर्फ़ की संभावना है—गर्म परतें, ऊनी मोज़े और ग्रिप वाले वाटरप्रूफ जूते रखें।": "Snow is possible—pack warm layers, wool socks, and grippy waterproof shoes.",
  "बारिश में पानी से कम खराब होने वाले जूते चुनें।": "Choose shoes that can handle rain.",
  "गर्मी में हल्के और आरामदायक कपड़े चुनें।": "Choose light, comfortable clothes for warm weather.",
  "मेरी अलमारी से लुक सुझाओ": "Suggest a look from my wardrobe",
  "मौसम और लुक देख रहे हैं…": "Checking the weather and planning your look…",
  "अगले 16 दिनों में वास्तविक मौसम देखें; आगे की तारीख के लिए जगह का मौसमी अनुमान लेकर कपड़े अपने आप चुनेंगे।": "Live forecasts are used for the next 16 days; farther dates use a destination-based climate estimate to suggest outfits.",
  "इस तारीख के लिए मौसमी जानकारी उपलब्ध नहीं है। 2050 या उससे पहले की तारीख चुनें।": "Climate estimates are available only through 2050. Choose a date on or before 2050.",
  "जलवायु अनुमान (वास्तविक पूर्वानुमान नहीं; CMIP6 / Open-Meteo)": "Climate estimate (not a forecast; CMIP6 / Open-Meteo)",
  "कार्यक्रम की तारीख आज या आने वाले दिनों में होनी चाहिए।": "The event date must be today or a future date.",
  "कार्यक्रम की सही तारीख चुनें।": "Choose a valid event date.",
  "यह शहर या venue map पर नहीं मिला।": "This city or venue could not be found on the map.",
  "मौसम सेवा ने इस तारीख का अनुमान नहीं दिया।": "The weather service has no forecast for this date.",
  "मौसम सेवा ने अधूरा अनुमान दिया।": "The weather service returned an incomplete forecast.",
  "इस जगह का मौसम अभी नहीं मिल पाया। जगह जाँचें और फिर कोशिश करें।": "The weather for this location could not be retrieved. Check the location and try again.",
  "पार्टी, तारीख, जगह और लुक के लिए नाम भरें।": "Enter the occasion, date, location, and name for the look.",
  "पार्टी की जानकारी सही नहीं है।": "The party details are invalid.",
  "पार्टी का नाम, मौसम और लुक के लिए नाम जाँचें।": "Check the party name, weather, and name for the look.",
  "पार्टी के लिए सही tag चुनें।": "Choose a valid party tag for this item.",
  "Map की जानकारी सही नहीं है।": "The map details are invalid.",
  "Map के लिए जगह और current location जाँचें।": "Check the venue and current location for the map.",
  "तुमने जानकारी बदली है; लुक फिर से बनाओ।": "You changed the details; create the look again.",
  "कार्यक्रम की तारीख सही नहीं है।": "The event date is invalid.",
  "लुक की फोटो जानकारी सही नहीं है।": "The outfit photo information is invalid.",
  "अलमारी की फोटो नहीं मिली।": "A wardrobe photo could not be found.",
  "शादी की पार्टी": "Wedding party",
  "पार्टी / समारोह": "Party / celebration",

  "शर्ट / टॉप": "Shirt / top", "पैंट": "Pants", "जूते": "Shoes",
  "मौसम": "Weather", "सभी मौसम": "All weather",
  "एक्सेसरी": "Accessory", "कपड़े का नाम": "Item name",
  "कपड़े का प्रकार": "Item type", "किसकी अलमारी?": "Whose wardrobe?",
  "कपड़े का नाम लिखें (अधिकतम 60 अक्षर)।": "Enter an item name (up to 60 characters).",
  "कपड़े का सही प्रकार चुनें।": "Choose a valid item type.",
  "यह कपड़ा किसकी अलमारी का है, सही विकल्प चुनें।": "Choose whose wardrobe this item belongs to.",
  "रंग का नाम 30 अक्षरों से छोटा रखें।": "Keep the color name under 30 characters.",
  "कपड़ों का सही साइज़ चुनें।": "Choose a valid clothing size.",
  "साइज़ का विकल्प सिर्फ कपड़ों के लिए है।": "Sizes are only available for clothing.",
  "कपड़ा अलमारी में जोड़ दिया गया।": "Item added to your wardrobe.",
  "यह कपड़ा नहीं मिला।": "Item not found.",
  "कपड़ा अलमारी से हटा दिया गया।": "Item removed from your wardrobe.",
  "कृपया पहले लॉगिन करें।": "Please log in first.",
  "GROQ_API_KEY सेट नहीं है।": "GROQ_API_KEY is not set.",
  "पहले अपनी फोटो चुनें।": "Choose a photo first.",
  "पार्टी, मौसम, स्टाइल और कपड़ों के विकल्प जाँचें।": "Check the party, weather, style, and clothing options.",
  "फोटो 5 MB से छोटी होनी चाहिए।": "The photo must be smaller than 5 MB.",
  "JPG, PNG या WebP फोटो चुनें।": "Choose a JPG, PNG, or WebP photo.",
  "यह सही image फ़ाइल नहीं लगती।": "This does not appear to be a valid image file.",
  "फोटो से सुझाव नहीं बन पाया। फिर कोशिश करें।": "Could not create a suggestion from the photo. Try again.",
  "पार्टी, मौसम, स्टाइल, किसके लिए और नीचे के कपड़े जाँचें।": "Check the party, weather, style, audience, and bottom options.",
  "पहले सही पार्टी, मौसम, स्टाइल और कपड़ों के विकल्प चुनें।": "Choose valid party, weather, style, and clothing options first.",
  "दिख रहे लुक की जानकारी सही नहीं है।": "The displayed look details are invalid.",
  "लुक सेव हो गया!": "Look saved!",
  "सेव किए लुक लोड नहीं हो पाए।": "Could not load saved looks.",
  "यह सेव किया हुआ लुक नहीं मिला।": "Saved look not found.",
  "लुक हटा दिया गया।": "Look deleted.",
  "सेव किया:": "Saved:",
  "लुक बनाते समय समस्या आई।": "Something went wrong while creating the look.",
  "पहले अपना लुक बनाओ।": "Create a look first.",
  "सेव हो रहा है…": "Saving…",
  "लुक सेव नहीं हो पाया।": "Could not save the look.",
  "कपड़ा नहीं जुड़ पाया।": "Could not add the item.",
  "फोटो से कपड़े का नाम और प्रकार नहीं पहचान पाए। साफ़ फोटो चुनें या AI पहचान बंद करके जोड़ें।": "Could not identify this photo. Use a clear image or turn off AI recognition to add it manually.",
  "AI पहचान के लिए फोटो चुनें।": "Choose a photo for AI recognition.",
  "Groq ने API key या मॉडल access अस्वीकार किया। backend/.env में GROQ_API_KEY जाँचें।": "Groq rejected the API key or model access. Check GROQ_API_KEY in backend/.env.",
  "Groq की rate limit या usage limit पूरी है। थोड़ी देर बाद फिर कोशिश करें।": "The Groq rate or usage limit has been reached. Please try again later.",
  "Groq ने फोटो request अस्वीकार की। Flask terminal में कारण देखें।": "Groq rejected the photo request. Check the Flask terminal for details.",
  "Groq से फोटो पहचान सेवा अभी उपलब्ध नहीं है। Flask terminal देखें और फिर कोशिश करें।": "Photo recognition is temporarily unavailable from Groq. Check the Flask terminal and retry.",
  "कपड़े का नाम लिखें या फोटो चुनें।": "Enter an item name or choose a photo.",
  "एक बार में अधिकतम 20 फोटो चुनें।": "Choose up to 20 photos at a time.",
  "जोड़ा जा रहा है…": "Adding…",
  "＋ अलमारी में जोड़ो": "＋ Add to wardrobe",
  "अलमारी लोड नहीं हो पाई।": "Could not load the wardrobe.",
  "कपड़े की जानकारी सही नहीं है।": "The wardrobe item details are invalid.",
  "कपड़े का नाम या पार्टी tag बदलें।": "Update the item name or party tag.",
  "कपड़े की जानकारी अपडेट कर दी गई।": "The wardrobe item was updated.",
  "कपड़े का पार्टी tag बदल दिया गया।": "The party tag was updated.",
  "कपड़ा हटाया नहीं जा सका।": "Could not remove the item.",
  "सेव किए लुक लोड नहीं हो पाए।": "Could not load saved looks.",
  "लुक हटाया नहीं जा सका।": "Could not delete the look.",
  "JPG, PNG या WebP फोटो चुनें।": "Choose a JPG, PNG, or WebP photo.",
  "मेरी जगह से रास्ता दिखाओ": "Show route from my location",
  "इस browser में location की सुविधा उपलब्ध नहीं है।": "This browser does not support location access.",
  "Location की अनुमति नहीं मिली। Browser में अनुमति देकर फिर कोशिश करें।": "Location permission was denied. Allow it in your browser and retry.",
  "आपकी current location नहीं मिल पाई। उपलब्ध होने पर फिर कोशिश करें।": "Could not read your current location. Retry when location is available.",
  "पार्टी आउटफिट प्लानर का sample कपड़ों का catalog देखें": "Browse Party Outfit Planner's built-in clothing catalog",
  "पूरी sample अलमारी जोड़ें": "Add the full sample wardrobe",
  "sample items आपकी अलमारी में जोड़ दिए गए।": "sample items were added to your wardrobe.",
  "आपकी अलमारी में sample items पहले से हैं।": "Sample items are already in your wardrobe.",
  "Map library load नहीं हुई। पेज refresh करके फिर कोशिश करें।": "The map library did not load. Refresh the page and retry.",
  "Sample wardrobe add नहीं हुई।": "Could not add the sample wardrobe.",
  "Catalog load नहीं हो पाया।": "Could not load the catalog.",
  "Map route नहीं बन पाया।": "Could not create the map route.",
  "कार्यक्रम का venue map पर नहीं मिला।": "The event venue could not be found on the map.",
  "इस स्थान तक कोई सड़क मार्ग नहीं मिला।": "No driving route was found to this location.",
  "Map route अभी नहीं बन पाया। थोड़ी देर बाद फिर कोशिश करें।": "The map route could not be created. Try again shortly.",
  "कपड़े की फोटो 5 MB से छोटी होनी चाहिए।": "The clothing photo must be smaller than 5 MB.",
  "JPG, PNG या WebP कपड़ों की फोटो चुनें।": "Choose a JPG, PNG, or WebP clothing photo.",
  "कपड़ों की फोटो का resolution बहुत बड़ा है।": "The clothing photo resolution is too large.",
  "यह मान्य JPG, PNG या WebP फोटो नहीं है।": "This is not a valid JPG, PNG, or WebP photo.",
  "इस कपड़े की फोटो नहीं मिली।": "The photo for this item was not found."
};

function translateText(text) {
  const translations = Object.entries(englishText)
    .sort((a, b) => b[0].length - a[0].length);

  if (appLanguage === "en") {
    return translations.reduce(
      (value, [hindi, english]) => value.replaceAll(hindi, english),
      text
    );
  }

  return translations.reduce(
    (value, [hindi, english]) => value.replaceAll(english, hindi),
    text
  );
}

function setEnglish(selector, english, asHtml = false, hindi = null) {
  const element = document.querySelector(selector);
  if (!element) return;

  if ("placeholder" in element) {
    if (!("hindiPlaceholder" in element.dataset)) {
      element.dataset.hindiPlaceholder = element.placeholder;
    }

    element.placeholder = appLanguage === "en"
      ? english
      : element.dataset.hindiPlaceholder;
    return;
  }

  const key = asHtml ? "hindiHtml" : "hindiText";
  if (!(key in element.dataset)) {
    element.dataset[key] = hindi ?? (asHtml ? element.innerHTML : element.textContent);
  }

  if (appLanguage === "en") {
    if (asHtml) element.innerHTML = english;
    else element.textContent = english;
  } else {
    if (asHtml) element.innerHTML = element.dataset[key];
    else element.textContent = element.dataset[key];
  }
}

function setOption(selector, english) {
  setEnglish(selector, english);
}

function setDatalistOptions(id, hindiValues, englishValues) {
  const list = document.getElementById(id);
  if (!list) return;
  const values = appLanguage === "en" ? englishValues : hindiValues;
  list.replaceChildren(...values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    return option;
  }));
}

function applyPageLanguage() {
  if (!languageSelect) return;

  appLanguage = languageSelect.value;
  localStorage.setItem("lookbook-language", appLanguage);
  document.documentElement.lang = appLanguage;
  updateEventDatePreview();

  setEnglish(
    ".topbar-note",
    '<span class="status-dot"></span> Your style assistant',
    true,
    '<span class="status-dot"></span> आपका स्टाइल असिस्टेंट'
  );
  setEnglish(".topbar-actions .logout-button", "Log out");
  setEnglish(".hero-copy .eyebrow", "YOUR PLAN, YOUR STYLE", false, "तुम्हारी अलमारी, तुम्हारा स्टाइल");
  setEnglish(".hero h1", "Your wardrobe,<br><span>your next look.</span>", true);
  setEnglish(".hero-description", "Add clothing photos to your digital wardrobe. Choose a party, date, and location to get a weather-matched look from your saved clothes.");
  setEnglish(".hero-tag", "LOOK GOOD.<br>FEEL GREAT.", true, "अच्छे दिखो।<br>खुश महसूस करो।");

  setEnglish("#plannerTitle", "Tell us about the party");
  setEnglish("#plannerHint", "Your saved clothes will be selected automatically using the forecast for your chosen date and location.");
  setEnglish('label[for="partySearch"]', "Search party name");
  setEnglish("#partySearch", "e.g. wedding, birthday, or night party");
  setEnglish('label[for="outfitAudience"]', "Who is this look for?");
  setOption('#outfitAudience option[value="men"]', "Men");
  setOption('#outfitAudience option[value="women"]', "Women");
  setOption('#outfitAudience option[value="children"]', "Children");
  setOption('#outfitAudience option[value="senior"]', "Older adult");
  setEnglish('label[for="eventDate"]', "When are you going?");
  setEnglish('label[for="eventLocation"]', "Where are you going?");
  setEnglish("#eventLocation", "City or region, e.g. Jaipur, Rajasthan, or Kashmir");
  setEnglish(".form-panel form > .planner-hint", "Enter a city or region and date. We’ll check the weather and match clothes to it; state-level weather is approximate.");
  setDatalistOptions(
    "partySuggestions",
    ["शादी की पार्टी", "बर्थडे पार्टी", "कैज़ुअल पार्टी", "नाइट पार्टी"],
    ["Wedding party", "Birthday party", "Casual party", "Night party"]
  );
  setEnglish(
    ".form-panel .primary-button span:first-child",
    "Suggest a party look",
    false,
    "मेरी पार्टी का लुक बताओ"
  );

  setEnglish(".result-panel .eyebrow", "MADE FOR YOUR PLAN", false, "तुम्हारे प्लान के लिए");
  setEnglish(".result-panel h2", "Your look");
  setEnglish("#wearTitle", "Recommended outfit for you");
  setEnglish("#avoidTitle", "Avoid these");
  setEnglish("#weatherOutfitTitle", "What to wear for this weather");
  setEnglish("#googleImagesButton", "See this look on Google Images ↗");
  setEnglish("#resultPlaceholder p", "Choose a party, date, and location.<br>Your party and weather look will appear here.", true);
  setEnglish("#designIdea .eyebrow", "DESIGN INSPIRATION", false, "डिज़ाइन की झलक");
  setEnglish("#colorIdeasTitle", "Clothing and shoe color combinations");
  setEnglish("#saveButton span", "Save this look");
  setEnglish("#nextOutfitButton span", "Next outfit combination");
  setEnglish("#saveHint", "Create a look first; then you can save it.", false, "पहले लुक बनाओ; फिर इसे सेव कर पाओगे।");
  document.querySelectorAll(".outfit-category-label").forEach((item, index) => {
    const labels = ["Top", "Bottom", "Shoes", "Accessory", "Glasses", "Perfume"];
    const original = ["ऊपर", "नीचे", "जूते", "एक्सेसरी", "चश्मा", "परफ्यूम"];
    item.textContent = appLanguage === "en" ? labels[index] : original[index];
  });
  updateOutfitItemLabels(
    currentSelection?.audience,
    currentOutfit?.item_categories?.bottom || currentSelection?.outfit_type
  );
  if (currentOutfit) renderSavedWardrobeItems(currentOutfit);

  setEnglish(".wardrobe-section .eyebrow", "MY CLOSET", false, "मेरी अलमारी");
  setEnglish(".wardrobe-section h2", "My wardrobe");
  setEnglish('label[for="wardrobeCategory"]', "Clothing category");
  setOption('#wardrobeCategory option[value="top"]', "Shirt / top");
  setOption('#wardrobeCategory option[value="bottom"]', "Pants");
  setOption('#wardrobeCategory option[value="shorts"]', "Shorts");
  setOption('#wardrobeCategory option[value="saree"]', "Saree");
  setOption('#wardrobeCategory option[value="salwar"]', "Salwar suit");
  setOption('#wardrobeCategory option[value="lehenga"]', "Lehenga");
  setOption('#wardrobeCategory option[value="kurti"]', "Kurti");
  setOption('#wardrobeCategory option[value="shoes"]', "Shoes");
  setOption('#wardrobeCategory option[value="accessory"]', "Watch / belt / bag");
  setEnglish("#emptyWardrobeLook", "No saved wardrobe items match this party and person yet. Add clothes to My Closet first.");
  setEnglish('label[for="wardrobeSearch"]', "Search your wardrobe");
  setEnglish("#wardrobeSearch", "shirt, pants, shoes, watch…");
  setEnglish("#wardrobeSearchEmpty", "No matching clothing item was found.");
  setEnglish('label[for="wardrobeName"]', "Item name (optional)");
  setEnglish("#wardrobeNameHint", "AI names each photo automatically; for one photo, type your own name to keep it.");
  setEnglish('label[for="wardrobeAudience"]', "Who is this item for?");
  setEnglish('label[for="wardrobeParty"]', "Search party name", false, "पार्टी का नाम चुनें");
  setEnglish("#wardrobeName", "e.g. Oxford shirt");
  setOption('#wardrobeAudience option[value="adult"]', "Adult");
  setOption('#wardrobeAudience option[value="men"]', "Men");
  setOption('#wardrobeAudience option[value="women"]', "Women");
  setOption('#wardrobeAudience option[value="children"]', "Children");
  setOption('#wardrobeAudience option[value="senior"]', "Older adult");
  setOption('#wardrobeAudience option[value="all"]', "Everyone");
  setOption('#wardrobeParty option[value="any"]', "All parties");
  setOption('#wardrobeParty option[value="wedding"]', "Wedding party");
  setOption('#wardrobeParty option[value="birthday"]', "Birthday party");
  setOption('#wardrobeParty option[value="casual"]', "Casual party");
  setOption('#wardrobeParty option[value="night"]', "Night party");
  setEnglish('label[for="wardrobeImage"]', "Clothing photos (select multiple)", false, "कपड़ों की फोटो (एक से ज़्यादा चुन सकते हैं)");
  setEnglish("#wardrobeImageHint", "Choose several photos at once. AI identifies each photo's name and category; with AI off, the filename and category above are used.");
  setEnglish("#wardrobeAiIdentifyText", "Automatically recognize each photo's name and category");
  setEnglish("#wardrobeAiPrivacy", "Selected photos are sent to Groq for recognition.");
  updateWardrobePhotoCount();
  setEnglish("#wardrobePhotoNote", "Selected photos are saved with their items in your wardrobe and shown with their looks.");
  setEnglish("#removeWardrobeImage", "Remove photo");
  const wardrobeImageAlt = document.getElementById("wardrobeImagePreview");
  if (wardrobeImageAlt) {
    wardrobeImageAlt.alt = appLanguage === "en"
      ? "Preview of the clothing photo"
      : "कपड़ों की फोटो की झलक";
  }
  setEnglish("#wardrobeForm .primary-button", "＋ Add to wardrobe");
  setEnglish("#emptyWardrobe", "Your wardrobe is empty. Add your clothes above.");
  setEnglish(".catalog-details > summary", "Browse Party Outfit Planner's built-in clothing catalog");
  setEnglish(".catalog-details > .catalog-privacy-note", "These are built-in sample item names and categories, not images searched from the web. Empty categories also use the app's built-in outfit catalog.");
  setEnglish("#addSampleWardrobe span", "Add the full sample wardrobe");

  document.title = appLanguage === "en"
    ? "Party Outfit Planner"
    : "पार्टी आउटफिट प्लानर";
  setEnglish(".saved-section:not(.wardrobe-section) .eyebrow", "YOUR COLLECTION", false, "तुम्हारा कलेक्शन");
  setEnglish(".saved-section:not(.wardrobe-section) h2", "Saved looks");
  setEnglish("#emptyHistory", "No looks saved yet. Create and save your first look.");
  setEnglish(".footer span:last-child", "Your style, for every party.", false, "हर पार्टी के लिए, तुम्हारा अपना स्टाइल।");

  if (lastOutfit) showOutfit(lastOutfit);
  updateNextOutfitLabel();
  renderColorCombinations();
  translateVisibleMessages();

  loadWardrobe().then(translateCards);
  loadHistory().then(translateCards);
}

function translateCards() {
  document.querySelectorAll("#wardrobeList .history-card").forEach((card) => {
    card.querySelectorAll("p, button").forEach((element) => {
      if (element.tagName === "BUTTON" && element.dataset.action === "rename") {
        element.textContent = "✎";
        element.title = appLanguage === "en" ? "Edit item name and party tag" : "नाम या पार्टी tag बदलें";
        element.setAttribute("aria-label", element.title);
      } else if (element.tagName === "BUTTON") {
        element.textContent = appLanguage === "en" ? "Delete" : "हटाएँ";
      } else {
        element.textContent = translateText(element.textContent);
      }
    });
  });

  document.querySelectorAll("#historyList .history-card").forEach((card) => {
    card.querySelectorAll("h3, p").forEach((element) => {
      element.textContent = translateText(element.textContent);
    });
    const button = card.querySelector("button");
    if (button) button.textContent = appLanguage === "en" ? "Delete" : "हटाएँ";
  });
}

const originalShowOutfit = showOutfit;

const outfitTranslationFields = [
  "top", "bottom", "shoes", "accessory", "weather_tip", "weather_outfit",
  "eyewear", "perfume", "design_title", "design_details"
];

function hasWrongLanguageScript(text) {
  if (appLanguage === "en") return /[\u0900-\u097F]/.test(text);
  const withoutSizes = text.replace(/\b(?:XS|S|M|L|XL|XXL|XXXL|[4-8]XL)\b/gi, "");
  return /[A-Za-z]{2,}/.test(withoutSizes);
}

function outfitFallbackValues(outfitType) {
  const traditional = {
    saree: {
      en: ["Matching saree blouse", "Coordinated saree"],
      hi: ["मैचिंग साड़ी ब्लाउज़", "मेल खाती साड़ी"]
    },
    salwar: {
      en: ["Matching salwar suit", "Comfortable salwar pants"],
      hi: ["मैचिंग सलवार-सूट", "आरामदायक सलवार पैंट"]
    },
    lehenga: {
      en: ["Matching choli", "Coordinated lehenga"],
      hi: ["मैचिंग चोली", "मेल खाता लहंगा"]
    },
    kurti: {
      en: ["Party kurti", "Matching pants or skirt"],
      hi: ["पार्टी कुर्ती", "मैचिंग पैंट या स्कर्ट"]
    }
  }[outfitType];
  const pair = traditional?.[appLanguage];

  return {
    top: pair?.[0] || (appLanguage === "en" ? "Party-ready top" : "पार्टी के लिए उपयुक्त टॉप"),
    bottom: pair?.[1] || (appLanguage === "en" ? "Coordinated pants" : "मैचिंग पैंट"),
    shoes: appLanguage === "en" ? "Comfortable party shoes" : "आरामदायक पार्टी जूते",
    accessory: appLanguage === "en" ? "Optional party accessory" : "पार्टी के लिए वैकल्पिक एक्सेसरी",
    weather_tip: appLanguage === "en"
      ? "Choose comfortable layers for the weather."
      : "मौसम के अनुसार आरामदायक कपड़े चुनें।",
    weather_outfit: appLanguage === "en"
      ? currentSelection?.weather === "cold"
        ? "Cold weather: thermal base layer, sweater, warm trousers, jacket or coat, wool socks, and closed shoes."
        : currentSelection?.weather === "rainy"
          ? "Rainy weather: quick-drying clothes, waterproof jacket, grippy closed shoes, and an umbrella."
          : "Warm weather: lightweight cotton or linen top, breathable trousers, and comfortable shoes; skip heavy jackets."
      : currentSelection?.weather === "cold"
        ? "ठंड के लिए: थर्मल इनर, स्वेटर, गर्म पैंट, जैकेट/कोट, ऊनी मोज़े और बंद जूते पहनें।"
        : currentSelection?.weather === "rainy"
          ? "बारिश के लिए: जल्दी सूखने वाले कपड़े, वाटरप्रूफ जैकेट, ग्रिप वाले बंद जूते और छाता रखें।"
          : "गर्मी के लिए: हल्की सूती/लिनेन शर्ट या टॉप, हल्की पैंट और आरामदायक जूते पहनें; भारी जैकेट न पहनें।",
    eyewear: appLanguage === "en"
      ? "Wear your preferred glasses if needed."
      : "ज़रूरत हो तो अपना पसंदीदा चश्मा पहनें।",
    perfume: appLanguage === "en"
      ? "Light perfume; use a small amount."
      : "हल्की खुशबू वाला परफ्यूम; थोड़ी मात्रा में लगाएँ।",
    design_title: appLanguage === "en" ? "Design idea" : "डिज़ाइन आइडिया",
    design_details: appLanguage === "en"
      ? "A coordinated traditional outfit design."
      : "पारंपरिक कपड़ों का मेल खाता डिज़ाइन।"
  };
}

function localizeOutfitForDisplay(outfit) {
  const localized = { ...outfit };
  const fallbackType = outfit.item_categories?.bottom || currentSelection?.outfit_type;
  const fallback = outfitFallbackValues(fallbackType);
  let needsTranslation = false;

  for (const field of outfitTranslationFields) {
    if (typeof outfit[field] !== "string" || !outfit[field].trim()) continue;
    const translated = translateText(outfit[field]);
    if (hasWrongLanguageScript(translated)) {
      localized[field] = fallback[field];
      needsTranslation = true;
    } else {
      localized[field] = translated;
    }
  }

  for (const field of ["party_name", "style_name", "audience_name"]) {
    if (typeof outfit[field] === "string") localized[field] = translateText(outfit[field]);
  }
  return { outfit: localized, needsTranslation };
}

function setOutfitLanguageStatus(message) {
  const status = document.getElementById("outfitLanguageStatus");
  if (!status) return;
  status.textContent = message;
  status.hidden = !message;
}

function renderLocalizedOutfit(outfit) {
  currentOutfit = outfit;
  originalShowOutfit(outfit);
  document.getElementById("partyName").textContent = outfit.party_name;
  document.getElementById("styleName").textContent = appLanguage === "en"
    ? `${outfit.audience_name} · ${outfit.style_name} style`
    : `${outfit.audience_name} · ${outfit.style_name} स्टाइल`;
  renderSavedWardrobeItems(outfit);
  document.getElementById("weatherTip").textContent = outfit.weather_tip;
  document.getElementById("weatherOutfit").textContent = outfit.weather_outfit || "";
  document.getElementById("weatherOutfitBox").hidden = !outfit.weather_outfit;
  document.querySelector(".weather-tip").hidden = !outfit.weather_tip;
  renderWeatherOutfitImages(outfit);
  renderColorCombinations();
}

async function translateOutfitForDisplay(outfit, language, requestId) {
  setOutfitLanguageStatus(language === "en" ? "Translating this look…" : "लुक का अनुवाद हो रहा है…");
  try {
    const response = await fetch("/api/translate-outfit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outfit, language })
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "अनुवाद पूरा नहीं हो पाया।");
    if (requestId !== outfitTranslationRequest || language !== appLanguage || lastOutfit !== outfit) return;

    const translated = { ...outfit, ...data.translations };
    const localized = localizeOutfitForDisplay(translated);
    if (localized.needsTranslation) throw new Error("Translation was incomplete.");
    lastOutfit = translated;
    renderLocalizedOutfit(localized.outfit);
    setOutfitLanguageStatus("");
  } catch (error) {
    if (requestId !== outfitTranslationRequest || language !== appLanguage || lastOutfit !== outfit) return;
    setOutfitLanguageStatus(error.code === "NON_JSON_RESPONSE"
      ? error.message
      : language === "en"
        ? "Some outfit text could not be translated. Create the look again in English."
        : "कुछ कपड़ों का अनुवाद नहीं हो पाया। हिंदी में लुक फिर से बनाएँ।");
  }
}

showOutfit = function (outfit) {
  lastOutfit = outfit;
  const localized = localizeOutfitForDisplay(outfit);
  renderLocalizedOutfit(localized.outfit);
  const requestId = ++outfitTranslationRequest;
  if (localized.needsTranslation) {
    translateOutfitForDisplay(outfit, appLanguage, requestId);
  } else {
    setOutfitLanguageStatus("");
  }
};

if (languageSelect) {
  languageSelect.value = appLanguage;
  languageSelect.addEventListener("change", applyPageLanguage);
  applyPageLanguage();
}
async function loadBuiltinCatalog() {
  const catalogElement = document.getElementById("builtinCatalog");
  try {
    const response = await fetch("/api/catalog");
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Catalog load नहीं हो पाया।");
    const icons = {
      top: "👕", bottom: "👖", shorts: "🩳", shoes: "👟",
      accessory: "⌚", eyewear: "👓", perfume: "🧴", saree: "🥻",
      salwar: "👗", lehenga: "👗", kurti: "👚"
    };
    catalogElement.replaceChildren();
    for (const item of data.items) {
      const card = document.createElement("article");
      card.className = "catalog-item";
      const preview = document.createElement("div");
      preview.className = "catalog-preview";
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = icons[item.category] || "✨";
      const image = document.createElement("img");
      image.src = item.preview_url || "";
      image.alt = translateText(item.name);
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.hidden = true;
        icon.hidden = false;
      });
      image.addEventListener("load", () => {
        icon.hidden = true;
      });
      preview.append(icon, image);
      const name = document.createElement("strong");
      name.textContent = translateText(item.name);
      const category = document.createElement("small");
      category.textContent = translateText(categoryNames[item.category] || item.category);
      card.append(preview, name, category);
      catalogElement.append(card);
    }
  } catch (error) {
    wardrobeMessage.textContent = translateText(error.message);
  }
}

document.getElementById("addSampleWardrobe").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch("/api/wardrobe/sample", { method: "POST" });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Sample wardrobe add नहीं हुई।");
    wardrobeMessage.textContent = translateText(data.message);
    await loadWardrobe();
    translateCards();
  } catch (error) {
    wardrobeMessage.textContent = translateText(error.message);
  } finally {
    button.disabled = false;
  }
});

loadBuiltinCatalog();