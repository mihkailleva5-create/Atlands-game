/**
 * Atlands — система сохранений.
 *
 * Стратегия (от надёжного к запасному):
 *  1) Telegram CloudStorage — облако, живёт на всех устройствах игрока,
 *     лимит значения 4096 символов -> сейв режется на чанки по 3500.
 *  2) localStorage — зеркало, работает везде и офлайн (лимит ~5 МБ).
 *  3) Экспорт/импорт JSON-файлом — ручной бэкап для игрока.
 *
 * Сейв версионируется (SAVE_VERSION) и мигрирует при обновлениях игры.
 * API: load(defaultState), schedule(state), flush(), exportJSON(), importJSON(), wipe()
 */
'use strict';

const SAVE_VERSION = 1;
const LS_KEY = 'atlands_save_v1';
const CLOUD_PREFIX = 'atlands_v1_'; // + meta / 0,1,2...
const CHUNK = 3500;

function deepClone(o) { return JSON.parse(JSON.stringify(o)); } // работает и в старых WebView Telegram

function migrateSave(raw, defaultState) {
  if (!raw || typeof raw !== 'object') return deepClone(defaultState);
  const s = Object.assign(deepClone(defaultState), raw);
  s.settings = Object.assign({}, defaultState.settings, raw.settings || {});
  s.decorations = Object.assign({}, defaultState.decorations, raw.decorations || {});
  s.quests = Object.assign({}, defaultState.quests, raw.quests || {});
  s.care = Object.assign({}, defaultState.care, raw.care || {});
  s.version = SAVE_VERSION;
  if (!Array.isArray(s.unlockedPets) || !s.unlockedPets.length) s.unlockedPets = ['lotti'];
  return s;
}

class SaveManager {
  constructor() {
    this.state = null;
    this.timer = null;
    this.dirty = false;
    this.onStatus = null; // (text) => UI: "Сохранено ☁️ 12:03"
  }

  _status(text) { if (this.onStatus) this.onStatus(text); }

  /** Загрузка: Telegram CloudStorage -> localStorage -> новый сейв. */
  async load(defaultState) {
    const local = this._loadLocal();
    const cloud = await this._loadCloud();
    // берём тот, у кого свежее lastSeen
    const chosen = (cloud && (!local || (cloud.lastSeen || 0) >= (local.lastSeen || 0))) ? cloud : local;
    this.state = migrateSave(chosen, defaultState);
    if (cloud && chosen === cloud) this._writeLocal(this.state);
    return this.state;
  }

  _loadLocal() {
    try {
      const txt = localStorage.getItem(LS_KEY);
      return txt ? JSON.parse(txt) : null;
    } catch (e) { return null; }
  }

  _writeLocal(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  _cloud() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return tg && tg.CloudStorage ? tg.CloudStorage : null;
  }

  _loadCloud() {
    const cs = this._cloud();
    if (!cs) return Promise.resolve(null);
    return new Promise(resolve => {
      try {
        cs.getItem(CLOUD_PREFIX + 'meta', (err, meta) => {
          if (err || !meta) return resolve(null);
          const n = parseInt(meta, 10) || 0;
          if (!n) return resolve(null);
          const keys = Array.from({ length: n }, (_, i) => CLOUD_PREFIX + i);
          cs.getItems(keys, (err2, values) => {
            if (err2 || !values) return resolve(null);
            try { resolve(JSON.parse(keys.map(k => values[k] || '').join(''))); }
            catch (e) { resolve(null); }
          });
        });
      } catch (e) { resolve(null); }
    });
  }

  _writeCloud(state) {
    const cs = this._cloud();
    if (!cs) return;
    try {
      const txt = JSON.stringify(state);
      const chunks = [];
      for (let i = 0; i < txt.length; i += CHUNK) chunks.push(txt.slice(i, i + CHUNK));
      const items = { [CLOUD_PREFIX + 'meta']: String(chunks.length) };
      chunks.forEach((c, i) => { items[CLOUD_PREFIX + i] = c; });
      cs.setItems(items, () => {});
    } catch (e) {}
  }

  /** Отложенное сохранение (не дёргать облако на каждый тап). */
  schedule(state) {
    this.state = state;
    this.dirty = true;
    this._writeLocal(state); // локально — сразу, это дёшево
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 4000);
  }

  /** Сохранить прямо сейчас (закрытие, пауза, важное событие). */
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.state) return;
    this.state.lastSeen = Date.now();
    this._writeLocal(this.state);
    this._writeCloud(this.state);
    this.dirty = false;
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this._status(this._cloud() ? `☁️ Сохранено в ${t}` : `💾 Сохранено в ${t}`);
  }

  exportJSON(state) { return JSON.stringify(state, null, 2); }

  importJSON(text, defaultState) {
    const raw = JSON.parse(text); // бросит ошибку при битом файле — ловим в UI
    this.state = migrateSave(raw, defaultState);
    this.flush();
    return this.state;
  }

  wipe() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    const cs = this._cloud();
    if (cs) {
      try {
        cs.getKeys((err, keys) => {
          if (!err && keys) cs.removeItems(keys.filter(k => k.startsWith(CLOUD_PREFIX)), () => {});
        });
      } catch (e) {}
    }
    this.state = null; this.dirty = false;
  }
}

window.AtlandsSave = new SaveManager();
window.AtlandsSaveHelpers = { migrateSave, SAVE_VERSION };
