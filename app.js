
    const STORE_KEY = 'keto_lite_clean_v1';

    const defaultState = {
      tab: 'diary',
      currentDate: localDate(new Date()),
      goals: { calories: 2000, protein: 150, fat: 130, carbs: 25 },
      foods: [
        { id: uid(), name: 'Яйцо варёное', category: 'Яйца', kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1, status: 'keto', comment: '1 яйцо без скорлупы примерно 50 г.' },
        { id: uid(), name: 'Сливки 10%', category: 'Молочное', kcal: 118, protein: 2.8, fat: 10, carbs: 4.3, status: 'caution', comment: 'Кето-допустимо, но есть углеводы.' },
        { id: uid(), name: 'Масло MCT', category: 'Масла', kcal: 833, protein: 0, fat: 100, carbs: 0, status: 'keto', comment: 'Чистый жир. Не лить без счёта.' },
        { id: uid(), name: 'Кофе растворимый', category: 'Напитки', kcal: 240, protein: 12, fat: 0.5, carbs: 40, status: 'keto', comment: 'Считать сухой порошок. 1 ч.л. ≈ 2 г.' },
        { id: uid(), name: 'SNAQER арахис-карамель', category: 'Батончики', kcal: 456, protein: 20, fat: 32, carbs: 8, status: 'caution', comment: '1 батончик 50 г = 228 ккал, Б 10, Ж 16, У 4.' }
      ],
      logs: {}
    };

    let state = loadState();
    let toastTimer = null;

    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

    function localDate(dateObj) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function parseDate(dateString) {
      const [y, m, d] = dateString.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    function displayDate(dateString) {
      const today = localDate(new Date());
      if (dateString === today) return 'Сегодня';
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (dateString === localDate(y)) return 'Вчера';
      return parseDate(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return structuredClone(defaultState);
        const saved = JSON.parse(raw);
        return {
          ...structuredClone(defaultState),
          ...saved,
          goals: { ...defaultState.goals, ...(saved.goals || {}) },
          foods: Array.isArray(saved.foods) ? saved.foods : defaultState.foods,
          logs: saved.logs || {}
        };
      } catch (e) {
        return structuredClone(defaultState);
      }
    }

    function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

    function n(v, fallback = 0) {
      const num = Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(num) ? num : fallback;
    }

    function round1(v) { return Math.round((n(v) + Number.EPSILON) * 10) / 10; }
    function fmt(v) { return Number.isInteger(round1(v)) ? String(Math.round(v)) : String(round1(v)); }

    function calc(food, grams) {
      const g = n(grams);
      const k = g / 100;
      return {
        kcal: Math.round(n(food.kcal) * k),
        protein: round1(n(food.protein) * k),
        fat: round1(n(food.fat) * k),
        carbs: round1(n(food.carbs) * k)
      };
    }

    function dayLogs() { return state.logs[state.currentDate] || []; }

    function totalsFor(logs) {
      return logs.reduce((acc, item) => {
        acc.kcal += n(item.kcal);
        acc.protein += n(item.protein);
        acc.fat += n(item.fat);
        acc.carbs += n(item.carbs);
        if (item.status === 'caution') acc.caution += 1;
        if (item.status === 'stop') acc.stop += 1;
        return acc;
      }, { kcal: 0, protein: 0, fat: 0, carbs: 0, caution: 0, stop: 0 });
    }

    function ketoStatus(totals) {
      const carbGoal = n(state.goals.carbs, 25);
      if (totals.stop > 0 || totals.carbs > 50) {
        return { icon: '❌', title: 'Кето сорвано', text: 'Есть запрещённый продукт или углеводы выше 50 г. Завтра возвращайся к простому мясо/рыба/яйца/овощи.' };
      }
      if (totals.carbs > Math.max(40, carbGoal)) {
        return { icon: '⚠️', title: 'Кето под угрозой', text: `Углеводы уже ${fmt(totals.carbs)} г. До конца дня больше никаких молочных сладостей, батончиков и соусов.` };
      }
      if (totals.carbs > carbGoal) {
        return { icon: '⚠️', title: 'Выше лимита', text: `Лимит ${fmt(carbGoal)} г, сейчас ${fmt(totals.carbs)} г. Это ещё не катастрофа, но дальше только ноль углеводов.` };
      }
      if (totals.caution > 0) {
        return { icon: '✅', title: 'Кето-норма', text: `Углеводы ${fmt(totals.carbs)} г из ${fmt(carbGoal)} г. Есть продукты “осторожно”, но лимит пока держишь.` };
      }
      return { icon: '✅', title: 'Кето-норма', text: `Углеводы ${fmt(totals.carbs)} г из ${fmt(carbGoal)} г. Хорошо, держишь режим.` };
    }

    function progress(current, goal) {
      const g = n(goal);
      if (!g) return 0;
      return Math.min(100, Math.max(0, (n(current) / g) * 100));
    }

    function statusBadge(status) {
      if (status === 'stop') return '<span class="badge stop">стоп</span>';
      if (status === 'caution') return '<span class="badge caution">осторожно</span>';
      return '<span class="badge">кето</span>';
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function render() {
      const app = document.getElementById('app');
      const logs = dayLogs();
      const totals = totalsFor(logs);
      const status = ketoStatus(totals);
      const today = localDate(new Date());
      const title = state.tab === 'diary' ? 'Кето-дневник' : 'База продуктов';

      app.innerHTML = `
        <header>
          <div class="title">${title}</div>
          <div class="header-stats">
            <span>${Math.round(totals.kcal)} ккал</span>
            <span>${fmt(totals.carbs)} г угл</span>
          </div>
        </header>
        <main>${state.tab === 'diary' ? diaryHtml(totals, status, logs, today) : productsHtml()}</main>
        <nav class="safe-pb">
          <button id="tabDiary" class="nav-btn fast-touch ${state.tab === 'diary' ? 'active' : ''}"><span class="ico">📅</span><span>Дневник</span></button>
          <button id="tabProducts" class="nav-btn products fast-touch ${state.tab === 'products' ? 'active' : ''}"><span class="ico">📦</span><span>База</span></button>
        </nav>
      `;

      document.getElementById('tabDiary').onclick = () => setTab('diary');
      document.getElementById('tabProducts').onclick = () => setTab('products');

      if (state.tab === 'diary') bindDiary();
      else bindProducts();
    }

    function diaryHtml(totals, status, logs, today) {
      return `
        <div class="space">
          <div class="date-row">
            <button class="date-btn fast-touch" id="prevDate">‹</button>
            <div class="date-label">${displayDate(state.currentDate)}</div>
            <button class="date-btn fast-touch" id="nextDate" ${state.currentDate >= today ? 'disabled' : ''}>›</button>
          </div>

          <section class="card">
            <div class="total-top">
              <div>
                <div class="label">Калории</div>
                <div><span class="big">${Math.round(totals.kcal)}</span> <span class="sub">/ ${fmt(state.goals.calories)}</span></div>
              </div>
              <div class="remain"><span class="num">${Math.round(n(state.goals.calories) - totals.kcal)}</span><span class="txt">ост.</span></div>
            </div>
            <div class="bar"><div style="width:${progress(totals.kcal, state.goals.calories)}%"></div></div>
            <div class="macros">
              <div class="macro">
                <div class="name">Белки</div>
                <div class="value protein">${fmt(totals.protein)}г</div>
                <div class="sub">/ ${fmt(state.goals.protein)}г</div>
                <div class="bar blue"><div style="width:${progress(totals.protein, state.goals.protein)}%"></div></div>
              </div>
              <div class="macro">
                <div class="name">Жиры</div>
                <div class="value fat">${fmt(totals.fat)}г</div>
                <div class="sub">/ ${fmt(state.goals.fat)}г</div>
                <div class="bar yellow"><div style="width:${progress(totals.fat, state.goals.fat)}%"></div></div>
              </div>
              <div class="macro">
                <div class="name">Углеводы</div>
                <div class="value carbs">${fmt(totals.carbs)}г</div>
                <div class="sub">/ ${fmt(state.goals.carbs)}г</div>
                <div class="bar orange"><div style="width:${progress(totals.carbs, state.goals.carbs)}%"></div></div>
              </div>
            </div>
          </section>

          <section class="card small status-box">
            <div class="status-icon">${status.icon}</div>
            <div>
              <div class="status-title">${status.title}</div>
              <div class="status-text">${escapeHtml(status.text)}</div>
            </div>
          </section>

          <form id="addLogForm" class="card space">
            <p class="section-title">Добавить еду</p>
            <select id="foodSelect" required>
              <option value="" disabled selected>Выбери продукт</option>
              ${state.foods.map(f => `<option value="${f.id}">${escapeHtml(f.name)} — ${fmt(f.kcal)} ккал / Б${fmt(f.protein)} Ж${fmt(f.fat)} У${fmt(f.carbs)}</option>`).join('')}
            </select>
            <div class="form-row">
              <input id="gramsInput" type="number" inputmode="decimal" step="0.1" placeholder="Граммы" required />
              <button type="submit" class="round-btn fast-touch">+</button>
            </div>
          </form>

          <section>
            <p class="section-title">Съедено</p>
            <div class="log-list">
              ${logs.length ? logs.map(item => logItemHtml(item)).join('') : '<div class="empty">Пока ничего не добавлено</div>'}
            </div>
          </section>
        </div>
      `;
    }

    function logItemHtml(item) {
      return `
        <div class="item">
          <div style="min-width:0; flex:1;">
            <div class="item-title">${escapeHtml(item.name)}</div>
            <div class="item-meta">
              <span>${fmt(item.grams)}г</span>
              <span class="kcal">${Math.round(item.kcal)} ккал</span>
              <span class="p">Б ${fmt(item.protein)}</span>
              <span class="f">Ж ${fmt(item.fat)}</span>
              <span class="c">У ${fmt(item.carbs)}</span>
            </div>
          </div>
          <div class="item-actions">
            ${statusBadge(item.status)}
            <button class="mini-btn danger delete-log fast-touch" data-id="${item.id}">✕</button>
          </div>
        </div>
      `;
    }

    function productsHtml() {
      return `
        <div class="space">
          <section class="card space">
            <p class="section-title">Цели на день</p>
            <div class="form-grid">
              <label><span class="label">Ккал</span><input id="goalCalories" type="number" value="${fmt(state.goals.calories)}" /></label>
              <label><span class="label">Белки</span><input id="goalProtein" type="number" value="${fmt(state.goals.protein)}" /></label>
              <label><span class="label">Жиры</span><input id="goalFat" type="number" value="${fmt(state.goals.fat)}" /></label>
              <label><span class="label">Углеводы</span><input id="goalCarbs" type="number" value="${fmt(state.goals.carbs)}" /></label>
            </div>
            <button id="saveGoals" class="full-btn fast-touch">Сохранить цели</button>
          </section>

          <form id="addFoodForm" class="card space">
            <p class="section-title">Новый продукт на 100 г</p>
            <input id="pName" type="text" placeholder="Название" required />
            <input id="pCategory" type="text" placeholder="Категория" value="Продукты" />
            <div class="form-grid">
              <input id="pKcal" type="number" inputmode="decimal" step="0.1" placeholder="Ккал" required />
              <input id="pProtein" type="number" inputmode="decimal" step="0.1" placeholder="Белки" required />
              <input id="pFat" type="number" inputmode="decimal" step="0.1" placeholder="Жиры" required />
              <input id="pCarbs" type="number" inputmode="decimal" step="0.1" placeholder="Углеводы" required />
            </div>
            <select id="pStatus">
              <option value="keto">✅ кето</option>
              <option value="caution">⚠️ осторожно</option>
              <option value="stop">❌ стоп</option>
            </select>
            <textarea id="pComment" placeholder="Комментарий, необязательно"></textarea>
            <button type="submit" class="full-btn blue fast-touch">Добавить / обновить</button>
          </form>

          <section class="card space">
            <p class="section-title">Вставка от ChatGPT</p>
            <textarea id="importBox" placeholder='Сюда вставь JSON продукта, например: {"name":"Кета","category":"Рыба","kcal":138,"protein":21,"fat":6,"carbs":0,"status":"keto"}'></textarea>
            <button id="importProduct" class="full-btn gray fast-touch">Вставить продукт</button>
            <div class="hint">Можно вставить один продукт или массив продуктов. Если название уже есть — данные обновятся.</div>
          </section>

          <section>
            <p class="section-title">Список продуктов (${state.foods.length})</p>
            <div class="food-list">
              ${state.foods.map(foodItemHtml).join('')}
            </div>
          </section>
        </div>
      `;
    }

    function foodItemHtml(f) {
      return `
        <div class="item">
          <div style="min-width:0; flex:1;">
            <div class="item-title">${escapeHtml(f.name)}</div>
            <div class="item-meta">
              <span>${escapeHtml(f.category || 'Продукты')}</span>
              <span class="kcal">${fmt(f.kcal)} ккал</span>
              <span class="p">Б ${fmt(f.protein)}</span>
              <span class="f">Ж ${fmt(f.fat)}</span>
              <span class="c">У ${fmt(f.carbs)}</span>
            </div>
            ${f.comment ? `<div class="hint">${escapeHtml(f.comment)}</div>` : ''}
          </div>
          <div class="item-actions">
            ${statusBadge(f.status)}
            <button class="mini-btn edit-food fast-touch" data-id="${f.id}">Изм.</button>
            <button class="mini-btn danger delete-food fast-touch" data-id="${f.id}">✕</button>
          </div>
        </div>
      `;
    }

    function bindDiary() {
      document.getElementById('prevDate').onclick = () => shiftDate(-1);
      document.getElementById('nextDate').onclick = () => shiftDate(1);
      document.getElementById('addLogForm').onsubmit = addLog;
      document.querySelectorAll('.delete-log').forEach(btn => {
        btn.onclick = () => deleteLog(btn.dataset.id);
      });
    }

    function bindProducts() {
      document.getElementById('saveGoals').onclick = () => {
        state.goals = {
          calories: n(document.getElementById('goalCalories').value),
          protein: n(document.getElementById('goalProtein').value),
          fat: n(document.getElementById('goalFat').value),
          carbs: n(document.getElementById('goalCarbs').value)
        };
        saveState();
        showToast('Цели сохранены');
        render();
      };
      document.getElementById('addFoodForm').onsubmit = addFoodFromForm;
      document.getElementById('importProduct').onclick = importFood;
      document.querySelectorAll('.delete-food').forEach(btn => {
        btn.onclick = () => deleteFood(btn.dataset.id);
      });
      document.querySelectorAll('.edit-food').forEach(btn => {
        btn.onclick = () => fillFoodForm(btn.dataset.id);
      });
    }

    function setTab(tab) {
      state.tab = tab;
      saveState();
      render();
    }

    function shiftDate(delta) {
      const d = parseDate(state.currentDate);
      d.setDate(d.getDate() + delta);
      const next = localDate(d);
      if (next > localDate(new Date())) return;
      state.currentDate = next;
      saveState();
      render();
    }

    function addLog(e) {
      e.preventDefault();
      const foodId = document.getElementById('foodSelect').value;
      const grams = n(document.getElementById('gramsInput').value);
      const food = state.foods.find(f => f.id === foodId);
      if (!food || grams <= 0) return;
      const c = calc(food, grams);
      const log = {
        id: uid(),
        foodId: food.id,
        name: food.name,
        grams,
        kcal: c.kcal,
        protein: c.protein,
        fat: c.fat,
        carbs: c.carbs,
        status: food.status || 'keto'
      };
      state.logs[state.currentDate] = [...dayLogs(), log];
      saveState();
      render();
    }

    function deleteLog(id) {
      state.logs[state.currentDate] = dayLogs().filter(x => x.id !== id);
      saveState();
      render();
    }

    function normalizeFood(obj) {
      const name = String(obj.name || obj.title || obj['Название'] || '').trim();
      if (!name) throw new Error('Нет названия продукта');
      let status = String(obj.status || obj['Статус'] || 'keto').toLowerCase();
      if (status.includes('ост') || status.includes('caution') || status.includes('warning')) status = 'caution';
      else if (status.includes('стоп') || status.includes('запр') || status.includes('stop') || status.includes('bad')) status = 'stop';
      else status = 'keto';
      return {
        id: obj.id || uid(),
        name,
        category: String(obj.category || obj['Категория'] || 'Продукты').trim(),
        kcal: n(obj.kcal ?? obj.calories ?? obj['Ккал'] ?? obj['Калории']),
        protein: n(obj.protein ?? obj['Белки']),
        fat: n(obj.fat ?? obj['Жиры']),
        carbs: n(obj.carbs ?? obj['Углеводы']),
        status,
        comment: String(obj.comment || obj['Комментарий'] || '').trim()
      };
    }

    function upsertFood(food) {
      const idx = state.foods.findIndex(f => f.name.trim().toLowerCase() === food.name.trim().toLowerCase());
      if (idx >= 0) state.foods[idx] = { ...state.foods[idx], ...food, id: state.foods[idx].id };
      else state.foods.push(food);
    }

    function addFoodFromForm(e) {
      e.preventDefault();
      const food = normalizeFood({
        name: document.getElementById('pName').value,
        category: document.getElementById('pCategory').value,
        kcal: document.getElementById('pKcal').value,
        protein: document.getElementById('pProtein').value,
        fat: document.getElementById('pFat').value,
        carbs: document.getElementById('pCarbs').value,
        status: document.getElementById('pStatus').value,
        comment: document.getElementById('pComment').value
      });
      upsertFood(food);
      saveState();
      showToast('Продукт сохранён');
      render();
    }

    function fillFoodForm(id) {
      const f = state.foods.find(x => x.id === id);
      if (!f) return;
      document.getElementById('pName').value = f.name || '';
      document.getElementById('pCategory').value = f.category || '';
      document.getElementById('pKcal').value = f.kcal ?? '';
      document.getElementById('pProtein').value = f.protein ?? '';
      document.getElementById('pFat').value = f.fat ?? '';
      document.getElementById('pCarbs').value = f.carbs ?? '';
      document.getElementById('pStatus').value = f.status || 'keto';
      document.getElementById('pComment').value = f.comment || '';
      window.setTimeout(() => document.getElementById('pName').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }

    function deleteFood(id) {
      const f = state.foods.find(x => x.id === id);
      if (!f) return;
      if (!confirm(`Удалить продукт “${f.name}”? Старые записи в дневнике останутся.`)) return;
      state.foods = state.foods.filter(x => x.id !== id);
      saveState();
      render();
    }

    function importFood() {
      const raw = document.getElementById('importBox').value.trim();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        arr.map(normalizeFood).forEach(upsertFood);
        saveState();
        showToast(`Добавлено/обновлено: ${arr.length}`);
        render();
      } catch (e) {
        showToast('Не получилось прочитать JSON. Скопируй блок целиком, от { до }');
      }
    }

    function showToast(text) {
      clearTimeout(toastTimer);
      const old = document.querySelector('.toast');
      if (old) old.remove();
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = text;
      document.body.appendChild(div);
      toastTimer = setTimeout(() => div.remove(), 2200);
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }

    render();
  