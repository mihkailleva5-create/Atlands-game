/**
 * Atlands — игровая логика и интерфейс.
 * Зависимости: models.js (PETS, DECORATIONS, petSVG), music.js, telegram.js, save.js
 */
'use strict';

/* ================= Состояние ================= */

function defaultState() {
  return {
    version: 1,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    sparkles: 0,
    drops: 10,
    totalTaps: 0,
    totalEarned: 0,
    level: 1,
    exp: 0,
    petId: 'lotti',
    petName: 'Лотти',
    skin: 'pink',
    accessory: 'flower',
    mood: 85, hunger: 75, energy: 90, // 0..100, влияют на доход
    unlockedPets: ['lotti'],
    decorations: { flower: 0, mushroom: 0, tree: 0, lantern: 0, crystal: 0, waterfall: 0 },
    care: { feed: 0, play: 0, groom: 0 }, // timestamp следующего доступного действия
    boostUntil: 0,
    lastDaily: null,
    quests: { date: null, taps: 0, earned: 0, buys: 0, claimed: [] },
    settings: { music: true, sfx: true, track: 0, volume: 0.5 },
  };
}

let S = defaultState();
const $ = id => document.getElementById(id);
const music = window.AtlandsMusic;
const tg = window.AtlandsTG;

/* ================= Утилиты ================= */

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function todayKey() { return new Date().toLocaleDateString('sv-SE'); } // YYYY-MM-DD локально
function expNeed(level) { return Math.floor(100 * Math.pow(level, 1.35)); }
function petDef(id) { return PETS.find(p => p.id === id) || PETS[0]; }

function perSec() {
  return DECORATIONS.reduce((sum, d) => sum + (S.decorations[d.id] || 0) * d.perSec, 0);
}
function careMultiplier() {
  const avg = (S.mood + S.hunger + S.energy) / 3;
  return 0.6 + (avg / 100) * 0.9; // 0.6 .. 1.5
}
function boostMultiplier() { return Date.now() < S.boostUntil ? 2 : 1; }
function tapGain() {
  return Math.max(1, Math.round(1 * petDef(S.petId).bonus * careMultiplier() * boostMultiplier()));
}
function decorCost(d) { return Math.floor(d.baseCost * Math.pow(d.costGrowth, S.decorations[d.id] || 0)); }

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}
function sfx(name) { if (S.settings.sfx) music.sfx(name); }
function save() { window.AtlandsSave.schedule(S); }

/* ================= Доход и опыт ================= */

function addSparkles(n, { silent = false } = {}) {
  S.sparkles += n;
  if (n > 0) { S.totalEarned += n; S.quests.earned += n; }
  if (!silent) updateHUD();
}
function addExp(n) {
  S.exp += n;
  while (S.exp >= expNeed(S.level)) {
    S.exp -= expNeed(S.level);
    S.level++;
    const reward = 50 * S.level;
    addSparkles(reward, { silent: true });
    sfx('levelup');
    tg.haptic('success');
    toast(`🎉 Новый уровень ${S.level}! +${reward} ✨`);
    burstHearts(14);
  }
}

/* ================= Остров ================= */

function renderPet() {
  $('pet-stage').innerHTML = petSVG(S.petId, { skin: S.skin, accessory: S.accessory });
  $('pet-name-label').textContent = S.petName;
  $('pet-species-label').textContent = `${petDef(S.petId).species} · бонус x${petDef(S.petId).bonus}`;
  $('island-stage-name').textContent = islandStageName(S.level);
  renderDecorLayer();
}

function renderDecorLayer() {
  // показываем до 12 декораций на острове (по кругу), дальше просто счётчик
  const layer = $('decor-layer');
  const items = [];
  DECORATIONS.forEach(d => {
    const count = Math.min(S.decorations[d.id] || 0, d.id === 'flower' ? 5 : 2);
    for (let i = 0; i < count; i++) items.push(d.icon);
  });
  layer.innerHTML = items.slice(0, 12).map((icon, i) =>
    `<span class="island-decor" style="--i:${i}">${icon}</span>`).join('');
}

