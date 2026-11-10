const form = document.getElementById("outfitForm");
const errorMessage = document.getElementById("errorMessage");
const saveMessage = document.getElementById("saveMessage");
const saveButton = document.getElementById("saveButton");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const outfitResult = document.getElementById("outfitResult");
const audienceSelect = document.getElementById("audience");
const outfitTypeLabel = document.getElementById("outfitTypeLabel");
const outfitTypeSelect = document.getElementById("outfitType");
const bottomPreferenceLabel = document.querySelector('label[for="bottomPreference"]');
const bottomPreferenceSelect = document.getElementById("bottomPreference");
const locationInput = document.getElementById("location");
const calendarForm = document.getElementById("calendarForm");
const calendarFile = document.getElementById("calendarFile");
const calendarMessage = document.getElementById("calendarMessage");
const calendarEventPanel = document.getElementById("calendarEvent");
const routeButton = document.getElementById("routeButton");
const routeMessage = document.getElementById("routeMessage");
const routeMapElement = document.getElementById("routeMap");
const routeSummary = document.getElementById("routeSummary");
let currentCalendarEvent = null;
let routeMapInstance = null;

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
const wardrobeMessage = document.getElementById("wardrobeMessage");
const wardrobeList = document.getElementById("wardrobeList");
const emptyWardrobe = document.getElementById("emptyWardrobe");
const wardrobeCount = document.getElementById("wardrobeCount");
const wardrobeCategory = document.getElementById("wardrobeCategory");
const wardrobeSizeField = document.getElementById("wardrobeSizeField");
const wardrobeSize = document.getElementById("wardrobeSize");
const wardrobeImageInput = document.getElementById("wardrobeImage");
const wardrobeImagePreviewBox = document.getElementById("wardrobeImagePreviewBox");
const wardrobeImagePreview = document.getElementById("wardrobeImagePreview");
let wardrobeImagePreviewUrl = null;

let currentSelection = null;
let currentOutfit = null;

function updateOutfitTypeFields() {
  const isWomen = audienceSelect.value === "women";
  outfitTypeLabel.hidden = !isWomen;
  outfitTypeSelect.hidden = !isWomen;

  if (!isWomen) outfitTypeSelect.value = "any";
  const useEthnicOutfit = isWomen && outfitTypeSelect.value !== "any";
  bottomPreferenceLabel.hidden = useEthnicOutfit;
  bottomPreferenceSelect.hidden = useEthnicOutfit;
}

audienceSelect.addEventListener("change", updateOutfitTypeFields);
outfitTypeSelect.addEventListener("change", updateOutfitTypeFields);
updateOutfitTypeFields();

locationInput.addEventListener("input", () => {
  if (currentSelection) currentSelection.location = locationInput.value.trim();
});

const categoryNames = {
  top: "शर्ट / टॉप",
  bottom: "पैंट",
  shorts: "शॉर्ट्स",
  shoes: "जूते",
  accessory: "एक्सेसरी",
  eyewear: "चश्मा",
  saree: "साड़ी",
  salwar: "सलवार-सूट",
  lehenga: "लहंगा",
  kurti: "कुर्ती"
};

const wardrobeAudienceNames = {
  men: "पुरुष",
  women: "महिला",
  adult: "वयस्क",
  children: "बच्चे",
  senior: "बुज़ुर्ग",
  all: "सबके लिए"
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

function updateWardrobeSizeField() {
  const isClothing = [
    "top", "bottom", "shorts", "saree", "salwar", "lehenga", "kurti"
  ].includes(
    wardrobeCategory.value
  );
  wardrobeSizeField.hidden = !isClothing;
  if (!isClothing) wardrobeSize.value = "any";
}

wardrobeCategory.addEventListener("change", updateWardrobeSizeField);
updateWardrobeSizeField();

function translateVisibleMessages() {
  document.querySelectorAll(
    "#errorMessage, #saveMessage, #wardrobeMessage, #photoMessage, #analysisMessage"
  ).forEach((element) => {
    element.textContent = translateText(element.textContent);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  saveMessage.textContent = "";

  currentSelection = {
    party_type: document.getElementById("partyType").value,
    style: document.getElementById("style").value,
    weather: document.getElementById("weather").value,
    audience: document.getElementById("audience").value,
    outfit_type: document.getElementById("outfitType").value,
    bottom_preference: document.getElementById("bottomPreference").value,
    location: locationInput.value.trim()
  };

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector("span").textContent = translateText("लुक बन रहा है…");

  try {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentSelection)
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "लुक बनाते समय समस्या आई।");
    }

    showOutfit(data.outfit);
  } catch (error) {
    errorMessage.textContent = translateText(error.message);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = translateText("मेरा लुक सुझाओ");
  }
});

