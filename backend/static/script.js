const form = document.getElementById("outfitForm");
const errorMessage = document.getElementById("errorMessage");
const saveMessage = document.getElementById("saveMessage");
const saveButton = document.getElementById("saveButton");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const outfitResult = document.getElementById("outfitResult");

const wardrobeForm = document.getElementById("wardrobeForm");
const wardrobeMessage = document.getElementById("wardrobeMessage");
const wardrobeList = document.getElementById("wardrobeList");
const emptyWardrobe = document.getElementById("emptyWardrobe");
const wardrobeCount = document.getElementById("wardrobeCount");

let currentSelection = null;
let currentOutfit = null;

const categoryNames = {
  top: "शर्ट / टॉप",
  bottom: "पैंट",
  shorts: "शॉर्ट्स",
  shoes: "जूते",
  accessory: "एक्सेसरी"
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  saveMessage.textContent = "";

  currentSelection = {
    party_type: document.getElementById("partyType").value,
    style: document.getElementById("style").value,
    weather: document.getElementById("weather").value,
    audience: document.getElementById("audience").value,
    bottom_preference: document.getElementById("bottomPreference").value
  };

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector("span").textContent = "लुक बन रहा है…";

  try {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentSelection)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "लुक बनाते समय समस्या आई।");
    }

    showOutfit(data.outfit);
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "मेरा लुक सुझाओ";
  }
});

function showOutfit(outfit) {
  currentOutfit = outfit;
  document.getElementById("partyName").textContent = outfit.party_name;
  document.getElementById("styleName").textContent =
    `${outfit.audience_name} · ${outfit.style_name} स्टाइल`;
  document.getElementById("outfitTop").textContent = outfit.top;
  document.getElementById("outfitBottom").textContent = outfit.bottom;
  document.getElementById("outfitShoes").textContent = outfit.shoes;
  document.getElementById("outfitAccessory").textContent = outfit.accessory;
  document.getElementById("weatherTip").textContent = outfit.weather_tip;

  resultPlaceholder.hidden = true;
  outfitResult.hidden = false;
}

saveButton.addEventListener("click", async () => {
  if (!currentSelection) {
    saveMessage.textContent = "पहले अपना लुक बनाओ।";
    return;
  }

  saveButton.disabled = true;
  saveMessage.textContent = "सेव हो रहा है…";

  try {
    const response = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...currentSelection, outfit: currentOutfit })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "लुक सेव नहीं हो पाया।");
    }

    saveMessage.textContent = "✓ " + data.message;
    await loadHistory();
  } catch (error) {
    saveMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

wardrobeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  wardrobeMessage.textContent = "";

  const item = {
    name: document.getElementById("wardrobeName").value.trim(),
    category: document.getElementById("wardrobeCategory").value,
    color: document.getElementById("wardrobeColor").value.trim()
  };

  const addButton = wardrobeForm.querySelector('button[type="submit"]');
  addButton.disabled = true;
  addButton.textContent = "जोड़ा जा रहा है…";

  try {
    const response = await fetch("/api/wardrobe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "कपड़ा नहीं जुड़ पाया।");
    }

    wardrobeForm.reset();
    wardrobeMessage.textContent = "✓ " + data.message;
    await loadWardrobe();
  } catch (error) {
    wardrobeMessage.textContent = error.message;
  } finally {
    addButton.disabled = false;
    addButton.textContent = "＋ अलमारी में जोड़ो";
  }
});

async function loadWardrobe() {
  try {
    const response = await fetch("/api/wardrobe");
    const data = await response.json();

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
    emptyWardrobe.textContent = error.message;
  }
}

function createWardrobeCard(item) {
  const card = document.createElement("article");
  card.className = "history-card";

  const title = document.createElement("h3");
  title.textContent = item.name;

  const details = document.createElement("p");
  const category = categoryNames[item.category] || item.category;
  details.textContent = item.color
    ? `${category} · ${item.color}`
    : category;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "हटाएँ";
  deleteButton.addEventListener("click", () => deleteWardrobeItem(item.id));

  card.append(title, details, deleteButton);
  return card;
}

