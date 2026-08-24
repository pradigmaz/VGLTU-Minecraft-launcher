import asyncio
import os
import logging
from html import escape
import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command, CommandObject
from aiogram.types import Message
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

# Конфигурация
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is required!")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
DEVELOPER_CHAT_ID = os.getenv("DEVELOPER_CHAT_ID")
BOT_CALLBACK_SECRET = os.getenv("BOT_CALLBACK_SECRET")

# Timeout для HTTP запросов (секунды)
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)

logging.basicConfig(level=logging.INFO)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# Rate limiting для feedback (user_id -> last_message_time)
from collections import defaultdict
import time
feedback_cooldowns: dict[int, float] = defaultdict(float)
FEEDBACK_COOLDOWN_SECONDS = 30  # 1 сообщение в 30 секунд

# --- ХЕНДЛЕР 1: КОМАНДА /START ---
@dp.message(CommandStart())
async def command_start_handler(message: Message, command: CommandObject):
    args = command.args 
    
    # 1. Сценарий: Нажали кнопку "Feedback" в лаунчере (?start=feedback)
    if args and args.startswith("feedback"):
        await message.answer(
            f"👋 Привет, {message.from_user.first_name}!\n\n"
            "Я вижу, вы перешли из Лаунчера, чтобы оставить отзыв.\n\n"
            "✍️ <b>Просто напишите сюда ваше сообщение:</b>\n"
            "• Нашли баг?\n"
            "• Есть идея для мода?\n"
            "• Или просто хотите сказать спасибо?\n\n"
            "<i>Я мгновенно перешлю ваше сообщение разработчику.</i> 👇"
        )
        return

    # 2. Сценарий: Просто /start (без параметров)
    if not args:
        await message.answer(
            f"👋 Привет! Я бот Pixel Launcher.\n\n"
            "🔹 Для входа в админку — используйте ссылку в браузере.\n"
            "🔹 Чтобы написать разработчику — просто отправьте сообщение сюда."
        )
        return

    # 3. Сценарий: Авторизация (/start <uuid_код>)
    user_data = {
        "code": args,
        "telegram_id": message.from_user.id,
        "username": message.from_user.username or "Unknown"
    }

    if not BOT_CALLBACK_SECRET:
        logging.error("BOT_CALLBACK_SECRET is not configured")
        await message.answer("⚠️ Авторизация панели временно недоступна.")
        return

    async with aiohttp.ClientSession(timeout=REQUEST_TIMEOUT) as session:
        try:
            async with session.post(
                f"{BACKEND_URL}/api/auth/callback",
                json=user_data,
                headers={"X-Bot-Callback-Secret": BOT_CALLBACK_SECRET},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    role = data.get("role", "user")
                    if role == "admin":
                        await message.answer("✅ <b>Успешно!</b> Вы авторизованы как Администратор. Вернитесь в браузер.")
                    else:
                        await message.answer("✅ <b>Готово!</b> Вы вошли в аккаунт.")     
                elif resp.status == 404:
                    await message.answer("❌ <b>Ошибка:</b> Код авторизации устарел или неверен.")
                elif resp.status == 403:
                    # Даже если не админ, авторизация не прошла, но писать можно
                    await message.answer("⛔ Доступ к панели закрыт, но вы можете писать сюда сообщения для разработчика.")
                else:
                    await message.answer(f"⚠️ <b>Ошибка сервера:</b> Код {resp.status}")
        except Exception as e:
            logging.error(f"Backend error: {e}")
            await message.answer("🔌 Ошибка подключения к серверу.")

# --- ХЕНДЛЕР 2: КОМАНДА /feedback ---
@dp.message(Command("feedback"))
async def feedback_command_handler(message: Message):
    await message.answer(
        "💬 <b>Оставьте свои предложения</b>\n\n"
        "Просто напишите сюда ваше сообщение:\n"
        "• Нашли баг?\n"
        "• Есть идея для улучшения?\n"
        "• Хотите предложить новый мод?\n\n"
        "<i>Я перешлю ваше сообщение разработчику.</i> 👇"
    )

# --- ХЕНДЛЕР 3: ФИДБЕК (Текст) ---
@dp.message(F.text & ~F.text.startswith("/"))
async def feedback_handler(message: Message):
    if not DEVELOPER_CHAT_ID:
        await message.reply("⚠️ Система отзывов временно не настроена.")
        return

    # Rate limiting
    user_id = message.from_user.id
    now = time.time()
    if now - feedback_cooldowns[user_id] < FEEDBACK_COOLDOWN_SECONDS:
        remaining = int(FEEDBACK_COOLDOWN_SECONDS - (now - feedback_cooldowns[user_id]))
        await message.reply(f"⏳ Подождите {remaining} сек. перед следующим сообщением.")
        return
    feedback_cooldowns[user_id] = now

    try:
        username = f"@{escape(message.from_user.username)}" if message.from_user.username else "No Username"
        user_link = f"<a href='tg://user?id={message.from_user.id}'>{escape(message.from_user.full_name)}</a>"
        
        admin_text = (
            f"📩 <b>Фидбек от {user_link}</b> ({username}):\n\n"
            f"{escape(message.text)}"
        )

        await bot.send_message(chat_id=DEVELOPER_CHAT_ID, text=admin_text)
        await message.reply("✅ <b>Отправлено!</b> Разработчик получил ваше сообщение.")

    except Exception as e:
        logging.error(f"Feedback error: {e}")
        await message.reply("❌ Ошибка отправки.")

async def main():
    print("🤖 Bot started...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
