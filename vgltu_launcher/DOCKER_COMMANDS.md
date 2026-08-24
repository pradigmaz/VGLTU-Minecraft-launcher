# Docker Compose: запуск и диагностика

## Рабочий каталог и быстрый запуск

Команды выполняются из `vgltu_launcher`. Сначала создайте `.env` из `.env.example` и замените все значения-заглушки. Для backend обязательны `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD` и `SECRET_KEY`.

`SFTP_ENCRYPTION_KEY` нужен до первого SFTP/RCON-подключения и не должен меняться после сохранения секретов. `BOT_CALLBACK_SECRET` нужен только для входа в admin-панель через Telegram и должен совпадать у backend и bot.

```bash
# Основной локальный контур без Telegram-бота
docker compose up -d --build postgres minio redis backend admin-web

# Проверить состояние и открыть интерфейсы
docker compose ps
# admin: http://localhost:5173
# OpenAPI: http://localhost:8000/openapi.json

# Запустить bot только после настройки BOT_TOKEN, ADMIN_IDS и BOT_CALLBACK_SECRET
docker compose up -d bot
```

`BOT_USERNAME` есть в `.env.example`, но текущий Compose не передаёт его backend. Поэтому при username, отличном от `vgltuminecraftbot`, откройте бота вручную и отправьте ему `/start <код>` вместо ссылки из admin-панели.

## Основные команды

### Запуск контейнеров
```bash
# Запустить все сервисы, включая Telegram-бота
docker compose up -d

# Запустить с пересборкой backend образа
docker compose up -d --build backend

# Запустить конкретный сервис
docker compose up -d backend
docker compose up -d postgres
docker compose up -d redis
docker compose up -d minio
```

### Остановка контейнеров
```bash
# Остановить все сервисы
docker compose down

# Остановить конкретный сервис
docker compose stop backend

# Остановить и удалить volumes (ВНИМАНИЕ: удалит данные!)
docker compose down -v
```

### Перезагрузка
```bash
# Перезагрузить backend
docker compose restart backend

# Перезагрузить все сервисы
docker compose restart
```

## Логи и отладка

### Просмотр логов
```bash
# Логи backend (последние 50 строк)
docker compose logs backend --tail 50

# Логи backend в реальном времени
docker compose logs -f backend

# Логи всех сервисов
docker compose logs --tail 50

# Логи конкретного сервиса в реальном времени
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f minio
```

### Проверка статуса
```bash
# Статус всех контейнеров
docker compose ps

# Подробная информация о контейнере
docker inspect pixellauncher_backend
```

## Работа с контейнером backend

### Выполнение команд внутри контейнера
```bash
# Интерактивный shell в контейнере
docker compose exec backend bash

# Выполнить команду
docker compose exec backend python -c "import sys; print(sys.version)"

# Проверить установленные пакеты
docker compose exec backend pip list
```

### Пересборка образа
```bash
# Пересобрать образ backend
docker compose build backend

# Пересобрать без кеша
docker compose build --no-cache backend

# Пересобрать все образы
docker compose build
```

## Работа с базой данных

### PostgreSQL
```bash
# Подключиться к PostgreSQL с параметрами из .env
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Выполнить SQL команду
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT * FROM users;"'

# Создать резервную копию в текущем каталоге хоста
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql

# Восстановить из резервной копии
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backup.sql
```

### Redis
```bash
# Подключиться к Redis
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD"'

# Просмотреть ключи без блокирующего KEYS *
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --scan'

# Очистить весь Redis. Необратимо; используйте только осознанно.
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" FLUSHALL ASYNC'
```

### MinIO
```bash
# MinIO не публикуется на хост и не должен проксироваться через Nginx.
# Бакет создается и делаетcя приватным при запуске backend.
docker compose logs backend --tail 50
```

## Очистка и обслуживание

### Удаление неиспользуемых ресурсов
```bash
# Удалить неиспользуемые образы
docker image prune

# Удалить неиспользуемые контейнеры
docker container prune

# Удалить неиспользуемые volumes
docker volume prune

# Полная очистка Docker host, а не только launcher (ВНИМАНИЕ: удалит всё неиспользуемое!)
docker system prune -a
```

### Просмотр использования ресурсов
```bash
# Статистика контейнеров
docker stats

# Размер контейнеров
docker ps -s
```

## Полезные команды для разработки

### Пересборка и перезагрузка backend
```bash
# Одна команда для пересборки и перезагрузки
docker compose up -d --build backend && docker compose logs -f backend
```

### Проверка здоровья сервисов
```bash
# Проверить OpenAPI backend
curl http://localhost:8000/openapi.json

# Проверить метаданные Yggdrasil
curl http://localhost:8000/authserver

# Проверить PostgreSQL
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Проверить Redis
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
```

### Создание игрового пользователя
```bash
# Нужна действующая JWT-сессия администратора. Пароль — не менее 12 символов; сервер хранит только hash.
curl -X POST http://localhost:8000/api/admin/players \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer","password":"change-this-password"}'
```

## Переменные окружения

Используйте `.env`, созданный из `.env.example`; не храните настоящие секреты в этом документе. Редактируйте `.env`, а не `docker-compose.yml`, когда меняете пароли, ключи или Telegram-настройки.

После изменения `.env` пересоздайте затронутые сервисы:
```bash
docker compose up -d --build
```

## Решение проблем

### Backend не запускается
```bash
# Проверить логи
docker compose logs backend

# Пересобрать образ
docker compose build --no-cache backend

# Перезагрузить
docker compose up -d --build backend
```

### Ошибка подключения к БД
```bash
# Проверить статус PostgreSQL
docker compose ps postgres

# Проверить логи PostgreSQL
docker compose logs postgres

# Перезагрузить PostgreSQL
docker compose restart postgres
```

### Очистить всё и начать заново
```bash
# Остановить и удалить данные launcher (включая PostgreSQL volume)
docker compose down -v

# Пересобрать образы
docker compose build

# Запустить заново
docker compose up -d
```