function showOutfit(outfit) {
  currentOutfit = outfit;
  renderEthnicDesign(outfit);
  updateOutfitItemLabels(
    currentSelection?.audience,
    currentSelection?.outfit_type
  );
  document.getElementById("partyName").textContent = outfit.party_name;
  document.getElementById("styleName").textContent =
    `${outfit.audience_name} · ${outfit.style_name} स्टाइल`;
  document.getElementById("outfitTop").textContent = outfit.top;
  document.getElementById("outfitBottom").textContent = outfit.bottom;
  document.getElementById("outfitShoes").textContent = outfit.shoes;
  document.getElementById("outfitAccessory").textContent = outfit.accessory;
  document.getElementById("outfitEyewear").textContent = outfit.eyewear || "—";
  document.getElementById("weatherTip").textContent = outfit.weather_tip;

  resultPlaceholder.hidden = true;
  outfitResult.hidden = false;
  outfitResult.classList.remove("outfit-enter");
  requestAnimationFrame(() => outfitResult.classList.add("outfit-enter"));
}

function updateOutfitItemLabels(audience, outfitType) {
  const labelsByType = {
    saree: ["ब्लाउज़", "साड़ी", "जूते", "एक्सेसरी", "चश्मा"],
    salwar: ["कुर्ती / सूट", "सलवार / पैंट", "जूते", "एक्सेसरी", "चश्मा"],
    lehenga: ["चोली", "लहंगा", "जूते", "एक्सेसरी", "चश्मा"],
    kurti: ["कुर्ती", "पैंट / स्कर्ट", "जूते", "एक्सेसरी", "चश्मा"]
  };
  const labelsEnglish = {
    saree: ["Blouse", "Saree", "Shoes", "Accessory", "Glasses"],
    salwar: ["Kurta / suit", "Salwar / pants", "Shoes", "Accessory", "Glasses"],
    lehenga: ["Choli", "Lehenga", "Shoes", "Accessory", "Glasses"],
    kurti: ["Kurti", "Pants / skirt", "Shoes", "Accessory", "Glasses"]
  };
  const defaultHindi = ["ऊपर", "नीचे", "जूते", "एक्सेसरी", "चश्मा"];
  const defaultEnglish = ["Top", "Bottom", "Shoes", "Accessory", "Glasses"];
  const isTraditionalLook = audience === "women" && labelsByType[outfitType];
  const labels = isTraditionalLook
    ? (appLanguage === "en" ? labelsEnglish[outfitType] : labelsByType[outfitType])
    : (appLanguage === "en" ? defaultEnglish : defaultHindi);

  document.querySelectorAll(".outfit-item small").forEach((item, index) => {
    item.textContent = labels[index] || "";
  });
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

wardrobeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  wardrobeMessage.textContent = "";

  const formData = new FormData();
  formData.set("name", document.getElementById("wardrobeName").value.trim());
  formData.set("category", document.getElementById("wardrobeCategory").value);
  formData.set("color", document.getElementById("wardrobeColor").value.trim());
  formData.set("audience", document.getElementById("wardrobeAudience").value);
  formData.set("size", wardrobeSize.value);
  if (wardrobeImageInput.files[0]) {
    formData.set("image", wardrobeImageInput.files[0]);
  }

  const addButton = wardrobeForm.querySelector('button[type="submit"]');
  addButton.disabled = true;
  addButton.textContent = translateText("जोड़ा जा रहा है…");

  try {
    const response = await fetch("/api/wardrobe", {
      method: "POST",
      body: formData
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "कपड़ा नहीं जुड़ पाया।");
    }

    wardrobeForm.reset();
    clearWardrobeImagePreview();
    updateWardrobeSizeField();
    wardrobeMessage.textContent = "✓ " + translateText(data.message);
    await loadWardrobe();
  } catch (error) {
    wardrobeMessage.textContent = translateText(error.message);
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

    wardrobeList.replaceChildren();
    wardrobeCount.textContent = data.items.length;
    emptyWardrobe.hidden = data.items.length > 0;

    for (const item of data.items) {
      wardrobeList.appendChild(createWardrobeCard(item));
    }
  } catch (error) {
    wardrobeList.replaceChildren();
    emptyWardrobe.hidden = false;
    emptyWardrobe.textContent = translateText(error.message);
  }
  translateCards();
}

function createWardrobeCard(item) {
  const card = document.createElement("article");
  card.className = "history-card";

  const title = document.createElement("h3");
  title.textContent = item.name;

  const details = document.createElement("p");
  const category = translateText(categoryNames[item.category] || item.category);
  const audience = translateText(wardrobeAudienceNames[item.audience] || item.audience);
  const color = translateText(item.color || "");
  const size = item.size && item.size !== "any"
    ? ` · ${translateText("साइज़")} ${item.size}`
    : "";
  details.textContent = color
    ? `${audience} · ${category} · ${color}${size}`
    : `${audience} · ${category}${size}`;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = translateText("हटाएँ");
  deleteButton.addEventListener("click", () => deleteWardrobeItem(item.id));

  if (item.image_url) {
    const image = document.createElement("img");
    image.className = "wardrobe-item-image";
    image.src = item.image_url;
    image.alt = item.name;
    image.loading = "lazy";
    card.append(image);
  }
  card.append(title, details, deleteButton);
  return card;
}

