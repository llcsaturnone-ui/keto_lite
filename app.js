const STORAGE_KEY = "kbju_trainer_github_v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const todayKey = () => new Date().toISOString().slice(0, 10);
const makeId = () => `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

const toNum = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const round1 = (value) => Math.round(toNum(value) * 10) / 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const escapeHtml = (value) => {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
};

const percent = (used, target) => {
  if (!target) return 0;
  return clamp((used / target) * 100, 0, 100);
};

const starterProducts = [
  { id: makeId(), name: "Куриная грудка", kcal: 165, protein: 31, fat: 3.6, carbs: 0 },
  { id: makeId(), name: "Яйцо куриное", kcal: 157, protein: 12.7, fat: 10.9, carbs: 0.7 },
  { id: makeId(), name: "Творог 5%", kcal: 121, protein: 17, fat: 5, carbs: 1.8 },
  { id: makeId(), name: "Гречка варёная", kcal: 110, protein: 3.6, fat: 1.1, carbs: 21.3 },
  { id: makeId(), name: "Огурец", kcal: 15, protein: 0.8, fat: 0.1, carbs: 2.8 },
  { id: makeId(), name: "ПП батончик", kcal: 465, protein: 8.8, fat: 35.3, carbs: 11.8 },
];

const starterTrainings = () => [
  {
    id: makeId(),
    title: "Минимум дня",
    done: false,
    items: [
      "Отжимания 5–10",
      "Приседания 10–15",
      "Вис/подтягивания 20 сек",
      "Планка 20–30 сек",
      "Пресс 10–15",
      "Шаги 7000+",
    ],
  },
  {
    id: makeId(),
    title: "Силовая база",
    done: false,
    items: [
      "3 круга",
      "Отжимания 8–12",
      "Приседания 15–20",
      "Негативные подтягивания 3–5",
      "Планка 30 сек",
      "Пресс 15",
    ],
  },
];

const defaultState = () => ({
  settings: {
    name: "Майский режим",
    kcal: 2100,
    protein: 160,
    fat: 70,
    carbs: 150,
    steps: 7000,
  },
  products: starterProducts,
  days: {},
});

let currentDate = todayKey();
let currentTab = "home";
let state = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState();

    const parsed = JSON.parse(saved);
    const fresh = defaultState();

    return {
      ...fresh,
      ...parsed,
      settings: { ...fresh.settings, ...(parsed.settings || {}) },
      products: Array.isArray(parsed.products) && parsed.products.length ? parsed.products : fresh.products,
      days: parsed.days || {},
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDay(date = currentDate) {
  if (!state.days[date]) {
    state.days[date] = {
      meals: [],
      trainings: starterTrainings(),
      stepsDone: "",
      weight: "",
      waist: "",
      note: "",
    };
  }

  return state.days[date];
}

function calcProduct(product, grams) {
  const k = toNum(grams) / 100;

  return {
    kcal: product.kcal * k,
    protein: product.protein * k,
    fat: product.fat * k,
    carbs: product.carbs * k,
  };
}

function getTotals() {
  const day = getDay();

  return day.meals.reduce(
    (acc, meal) => {
      acc.kcal += toNum(meal.kcal);
      acc.protein += toNum(meal.protein);
      acc.fat += toNum(meal.fat);
      acc.carbs += toNum(meal.carbs);
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

function macroCard(label, used, target, unit) {
  const left = target - used;
  const over = left < 0;

  return `
    <div class="card" style="margin:0;padding:14px">
      <div class="row">
        <div class="small">${label}</div>
        <div class="${over ? "red" : "green"}" style="font-size:13px;font-weight:900">
          ${over ? "+" : ""}${round1(Math.abs(left))} ${unit}
        </div>
      </div>
      <div style="font-size:24px;font-weight:950;margin-top:4px">
        ${round1(used)} <span class="small">/ ${target} ${unit}</span>
      </div>
      <div class="bar">
        <div class="fill ${over ? "red" : ""}" style="width:${percent(used, target)}%"></div>
      </div>
    </div>
  `;
}

function renderHome() {
  const settings = state.settings;
  const day = getDay();
  const totals = getTotals();
  const leftKcal = settings.kcal - totals.kcal;

  $("#screenHome").innerHTML = `
    <div class="card hero">
      <div class="row">
        <div>
          <div class="small">Остаток на сегодня</div>
          <div class="hero-number ${leftKcal < 0 ? "red" : "green"}">${round1(leftKcal)}</div>
          <div class="small">ккал осталось из ${settings.kcal}</div>
        </div>
        <button class="btn-dark" id="resetDayBtn">Сброс</button>
      </div>
    </div>

    <div class="grid2">
      ${macroCard("Калории", totals.kcal, settings.kcal, "ккал")}
      ${macroCard("Белок", totals.protein, settings.protein, "г")}
      ${macroCard("Жиры", totals.fat, settings.fat, "г")}
      ${macroCard("Углеводы", totals.carbs, settings.carbs, "г")}
    </div>

    <div class="card">
      <h2>Шаги и замеры</h2>
      <div class="grid3">
        <div>
          <label>Шаги</label>
          <input id="stepsDone" type="number" inputmode="numeric" value="${escapeHtml(day.stepsDone)}" placeholder="0">
        </div>
        <div>
          <label>Вес</label>
          <input id="weight" type="number" inputmode="decimal" value="${escapeHtml(day.weight)}" placeholder="кг">
        </div>
        <div>
          <label>Талия</label>
          <input id="waist" type="number" inputmode="decimal" value="${escapeHtml(day.waist)}" placeholder="см">
        </div>
      </div>
      <div class="bar">
        <div class="fill green" style="width:${percent(toNum(day.stepsDone), settings.steps)}%"></div>
      </div>
      <div class="small margin-top-8">${toNum(day.stepsDone)} / ${settings.steps} шагов</div>
    </div>

    ${trainingBlockHtml(day)}

    <div class="card">
      <h2>Что съел сегодня</h2>
      ${
        day.meals.length
          ? day.meals
              .map(
                (meal) => `
                <div class="item-card row">
                  <div>
                    <h3>${escapeHtml(meal.name)} <span class="muted" style="font-weight:500">${round1(meal.grams)} г</span></h3>
                    <div class="small">
                      ${escapeHtml(meal.time)} · ${round1(meal.kcal)} ккал ·
                      Б ${round1(meal.protein)} / Ж ${round1(meal.fat)} / У ${round1(meal.carbs)}
                    </div>
                  </div>
                  <button class="delete-btn" data-delete-meal="${meal.id}">×</button>
                </div>
              `
              )
              .join("")
          : `<p class="muted">Пока пусто. Нажми “Добавить” снизу.</p>`
      }
    </div>

    <div class="card">
      <h2>Заметка дня</h2>
      <textarea id="note" placeholder="Сон, тяга к сладкому, самочувствие...">${escapeHtml(day.note)}</textarea>
    </div>
  `;

  $("#stepsDone").addEventListener("input", (event) => {
    day.stepsDone = event.target.value;
    saveState();
    renderHome();
  });

  $("#weight").addEventListener("input", (event) => {
    day.weight = event.target.value;
    saveState();
  });

  $("#waist").addEventListener("input", (event) => {
    day.waist = event.target.value;
    saveState();
  });

  $("#note").addEventListener("input", (event) => {
    day.note = event.target.value;
    saveState();
  });

  $("#resetDayBtn").addEventListener("click", () => {
    if (!confirm("Очистить день?")) return;
    delete state.days[currentDate];
    saveState();
    render();
  });

  $$("[data-delete-meal]").forEach((button) => {
    button.addEventListener("click", () => {
      day.meals = day.meals.filter((meal) => meal.id !== button.dataset.deleteMeal);
      saveState();
      renderHome();
    });
  });

  $$("[data-toggle-training]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const training = day.trainings.find((item) => item.id === checkbox.dataset.toggleTraining);
      if (!training) return;

      training.done = checkbox.checked;
      saveState();
      renderHome();
    });
  });

  $("#addTrainingBtn").addEventListener("click", () => {
    const title = prompt("Название тренировки");
    if (!title) return;

    const raw = prompt("Упражнения через запятую", "Отжимания, приседания, планка") || "";
    const items = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    day.trainings.push({ id: makeId(), title, done: false, items });
    saveState();
    renderHome();
  });
}

function trainingBlockHtml(day) {
  return `
    <div class="card">
      <div class="row">
        <h2 style="margin:0">Тренировки</h2>
        <button id="addTrainingBtn" class="btn-dark">+</button>
      </div>

      ${day.trainings
        .map(
          (training) => `
          <div class="item-card ${training.done ? "training-done" : ""}">
            <label style="display:flex;gap:10px;align-items:flex-start;margin:0;color:var(--text);font-size:15px">
              <input class="checkbox" type="checkbox" data-toggle-training="${training.id}" ${training.done ? "checked" : ""}>
              <div>
                <h3>${escapeHtml(training.title)}</h3>
                <ul>
                  ${training.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                </ul>
              </div>
            </label>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

function renderAdd() {
  $("#screenAdd").innerHTML = `
    <div class="card">
      <h2>Добавить еду</h2>
      <input id="productSearch" placeholder="Поиск продукта">
    </div>
    <div id="productList"></div>
  `;

  const searchInput = $("#productSearch");

  const drawProducts = () => {
    const query = searchInput.value.toLowerCase().trim();
    const products = state.products.filter((product) => product.name.toLowerCase().includes(query));

    $("#productList").innerHTML =
      products
        .map(
          (product) => `
          <div class="card">
            <h3>${escapeHtml(product.name)}</h3>
            <div class="small">
              на 100 г: ${round1(product.kcal)} ккал ·
              Б ${round1(product.protein)} / Ж ${round1(product.fat)} / У ${round1(product.carbs)}
            </div>

            <div class="row margin-top-12">
              <input type="number" inputmode="decimal" placeholder="граммы" value="100" data-grams="${product.id}">
              <button class="btn-blue" data-add-food="${product.id}">Добавить</button>
            </div>
          </div>
        `
        )
        .join("") || `<p class="muted">Ничего не найдено. Добавь продукт в базе.</p>`;

    $$("[data-add-food]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = state.products.find((item) => item.id === button.dataset.addFood);
        if (!product) return;

        const gramsInput = $(`[data-grams="${product.id}"]`);
        const grams = toNum(gramsInput.value || 100);
        const calc = calcProduct(product, grams);

        getDay().meals.unshift({
          id: makeId(),
          productId: product.id,
          name: product.name,
          grams,
          kcal: calc.kcal,
          protein: calc.protein,
          fat: calc.fat,
          carbs: calc.carbs,
          time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        });

        saveState();
        setTab("home");
      });
    });
  };

  searchInput.addEventListener("input", drawProducts);
  drawProducts();
}

function renderProducts() {
  $("#screenProducts").innerHTML = `
    <div class="card">
      <h2>База продуктов</h2>

      <input id="productName" placeholder="Название">

      <div class="grid4 margin-top-8">
        <input id="productKcal" type="number" inputmode="decimal" placeholder="ккал">
        <input id="productProtein" type="number" inputmode="decimal" placeholder="Б">
        <input id="productFat" type="number" inputmode="decimal" placeholder="Ж">
        <input id="productCarbs" type="number" inputmode="decimal" placeholder="У">
      </div>

      <button id="saveProductBtn" class="btn-green btn-full margin-top-10">Сохранить продукт</button>
      <div class="small margin-top-8">Данные указывай на 100 г продукта.</div>
    </div>

    <div>
      ${state.products
        .map(
          (product) => `
          <div class="item-card row">
            <div>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="small">
                ${round1(product.kcal)} ккал ·
                Б ${round1(product.protein)} / Ж ${round1(product.fat)} / У ${round1(product.carbs)} на 100 г
              </div>
            </div>
            <button class="delete-btn" data-delete-product="${product.id}">×</button>
          </div>
        `
        )
        .join("")}
    </div>
  `;

  $("#saveProductBtn").addEventListener("click", () => {
    const name = $("#productName").value.trim();

    if (!name) {
      alert("Введите название продукта");
      return;
    }

    state.products.unshift({
      id: makeId(),
      name,
      kcal: toNum($("#productKcal").value),
      protein: toNum($("#productProtein").value),
      fat: toNum($("#productFat").value),
      carbs: toNum($("#productCarbs").value),
    });

    saveState();
    renderProducts();
  });

  $$("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", () => {
      state.products = state.products.filter((product) => product.id !== button.dataset.deleteProduct);
      saveState();
      renderProducts();
    });
  });
}

function renderSettings() {
  const settings = state.settings;

  $("#screenSettings").innerHTML = `
    <div class="card">
      <h2>Дневная норма</h2>

      <label>Название режима</label>
      <input id="settingsName" value="${escapeHtml(settings.name)}">

      <div class="grid2 margin-top-10">
        <div>
          <label>Калории</label>
          <input id="settingsKcal" type="number" inputmode="numeric" value="${settings.kcal}">
        </div>
        <div>
          <label>Шаги</label>
          <input id="settingsSteps" type="number" inputmode="numeric" value="${settings.steps}">
        </div>
        <div>
          <label>Белок</label>
          <input id="settingsProtein" type="number" inputmode="numeric" value="${settings.protein}">
        </div>
        <div>
          <label>Жиры</label>
          <input id="settingsFat" type="number" inputmode="numeric" value="${settings.fat}">
        </div>
        <div>
          <label>Углеводы</label>
          <input id="settingsCarbs" type="number" inputmode="numeric" value="${settings.carbs}">
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Резервная копия</h2>
      <button id="exportBtn" class="btn-blue btn-full">Скачать backup</button>
      <button id="importBtn" class="btn-dark btn-full margin-top-8">Загрузить backup</button>
      <input id="importFile" class="file-input" type="file" accept="application/json">
      <p class="notice">Данные сохраняются в памяти Safari/браузера на этом устройстве. Backup нужен, чтобы не потерять данные.</p>
    </div>

    <div class="card">
      <h2>Установка на iPhone</h2>
      <p class="notice">Открой сайт в Safari → Поделиться → На экран «Домой». После этого приложение будет запускаться как отдельная иконка.</p>
    </div>
  `;

  bindSettingInput("settingsName", "name", false);
  bindSettingInput("settingsKcal", "kcal", true);
  bindSettingInput("settingsSteps", "steps", true);
  bindSettingInput("settingsProtein", "protein", true);
  bindSettingInput("settingsFat", "fat", true);
  bindSettingInput("settingsCarbs", "carbs", true);

  $("#exportBtn").addEventListener("click", exportData);
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", importData);
}

function bindSettingInput(inputId, key, numeric) {
  $(`#${inputId}`).addEventListener("input", (event) => {
    state.settings[key] = numeric ? toNum(event.target.value) : event.target.value;
    saveState();
    $("#appTitle").textContent = state.settings.name;
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "kbju-trainer-backup.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      state = JSON.parse(reader.result);
      saveState();
      alert("Данные восстановлены");
      render();
    } catch {
      alert("Не получилось прочитать файл");
    }
  };

  reader.readAsText(file);
}

function setTab(tab) {
  currentTab = tab;

  $$(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  $("#screenHome").classList.toggle("hidden", tab !== "home");
  $("#screenAdd").classList.toggle("hidden", tab !== "add");
  $("#screenProducts").classList.toggle("hidden", tab !== "products");
  $("#screenSettings").classList.toggle("hidden", tab !== "settings");

  render();
}

function render() {
  $("#appTitle").textContent = state.settings.name;

  if (currentTab === "home") renderHome();
  if (currentTab === "add") renderAdd();
  if (currentTab === "products") renderProducts();
  if (currentTab === "settings") renderSettings();
}

function init() {
  $("#dateInput").value = currentDate;

  $("#dateInput").addEventListener("change", (event) => {
    currentDate = event.target.value || todayKey();
    render();
  });

  $$(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  render();
}

init();
