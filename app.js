
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

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredCopy(defaultData);

    const parsed = JSON.parse(saved);

    return {
      ...structuredCopy(defaultData),
      ...parsed,
      goals: { ...defaultData.goals, ...(parsed.goals || {}) },
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
      water: Array.isArray(parsed.water) ? parsed.water : [],
      weights: Array.isArray(parsed.weights) ? parsed.weights : [],
      savedFoods: Array.isArray(parsed.savedFoods) ? parsed.savedFoods : []
    };
  } catch (error) {
    console.error("Could not load tracker data:", error);
    return structuredCopy(defaultData);
  }
}

function structuredCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

let data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render();
  } catch (error) {
    alert("Your changes could not be saved. Check your iPhone storage settings.");
    console.error(error);
  }
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
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

  return [...data.weights]
    .sort((a, b) => {
      const dateCompare = (b.date || "").localeCompare(a.date || "");
      return dateCompare || numberValue(b.createdAt) - numberValue(a.createdAt);
    })[0].weight;
}

function getFastingStatus() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = 11 * 60;
  const end = 19 * 60;

  if (minutes >= start && minutes < end) {
    return "Eating window is open";
  }

  if (minutes >= end) {
    return "Fasting window";
  }

  return "Fasting window";
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach(element => {
    element.textContent = value;
  });
}