function burstHearts(n = 6) {
  const box = $('particles');
  const icons = ['💖', '✨', '💗', '⭐', '🫧'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'particle';
    s.textContent = icons[Math.floor(Math.random() * icons.length)];
    s.style.left = 35 + Math.random() * 30 + '%';
    s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    s.style.animationDelay = (Math.random() * 0.15) + 's';
    box.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}

function floatText(text) {
  const box = $('particles');
  const s = document.createElement('span');
  s.className = 'float-text';
  s.textContent = text;
  s.style.left = 42 + Math.random() * 16 + '%';
  box.appendChild(s);
  setTimeout(() => s.remove(), 1100);
}

function onTapPet() {
  const gain = tapGain();
  addSparkles(gain);
  addExp(1);
  S.totalTaps++;
  S.quests.taps++;
  S.mood = Math.min(100, S.mood + 0.4);
  floatText(`+${gain} ✨`);
  if (Math.random() < 0.35) burstHearts(3);
  sfx(Math.random() < 0.25 ? 'coin' : 'pop');
  tg.haptic('light');
  const stage = $('pet-stage');
  stage.classList.remove('happy');
  void stage.offsetWidth; // перезапуск анимации
  stage.classList.add('happy');
  updateHUD();
  save();
}

/* ================= Уход за питомцем ================= */

const CARE = {
  feed:  { icon: '🍓', name: 'Покормить', cooldown: 60,  apply() { S.hunger = Math.min(100, S.hunger + 30); S.drops += 1; addExp(5); return 'Ням! +сытость, +1 💧'; } },
  play:  { icon: '🎾', name: 'Поиграть',  cooldown: 90,  apply() { S.mood = Math.min(100, S.mood + 25); S.energy = Math.max(0, S.energy - 8); S.drops += 1; addExp(7); return 'Весело! +настроение, +1 💧'; } },
  groom: { icon: '🫧', name: 'Погладить', cooldown: 30,  apply() { S.mood = Math.min(100, S.mood + 12); S.energy = Math.min(100, S.energy + 10); addExp(3); return 'Мурр… +настроение и бодрость'; } },
};

function onCare(key) {
  const now = Date.now();
  if (now < (S.care[key] || 0)) return;
  S.care[key] = now + CARE[key].cooldown * 1000;
  const msg = CARE[key].apply();
  toast(`${CARE[key].icon} ${msg}`);
  sfx('coin'); tg.haptic('medium'); burstHearts(5);
  renderCare(); updateHUD(); save();
}

function renderCare() {
  const now = Date.now();
  document.querySelectorAll('[data-care]').forEach(btn => {
    const key = btn.dataset.care;
    const left = Math.ceil(((S.care[key] || 0) - now) / 1000);
    btn.disabled = left > 0;
    btn.querySelector('.care-label').textContent = left > 0 ? `${left}с` : CARE[key].name;
  });
  $('stat-mood').style.width = S.mood + '%';
  $('stat-hunger').style.width = S.hunger + '%';
  $('stat-energy').style.width = S.energy + '%';
}

/* ================= Магазин ================= */

const TREATS = [
  { id: 'berry', icon: '🍓', name: 'Ягодный пирог', costDrops: 5,  desc: '+30 опыта, настроение 100', apply() { S.mood = 100; addExp(30); } },
  { id: 'boost', icon: '⚡', name: 'Эликсир искр',  costDrops: 12, desc: 'Доход x2 на 10 минут', apply() { S.boostUntil = Date.now() + 10 * 60 * 1000; } },
  { id: 'feast', icon: '🎂', name: 'Праздничный торт', costDrops: 20, desc: 'Все статы 100, +80 опыта', apply() { S.mood = S.hunger = S.energy = 100; addExp(80); } },
];

function renderShop() {
  $('shop-list').innerHTML = DECORATIONS.map(d => {
    const count = S.decorations[d.id] || 0;
    const cost = decorCost(d);
    const afford = S.sparkles >= cost;
    return `<div class="card shop-card">
      <div class="shop-icon">${d.icon}</div>
      <div class="shop-info"><b>${d.name}</b><span>${d.desc} · у вас: ${count}</span></div>
      <button class="btn-buy" data-buy="${d.id}" ${afford ? '' : 'disabled'}>${fmt(cost)} ✨</button>
    </div>`;
  }).join('');
  $('treats-list').innerHTML = TREATS.map(t => `
    <div class="card shop-card">
      <div class="shop-icon">${t.icon}</div>
      <div class="shop-info"><b>${t.name}</b><span>${t.desc}</span></div>
      <button class="btn-buy btn-drops" data-treat="${t.id}" ${S.drops >= t.costDrops ? '' : 'disabled'}>${t.costDrops} 💧</button>
    </div>`).join('');
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyDecor(b.dataset.buy));
  document.querySelectorAll('[data-treat]').forEach(b => b.onclick = () => buyTreat(b.dataset.treat));
}

function buyDecor(id) {
  const d = DECORATIONS.find(x => x.id === id);
  const cost = decorCost(d);
  if (S.sparkles < cost) { sfx('error'); return; }
  S.sparkles -= cost;
  S.decorations[id]++;
  S.quests.buys++;
  addExp(4);
  toast(`${d.icon} ${d.name} теперь на острове!`);
  sfx('buy'); tg.haptic('medium');
  renderShop(); renderDecorLayer(); updateHUD(); save();
}

