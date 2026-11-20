const STORAGE_KEY = "myHealthTracker";

const defaultData = {
  calorieGoal: 1500,
  proteinGoal: 120,
  waterGoal: 80,
  startingWeight: 150,
  goalWeight: 130,
  fastingStart: "19:00",
  fastingEnd: "11:00",
  foods: [],
  exercises: [],
  water: [],
  weights: [],
  savedFoods: []
};

let data = loadData();

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultData, ...JSON.parse(saved) } : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  render();
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function addFood(food) {
  data.foods.push({
    id: crypto.randomUUID(),
    date: today(),
    meal: food.meal || "Snack",
    name: food.name,
    brand: food.brand || "",
    serving: food.serving || "1 serving",
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0
  });
  saveData();
}

function deleteFood(id) {
  data.foods = data.foods.filter(f => f.id !== id);
  saveData();
}

function addExercise(exercise) {
  data.exercises.push({
    id: crypto.randomUUID(),
    date: today(),
    name: exercise.name,
    minutes: Number(exercise.minutes) || 0,
    caloriesBurned: Number(exercise.caloriesBurned) || 0,
    type: exercise.type || "Cardio",
    sets: Number(exercise.sets) || 0,
    reps: Number(exercise.reps) || 0,
    weight: Number(exercise.weight) || 0
  });
  saveData();
}

function deleteExercise(id) {
  data.exercises = data.exercises.filter(e => e.id !== id);
  saveData();
}

function addWater(ounces) {
  data.water.push({
    id: crypto.randomUUID(),
    date: today(),
    ounces: Number(ounces) || 0
  });
  saveData();
}

function deleteWater(id) {
  data.water = data.water.filter(w => w.id !== id);
  saveData();
}

function addWeight(pounds) {
  data.weights.push({
    id: crypto.randomUUID(),
    date: today(),
    pounds: Number(pounds)
  });
  saveData();
}

function deleteWeight(id) {
  data.weights = data.weights.filter(w => w.id !== id);
  saveData();
}

function addSavedFood(food) {
  data.savedFoods.push({
    ...food,
    id: crypto.randomUUID()
  });
  saveData();
}

function getDailyTotals() {
  const date = today();
  const foods = data.foods.filter(f => f.date === date);
  const exercises = data.exercises.filter(e => e.date === date);
  const water = data.water.filter(w => w.date === date);

  return {
    calories: foods.reduce((sum, f) => sum + f.calories, 0),
    protein: foods.reduce((sum, f) => sum + f.protein, 0),
    carbs: foods.reduce((sum, f) => sum + f.carbs, 0),
    fat: foods.reduce((sum, f) => sum + f.fat, 0),
    water: water.reduce((sum, w) => sum + w.ounces, 0),
    exerciseMinutes: exercises.reduce((sum, e) => sum + e.minutes, 0),
    caloriesBurned: exercises.reduce((sum, e) => sum + e.caloriesBurned, 0)
  };
}

function getLatestWeight() {
  return [...data.weights].sort((a,b) => b.date.localeCompare(a.date))[0]?.pounds
    ?? data.startingWeight;
}

function getProgress() {
  const totals = getDailyTotals();
  return {
    caloriePercent: Math.min(100, totals.calories / data.calorieGoal * 100),
    proteinPercent: Math.min(100, totals.protein / data.proteinGoal * 100),
    waterPercent: Math.min(100, totals.water / data.waterGoal * 100),
    weightLost: data.startingWeight - getLatestWeight(),
    weightRemaining: getLatestWeight() - data.goalWeight
  };
}

function getFastingStatus() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = 19 * 60;
  const end = 11 * 60;
  const eating = minutes >= end && minutes < start;

  return {
    eating,
    message: eating ? "Eating window" : "Fasting window"
  };
}

function updateGoals(goals) {
  if (goals.calories != null) data.calorieGoal = Number(goals.calories);
  if (goals.protein != null) data.proteinGoal = Number(goals.protein);
  if (goals.water != null) data.waterGoal = Number(goals.water);
  if (goals.goalWeight != null) data.goalWeight = Number(goals.goalWeight);
  saveData();
}

function render() {
  const totals = getDailyTotals();
  const progress = getProgress();

  document.querySelectorAll("[data-total]").forEach(el => {
    const key = el.dataset.total;
    if (totals[key] !== undefined) el.textContent = totals[key];
  });

  document.querySelectorAll("[data-progress]").forEach(el => {
    const key = el.dataset.progress;
    if (progress[key] !== undefined) el.style.width = `${progress[key]}%`;
  });

  document.querySelectorAll("[data-remaining]").forEach(el => {
    const key = el.dataset.remaining;
    const goals = {
      calories: data.calorieGoal,
      protein: data.proteinGoal,
      water: data.waterGoal
    };
    if (goals[key] !== undefined) {
      el.textContent = Math.max(0, goals[key] - totals[key]);
    }
  });

  document.querySelectorAll("[data-weight-current]").forEach(el => {
    el.textContent = getLatestWeight();
  });

  document.querySelectorAll("[data-fasting-status]").forEach(el => {
    el.textContent = getFastingStatus().message;
  });
}

window.Tracker = {
  data,
  addFood,
  deleteFood,
  addExercise,
  deleteExercise,
  addWater,
  deleteWater,
  addWeight,
  deleteWeight,
  addSavedFood,
  updateGoals,
  getDailyTotals,
  getProgress,
  getLatestWeight,
  getFastingStatus,
  render
};

document.addEventListener("DOMContentLoaded", render);
