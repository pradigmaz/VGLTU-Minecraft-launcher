# Faculty Launcher

Полнофункциональная система управления Minecraft серверами с веб-панелью администратора, десктоп лаунчером и Telegram ботом.

## 🚀 Возможности

### Desktop Launcher (Electron)
- ✅ Авторизация через Yggdrasil
- ✅ Автоматическая установка Minecraft + Forge
- ✅ Система зеркал для скачивания (FastMirror, Official, BMCLAPI)
- ✅ Настройка выделения RAM
- ✅ Консоль логов с автоскроллом
- ✅ Stealth Mode (скрытие при запуске игры)

### Admin Web Panel (React)
- ✅ Аутентификация через Telegram Bot
- ✅ Загрузка модпаков (ZIP/RAR)
- ✅ File Manager с редактором конфигов
- ✅ Темная/светлая тема
- ✅ Мультиязычность (EN/RU)

### Backend (FastAPI)
- ✅ Yggdrasil авторизация
- ✅ Content-addressable storage (дедупликация файлов)
- ✅ PostgreSQL + Redis + MinIO
- ✅ Rate limiting
- ✅ Archive bomb protection

### Telegram Bot (aiogram)
- ✅ Авторизация админов
- ✅ Feedback система
- ✅ Rate limiting

## 📦 Технологии

**Frontend:**
- React 19.2.0
- Electron 34.0.0
- Vite 7.2.4
- Tailwind CSS 4.1.17

**Backend:**
- FastAPI 0.115.12
- SQLAlchemy 2.0.36 (async)
- PostgreSQL 16
- Redis 7
- MinIO (S3-compatible)

**Bot:**
- aiogram 3.17.0
- Python 3.11+

## 🛠️ Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/your-username/faculty-launcher.git
cd faculty-launcher
```

### 2. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
nano .env
```

**Обязательные переменные:**
```env
# Telegram Bot
BOT_TOKEN=your_bot_token_from_@BotFather
ADMIN_IDS=your_telegram_id
BOT_USERNAME=your_bot_username
DEVELOPER_CHAT_ID=your_telegram_id

# Безопасность (сгенерировать: openssl rand -hex 32)
SECRET_KEY=your_secret_key_here
POSTGRES_PASSWORD=strong_password_here
REDIS_PASSWORD=strong_password_here
MINIO_ROOT_PASSWORD=strong_password_here
```

### 3. Запуск через Docker Compose

```bash
docker-compose up -d
```

**Сервисы запустятся на портах:**
- Backend API: http://localhost:8000
- Admin Web: http://localhost:5173
- MinIO Console: http://localhost:9001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 4. Проверка работы

```bash
# Проверить статус контейнеров
docker-compose ps

# Логи backend
docker-compose logs -f backend

# Логи бота
docker-compose logs -f bot
```

## 📱 Использование

### Для администраторов

1. Откройте Admin Web: http://localhost:5173
2. Нажмите "Login via Telegram"
3. Откройте бота и отправьте `/start <код>`
4. Вернитесь в браузер - вы авторизованы

### Для игроков

1. Скачайте Desktop Launcher из releases
2. Установите и запустите
3. Введите ник и нажмите "Login"
4. Выберите сервер и нажмите "Play"

## 🔧 Разработка

### Backend

```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Admin Web

```bash
cd admin-web
npm install
npm run dev
```

### Desktop Launcher

```bash
cd desktop
npm install
npm run dev
```

### Telegram Bot

```bash
cd telegram-bot
pip install -r requirements.txt
python bot.py
```

## 📚 Документация

Подробная документация находится в папке `docs/` (после клонирования):
- `docs/Backend.md` - API документация
- `docs/Desktop.md` - Архитектура лаунчера
- `docs/AdminWeb.md` - Компоненты админки

## 🔒 Безопасность

Проект прошёл аудит безопасности (2025-12-08):
- ✅ JWT с сильным SECRET_KEY
- ✅ Redis с паролем
- ✅ MinIO SSL конфигурируемый
- ✅ CORS ограничен
- ✅ Input validation
- ✅ Path traversal protection
- ✅ Archive bomb protection
- ✅ Rate limiting
- ✅ CSP в Electron

## 📝 Лицензия

MIT License

## 🤝 Контрибьюция

Pull requests приветствуются! Для больших изменений сначала откройте issue.

## 📧 Контакты

- Telegram: @your_username
- Email: your@email.com