function buyTreat(id) {
  const t = TREATS.find(x => x.id === id);
  if (S.drops < t.costDrops) { sfx('error'); return; }
  S.drops -= t.costDrops;
  t.apply();
  toast(`${t.icon} ${t.name}!`);
  sfx('buy'); burstHearts(6);
  renderShop(); renderCare(); updateHUD(); save();
}

/* ================= Питомцы и внешность ================= */

function renderPets() {
  $('pets-grid').innerHTML = PETS.map(p => {
    const owned = S.unlockedPets.includes(p.id);
    const active = S.petId === p.id;
    return `<div class="card pet-card ${active ? 'active' : ''}">
      <div class="pet-preview">${petSVG(p.id, { skin: p.skins[0], accessory: 'none' })}</div>
      <b>${p.name}</b><span class="pet-species">${p.species} · x${p.bonus}</span>
      <p class="pet-desc">${p.desc}</p>
      ${active ? '<span class="badge">Сейчас с вами</span>'
        : owned ? `<button class="btn-main" data-equip="${p.id}">Выбрать</button>`
        : `<button class="btn-main" data-unlock="${p.id}" ${S.sparkles >= p.price ? '' : 'disabled'}>Открыть · ${fmt(p.price)} ✨</button>`}
    </div>`;
  }).join('');
  document.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => equipPet(b.dataset.equip));
  document.querySelectorAll('[data-unlock]').forEach(b => b.onclick = () => unlockPet(b.dataset.unlock));

  const skins = petDef(S.petId).skins;
  $('skin-row').innerHTML = skins.map(sk => `
    <button class="skin-dot ${S.skin === sk ? 'sel' : ''}" data-skin="${sk}" title="${sk}"
      style="background:linear-gradient(135deg, ${(SKIN_COLORS[sk] || [])[0] || '#eee'}, ${(SKIN_COLORS[sk] || [])[2] || '#ccc'})"></button>`).join('');
  document.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
    S.skin = b.dataset.skin; renderPet(); renderPets(); save(); sfx('pop');
  });

  $('accessory-row').innerHTML = ACCESSORIES.map(a => {
    const locked = S.level < a.unlockLevel;
    return `<button class="acc-btn ${S.accessory === a.id ? 'sel' : ''}" data-acc="${a.id}" ${locked ? 'disabled' : ''}
      title="${a.name}">${a.icon}<span>${locked ? `ур. ${a.unlockLevel}` : a.name}</span></button>`;
  }).join('');
  document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => {
    S.accessory = b.dataset.acc; renderPet(); renderPets(); save(); sfx('pop');
  });
}

function equipPet(id) {
  S.petId = id;
  S.petName = petDef(id).name;
  if (!petDef(id).skins.includes(S.skin)) S.skin = petDef(id).skins[0];
  renderPet(); renderPets(); save();
  toast(`${petDef(id).name} теперь с вами! 💖`); sfx('coin'); tg.haptic('medium');
}

function unlockPet(id) {
  const p = petDef(id);
  if (S.sparkles < p.price) { sfx('error'); return; }
  S.sparkles -= p.price;
  S.unlockedPets.push(id);
  equipPet(id);
  burstHearts(12);
}

/* ================= Задания и ежедневная награда ================= */

const QUESTS = [
  { id: 'taps',  icon: '👆', name: 'Тапни питомца 50 раз',     target: 50,  reward: 120, progress: () => S.quests.taps },
  { id: 'earned', icon: '✨', name: 'Заработай 500 искр',       target: 500, reward: 150, progress: () => Math.floor(S.quests.earned) },
  { id: 'buys',  icon: '🛒', name: 'Купи 3 украшения острова', target: 3,   reward: 200, progress: () => S.quests.buys },
];

function ensureQuests() {
  if (S.quests.date !== todayKey()) {
    S.quests = { date: todayKey(), taps: 0, earned: 0, buys: 0, claimed: [] };
  }
}

