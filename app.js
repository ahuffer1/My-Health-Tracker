
const STORAGE_KEY = "myHealthTracker";

const defaultData = {
  goals: {
    calories: 1500,
    protein: 120,
    water: 80,
    startingWeight: 150,
    goalWeight: 130
  },
  foods: [],
  exercises: [],
  water: [],
  weights: [],
  savedFoods: []
};

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return copy(defaultData);

    const parsed = JSON.parse(saved);

    return {
      ...copy(defaultData),
      ...parsed,
      goals: { ...defaultData.goals, ...(parsed.goals || {}) },
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
      water: Array.isArray(parsed.water) ? parsed.water : [],
      weights: Array.isArray(parsed.weights) ? parsed.weights : [],
      savedFoods: Array.isArray(parsed.savedFoods) ? parsed.savedFoods : []
    };
  } catch (error) {
    console.error("Could not load saved data:", error);
    return copy(defaultData);
  }
}

let data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render();
  } catch (error) {
    alert("Unable to save your information. Check your iPhone storage settings.");
    console.error(error);
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function today() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getDailyTotals() {
  const date = today();
  const foods = data.foods.filter(item => item.date === date);
  const exercises = data.exercises.filter(item => item.date === date);
  const water = data.water.filter(item => item.date === date);

  return {
    calories: foods.reduce((sum, item) => sum + numberValue(item.calories), 0),
    protein: foods.reduce((sum, item) => sum + numberValue(item.protein), 0),
    carbs: foods.reduce((sum, item) => sum + numberValue(item.carbs), 0),
    fat: foods.reduce((sum, item) => sum + numberValue(item.fat), 0),
    water: water.reduce((sum, item) => sum + numberValue(item.amount), 0),
    exerciseMinutes: exercises.reduce((sum, item) => sum + numberValue(item.minutes), 0),
    caloriesBurned: exercises.reduce((sum, item) => sum + numberValue(item.burned), 0)
  };
}

function getLatestWeight() {
  if (!data.weights.length) return data.goals.startingWeight;

  return [...data.weights].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") ||
    numberValue(b.createdAt) - numberValue(a.createdAt)
  )[0].weight;
}

function getFastingStatus() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  return minutes >= 11 * 60 && minutes < 19 * 60
    ? "Eating window is open"
    : "Fasting window";
}

function renderDashboard() {
  const totals = getDailyTotals();

  document.querySelectorAll("[data-total]").forEach(element => {
    const key = element.dataset.total;
    if (key in totals) {
      element.textContent = Math.round(totals[key] * 10) / 10;
    }
  });

  document.querySelectorAll("[data-remaining]").forEach(element => {
    const key = element.dataset.remaining;
    const goal = numberValue(data.goals[key]);
    element.textContent = Math.max(0, goal - numberValue(totals[key]));
  });

  document.querySelectorAll("[data-progress]").forEach(element => {
    const key = element.dataset.progress;
    const goal = numberValue(data.goals[key]);
    const percent = goal > 0
      ? Math.min(100, numberValue(totals[key]) / goal * 100)
      : 0;

    element.style.width = `${percent}%`;
  });

  document.querySelectorAll("[data-weight-current]").forEach(element => {
    element.textContent = `${getLatestWeight()} lb`;
  });

  document.querySelectorAll("[data-fasting-status]").forEach(element => {
    element.textContent = getFastingStatus();
  });

  const dateElement = document.getElementById("todayDate");
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }
}

