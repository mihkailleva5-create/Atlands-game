/**
 * Atlands — интеграция с Telegram Mini App.
 * Работает и без Telegram (в обычном браузере) — тогда всё тихо пропускается.
 * Документация: https://core.telegram.org/bots/webapps
 */
'use strict';

const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const AtlandsTG = {
  isTelegram: !!TG,
  user: null, // { id, first_name, username, photo_url }

  init(onBack) {
    if (!TG) return;
    try {
      TG.ready();
      TG.expand(); // на весь экран
      if (TG.setHeaderColor) TG.setHeaderColor('#87ceeb');
      if (TG.setBackgroundColor) TG.setBackgroundColor('#aee7ff');
      // тема Telegram -> CSS-переменные
      const root = document.documentElement;
      const tp = TG.themeParams || {};
      if (tp.bg_color) root.style.setProperty('--tg-bg', tp.bg_color);
      if (tp.text_color) root.style.setProperty('--tg-text', tp.text_color);
      if (TG.colorScheme) root.dataset.scheme = TG.colorScheme;
      if (TG.initDataUnsafe && TG.initDataUnsafe.user) this.user = TG.initDataUnsafe.user;
      if (TG.BackButton) {
        TG.BackButton.onClick(() => { if (onBack) onBack(); });
      }
      // автосохранение при сворачивании/закрытии Mini App
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && window.AtlandsSave) window.AtlandsSave.flush();
      });
    } catch (e) { console.warn('Telegram init:', e); }
  },

  haptic(type = 'light') {
    if (!TG || !TG.HapticFeedback) return;
    try {
      if (type === 'success' || type === 'error') TG.HapticFeedback.notificationOccurred(type);
      else TG.HapticFeedback.impactOccurred(type);
    } catch (e) {}
  },

  showBack(show) {
    if (!TG || !TG.BackButton) return;
    try { show ? TG.BackButton.show() : TG.BackButton.hide(); } catch (e) {}
  },

  mainButton(text, onClick) {
    if (!TG || !TG.MainButton) return null;
    try {
      TG.MainButton.setText(text);
      TG.MainButton.offClick(this._mbHandler || (() => {}));
      this._mbHandler = onClick;
      TG.MainButton.onClick(onClick);
      TG.MainButton.show();
      return TG.MainButton;
    } catch (e) { return null; }
  },

  hideMainButton() {
    if (TG && TG.MainButton) { try { TG.MainButton.hide(); } catch (e) {} }
  },

  /** Отправить данные боту (бот получит web_app_data). Лимит Telegram ~4 КБ. */
  sendToBot(payload) {
    if (!TG || !TG.sendData) return false;
    try { TG.sendData(JSON.stringify(payload)); return true; } catch (e) { return false; }
  },

  openLink(url) {
    if (TG && TG.openLink) TG.openLink(url); else window.open(url, '_blank');
  },
};

window.AtlandsTG = AtlandsTG;