function clearWardrobeImagePreview() {
  wardrobeImageInput.value = "";
  wardrobeImagePreview.removeAttribute("src");
  wardrobeImagePreviewBox.hidden = true;
  if (wardrobeImagePreviewUrl) URL.revokeObjectURL(wardrobeImagePreviewUrl);
  wardrobeImagePreviewUrl = null;
}

wardrobeImageInput.addEventListener("change", () => {
  wardrobeMessage.textContent = "";
  const image = wardrobeImageInput.files[0];
  if (!image) {
    clearWardrobeImagePreview();
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    wardrobeMessage.textContent = translateText("JPG, PNG या WebP कपड़ों की फोटो चुनें।");
    clearWardrobeImagePreview();
    return;
  }
  if (image.size > 5 * 1024 * 1024) {
    wardrobeMessage.textContent = translateText("कपड़ों की फोटो 5 MB से छोटी होनी चाहिए।");
    clearWardrobeImagePreview();
    return;
  }
  if (wardrobeImagePreviewUrl) URL.revokeObjectURL(wardrobeImagePreviewUrl);
  wardrobeImagePreviewUrl = URL.createObjectURL(image);
  wardrobeImagePreview.src = wardrobeImagePreviewUrl;
  wardrobeImagePreviewBox.hidden = false;
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
  title.textContent = translateText(
    `${saved.outfit.party_name} · ${saved.outfit.style_name}`
  );

  const details = document.createElement("p");
  details.textContent = translateText(
    `👕 ${saved.outfit.top} · 👖 ${saved.outfit.bottom} · 👟 ${saved.outfit.shoes}` +
    (saved.outfit.eyewear ? ` · 👓 ${saved.outfit.eyewear}` : "")
  );

  const designDetails = saved.outfit.design_details
    ? document.createElement("p")
    : null;
  if (designDetails) {
    designDetails.textContent = translateText(
      `🎨 ${saved.outfit.design_title}: ${saved.outfit.design_details}`
    );
  }

  const date = document.createElement("p");
  date.textContent = translateText(`सेव किया: ${saved.created_at}`);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = translateText("हटाएँ");
  deleteButton.addEventListener("click", () => deleteOutfit(saved.id));

  card.append(title, details);
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

  "ठंड के लिए जैकेट या ब्लेज़र साथ रखें।": "Bring a jacket or blazer for cold weather.",
  "बारिश में पानी से कम खराब होने वाले जूते चुनें।": "Choose shoes that can handle rain.",
  "गर्मी में हल्के और आरामदायक कपड़े चुनें।": "Choose light, comfortable clothes for warm weather.",

  "शर्ट / टॉप": "Shirt / top", "पैंट": "Pants", "जूते": "Shoes",
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
  "फोटो विश्लेषण के लिए अनुमति दें।": "Please consent to photo analysis.",
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
  "लुक बन रहा है…": "Creating your look…",
  "मेरा लुक सुझाओ": "Suggest my look",
  "लुक बनाते समय समस्या आई।": "Something went wrong while creating the look.",
  "पहले अपना लुक बनाओ।": "Create a look first.",
  "सेव हो रहा है…": "Saving…",
  "लुक सेव नहीं हो पाया।": "Could not save the look.",
  "कपड़ा नहीं जुड़ पाया।": "Could not add the item.",
  "जोड़ा जा रहा है…": "Adding…",
  "＋ अलमारी में जोड़ो": "＋ Add to wardrobe",
  "अलमारी लोड नहीं हो पाई।": "Could not load the wardrobe.",
  "कपड़ा हटाया नहीं जा सका।": "Could not remove the item.",
  "सेव किए लुक लोड नहीं हो पाए।": "Could not load saved looks.",
  "लुक हटाया नहीं जा सका।": "Could not delete the look.",
  "JPG, PNG या WebP फोटो चुनें।": "Choose a JPG, PNG, or WebP photo.",
  "पहले फोटो चुनो।": "Choose a photo first.",
  "पहले फोटो विश्लेषण की अनुमति दो।": "Consent to photo analysis first.",
  "फोटो देखकर सुझाव बनाया जा रहा है…": "Creating a suggestion from your photo…",
  "फोटो से सुझाव नहीं बन पाया।": "Could not create a suggestion from the photo.",
  "तुम्हारा फोटो-आधारित लुक तैयार है।": "Your photo-based look is ready.",
  "मेरी जगह से रास्ता दिखाओ": "Show route from my location",
  "Calendar import करके look बनाओ": "Import calendar and plan my look",
  "इस browser में location की सुविधा उपलब्ध नहीं है।": "This browser does not support location access.",
  "Location की अनुमति नहीं मिली। Browser में अनुमति देकर फिर कोशिश करें।": "Location permission was denied. Allow it in your browser and retry.",
  "आपकी current location नहीं मिल पाई। उपलब्ध होने पर फिर कोशिश करें।": "Could not read your current location. Retry when location is available.",
  "Calendar import हो रहा है…": "Importing calendar…",
  "LOOKBOOK के अंदर का sample कपड़ों का catalog देखें": "Browse LOOKBOOK's built-in clothing catalog",
  "पूरी sample अलमारी जोड़ें": "Add the full sample wardrobe",
  "sample items आपकी अलमारी में जोड़ दिए गए।": "sample items were added to your wardrobe.",
  "आपकी अलमारी में sample items पहले से हैं।": "Sample items are already in your wardrobe.",
  "Map library load नहीं हुई। पेज refresh करके फिर कोशिश करें।": "The map library did not load. Refresh the page and retry.",
  "अगले event का look नहीं बन पाया।": "Could not create a look for the next event.",
  "Calendar import नहीं हुआ।": "The calendar could not be imported.",
  "Sample wardrobe add नहीं हुई।": "Could not add the sample wardrobe.",
  "Catalog load नहीं हो पाया।": "Could not load the catalog.",
  "Map route नहीं बन पाया।": "Could not create the map route.",
  "अपनी .ics calendar फ़ाइल चुनें।": "Choose your .ics calendar file.",
  "सिर्फ .ics calendar फ़ाइल इस्तेमाल करें।": "Choose an .ics calendar file.",
  "डिवाइस का timezone पहचाना नहीं गया।": "The device timezone could not be recognized.",
  "इस .ics फ़ाइल में कोई calendar event नहीं मिला।": "No calendar events were found in this .ics file.",
  "पहले future events वाली .ics calendar फ़ाइल import करें।": "Import an .ics calendar file with upcoming events first.",
  "कार्यक्रम का venue map पर नहीं मिला।": "The event venue could not be found on the map.",
  "इस स्थान तक कोई सड़क मार्ग नहीं मिला।": "No driving route was found to this location.",
  "इस calendar event में venue/location नहीं दिया गया है।": "This calendar event has no venue or location.",
  "Map के लिए current location मान्य नहीं है।": "The current location is not valid for the map.",
  "यह calendar event नहीं मिला।": "Calendar event not found.",
  "Map route अभी नहीं बन पाया। थोड़ी देर बाद फिर कोशिश करें।": "The map route could not be created. Try again shortly.",
  "Calendar import हुआ, लेकिन कोई आने वाला event नहीं मिला।": "The calendar was imported, but no upcoming events were found.",
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

function applyPageLanguage() {
  if (!languageSelect) return;

  appLanguage = languageSelect.value;
  localStorage.setItem("lookbook-language", appLanguage);
  document.documentElement.lang = appLanguage;

  setEnglish(
    ".topbar-note",
    '<span class="status-dot"></span> Your style assistant',
    true,
    '<span class="status-dot"></span> आपका स्टाइल असिस्टेंट'
  );
  setEnglish(".topbar-actions .logout-button", "Log out");
  setEnglish(".hero-copy .eyebrow", "YOUR PLAN, YOUR STYLE", false, "तुम्हारी अलमारी, तुम्हारा स्टाइल");
  setEnglish(".hero h1", "Your wardrobe,<br><span>your next look.</span>", true);
  setEnglish(".hero-description", "Import your next calendar event and get a complete look from your wardrobe.");
  setEnglish(".hero-tag", "LOOK GOOD.<br>FEEL GREAT.", true, "अच्छे दिखो।<br>खुश महसूस करो।");

  setEnglish("#calendarTitle", "Get ready for your next event");
  setEnglish(".calendar-intro", "Import an .ics file from your calendar. LOOKBOOK selects the next upcoming event and automatically creates a complete outfit from your wardrobe.");
  setEnglish('label[for="calendarFile"]', "Calendar file (.ics)");
  setEnglish("#calendarForm .primary-button span:first-child", "Import calendar and plan my look");
  setEnglish(".calendar-privacy-note", "Only the event name, time, and venue are saved to your account; the original calendar file is not stored. A map route is created only when you request it; your current location and venue are sent to OpenStreetMap geocoding/routing services.");
  setEnglish(".calendar-event .eyebrow", "NEXT UP");
  setEnglish("#routeButton span", "Show route from my location");
  setEnglish(".manual-planner-summary strong", "Choose party details manually");
  setEnglish(".manual-planner-content .eyebrow", "MANUAL PLANNER", false, "MANUAL PLANNER");
  setEnglish(".form-panel .section-heading h2", "Tell us about the party");
  setEnglish(".form-panel h2", "Tell us about the party");
  setEnglish('label[for="partyType"]', "What kind of party?");
  setEnglish('label[for="audience"]', "Who is the look for?");
  setEnglish("#outfitTypeLabel", "Traditional outfit");
  setEnglish('label[for="style"]', "Choose a style");
  setEnglish('label[for="weather"]', "What's the weather?");
  setEnglish('label[for="bottomPreference"]', "Choose pants or shorts");
  setEnglish('label[for="location"]', "Location / city (optional)");
  setEnglish("#location", "e.g. Jaipur");
  setEnglish(
    "#locationPrivacyNote",
    "This city is only saved with your manual look."
  );
  setEnglish('label[for="photoInput"]', "Your photo (optional)", false, "अपनी फोटो (वैकल्पिक)");
  setOption('#partyType option[value="birthday"]', "🎂 Birthday party");
  setOption('#partyType option[value="wedding"]', "💐 Wedding party");
  setOption('#partyType option[value="casual"]', "🎈 Casual party");
  setOption('#partyType option[value="night"]', "🌙 Night party");
  setOption('#audience option[value="men"]', "Men");
  setOption('#audience option[value="women"]', "Women");
  setOption('#audience option[value="children"]', "Children");
  setOption('#audience option[value="senior"]', "Older adult");
  setOption('#outfitType option[value="any"]', "Any style");
  setOption('#outfitType option[value="saree"]', "Saree");
  setOption('#outfitType option[value="salwar"]', "Salwar suit / Anarkali");
  setOption('#outfitType option[value="lehenga"]', "Lehenga choli");
  setOption('#outfitType option[value="kurti"]', "Kurti set");
  setOption('#style option[value="casual"]', "Relaxed and casual");
  setOption('#style option[value="smart"]', "Smart and classic");
  setOption('#style option[value="bold"]', "Bold and trendy");
  setOption('#weather option[value="warm"]', "☀️ Warm / clear");
  setOption('#weather option[value="cold"]', "❄️ Cold");
  setOption('#weather option[value="rainy"]', "🌧️ Rainy");
  setOption('#bottomPreference option[value="trousers"]', "Long pants");
  setOption('#bottomPreference option[value="shorts"]', "Shorts");
  setOption('#wardrobeSize option[value="any"]', "Any / free size");
  setEnglish('label[for="wardrobeSize"]', "Clothing size");
  setEnglish(".form-panel .primary-button span:first-child", "Suggest my look");
  setEnglish("#removePhoto", "Remove photo");
  setEnglish("#analyzePhotoButton", "Suggest a look from photo", false, "फोटो देखकर लुक सुझाओ");

  setEnglish(".result-panel .eyebrow", "MADE FOR YOUR PLAN", false, "तुम्हारे प्लान के लिए");
  setEnglish(".result-panel h2", "Your look");
  setEnglish("#resultPlaceholder p", "Choose your party details.<br>Your look will appear here.", true);
  setEnglish("#designIdea .eyebrow", "DESIGN INSPIRATION", false, "डिज़ाइन की झलक");
  setEnglish("#colorIdeasTitle", "Clothing and shoe color combinations");
  setEnglish("#saveButton span", "Save this look");
  document.querySelectorAll(".outfit-item small").forEach((item, index) => {
    const labels = ["Top", "Bottom", "Shoes", "Accessory", "Glasses"];
    const original = ["ऊपर", "नीचे", "जूते", "एक्सेसरी", "चश्मा"];
    item.textContent = appLanguage === "en" ? labels[index] : original[index];
  });
  updateOutfitItemLabels(currentSelection?.audience, currentSelection?.outfit_type);

  setEnglish(".wardrobe-section .eyebrow", "MY CLOSET", false, "मेरी अलमारी");
  setEnglish(".wardrobe-section h2", "My wardrobe");
  setEnglish('label[for="wardrobeName"]', "Item name");
  setEnglish('label[for="wardrobeCategory"]', "Item type");
  setEnglish('label[for="wardrobeAudience"]', "Who is this item for?");
  setEnglish('label[for="wardrobeColor"]', "Color (optional)");
  setEnglish("#wardrobeName", "e.g. Oxford shirt");
  setEnglish("#wardrobeColor", "e.g. Navy blue");
  setOption('#wardrobeCategory option[value="top"]', "Shirt / top");
  setOption('#wardrobeCategory option[value="bottom"]', "Pants");
  setOption('#wardrobeCategory option[value="shorts"]', "Shorts");
  setOption('#wardrobeCategory option[value="shoes"]', "Shoes");
  setOption('#wardrobeCategory option[value="accessory"]', "Accessory");
  setOption('#wardrobeCategory option[value="eyewear"]', "Glasses");
  setOption('#wardrobeCategory option[value="saree"]', "Saree");
  setOption('#wardrobeCategory option[value="salwar"]', "Salwar suit");
  setOption('#wardrobeCategory option[value="lehenga"]', "Lehenga");
  setOption('#wardrobeCategory option[value="kurti"]', "Kurti");
  setOption('#wardrobeAudience option[value="adult"]', "Adult");
  setOption('#wardrobeAudience option[value="men"]', "Men");
  setOption('#wardrobeAudience option[value="women"]', "Women");
  setOption('#wardrobeAudience option[value="children"]', "Children");
  setOption('#wardrobeAudience option[value="senior"]', "Older adult");
  setOption('#wardrobeAudience option[value="all"]', "Everyone");
  setEnglish('label[for="wardrobeImage"]', "Clothing photo (optional)");
  setEnglish(".wardrobe-image-field > small", "JPG, PNG, or WebP · up to 5 MB");
  setEnglish("#removeWardrobeImage", "Remove photo");
  const wardrobeImageAlt = document.getElementById("wardrobeImagePreview");
  if (wardrobeImageAlt) {
    wardrobeImageAlt.alt = appLanguage === "en"
      ? "Preview of the clothing photo"
      : "कपड़े की फोटो का preview";
  }
  setEnglish("#wardrobeForm .primary-button", "＋ Add to wardrobe");
  setEnglish("#emptyWardrobe", "Your wardrobe is empty. Add your clothes above.");
  setEnglish(".catalog-details > summary", "Browse LOOKBOOK's built-in clothing catalog");
  setEnglish(".catalog-details > .calendar-privacy-note", "These are built-in sample item names and categories, not images searched from the web. Empty categories also use the app's built-in outfit catalog.");
  setEnglish("#addSampleWardrobe span", "Add the full sample wardrobe");

  setEnglish(
    ".photo-consent span",
    "I consent to AI photo analysis. A parent or guardian must consent for a child's photo.",
    false,
    "मैं इस फोटो के एआई विश्लेषण की अनुमति देता/देती हूँ। बच्चे की फोटो के लिए अभिभावक की अनुमति आवश्यक है।"
  );
  setEnglish(
    ".photo-privacy-note",
    "Photos are sent to Groq's AI service for analysis. The app does not store them.",
    false,
    "फोटो विश्लेषण के लिए इसे Groq की एआई सेवा को भेजा जाएगा। ऐप फोटो सेव नहीं करता।"
  );

  document.title = appLanguage === "en"
    ? "Party Outfit Planner · LOOKBOOK"
    : "पार्टी आउटफिट प्लानर · LOOKBOOK";
  const photoPreview = document.getElementById("photoPreview");
  if (photoPreview) {
    photoPreview.alt = appLanguage === "en"
      ? "Preview of your uploaded photo"
      : "अपलोड की गई फोटो की झलक";
  }

  setEnglish(".saved-section:not(.wardrobe-section) .eyebrow", "YOUR COLLECTION", false, "तुम्हारा कलेक्शन");
  setEnglish(".saved-section:not(.wardrobe-section) h2", "Saved looks");
  setEnglish("#emptyHistory", "No looks saved yet. Create and save your first look.");
  setEnglish(".footer span:last-child", "Your style, for every party.", false, "हर पार्टी के लिए, तुम्हारा अपना स्टाइल।");

  if (lastOutfit) showOutfit(lastOutfit);
  updateOutfitTypeFields();
  renderColorCombinations();
  translateVisibleMessages();

  loadWardrobe().then(translateCards);
  loadHistory().then(translateCards);
}

function translateCards() {
  document.querySelectorAll("#wardrobeList .history-card").forEach((card) => {
    card.querySelectorAll("p, button").forEach((element) => {
      if (element.tagName === "BUTTON") {
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
let lastOutfit = null;
let outfitTranslationRequest = 0;

const outfitTranslationFields = [
  "top", "bottom", "shoes", "accessory", "weather_tip", "eyewear",
  "design_title", "design_details"
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
    eyewear: appLanguage === "en"
      ? "Wear your preferred glasses if needed."
      : "ज़रूरत हो तो अपना पसंदीदा चश्मा पहनें।",
    design_title: appLanguage === "en" ? "Design idea" : "डिज़ाइन आइडिया",
    design_details: appLanguage === "en"
      ? "A coordinated traditional outfit design."
      : "पारंपरिक कपड़ों का मेल खाता डिज़ाइन।"
  };
}

function localizeOutfitForDisplay(outfit) {
  const localized = { ...outfit };
  const fallback = outfitFallbackValues(currentSelection?.outfit_type);
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
  document.getElementById("outfitTop").textContent = outfit.top;
  document.getElementById("outfitBottom").textContent = outfit.bottom;
  document.getElementById("outfitShoes").textContent = outfit.shoes;
  document.getElementById("outfitAccessory").textContent = outfit.accessory;
  document.getElementById("outfitEyewear").textContent = outfit.eyewear || "—";
  document.getElementById("weatherTip").textContent = outfit.weather_tip;
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
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const photoPreviewBox = document.getElementById("photoPreviewBox");
const photoMessage = document.getElementById("photoMessage");
const removePhotoButton = document.getElementById("removePhoto");

let photoPreviewUrl = null;

photoInput.addEventListener("change", () => {
  photoMessage.textContent = "";
  const file = photoInput.files[0];

  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    photoMessage.textContent = translateText("JPG, PNG या WebP फोटो चुनें।");
    photoInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    photoMessage.textContent = translateText("फोटो 5 MB से छोटी होनी चाहिए।");
    photoInput.value = "";
    return;
  }

  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);

  photoPreviewUrl = URL.createObjectURL(file);
  photoPreview.src = photoPreviewUrl;
  photoPreviewBox.hidden = false;
});

removePhotoButton.addEventListener("click", () => {
  photoInput.value = "";
  photoPreview.removeAttribute("src");
  photoPreviewBox.hidden = true;
  photoMessage.textContent = "";
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = null;
});
const analyzePhotoButton = document.getElementById("analyzePhotoButton");
const photoConsent = document.getElementById("photoConsent");
const analysisMessage = document.getElementById("analysisMessage");

analyzePhotoButton.addEventListener("click", async () => {
  const file = photoInput.files[0];

  if (!file) {
    analysisMessage.textContent = translateText("पहले फोटो चुनो।");
    return;
  }

  if (!photoConsent.checked) {
    analysisMessage.textContent = translateText("पहले फोटो विश्लेषण की अनुमति दो।");
    return;
  }

  currentSelection = {
    party_type: document.getElementById("partyType").value,
    style: document.getElementById("style").value,
    weather: document.getElementById("weather").value,
    audience: document.getElementById("audience").value,
    outfit_type: document.getElementById("outfitType").value,
    bottom_preference: document.getElementById("bottomPreference").value,
    location: locationInput.value.trim()
  };

  const formData = new FormData();
  formData.append("photo", file);
  formData.append("photo_consent", "yes");
  formData.append("language", document.getElementById("languageSelect")?.value || "hi");

  Object.entries(currentSelection).forEach(([key, value]) => {
    formData.append(key, value);
  });

  analyzePhotoButton.disabled = true;
  analysisMessage.textContent = translateText("फोटो देखकर सुझाव बनाया जा रहा है…");

  try {
    const response = await fetch("/api/analyze-photo", {
      method: "POST",
      body: formData
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "फोटो से सुझाव नहीं बन पाया।");
    }

    showOutfit(data.outfit);
    analysisMessage.textContent = translateText("तुम्हारा फोटो-आधारित लुक तैयार है।");
  } catch (error) {
    analysisMessage.textContent = translateText(error.message);
  } finally {
    analyzePhotoButton.disabled = false;
  }
});

function showCalendarEvent(event) {
  currentCalendarEvent = event;
  document.getElementById("calendarEventName").textContent = event.summary;
  const start = new Date(event.starts_at);
  document.getElementById("calendarEventTime").textContent =
    Number.isNaN(start.getTime())
      ? event.starts_at
      : start.toLocaleString(appLanguage === "en" ? "en" : "hi-IN", {
        dateStyle: "full",
        timeStyle: "short"
      });
  document.getElementById("calendarEventLocation").textContent =
    event.location || translateText("इस calendar event में venue/location नहीं दिया गया है।");
  calendarEventPanel.hidden = false;
  routeButton.disabled = !event.location;
  routeMessage.textContent = "";
  routeSummary.hidden = true;
  routeMapElement.hidden = true;
  if (routeMapInstance) {
    routeMapInstance.remove();
    routeMapInstance = null;
  }
}

async function createNextEventLook() {
  const response = await fetch("/api/calendar/plan", { method: "POST" });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "अगले event का look नहीं बन पाया।");
  currentSelection = data.selection;
  showCalendarEvent(data.event);
  showOutfit(data.outfit);
}

calendarForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  calendarMessage.textContent = "";
  const submitButton = calendarForm.querySelector('button[type="submit"]');
  const submitLabel = submitButton.querySelector("span");
  submitButton.disabled = true;
  submitLabel.textContent = appLanguage === "en" ? "Importing calendar…" : "Calendar import हो रहा है…";

  const formData = new FormData(calendarForm);
  formData.set(
    "timezone",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  try {
    const response = await fetch("/api/calendar/import", {
      method: "POST",
      body: formData
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Calendar import नहीं हुआ।");
    calendarMessage.textContent = appLanguage === "en"
      ? `${data.event_count} calendar event${data.event_count === 1 ? "" : "s"} imported.`
      : translateText(data.message);
    if (data.event) await createNextEventLook();
  } catch (error) {
    calendarMessage.textContent = translateText(error.message);
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = translateText("Calendar import करके look बनाओ");
  }
});

async function loadCalendarEvent() {
  try {
    const response = await fetch("/api/calendar/next");
    const data = await readJsonResponse(response);
    if (response.ok && data.event) {
      showCalendarEvent(data.event);
      await createNextEventLook();
    }
  } catch (error) {
    calendarMessage.textContent = translateText(error.message);
  }
}

function showRouteOnMap(route, origin) {
  if (!window.L) throw new Error("Map library load नहीं हुई। पेज refresh करके फिर कोशिश करें।");
  routeMapElement.hidden = false;
  routeSummary.hidden = false;
  routeMapInstance = L.map(routeMapElement);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(routeMapInstance);
  const routeLayer = L.geoJSON({
    type: "Feature",
    properties: {},
    geometry: route.geometry
  }, {
    style: { color: "#ff8fb3", weight: 5, opacity: 0.9 }
  }).addTo(routeMapInstance);
  const destination = [
    route.destination.latitude,
    route.destination.longitude
  ];
  L.marker([origin.latitude, origin.longitude])
    .addTo(routeMapInstance)
    .bindPopup(appLanguage === "en" ? "Your location" : "आपकी जगह");
  L.marker(destination)
    .addTo(routeMapInstance)
    .bindPopup(currentCalendarEvent.location);
  const bounds = routeLayer.getBounds().extend(destination).extend([
    origin.latitude,
    origin.longitude
  ]);
  routeMapInstance.fitBounds(bounds.pad(0.12));
  const distance = new Intl.NumberFormat(
    appLanguage === "en" ? "en" : "hi-IN",
    { maximumFractionDigits: 1 }
  ).format(route.distance_meters / 1000);
  const minutes = Math.round(route.duration_seconds / 60);
  routeSummary.textContent = appLanguage === "en"
    ? `Driving route: ${distance} km · about ${minutes} min`
    : `सड़क मार्ग: ${distance} km · लगभग ${minutes} मिनट`;
}

async function requestEventRoute(position) {
  const origin = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
  const response = await fetch("/api/calendar/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_id: currentCalendarEvent.id,
      ...origin
    })
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || "Map route नहीं बन पाया।");
  showRouteOnMap(data, origin);
}

routeButton.addEventListener("click", () => {
  routeMessage.textContent = "";
  if (!navigator.geolocation) {
    routeMessage.textContent = appLanguage === "en"
      ? "This browser does not support location access."
      : "इस browser में location की सुविधा उपलब्ध नहीं है।";
    return;
  }
  routeButton.disabled = true;
  routeButton.querySelector("span").textContent =
    appLanguage === "en" ? "Finding route…" : "रास्ता खोज रहे हैं…";
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await requestEventRoute(position);
      } catch (error) {
        routeMessage.textContent = translateText(error.message);
      } finally {
        routeButton.disabled = !currentCalendarEvent?.location;
        routeButton.querySelector("span").textContent = translateText(
          "मेरी जगह से रास्ता दिखाओ"
        );
      }
    },
    (error) => {
      routeMessage.textContent = error.code === error.PERMISSION_DENIED
        ? (appLanguage === "en"
          ? "Location permission was denied. Allow it in your browser and retry."
          : "Location की अनुमति नहीं मिली। Browser में अनुमति देकर फिर कोशिश करें।")
        : (appLanguage === "en"
          ? "Could not read your current location. Retry when location is available."
          : "आपकी current location नहीं मिल पाई। उपलब्ध होने पर फिर कोशिश करें।");
      routeButton.disabled = !currentCalendarEvent?.location;
      routeButton.querySelector("span").textContent = translateText(
        "मेरी जगह से रास्ता दिखाओ"
      );
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
  );
});

async function loadBuiltinCatalog() {
  const catalogElement = document.getElementById("builtinCatalog");
  try {
    const response = await fetch("/api/catalog");
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Catalog load नहीं हो पाया।");
    const icons = {
      top: "👕", bottom: "👖", shorts: "🩳", shoes: "👟",
      accessory: "⌚", eyewear: "👓", saree: "🥻",
      salwar: "👗", lehenga: "👗", kurti: "👚"
    };
    catalogElement.replaceChildren();
    for (const item of data.items) {
      const card = document.createElement("article");
      card.className = "catalog-item";
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = icons[item.category] || "✨";
      const name = document.createElement("strong");
      name.textContent = translateText(item.name);
      const category = document.createElement("small");
      category.textContent = translateText(categoryNames[item.category] || item.category);
      card.append(icon, name, category);
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
loadCalendarEvent();
