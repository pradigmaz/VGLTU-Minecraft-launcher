# Minecraft Launcher System

Полнофункциональная система управления Minecraft серверами с веб-панелью администратора, десктоп лаунчером и Telegram ботом.

> Название проекта настраивается через `branding.json`

## 🚀 Возможности

### Desktop Launcher (Electron)
- Авторизация через Yggdrasil
- Автоматическая установка Minecraft + Forge
- Система зеркал для скачивания
- Настройка выделения RAM
- Консоль логов

### Admin Web Panel (React)
- Аутентификация через Telegram Bot
- Загрузка модпаков (ZIP/RAR)
- File Manager с редактором конфигов
- Темная/светлая тема

### Backend (FastAPI)
- Yggdrasil авторизация
- Content-addressable storage
- PostgreSQL + Redis + MinIO

### Telegram Bot (aiogram)
- Авторизация админов
- Feedback система

## 📦 Технологии

- **Frontend:** React, Electron, Vite, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy (async), PostgreSQL, Redis, MinIO
- **Bot:** aiogram, Python 3.11+

## 🛠️ Быстрый старт (локально)

```bash
# 1. Настройка
cp .env.example .env
nano .env  # заполнить переменные

# 2. Запуск
chmod +x manage.sh
./manage.sh start

# 3. Проверка
./manage.sh status
```

**Порты:**
- Backend API: http://localhost:8000
- MinIO Console: http://localhost:9001

## 🖥️ Развёртывание на сервере

Подробная пошаговая инструкция: **[DEPLOY.md](DEPLOY.md)**

## 🔧 Управление

```bash
./manage.sh start           # Запуск
./manage.sh stop            # Остановка
./manage.sh restart         # Перезапуск
./manage.sh logs backend    # Логи
./manage.sh reset           # Полный сброс данных
./manage.sh reset-service postgres  # Сброс PostgreSQL
```

## 🔒 Безопасность

- JWT с сильным SECRET_KEY
- Redis/MinIO с паролями
- Input validation
- Rate limiting
- Archive bomb protection

## 📝 Лицензия

MIT License