function renderQuests() {
  ensureQuests();
  $('quests-list').innerHTML = QUESTS.map(q => {
    const cur = Math.min(q.progress(), q.target);
    const done = cur >= q.target;
    const claimed = S.quests.claimed.includes(q.id);
    return `<div class="card quest-card">
      <div class="shop-icon">${q.icon}</div>
      <div class="shop-info"><b>${q.name}</b>
        <div class="progress"><div style="width:${(cur / q.target) * 100}%"></div></div>
        <span>${cur} / ${q.target} · награда ${q.reward} ✨</span></div>
      <button class="btn-buy" data-quest="${q.id}" ${done && !claimed ? '' : 'disabled'}>${claimed ? '✓' : q.reward + ' ✨'}</button>
    </div>`;
  }).join('');
  document.querySelectorAll('[data-quest]').forEach(b => b.onclick = () => claimQuest(b.dataset.quest));
  renderDaily();
}

function claimQuest(id) {
  const q = QUESTS.find(x => x.id === id);
  if (!q || S.quests.claimed.includes(id) || q.progress() < q.target) return;
  S.quests.claimed.push(id);
  addSparkles(q.reward); addExp(15);
  toast(`Задание выполнено! +${q.reward} ✨`);
  sfx('daily'); renderQuests(); updateHUD(); save();
}

function dailyAvailable() { return S.lastDaily !== todayKey(); }

function renderDaily() {
  const btn = $('daily-btn');
  btn.disabled = !dailyAvailable();
  btn.textContent = dailyAvailable() ? '🎁 Забрать ежедневную награду' : '🎁 Награда получена · приходи завтра';
  refreshMainButton();
}

function claimDaily() {
  if (!dailyAvailable()) return;
  S.lastDaily = todayKey();
  const reward = 100 + S.level * 20;
  addSparkles(reward); S.drops += 10; addExp(20);
  toast(`🎁 +${reward} ✨ и +10 💧`); sfx('daily'); tg.haptic('success'); burstHearts(12);
  renderDaily(); renderQuests(); updateHUD(); save();
}

function refreshMainButton() {
  // В Telegram показываем большую нижнюю кнопку, когда есть награда
  if (dailyAvailable()) tg.mainButton('🎁 Забрать ежедневную награду', claimDaily);
  else tg.hideMainButton();
}

/* ================= Музыка ================= */

function renderMusic() {
  $('now-playing').textContent = `${music.track.emoji} ${music.track.title} — ${music.track.desc}`;
  $('btn-play').textContent = music.playing ? '⏸ Пауза' : '▶ Играть';
  $('music-list').innerHTML = MUSIC_TRACKS.map((t, i) => `
    <div class="card music-card ${i === music.index ? 'active' : ''}">
      <div class="shop-icon">${t.emoji}</div>
      <div class="shop-info"><b>${t.title}</b><span>${t.desc}${t.file ? ' · mp3' : ''}</span></div>
      <button class="btn-main" data-track="${i}">${i === music.index && music.playing ? '⏸' : '▶'}</button>
    </div>`).join('');
  document.querySelectorAll('[data-track]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.track);
    if (i === music.index && music.playing) music.pause(); else music.play(i);
    S.settings.track = music.index; save();
  });
  $('volume-slider').value = Math.round(S.settings.volume * 100);
  $('toggle-music').checked = S.settings.music;
  $('toggle-sfx').checked = S.settings.sfx;
}

/* ================= HUD и навигация ================= */

function updateHUD() {
  $('hud-sparkles').textContent = fmt(S.sparkles);
  $('hud-drops').textContent = fmt(S.drops);
  $('hud-persec').textContent = `${fmt(perSec() * careMultiplier() * boostMultiplier())}/сек`;
  $('boost-badge').style.display = Date.now() < S.boostUntil ? 'inline-block' : 'none';
  $('player-level').textContent = `Уровень ${S.level}`;
  $('exp-fill').style.width = Math.min(100, (S.exp / expNeed(S.level)) * 100) + '%';
  $('exp-text').textContent = `${Math.floor(S.exp)} / ${expNeed(S.level)} опыта`;
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  tg.showBack(name !== 'island');
  if (name === 'shop') renderShop();
  if (name === 'pets') renderPets();
  if (name === 'quests') renderQuests();
  if (name === 'music') renderMusic();
  window.scrollTo({ top: 0 });
}

/* ================= Офлайн-доход ================= */

function applyOfflineEarnings() {
  const awaySec = Math.min((Date.now() - (S.lastSeen || Date.now())) / 1000, 8 * 3600);
  const gain = Math.floor(awaySec * perSec() * 0.5);
  if (awaySec > 120 && gain > 0) {
    addSparkles(gain, { silent: true });
    $('offline-text').textContent = `Пока тебя не было (${Math.floor(awaySec / 60)} мин), остров собрал ${fmt(gain)} ✨`;
    $('offline-modal').classList.add('show');
  }
}

/* ================= Инициализация ================= */