function renderFoods() {
  const container = document.getElementById("foodList");
  if (!container) return;

  const foods = data.foods.filter(item => item.date === today());
  const meals = ["Breakfast", "Lunch", "Dinner", "Snacks"];

  if (!foods.length) {
    container.innerHTML = '<p class="empty-state">No food logged today yet.</p>';
    return;
  }

  container.innerHTML = meals.map(meal => {
    const entries = foods.filter(item => item.meal === meal);
    if (!entries.length) return "";

    return `
      <div class="meal-group">
        <h3>${meal}</h3>
        ${entries.map(item => `
          <div class="entry">
            <div class="entry-info">
              <strong>${escapeHTML(item.name)}</strong>
              <small>${escapeHTML(item.brand || "")} ${item.serving ? "· " + escapeHTML(item.serving) : ""}</small>
              <small>${numberValue(item.calories)} kcal · ${numberValue(item.protein)} g protein</small>
              <small>${numberValue(item.carbs)} g carbs · ${numberValue(item.fat)} g fat</small>
            </div>
            <div class="entry-actions">
              <button type="button" onclick="Tracker.editFood('${item.id}')">Edit</button>
              <button type="button" onclick="Tracker.deleteFood('${item.id}')">Delete</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderExercises() {
  const container = document.getElementById("exerciseList");
  if (!container) return;

  const entries = data.exercises
    .filter(item => item.date === today())
    .sort((a, b) => numberValue(b.createdAt) - numberValue(a.createdAt));

  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No exercise logged today yet.</p>';
    return;
  }

  container.innerHTML = entries.map(item => `
    <div class="entry">
      <div class="entry-info">
        <strong>${escapeHTML(item.name)}</strong>
        <small>${escapeHTML(item.type)} · ${numberValue(item.minutes)} minutes</small>
        <small>
          ${item.burned ? numberValue(item.burned) + " estimated calories burned · " : ""}
          ${item.weight ? numberValue(item.weight) + " lb · " : ""}
          ${item.sets ? numberValue(item.sets) + " sets · " : ""}
          ${item.reps ? numberValue(item.reps) + " reps" : ""}
        </small>
      </div>
      <div class="entry-actions">
        <button type="button" onclick="Tracker.editExercise('${item.id}')">Edit</button>
        <button type="button" onclick="Tracker.deleteExercise('${item.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderWater() {
  const container = document.getElementById("waterList");
  if (!container) return;

  const entries = data.water
    .filter(item => item.date === today())
    .sort((a, b) => numberValue(b.createdAt) - numberValue(a.createdAt));

  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No water logged today yet.</p>';
    return;
  }

  container.innerHTML = entries.map(item => `
    <div class="entry">
      <div class="entry-info">
        <strong>${numberValue(item.amount)} oz water</strong>
        <small>${escapeHTML(item.time || "")}</small>
      </div>
      <div class="entry-actions">
        <button type="button" onclick="Tracker.editWater('${item.id}')">Edit</button>
        <button type="button" onclick="Tracker.deleteWater('${item.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderWeights() {
  const container = document.getElementById("weightList");
  if (!container) return;

  const entries = [...data.weights].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") ||
    numberValue(b.createdAt) - numberValue(a.createdAt)
  );

  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No weigh-ins logged yet.</p>';
    return;
  }

  container.innerHTML = entries.map(item => `
    <div class="entry">
      <div class="entry-info">
        <strong>${numberValue(item.weight)} lb</strong>
        <small>${formatDate(item.date)}</small>
      </div>
      <div class="entry-actions">
        <button type="button" onclick="Tracker.editWeight('${item.id}')">Edit</button>
        <button type="button" onclick="Tracker.deleteWeight('${item.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderProgress() {
  const container = document.getElementById("progressDetails");
  if (!container) return;

  const totals = getDailyTotals();
  const current = numberValue(getLatestWeight());
  const starting = numberValue(data.goals.startingWeight);
  const goal = numberValue(data.goals.goalWeight);
  const change = starting - current;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const cutoff = [
    sevenDaysAgo.getFullYear(),
    String(sevenDaysAgo.getMonth() + 1).padStart(2, "0"),
    String(sevenDaysAgo.getDate()).padStart(2, "0")
  ].join("-");

  const inWeek = list => list.filter(item => item.date >= cutoff && item.date <= today());

  const weeklyFoods = inWeek(data.foods);
  const weeklyExercises = inWeek(data.exercises);
  const weeklyWater = inWeek(data.water);

  const weeklyCalories = weeklyFoods.reduce((sum, item) => sum + numberValue(item.calories), 0);
  const weeklyProtein = weeklyFoods.reduce((sum, item) => sum + numberValue(item.protein), 0);
  const weeklyMinutes = weeklyExercises.reduce((sum, item) => sum + numberValue(item.minutes), 0);
  const weeklyWaterOz = weeklyWater.reduce((sum, item) => sum + numberValue(item.amount), 0);

  container.innerHTML = `
    <div class="progress-card">
      <h3>Weight Progress</h3>
      <p>Starting weight: <strong>${starting} lb</strong></p>
      <p>Current weight: <strong>${current} lb</strong></p>
      <p>Goal weight: <strong>${goal} lb</strong></p>
      <p>${change >= 0 ? change.toFixed(1) + " lb lost" : Math.abs(change).toFixed(1) + " lb gained"} since starting</p>
      <p>${current > goal ? (current - goal).toFixed(1) + " lb to goal" : "Goal weight reached!"}</p>
    </div>
    <div class="progress-card">
      <h3>Today's Nutrition</h3>
      <p>Calories: <strong>${Math.round(totals.calories)} / ${data.goals.calories}</strong></p>
      <p>Protein: <strong>${Math.round(totals.protein)} / ${data.goals.protein} g</strong></p>
      <p>Water: <strong>${Math.round(totals.water)} / ${data.goals.water} oz</strong></p>
      <p>Exercise: <strong>${Math.round(totals.exerciseMinutes)} minutes</strong></p>
    </div>
    <div class="progress-card">
      <h3>Last 7 Days</h3>
      <p>Calories logged: <strong>${Math.round(weeklyCalories)}</strong></p>
      <p>Protein logged: <strong>${Math.round(weeklyProtein)} g</strong></p>
      <p>Exercise: <strong>${Math.round(weeklyMinutes)} minutes</strong></p>
      <p>Water: <strong>${Math.round(weeklyWaterOz)} oz</strong></p>
    </div>
  `;
}

function render() {
  renderDashboard();
  renderFoods();
  renderExercises();
  renderWater();
  renderWeights();
  renderProgress();
}

/* FOOD FORM */

function addFood(event) {
  event.preventDefault();

  const name = document.getElementById("foodName").value.trim();
  if (!name) return alert("Enter a food name.");

  data.foods.push({
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    name,
    brand: document.getElementById("foodBrand").value.trim(),
    meal: document.getElementById("foodMeal").value,
    serving: document.getElementById("foodServing").value.trim(),
    calories: numberValue(document.getElementById("foodCalories").value),
    protein: numberValue(document.getElementById("foodProtein").value),
    carbs: numberValue(document.getElementById("foodCarbs").value),
    fat: numberValue(document.getElementById("foodFat").value)
  });

  saveData();
  event.target.reset();
}

/* EXERCISE FORM */

function addExercise(event) {
  event.preventDefault();

  const name = document.getElementById("exerciseName").value.trim();
  if (!name) return alert("Enter an exercise name.");

  data.exercises.push({
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    name,
    type: document.getElementById("exerciseType").value,
    minutes: numberValue(document.getElementById("exerciseMinutes").value),
    burned: numberValue(document.getElementById("exerciseBurned").value),
    weight: numberValue(document.getElementById("exerciseWeight").value),
    sets: numberValue(document.getElementById("exerciseSets").value),
    reps: numberValue(document.getElementById("exerciseReps").value)
  });

  saveData();
  event.target.reset();
}

/* WATER FORM */

function addWater(amount) {
  amount = numberValue(amount);
  if (amount <= 0) return;

  data.water.push({
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    time: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    }),
    amount
  });

  saveData();
}

/* WEIGHT FORM */

function addWeight(event) {
  event.preventDefault();

  const weight = numberValue(document.getElementById("weightInput").value);
  if (weight <= 0) return alert("Enter a valid weight.");

  data.weights.push({
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    weight
  });

  saveData();
  event.target.reset();
}

/* EDIT AND DELETE */

function findEntry(list, id) {
  return list.find(item => item.id === id);
}

function askNumber(label, current) {
  const answer = prompt(`Update ${label}:`, String(current ?? ""));
  if (answer === null) return null;

  const number = Number(answer);
  if (!Number.isFinite(number) || number < 0) {
    alert("Please enter a valid number.");
    return null;
  }
  return number;
}

function askText(label, current) {
  const answer = prompt(`Update ${label}:`, String(current ?? ""));
  return answer === null ? null : answer.trim();
}

function editFood(id) {
  const item = findEntry(data.foods, id);
  if (!item) return;

  const name = askText("food name", item.name);
  if (name === null) return;
  const calories = askNumber("calories", item.calories);
  if (calories === null) return;
  const protein = askNumber("protein", item.protein);
  if (protein === null) return;

  item.name = name;
  item.calories = calories;
  item.protein = protein;

  const serving = askText("serving size", item.serving);
  if (serving !== null) item.serving = serving;

  saveData();
}

function editExercise(id) {
  const item = findEntry(data.exercises, id);
  if (!item) return;

  const name = askText("exercise name", item.name);
  if (name === null) return;
  const minutes = askNumber("minutes", item.minutes);
  if (minutes === null) return;

  item.name = name;
  item.minutes = minutes;
  saveData();
}

function editWater(id) {
  const item = findEntry(data.water, id);
  if (!item) return;

  const amount = askNumber("water ounces", item.amount);
  if (amount === null) return;

  item.amount = amount;
  saveData();
}

function editWeight(id) {
  const item = findEntry(data.weights, id);
  if (!item) return;

  const weight = askNumber("weight in pounds", item.weight);
  if (weight === null || weight <= 0) return;

  item.weight = weight;
  saveData();
}

function deleteEntry(list, id, label) {
  if (!confirm(`Delete this ${label} entry?`)) return;
  const index = list.findIndex(item => item.id === id);
  if (index !== -1) {
    list.splice(index, 1);
    saveData();
  }
}

function deleteFood(id) {
  deleteEntry(data.foods, id, "food");
}

function deleteExercise(id) {
  deleteEntry(data.exercises, id, "exercise");
}

function deleteWater(id) {
  deleteEntry(data.water, id, "water");
}

function deleteWeight(id) {
  deleteEntry(data.weights, id, "weight");
}

/* NAVIGATION */

function showScreen(screenName) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === screenName);
  });

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.classList.toggle("active", button.dataset.screen === screenName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* BARCODE LOOKUP */

async function lookupFoodBarcode(barcode) {
  const status = document.getElementById("scanStatus");
  if (status) status.textContent = "Looking up product...";

  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,quantity,serving_size,nutriments`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Product lookup failed.");

    const result = await response.json();

    if (result.status !== 1 || !result.product) {
      if (status) {
        status.textContent = "Product not found. Please enter the nutrition information manually.";
      }
      return;
    }

    const product = result.product;
    const nutrients = product.nutriments || {};

    const value = key => {
      const found = nutrients[key];
      return found === undefined || found === null ? null : Number(found);
    };

    const servingValues = {
      calories: value("energy-kcal_serving"),
      protein: value("proteins_serving"),
      carbs: value("carbohydrates_serving"),
      fat: value("fat_serving")
    };

    const hasServingData = Object.values(servingValues).some(
      item => item !== null && Number.isFinite(item)
    );

    const per100 = {
      calories: value("energy-kcal_100g"),
      protein: value("proteins_100g"),
      carbs: value("carbohydrates_100g"),
      fat: value("fat_100g")
    };

    const chosen = hasServingData ? servingValues : per100;

    document.getElementById("foodName").value =
      product.product_name || "";

    document.getElementById("foodBrand").value =
      product.brands || "";

    document.getElementById("foodServing").value =
      hasServingData
        ? (product.serving_size || product.quantity || "1 serving")
        : "100 g (database values per 100 g)";

    document.getElementById("foodCalories").value =
      chosen.calories === null ? "" : Math.round(chosen.calories);

    document.getElementById("foodProtein").value =
      chosen.protein === null ? "" : chosen.protein.toFixed(1);

    document.getElementById("foodCarbs").value =
      chosen.carbs === null ? "" : chosen.carbs.toFixed(1);

    document.getElementById("foodFat").value =
      chosen.fat === null ? "" : chosen.fat.toFixed(1);

    if (status) {
      status.textContent =
        "Product found! Review the serving size and nutrition values, then tap Add Food to Diary.";
    }

    document.getElementById("foodName").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

  } catch (error) {
    console.error("Barcode lookup error:", error);
    if (status) {
      status.textContent = "Could not look up this barcode. Please try again or enter the food manually.";
    }
  }
}

/* CAMERA SCANNER */

let foodScanner = null;
let scannerRunning = false;

function setScannerStatus(message) {
  const status = document.getElementById("scanStatus");
  if (status) status.textContent = message;
}

async function stopFoodScanner() {
  if (!foodScanner || !scannerRunning) return;

  try {
    await foodScanner.stop();
  } catch (error) {
    console.warn("Scanner stop:", error);
  }

  scannerRunning = false;

  try {
    await foodScanner.clear();
  } catch (error) {
    console.warn("Scanner clear:", error);
  }

  foodScanner = null;
}

async function startFoodScanner() {
  const reader = document.getElementById("reader");

  if (!reader) return;

  if (!window.isSecureContext) {
    setScannerStatus("Camera scanning requires the secure HTTPS version of your GitHub Pages app.");
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    setScannerStatus("Scanner library did not load. Check your internet connection and refresh the app.");
    return;
  }

  if (scannerRunning) return;

  const startButton = document.getElementById("startScanner");
  if (startButton) startButton.disabled = true;

  setScannerStatus("Starting camera. Please allow camera access if asked.");

  try {
    foodScanner = new Html5Qrcode("barcodeCamera");

    await foodScanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 260, height: 150 },
        aspectRatio: 1.5
      },
      async barcode => {
        if (!scannerRunning) return;

        scannerRunning = false;
        setScannerStatus(`Barcode scanned: ${barcode}. Looking up product...`);

        await stopFoodScanner();
        await lookupFoodBarcode(barcode);

        const button = document.getElementById("startScanner");
        if (button) button.disabled = false;
      },
      () => {
        // Ignore normal camera frames where no barcode is detected.
      }
    );

    scannerRunning = true;
    setScannerStatus("Point your camera at the product barcode.");

  } catch (error) {
    console.error("Camera error:", error);
    foodScanner = null;
    scannerRunning = false;

    setScannerStatus(
      "Camera could not start. Check Safari camera permission and make sure you opened the HTTPS app."
    );

    if (startButton) startButton.disabled = false;
  }
}

