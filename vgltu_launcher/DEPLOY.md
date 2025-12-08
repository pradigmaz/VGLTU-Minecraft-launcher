# Развёртывание на сервере (Ubuntu/Debian)

Пошаговая инструкция для развёртывания проекта на чистом Linux сервере.

## Требования

- Ubuntu 20.04+ / Debian 11+
- Минимум 2GB RAM, 20GB диска
- Доступ по SSH с правами sudo

---

## Шаг 1: Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

## Шаг 2: Установка Docker

```bash
# Установка зависимостей
sudo apt install -y ca-certificates curl gnupg lsb-release

# Добавление GPG ключа Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавление репозитория (для Ubuntu)
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавление пользователя в группу docker (чтобы не писать sudo)
sudo usermod -aG docker $USER

# Перелогиниться или выполнить:
newgrp docker
```

## Шаг 3: Установка Docker Compose (если не установился)

```bash
# Проверка
docker compose version

# Если не работает — установить отдельно:
sudo apt install -y docker-compose
```

## Шаг 4: Клонирование репозитория

```bash
cd /opt
sudo git clone https://github.com/your-username/vgltu_launcher.git
sudo chown -R $USER:$USER vgltu_launcher
cd vgltu_launcher
```

## Шаг 5: Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

**Заполните обязательные поля:**

```env
# Telegram Bot (получить у @BotFather)
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_IDS=123456789
BOT_USERNAME=your_bot_username
DEVELOPER_CHAT_ID=123456789

# Пароли (ОБЯЗАТЕЛЬНО СМЕНИТЬ!)
POSTGRES_PASSWORD=сгенерируй_сложный_пароль
REDIS_PASSWORD=сгенерируй_сложный_пароль
MINIO_ROOT_PASSWORD=сгенерируй_сложный_пароль

# JWT секрет (сгенерировать)
SECRET_KEY=сгенерируй_hex_строку
```

**Генерация паролей:**
```bash
# Для SECRET_KEY
openssl rand -hex 32

# Для паролей БД
openssl rand -base64 24
```

## Шаг 6: Запуск

```bash
chmod +x manage.sh
./manage.sh start
```

## Шаг 7: Проверка

```bash
# Статус контейнеров
./manage.sh status

# Логи backend
./manage.sh logs backend

# Проверка API
curl http://localhost:8000/health
```

---

## Порты

| Сервис | Порт | Описание |
|--------|------|----------|
| Backend API | 8000 | FastAPI |
| Admin Web | 5173 | React (dev) |
| MinIO API | 9000 | S3-совместимое хранилище |
| MinIO Console | 9001 | Веб-интерфейс MinIO |
| PostgreSQL | 5432 | База данных |
| Redis | 6379 | Кэш/сессии |

---

## Настройка Nginx (опционально)

Для проксирования через домен:

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/launcher
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:5173/;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/launcher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL сертификат (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Полезные команды

```bash
./manage.sh start           # Запуск
./manage.sh stop            # Остановка
./manage.sh restart         # Перезапуск
./manage.sh logs backend    # Логи backend
./manage.sh logs bot        # Логи бота
./manage.sh status          # Статус
./manage.sh reset           # Полный сброс данных
./manage.sh reset-service postgres  # Сброс только PostgreSQL
```

---

## Решение проблем

### Ошибка подключения к PostgreSQL

```bash
# Сбросить данные PostgreSQL
./manage.sh reset-service postgres
```

### Контейнер не запускается

```bash
# Посмотреть логи
docker-compose logs <service_name>

# Пересобрать образ
docker-compose build --no-cache <service_name>
docker-compose up -d
```

### Нет места на диске

```bash
# Очистка неиспользуемых образов
docker system prune -a
```