async function init() {
  tg.init(() => showScreen('island'));
  window.AtlandsSave.onStatus = t => { $('save-status').textContent = t; };

  S = await window.AtlandsSave.load(defaultState());
  ensureQuests();
  applyOfflineEarnings();

  // игрок из Telegram
  const user = tg.user;
  $('player-name').textContent = user
    ? `Привет, ${user.first_name}! 👋`
    : (S.petName ? 'Мой уютный остров 🏝️' : 'Atlands');
  $('player-sub').textContent = user && user.username ? '@' + user.username : 'Atlands · мини-игра';

  // музыка из настроек
  music.setVolume(S.settings.volume);
  music.index = Math.min(S.settings.track || 0, MUSIC_TRACKS.length - 1);
  music.onChange = () => renderMusic();

  renderPet(); renderCare(); renderQuests(); updateHUD();

  /* события */
  $('pet-stage').addEventListener('click', onTapPet);
  document.querySelectorAll('[data-care]').forEach(b => b.onclick = () => onCare(b.dataset.care));
  document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => { showScreen(b.dataset.screen); sfx('pop'); tg.haptic('light'); });
  $('daily-btn').onclick = claimDaily;
  $('offline-close').onclick = () => { $('offline-modal').classList.remove('show'); sfx('coin'); updateHUD(); save(); };
  $('pet-name-label').onclick = () => {
    const name = prompt('Как зовут питомца?', S.petName);
    if (name && name.trim()) { S.petName = name.trim().slice(0, 16); renderPet(); save(); }
  };
  $('btn-play').onclick = () => { music.toggle(); if (music.playing) { S.settings.music = true; $('toggle-music').checked = true; } };
  $('btn-next').onclick = () => music.next();
  $('btn-prev').onclick = () => music.prev();
  $('volume-slider').oninput = e => {
    S.settings.volume = e.target.value / 100;
    music.setVolume(S.settings.volume); save();
  };
  $('toggle-music').onchange = e => {
    S.settings.music = e.target.checked;
    e.target.checked ? music.play(music.index) : music.pause();
    save();
  };
  $('toggle-sfx').onchange = e => { S.settings.sfx = e.target.checked; save(); if (e.target.checked) sfx('pop'); };

  /* настройки: экспорт / импорт / сброс / бот */
  $('btn-export').onclick = () => {
    const text = window.AtlandsSave.exportJSON(S);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'atlands-save.json'; a.click(); URL.revokeObjectURL(a.href);
    toast('Сейв скачан 📤');
  };
  $('import-file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      S = window.AtlandsSave.importJSON(await file.text(), defaultState());
      renderPet(); renderCare(); renderQuests(); updateHUD();
      toast('Сейв загружен 📥');
    } catch (err) { toast('Файл повреждён 😢'); sfx('error'); }
  };
  $('btn-reset').onclick = () => {
    if (!confirm('Сбросить весь прогресс? Это нельзя отменить!')) return;
    window.AtlandsSave.wipe();
    S = defaultState();
    window.AtlandsSave.schedule(S); window.AtlandsSave.flush();
    renderPet(); renderCare(); renderQuests(); updateHUD();
    toast('Остров создан заново 🌱');
  };
  $('btn-send-bot').onclick = () => {
    const ok = tg.sendToBot({ type: 'progress', level: S.level, sparkles: Math.floor(S.sparkles), pet: S.petId, totalTaps: S.totalTaps });
    toast(ok ? 'Отправлено боту 🤖' : 'Открой игру из Telegram, чтобы отправить боту');
  };

  /* игровые циклы */
  setInterval(() => { // пассивный доход, 10 раз/сек — плавно
    const gain = perSec() * careMultiplier() * boostMultiplier() / 10;
    if (gain > 0) addSparkles(gain);
  }, 100);
  setInterval(() => { // потребности медленно падают, энергия ночью восстанавливается... просто: все -1/2мин
    S.mood = Math.max(15, S.mood - 0.5);
    S.hunger = Math.max(10, S.hunger - 0.5);
    S.energy = Math.max(15, S.energy - 0.4);
    renderCare(); updateHUD();
  }, 30000);
  setInterval(renderCare, 1000); // кулдауны ухода
  setInterval(() => { window.AtlandsSave.flush(); }, 30000); // автосейв в облако

  showScreen('island');
  window.AtlandsSave.flush();
  // музыку запускаем после первого касания (правило браузеров) — см. обработчик ниже
  const startMusicOnce = () => {
    if (S.settings.music && !music.playing) music.play(music.index);
    document.removeEventListener('pointerdown', startMusicOnce);
  };
  document.addEventListener('pointerdown', startMusicOnce);
}

document.addEventListener('DOMContentLoaded', init);