function initializeFoodScanner() {
  const reader = document.getElementById("reader");
  if (!reader) return;

  reader.innerHTML = `
    <button type="button" id="startScanner" class="scanner-start">
      Start Barcode Scanner
    </button>
    <div id="barcodeCamera"></div>
  `;

  document.getElementById("startScanner").addEventListener("click", startFoodScanner);
}

/* CONNECT FORMS AND BUTTONS */

function connectForms() {
  document.getElementById("foodForm")?.addEventListener("submit", addFood);
  document.getElementById("exerciseForm")?.addEventListener("submit", addExercise);
  document.getElementById("weightForm")?.addEventListener("submit", addWeight);

  document.getElementById("customWaterForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = document.getElementById("customWater");
    addWater(input.value);
    event.target.reset();
  });

  document.querySelectorAll("[data-water]").forEach(button => {
    button.addEventListener("click", () => addWater(button.dataset.water));
  });

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });
}

window.Tracker = {
  addFood,
  addExercise,
  addWater,
  addWeight,
  editFood,
  editExercise,
  editWater,
  editWeight,
  deleteFood,
  deleteExercise,
  deleteWater,
  deleteWeight,
  showScreen,
  lookupFoodBarcode,
  startFoodScanner
};

document.addEventListener("DOMContentLoaded", () => {
  connectForms();
  initializeFoodScanner();
  render();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error => console.error("Offline setup failed:", error));
  }
});
