# Docker Commands для Backend

## Основные команды

### Запуск контейнеров
```bash
# Запустить все сервисы (PostgreSQL, Redis, MinIO, Backend)
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
# Подключиться к PostgreSQL
docker-compose exec postgres psql -U launcher -d pixel_launcher

# Выполнить SQL команду
docker-compose exec postgres psql -U launcher -d pixel_launcher -c "SELECT * FROM users;"

# Создать резервную копию
docker-compose exec postgres pg_dump -U launcher pixel_launcher > backup.sql

# Восстановить из резервной копии
docker-compose exec -T postgres psql -U launcher pixel_launcher < backup.sql
```

### Redis
```bash
# Подключиться к Redis
docker-compose exec redis redis-cli

# Проверить ключи
docker-compose exec redis redis-cli KEYS "*"

# Очистить Redis
docker-compose exec redis redis-cli FLUSHALL
```

### MinIO
```bash
# Консоль MinIO доступна по адресу: http://localhost:9001
# Логин: admin
# Пароль: supersecretkey

# Создать bucket через CLI
docker-compose exec minio mc mb minio/pixellauncher-storage

# Список buckets
docker-compose exec minio mc ls minio/
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

# Полная очистка (ВНИМАНИЕ: удалит всё!)
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
docker-compose up -d --build backend && docker-compose logs -f backend
```

### Проверка здоровья сервисов
```bash
# Проверить доступность backend
curl http://localhost:8000/

# Проверить метаданные Yggdrasil
curl http://localhost:8000/authserver

# Проверить PostgreSQL
docker-compose exec postgres pg_isready -U launcher

# Проверить Redis
docker-compose exec redis redis-cli ping
```

### Создание тестового пользователя
```bash
# Создать пользователя через API
curl -X POST http://localhost:8000/api/dev/create_user \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer","telegram_id":12345}'
```

## Переменные окружения

Все переменные окружения находятся в `docker-compose.yml`:

```yaml
DATABASE_URL: postgresql+asyncpg://launcher:dev_secret_password@postgres/pixel_launcher
REDIS_URL: redis://redis:6379
MINIO_URL: minio:9000
MINIO_ROOT_USER: admin
MINIO_ROOT_PASSWORD: supersecretkey
```

Для изменения переменных отредактируй `docker-compose.yml` и выполни:
```bash
docker-compose up -d --build
```

## Решение проблем

### Backend не запускается
```bash
# Проверить логи
docker-compose logs backend

# Пересобрать образ
docker-compose build --no-cache backend

# Перезагрузить
docker-compose up -d --build backend
```

### Ошибка подключения к БД
```bash
# Проверить статус PostgreSQL
docker-compose ps postgres

# Проверить логи PostgreSQL
docker-compose logs postgres

# Перезагрузить PostgreSQL
docker-compose restart postgres
```

### Очистить всё и начать заново
```bash
# Остановить и удалить всё (включая данные!)
docker-compose down -v

# Пересобрать образы
docker-compose build

# Запустить заново
docker-compose up -d
```
