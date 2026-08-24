# 🚀 VGLTU Minecraft Launcher Ecosystem v1.0.0

**Полнофункциональная экосистема для создания и управления собственным Minecraft лаунчером.**

Этот проект предоставляет полный набор инструментов для запуска своего Minecraft проекта: от мощного бэкенда и удобной админ-панели до кроссплатформенного десктопного клиента и Telegram-бота для взаимодействия с пользователями.

---

## 📋 Содержание

1.  [Состав проекта](#-состав-проекта)
2.  [Установка и запуск](#-установка-и-запуск)
3.  [Доступ администратора и игроки](#-доступ-администратора-и-игроки)
4.  [Управление Docker Compose](#-управление-docker-compose)
5.  [Кастомизация и ребрендинг](#-кастомизация-и-ребрендинг)
6.  [Инфраструктура и Nginx](#-инфраструктура-и-nginx)
7.  [Развертывание](#-развертывание)
8.  [Технический стек](#-технический-стек)

---

## 🌟 Состав проекта

Система состоит из четырех взаимосвязанных компонентов:

*   **🖥️ Server (Backend):**
    *   API на **FastAPI** (Python).
    *   Авторизация через **Yggdrasil API** (совместимость с любыми клиентами).
    *   Хранение файлов в **MinIO** (S3-compatible) с дедупликацией.
    *   База данных **PostgreSQL** и кэширование в **Redis**.
    *   Поддержка **RCON** для управления игровыми серверами.

*   **⚙️ Admin Web Panel:**
    *   Современный интерфейс на **React + Vite**.
    *   Управление сборками, загрузка модов (drag & drop).
    *   Настройка синхронизации файлов (SFTP) и RCON.
    *   Файловый менеджер с редактором конфигов.

*   **🎮 Desktop Client:**
    *   Кроссплатформенный лаунчер на **Electron + React**.
    *   Автоматическая установка Java, Minecraft, Forge/Fabric.
    *   Система зеркал для быстрой загрузки.
    *   Оптимизация RAM и "стелс-режим".

*   **🤖 Telegram Bot:**
    *   Бот на **aiogram** для взаимодействия с пользователями.
    *   Авторизация администраторов.
    *   Система обратной связи.

---

## 🛠 Установка и запуск

### Предварительные требования
*   Docker Engine с Compose plugin либо Docker Desktop.
*   Linux-сервер нужен для публичного развертывания с Nginx; локальный запуск возможен на Windows, macOS и Linux.
*   Node.js нужен только для ручной сборки admin-web или desktop.

### 1. Локальный запуск или существующий сервер

Все команды ниже выполняются из каталога `vgltu_launcher`, а не из корня репозитория.

```bash
cd vgltu_launcher
cp .env.example .env
```

В `.env` задайте пароли PostgreSQL, Redis и MinIO, а также `SECRET_KEY`. До первого SFTP/RCON-подключения задайте `SFTP_ENCRYPTION_KEY`: этот ключ шифрует сохранённые секреты, поэтому менять его после запуска нельзя.

Для локальной проверки без Telegram-бота запустите основной контур:

```bash
docker compose up -d --build postgres minio redis backend admin-web
docker compose ps
```

После запуска доступны:

*   admin-панель: `http://localhost:5173`;
*   OpenAPI backend: `http://localhost:8000/openapi.json`.

### 2. Telegram-бот и вход в admin-панель

Для входа администратора заполните `BOT_TOKEN`, `ADMIN_IDS` и `BOT_CALLBACK_SECRET` в `.env`. В `ADMIN_IDS` указываются числовые Telegram ID через запятую. `BOT_CALLBACK_SECRET` должен быть одинаковым у backend и bot.

> **Ограничение текущей конфигурации:** `BOT_USERNAME` из `.env.example` пока не передаётся Compose-сервису `backend`, поэтому ссылка из панели ведёт к `@vgltuminecraftbot`. Если у запущенного бота другой username, откройте его вручную и отправьте `/start <код>`.

```bash
docker compose up -d bot
```

Откройте admin-панель, перейдите по ссылке на бота или отправьте ему команду `/start` с показанным кодом. Код действует пять минут и после успешного входа удаляется.

### 3. Чистая установка на выделенном Linux-хосте

`install.sh` предназначен только для нового или одноразового хоста. Перед началом он требует `CLEANUP` и удаляет Docker Engine, все Docker-контейнеры и volumes, `/var/lib/docker`, Nginx, локальный `.env` и `docker-data`. Не запускайте его на рабочем сервере или локальном компьютере с нужными Docker-данными.

```bash
cd vgltu_launcher
chmod +x install.sh
./install.sh
```

---

## 🔐 Доступ администратора и игроки

Игровые учётные записи создаёт авторизованный администратор через `POST /api/admin/players`. У игрока должен быть пароль длиной не менее 12 символов; сервер хранит только его hash. Desktop-клиент передаёт введённый игроком пароль в Yggdrasil API, саморегистрация отсутствует.

Пример запроса и команды обслуживания приведены в [инструкции Docker Compose](vgltu_launcher/DOCKER_COMMANDS.md).

---

## 🔧 Управление Docker Compose

Управление проектом осуществляется через стандартные команды Docker Compose.

### Основные команды

| Действие | Команда |
|----------|---------|
| **Запуск** | `docker compose up -d` |
| **Остановка** | `docker compose stop` |
| **Перезапуск** | `docker compose restart` |
| **Статус** | `docker compose ps` |
| **Логи** | `docker compose logs -f [service]` (backend, bot, admin-web) |
| **Полный сброс** | `docker compose down -v` (⚠️ Удалит все данные!) |

> Подробнее о командах Docker читайте в [DOCKER_COMMANDS.md](vgltu_launcher/DOCKER_COMMANDS.md).

---

## 🎨 Кастомизация и Ребрендинг

Вы можете легко изменить название, ID приложения и другие параметры под свой проект.

1.  **Настройка `branding.json`:**
    Откройте файл `branding.json` и измените значения:
    ```json
    {
      "name": "My Super Launcher",
      "shortName": "mylauncher",
      "appId": "com.mylauncher.app",
      "adminTitle": "My Admin Panel"
    }
    ```

2.  **Применение изменений:**
    Запустите скрипт ребрендинга, который автоматически обновит файлы проекта.
    ```bash
    python3 rebrand.py
    ```

---

## 🌐 Инфраструктура и Nginx

Для работы в продакшене (с SSL и красивым доменом) используется Nginx.

### Настройка на выделенном хосте

На новом выделенном хосте `install.sh` устанавливает Docker и Nginx, генерирует окружение и подготавливает конфигурацию. Его полный сброс хоста описан в разделе установки выше.

### Ручная настройка Nginx

Для существующего сервера настройте Nginx вручную после запуска Compose:

1.  Установите Nginx: `sudo apt install nginx`.
2.  Скопируйте конфиг: `sudo cp nginx/launcher.conf /etc/nginx/sites-available/launcher`
3.  Отредактируйте доменное имя в конфиге: `sudo nano /etc/nginx/sites-available/launcher`
4.  Активируйте сайт: `sudo ln -s /etc/nginx/sites-available/launcher /etc/nginx/sites-enabled/`
5.  Проверьте конфигурацию: `sudo nginx -t`
6.  Перезапустите Nginx: `sudo systemctl reload nginx`

Для получения SSL сертификата от Let's Encrypt:
```bash
sudo apt install python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Адреса сервисов по умолчанию

| Сервис | Локальный адрес на хосте с Docker | Через Nginx |
|--------|-----------------------------|-------------|
| Admin Panel | `http://localhost:5173` | `https://your-domain.com/` |
| Backend API | `http://localhost:8000` | `https://your-domain.com/api/` |
| MinIO API и Console | Только внутренняя сеть Docker | Не публикуются |

---

## 🚀 Развертывание

Перед публичным запуском:

- [ ] `.env` файл настроен, пароли изменены, а `BOT_CALLBACK_SECRET` и `SFTP_ENCRYPTION_KEY` сгенерированы.
- [ ] `branding.json` актуализирован.
- [ ] Firewall (UFW) настроен (открыты порты 80, 443, 22).
- [ ] SSL сертификат получен и работает.
- [ ] Создана и проверена резервная копия PostgreSQL.
- [ ] `docker compose config` и `docker compose ps` завершаются без ошибок.

---

## 💻 Технический стек

*   **Backend:** Python 3.11, FastAPI, SQLAlchemy, Alembic
*   **Database:** PostgreSQL 16
*   **Cache:** Redis 7
*   **Storage:** MinIO (S3)
*   **Frontend (Admin):** React 18, Vite, Tailwind CSS, Shadcn UI
*   **Desktop:** Electron 30, React, TypeScript
*   **Infrastructure:** Docker, Nginx

---

> **Примечание:** Проект находится в активной стадии разработки. Возможны изменения в API и структуре базы данных.
