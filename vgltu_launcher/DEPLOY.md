# Развёртывание на сервере (Ubuntu/Debian)

Пошаговая инструкция для развёртывания проекта на чистом Linux сервере.

## Требования

- Ubuntu 20.04+ / Debian 11+
- Минимум 2GB RAM, 20GB диска
- Доступ по SSH с правами sudo

---

## Шаг 1: Обновление системы и базовая безопасность

```bash
sudo apt update && sudo apt upgrade -y
```

### Настройка Firewall (UFW)

```bash
# Установка UFW
sudo apt install -y ufw

# Разрешить SSH (ВАЖНО! Иначе потеряете доступ)
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS (если будет Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Если НЕ используете Nginx — открыть порты напрямую
# sudo ufw allow 8000/tcp  # Backend API
# sudo ufw allow 5173/tcp  # Admin Web
# sudo ufw allow 9000/tcp  # MinIO API
# sudo ufw allow 9001/tcp  # MinIO Console

# Включить firewall
sudo ufw enable
sudo ufw status
```

### Отключение root-доступа по SSH (рекомендуется)

```bash
# Создать обычного пользователя (если ещё нет)
sudo adduser launcher
sudo usermod -aG sudo launcher

# Отключить root login
sudo nano /etc/ssh/sshd_config
# Найти и изменить:
#   PermitRootLogin no
#   PasswordAuthentication no  # если используете SSH ключи

sudo systemctl restart sshd
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

### Вариант 1: Интерактивный установщик (рекомендуется)

```bash
chmod +x install.sh
./install.sh
```

Скрипт автоматически:
- Установит Docker (если нужно)
- Спросит все необходимые параметры с подсказками
- Сгенерирует пароли
- Создаст `.env`
- Запустит сервисы

### Вариант 2: Ручная настройка

```bash
cp .env.example .env
nano .env
```

**Заполните обязательные поля:**

```env
# Telegram Bot (получить у @BotFather)
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_IDS=123456789,987654321  # Несколько ID через запятую
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

## Настройка Nginx (опционально, но рекомендуется)

**Зачем нужен Nginx:**
- SSL/HTTPS сертификаты (Let's Encrypt)
- Единый порт 80/443 вместо `:8000`, `:9000`, `:5173`
- Доменное имя вместо IP
- Скрытие внутренних портов от интернета

**Если НЕ используете Nginx:**
- Откройте порты в UFW (см. Шаг 1)
- Доступ будет по `http://your-ip:8000`

### Автоматическая установка (рекомендуется)

```bash
sudo ./setup-nginx.sh your-domain.com
```

Скрипт автоматически:
- Установит Nginx
- Настроит конфиг с вашим доменом
- Предложит установить SSL сертификат (Let's Encrypt)

### Ручная установка

Готовые конфиги в папке `nginx/`:

```bash
sudo apt install -y nginx

# Скопировать конфиг
sudo cp nginx/launcher.conf /etc/nginx/sites-available/launcher

# Изменить домен
sudo nano /etc/nginx/sites-available/launcher
# Заменить your-domain.com на ваш домен

# Активировать
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

---

## Backup и восстановление

### Создание backup

```bash
./manage.sh backup
```

Создаёт backup в `backups/YYYYMMDD_HHMMSS/`:
- PostgreSQL (SQL dump)
- MinIO (архив файлов)
- .env (конфигурация)

### Восстановление из backup

```bash
./manage.sh restore backups/20250109_120000
```

### Автоматический backup (cron)

```bash
# Добавить в crontab
crontab -e

# Backup каждый день в 3:00
0 3 * * * cd /opt/vgltu_launcher && ./manage.sh backup

# Удаление старых backup (старше 30 дней)
0 4 * * * find /opt/vgltu_launcher/backups -type d -mtime +30 -exec rm -rf {} +
```

---

## Production Checklist

Перед запуском в production проверьте:

### Безопасность
- [ ] Все пароли изменены с дефолтных (`.env`)
- [ ] `SECRET_KEY` сгенерирован (`openssl rand -hex 32`)
- [ ] Firewall настроен (UFW)
- [ ] SSH: root login отключён
- [ ] SSL сертификаты установлены (если используется Nginx)

### Конфигурация
- [ ] `CORS_ORIGINS` содержит только ваш домен
- [ ] `ADMIN_IDS` содержит корректные Telegram ID
- [ ] DNS записи направлены на сервер
- [ ] Nginx конфиг обновлён с вашим доменом

### Мониторинг
- [ ] Health checks работают (`./manage.sh health`)
- [ ] Логи ротируются (настроено в docker-compose.yml)
- [ ] Backup настроен (cron)
- [ ] Тестовый backup/restore выполнен

### Тестирование
- [ ] Backend API доступен (`curl http://localhost:8000/health`)
- [ ] MinIO доступен (http://localhost:9001)
- [ ] Telegram бот отвечает
- [ ] Загрузка модпака работает
- [ ] Desktop launcher подключается