function renderDashboard() {
  const totals = getDailyTotals();

  document.querySelectorAll("[data-total]").forEach(element => {
    const key = element.dataset.total;
    if (Object.prototype.hasOwnProperty.call(totals, key)) {
      element.textContent = Math.round(totals[key] * 10) / 10;
    }
  });

  document.querySelectorAll("[data-remaining]").forEach(element => {
    const key = element.dataset.remaining;
    const goal = numberValue(data.goals[key]);
    const used = numberValue(totals[key]);
    element.textContent = Math.max(0, goal - used);
  });

  document.querySelectorAll("[data-progress]").forEach(element => {
    const key = element.dataset.progress;
    const goal = numberValue(data.goals[key]);
    const current = numberValue(totals[key]);
    const percent = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
    element.style.width = `${percent}%`;
    element.setAttribute("aria-valuenow", String(Math.round(percent)));
  });

  setText("[data-weight-current]", `${getLatestWeight()} lb`);
  setText("[data-fasting-status]", getFastingStatus());

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

  const meals = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const foods = data.foods.filter(item => item.date === today());

  if (!foods.length) {
    container.innerHTML = '<p class="empty-state">No food logged today yet.</p>';
    return;
  }

  container.innerHTML = meals.map(meal => {
    const mealFoods = foods.filter(item => item.meal === meal);
    if (!mealFoods.length) return "";

    return `
      <div class="meal-group">
        <h3>${meal}</h3>
        ${mealFoods.map(item => `
          <div class="entry">
            <div class="entry-info">
              <strong>${escapeHTML(item.name)}</strong>
              <small>
                ${escapeHTML(item.brand || "")}
                ${item.serving ? ` · ${escapeHTML(item.serving)}` : ""}
              </small>
              <small>
                ${numberValue(item.calories)} cal ·
                ${numberValue(item.protein)} g protein
              </small>
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

  const exercises = data.exercises
    .filter(item => item.date === today())
    .sort((a, b) => numberValue(b.createdAt) - numberValue(a.createdAt));

  if (!exercises.length) {
    container.innerHTML = '<p class="empty-state">No exercise logged today yet.</p>';
    return;
  }

  container.innerHTML = exercises.map(item => `
    <div class="entry">
      <div class="entry-info">
        <strong>${escapeHTML(item.name)}</strong>
        <small>
          ${escapeHTML(item.type || "Exercise")} ·
          ${numberValue(item.minutes)} minutes
        </small>
        <small>
          ${item.burned ? `${numberValue(item.burned)} estimated calories burned` : ""}
          ${item.sets ? ` · ${numberValue(item.sets)} sets` : ""}
          ${item.reps ? ` · ${numberValue(item.reps)} reps` : ""}
          ${item.weight ? ` · ${numberValue(item.weight)} lb` : ""}
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
  const latestWeight = numberValue(getLatestWeight());
  const startingWeight = numberValue(data.goals.startingWeight);
  const goalWeight = numberValue(data.goals.goalWeight);
  const lost = startingWeight - latestWeight;
  const remaining = latestWeight - goalWeight;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  const cutoff = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`;

  const weeklyFoods = data.foods.filter(item => item.date >= cutoff && item.date <= today());
  const weeklyExercises = data.exercises.filter(item => item.date >= cutoff && item.date <= today());
  const weeklyWater = data.water.filter(item => item.date >= cutoff && item.date <= today());

  const weeklyCalories = weeklyFoods.reduce((sum, item) => sum + numberValue(item.calories), 0);
  const weeklyProtein = weeklyFoods.reduce((sum, item) => sum + numberValue(item.protein), 0);
  const weeklyMinutes = weeklyExercises.reduce((sum, item) => sum + numberValue(item.minutes), 0);
  const weeklyWaterOz = weeklyWater.reduce((sum, item) => sum + numberValue(item.amount), 0);

  container.innerHTML = `
    <div class="progress-card">
      <h3>Weight progress</h3>
      <p>Starting weight: <strong>${startingWeight} lb</strong></p>
      <p>Current weight: <strong>${latestWeight} lb</strong></p>
      <p>Goal weight: <strong>${goalWeight} lb</strong></p>
      <p>
        ${lost >= 0
          ? `Change so far: ${lost.toFixed(1)} lb lost`
          : `Change so far: ${Math.abs(lost).toFixed(1)} lb gained`}
      </p>
      <p>${remaining > 0 ? `${remaining.toFixed(1)} lb to goal` : "You've reached your goal weight!"}</p>
    </div>

    <div class="progress-card">
      <h3>Today's nutrition</h3>
      <p>Calories: <strong>${Math.round(totals.calories)} / ${data.goals.calories}</strong></p>
      <p>Protein: <strong>${Math.round(totals.protein)} / ${data.goals.protein} g</strong></p>
      <p>Water: <strong>${Math.round(totals.water)} / ${data.goals.water} oz</strong></p>
      <p>Exercise: <strong>${Math.round(totals.exerciseMinutes)} minutes</strong></p>
    </div>

    <div class="progress-card">
      <h3>Last 7 days</h3>
      <p>Total calories logged: <strong>${Math.round(weeklyCalories)}</strong></p>
      <p>Total protein logged: <strong>${Math.round(weeklyProtein)} g</strong></p>
      <p>Exercise minutes: <strong>${Math.round(weeklyMinutes)}</strong></p>
      <p>Water logged: <strong>${Math.round(weeklyWaterOz)} oz</strong></p>
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

function addFood(event) {
  event.preventDefault();

  const name = document.getElementById("foodName").value.trim();
  if (!name) return alert("Please enter a food name.");

  const food = {
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    name,
    brand: document.getElementById("foodBrand").value.trim(),
    meal: document.getElementById("foodMeal").value || "Snacks",
    serving: document.getElementById("foodServing").value.trim(),
    calories: numberValue(document.getElementById("foodCalories").value),
    protein: numberValue(document.getElementById("foodProtein").value),
    carbs: numberValue(document.getElementById("foodCarbs").value),
    fat: numberValue(document.getElementById("foodFat").value)
  };

  data.foods.push(food);
  saveData();
  event.target.reset();
}

function addExercise(event) {
  event.preventDefault();

  const name = document.getElementById("exerciseName").value.trim();
  if (!name) return alert("Please enter an exercise name.");

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

function addWater(amount) {
  amount = numberValue(amount);
  if (amount <= 0) return;

  data.water.push({
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    amount
  });

  saveData();
}

function addWeight(event) {
  event.preventDefault();

  const weight = numberValue(document.getElementById("weightInput").value);
  if (weight <= 0) return alert("Please enter a valid weight.");

  data.weights.push({
    id: makeId(),
    date: today(),
    createdAt: Date.now(),
    weight
  });

  saveData();
  event.target.reset();
}

function editNumber(label, currentValue) {
  const answer = prompt(`Update ${label}:`, String(currentValue ?? ""));
  if (answer === null) return null;

  const value = Number(answer);
  if (!Number.isFinite(value) || value < 0) {
    alert("Please enter a valid number.");
    return null;
  }
  return value;
}

function editText(label, currentValue) {
  const answer = prompt(`Update ${label}:`, String(currentValue ?? ""));
  return answer === null ? null : answer.trim();
}

function findEntry(list, id) {
  return list.find(item => item.id === id);
}

function deleteEntry(list, id, label) {
  if (!confirm(`Delete this ${label} entry?`)) return;
  const index = list.findIndex(item => item.id === id);
  if (index !== -1) {
    list.splice(index, 1);
    saveData();
  }
}

function editFood(id) {
  const item = findEntry(data.foods, id);
  if (!item) return;

  const name = editText("food name", item.name);
  if (name === null) return;
  const calories = editNumber("calories", item.calories);
  if (calories === null) return;
  const protein = editNumber("protein grams", item.protein);
  if (protein === null) return;

  item.name = name;
  item.calories = calories;
  item.protein = protein;

  const serving = editText("serving size", item.serving);
  if (serving !== null) item.serving = serving;

  saveData();
}

function editExercise(id) {
  const item = findEntry(data.exercises, id);
  if (!item) return;

  const name = editText("exercise name", item.name);
  if (name === null) return;
  const minutes = editNumber("minutes", item.minutes);
  if (minutes === null) return;

  item.name = name;
  item.minutes = minutes;

  const burned = editNumber("estimated calories burned", item.burned);
  if (burned !== null) item.burned = burned;

  saveData();
}

function editWater(id) {
  const item = findEntry(data.water, id);
  if (!item) return;

  const amount = editNumber("water amount in ounces", item.amount);
  if (amount === null) return;

  item.amount = amount;
  saveData();
}

function editWeight(id) {
  const item = findEntry(data.weights, id);
  if (!item) return;

  const weight = editNumber("weight in pounds", item.weight);
  if (weight === null || weight <= 0) return;

  item.weight = weight;
  saveData();
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

function showScreen(screenName) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.toggle("active", screen.id === screenName);
  });

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.classList.toggle("active", button.dataset.screen === screenName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
  showScreen
};

document.addEventListener("DOMContentLoaded", () => {
  connectForms();
  render();
});