async function deleteWardrobeItem(id) {
  wardrobeMessage.textContent = "";

  try {
    const response = await fetch(`/api/wardrobe/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "कपड़ा हटाया नहीं जा सका।");
    }

    wardrobeMessage.textContent = "✓ " + data.message;
    await loadWardrobe();
  } catch (error) {
    wardrobeMessage.textContent = error.message;
  }
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  const emptyHistory = document.getElementById("emptyHistory");
  const historyCount = document.getElementById("historyCount");

  try {
    const response = await fetch("/api/outfits");
    const data = await response.json();

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
    emptyHistory.textContent = error.message;
  }
}

function createHistoryCard(saved) {
  const card = document.createElement("article");
  card.className = "history-card";

  const title = document.createElement("h3");
  title.textContent =
    `${saved.outfit.party_name} · ${saved.outfit.style_name}`;

  const details = document.createElement("p");
  details.textContent =
    `👕 ${saved.outfit.top} · 👖 ${saved.outfit.bottom} · 👟 ${saved.outfit.shoes}`;

  const date = document.createElement("p");
  date.textContent = `सेव किया: ${saved.created_at}`;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "हटाएँ";
  deleteButton.addEventListener("click", () => deleteOutfit(saved.id));

  card.append(title, details, date, deleteButton);
  return card;
}

async function deleteOutfit(id) {
  try {
    const response = await fetch(`/api/outfits/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "लुक हटाया नहीं जा सका।");
    }

    await loadHistory();
  } catch (error) {
    alert(error.message);
  }
}

loadWardrobe();
loadHistory();
const languageSelect = document.getElementById("languageSelect");
let appLanguage = localStorage.getItem("lookbook-language") || "hi";

const englishText = {
  "पुरुष": "Men", "महिला": "Women",
  "बर्थडे पार्टी": "Birthday party", "शादी की पार्टी": "Wedding party",
  "कैज़ुअल पार्टी": "Casual party", "नाइट पार्टी": "Night party",
  "कैज़ुअल": "Casual", "स्मार्ट": "Smart", "बोल्ड": "Bold",

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

  "ठंड के लिए जैकेट या ब्लेज़र साथ रखें।": "Bring a jacket or blazer for cold weather.",
  "बारिश में पानी से कम खराब होने वाले जूते चुनें।": "Choose shoes that can handle rain.",
  "गर्मी में हल्के और आरामदायक कपड़े चुनें।": "Choose light, comfortable clothes for warm weather."
};

function translateText(text) {
  if (appLanguage !== "en") return text;

  return Object.entries(englishText)
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((value, [hindi, english]) => value.replaceAll(hindi, english), text);
}

