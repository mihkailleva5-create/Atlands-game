"""
Atlands — пример Telegram-бота для мини-игры.

Что умеет:
  /start  -> кнопка «Играть» (WebApp открывает index.html игры)
  /profile -> прогресс игрока из базы
  Принимает web_app_data от игры (кнопка «🤖 Боту» в игре) и сохраняет в SQLite.

Установка:
  pip install -r requirements.txt
  BOT_TOKEN=123:ABC WEBAPP_URL=https://<твой-домен>/index.html python bot.py

WEBAPP_URL должен быть https (GitHub Pages подходит). Для теста бота
локальный http не откроется в Telegram — нужен публичный https-адрес.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://example.github.io/Atlands-game/")
DB_PATH = os.path.join(os.path.dirname(__file__), "saves.db")


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS players (
               user_id INTEGER PRIMARY KEY,
               username TEXT,
               level INTEGER DEFAULT 1,
               sparkles INTEGER DEFAULT 0,
               pet TEXT DEFAULT 'lotti',
               total_taps INTEGER DEFAULT 0,
               updated_at TEXT
           )"""
    )
    return conn


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    kb = [[InlineKeyboardButton("🏝️ Играть в Atlands", web_app=WebAppInfo(url=WEBAPP_URL))]]
    await update.message.reply_text(
        "Привет! Это Atlands — уютный остров с питомцами 🏝️💖\n"
        "Тапай питомца, собирай искры, открывай новых друзей и слушай музыку острова.",
        reply_markup=InlineKeyboardMarkup(kb),
    )


async def profile(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    with db() as conn:
        row = conn.execute(
            "SELECT level, sparkles, pet, total_taps, updated_at FROM players WHERE user_id=?",
            (user.id,),
        ).fetchone()
    if not row:
        await update.message.reply_text("Пока нет сохранённого прогресса. Открой игру кнопкой из /start 🎮")
        return
    level, sparkles, pet, taps, updated = row
    await update.message.reply_text(
        f"🏝️ Твой остров\nУровень: {level}\nИскр собрано: {sparkles} ✨\n"
        f"Питомец: {pet}\nТапов: {taps}\nОбновлено: {updated}"
    )


async def on_webapp_data(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    """Игра шлёт сюда JSON через Telegram.WebApp.sendData (кнопка «🤖 Боту»)."""
    user = update.effective_user
    try:
        data = json.loads(update.effective_message.web_app_data.data)
    except (ValueError, AttributeError):
        return
    if data.get("type") != "progress":
        return
    with db() as conn:
        conn.execute(
            """INSERT INTO players (user_id, username, level, sparkles, pet, total_taps, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 username=excluded.username, level=excluded.level,
                 sparkles=excluded.sparkles, pet=excluded.pet,
                 total_taps=excluded.total_taps, updated_at=excluded.updated_at""",
            (
                user.id,
                user.username or "",
                int(data.get("level", 1)),
                int(data.get("sparkles", 0)),
                str(data.get("pet", "lotti"))[:32],
                int(data.get("totalTaps", 0)),
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            ),
        )
    await update.message.reply_text(
        f"Прогресс сохранён ботом 🤖 Уровень {data.get('level', 1)}, искр: {data.get('sparkles', 0)} ✨"
    )


def main() -> None:
    if not BOT_TOKEN:
        raise SystemExit("Задай BOT_TOKEN от @BotFather: BOT_TOKEN=... python bot.py")
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("profile", profile))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, on_webapp_data))
    print("Atlands bot запущен. WEBAPP_URL =", WEBAPP_URL)
    app.run_polling()


if __name__ == "__main__":
    main()
