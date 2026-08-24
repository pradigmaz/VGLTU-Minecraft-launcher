# Административная панель

React-приложение для управления сборками, файлами, SFTP/RCON и настройками экземпляров launcher. В рабочем окружении его собирает Docker и отдаёт Nginx из compose-сервиса `admin-web`.

## Запуск через Docker Compose

Из каталога `vgltu_launcher`:

```bash
docker compose up -d --build postgres minio redis backend admin-web
```

Панель будет доступна по адресу `http://localhost:5173`. Backend API по умолчанию работает на `http://localhost:8000/api`.

## Вход администратора

Вход выполняется через Telegram-бота. Перед запуском bot укажите в `.env`:

* `BOT_TOKEN`;
* числовой Telegram ID администратора в `ADMIN_IDS`;
* одинаковый `BOT_CALLBACK_SECRET` для backend и bot.

Затем запустите bot:

```bash
docker compose up -d bot
```

`BOT_USERNAME` есть в `.env.example`, но текущий Compose не передаёт его backend. Поэтому ссылка из панели ведёт к `@vgltuminecraftbot`; если у запущенного бота другой username, откройте его вручную и отправьте `/start <код>`.

Код действует пять минут и удаляется после успешного входа.

## Локальная разработка интерфейса

Оставьте backend запущенным, остановите compose-сервис admin-панели, затем выполните:

```bash
docker compose stop admin-web
cd admin-web
npm install
npm run dev
```

Vite использует `http://localhost:8000/api`, если `VITE_API_URL` не задана. Для проверки перед изменением отправляйте `npm run lint`, для production-сборки — `npm run build`.