function setEnglish(selector, english, asHtml = false) {
  const element = document.querySelector(selector);
  if (!element) return;

  const key = asHtml ? "hindiHtml" : "hindiText";
  if (!(key in element.dataset)) {
    element.dataset[key] = asHtml ? element.innerHTML : element.textContent;
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

  setEnglish(".topbar-note", '<span class="status-dot"></span> Your style assistant', true);
  setEnglish(".topbar-actions .logout-button", "Log out");
  setEnglish(".hero-copy .eyebrow", "YOUR PLAN, YOUR STYLE");
  setEnglish(".hero h1", "For the party,<br><span>the perfect look.</span>", true);
  setEnglish(".hero-description", "Plan your next outfit around the party, weather, and your mood.");
  setEnglish(".hero-tag", "LOOK GOOD.<br>FEEL GREAT.", true);

  setEnglish(".form-panel .eyebrow", "LET'S GET READY");
  setEnglish(".form-panel h2", "Tell us about the party");
  setEnglish('label[for="partyType"]', "What kind of party?");
  setEnglish('label[for="audience"]', "Who is the look for?");
  setEnglish('label[for="style"]', "Choose a style");
  setEnglish('label[for="weather"]', "What's the weather?");
  setEnglish('label[for="bottomPreference"]', "Choose pants or shorts");
  setOption('#partyType option[value="birthday"]', "🎂 Birthday party");
  setOption('#partyType option[value="wedding"]', "💐 Wedding party");
  setOption('#partyType option[value="casual"]', "🎈 Casual party");
  setOption('#partyType option[value="night"]', "🌙 Night party");
  setOption('#audience option[value="men"]', "Men");
  setOption('#audience option[value="women"]', "Women");
  setOption('#style option[value="casual"]', "Relaxed and casual");
  setOption('#style option[value="smart"]', "Smart and classic");
  setOption('#style option[value="bold"]', "Bold and trendy");
  setOption('#weather option[value="warm"]', "☀️ Warm / clear");
  setOption('#weather option[value="cold"]', "❄️ Cold");
  setOption('#weather option[value="rainy"]', "🌧️ Rainy");
  setOption('#bottomPreference option[value="trousers"]', "Long pants");
  setOption('#bottomPreference option[value="shorts"]', "Shorts");
  setEnglish(".form-panel .primary-button span:first-child", "Suggest my look");

  setEnglish(".result-panel .eyebrow", "MADE FOR YOUR PLAN");
  setEnglish(".result-panel h2", "Your look");
  setEnglish("#resultPlaceholder p", "Choose your party details.<br>Your look will appear here.", true);
  setEnglish("#saveButton span", "Save this look");
  document.querySelectorAll(".outfit-item small").forEach((item, index) => {
    const labels = ["Top", "Bottom", "Shoes", "Accessory"];
    const original = ["ऊपर", "नीचे", "जूते", "एक्सेसरी"];
    item.textContent = appLanguage === "en" ? labels[index] : original[index];
  });

  setEnglish(".wardrobe-section .eyebrow", "MY CLOSET");
  setEnglish(".wardrobe-section h2", "My wardrobe");
  setEnglish('label[for="wardrobeName"]', "Item name");
  setEnglish('label[for="wardrobeCategory"]', "Item type");
  setEnglish('label[for="wardrobeColor"]', "Color (optional)");
  setEnglish("#wardrobeName", "e.g. Oxford shirt");
  setEnglish("#wardrobeColor", "e.g. Navy blue");
  setOption('#wardrobeCategory option[value="top"]', "Shirt / top");
  setOption('#wardrobeCategory option[value="bottom"]', "Pants");
  setOption('#wardrobeCategory option[value="shorts"]', "Shorts");
  setOption('#wardrobeCategory option[value="shoes"]', "Shoes");
  setOption('#wardrobeCategory option[value="accessory"]', "Accessory");
  setEnglish("#wardrobeForm .primary-button", "＋ Add to wardrobe");
  setEnglish("#emptyWardrobe", "Your wardrobe is empty. Add your clothes above.");

  setEnglish(".saved-section:not(.wardrobe-section) .eyebrow", "YOUR COLLECTION");
  setEnglish(".saved-section:not(.wardrobe-section) h2", "Saved looks");
  setEnglish("#emptyHistory", "No looks saved yet. Create and save your first look.");
  setEnglish(".footer span:last-child", "Your style, for every party.");

  if (lastOutfit) showOutfit(lastOutfit);

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

showOutfit = function (outfit) {
  lastOutfit = outfit;
  originalShowOutfit(outfit);

  if (appLanguage === "en") {
    document.getElementById("partyName").textContent = translateText(outfit.party_name);
    document.getElementById("styleName").textContent =
      `${translateText(outfit.audience_name)} · ${translateText(outfit.style_name)} style`;
    document.getElementById("outfitTop").textContent = translateText(outfit.top);
    document.getElementById("outfitBottom").textContent = translateText(outfit.bottom);
    document.getElementById("outfitShoes").textContent = translateText(outfit.shoes);
    document.getElementById("outfitAccessory").textContent = translateText(outfit.accessory);
    document.getElementById("weatherTip").textContent = translateText(outfit.weather_tip);
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
    photoMessage.textContent = "JPG, PNG या WebP फोटो चुनें।";
    photoInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    photoMessage.textContent = "फोटो 5 MB से छोटी होनी चाहिए।";
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
    analysisMessage.textContent = "पहले फोटो चुनो।";
    return;
  }

  if (!photoConsent.checked) {
    analysisMessage.textContent = "पहले फोटो विश्लेषण की अनुमति दो।";
    return;
  }

  currentSelection = {
    party_type: document.getElementById("partyType").value,
    style: document.getElementById("style").value,
    weather: document.getElementById("weather").value,
    audience: document.getElementById("audience").value,
    bottom_preference: document.getElementById("bottomPreference").value
  };

  const formData = new FormData();
  formData.append("photo", file);
  formData.append("photo_consent", "yes");
  formData.append("language", document.getElementById("languageSelect")?.value || "hi");

  Object.entries(currentSelection).forEach(([key, value]) => {
    formData.append(key, value);
  });

  analyzePhotoButton.disabled = true;
  analysisMessage.textContent = "फोटो देखकर सुझाव बनाया जा रहा है…";

  try {
    const response = await fetch("/api/analyze-photo", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "फोटो से सुझाव नहीं बन पाया।");
    }

    showOutfit(data.outfit);
    analysisMessage.textContent = "तुम्हारा फोटो-आधारित लुक तैयार है।";
  } catch (error) {
    analysisMessage.textContent = error.message;
  } finally {
    analyzePhotoButton.disabled = false;
  }
});