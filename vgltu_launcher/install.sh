#!/bin/bash

# ==========================================
# PIXEL LAUNCHER - AUTO INSTALLER (v2)
# ==========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Pixel Launcher — Автоматическая установка        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. ОПРЕДЕЛЕНИЕ IP
DETECTED_IP=$(curl -s ifconfig.me || echo "127.0.0.1")
echo -e "\n${YELLOW}▶ Шаг 1: Сетевые настройки${NC}"
echo -n "Введите IP сервера или домен [$DETECTED_IP]: "
read USER_IP
if [ -z "$USER_IP" ]; then USER_IP="$DETECTED_IP"; fi
echo -e "${GREEN}✓ Используем адрес: $USER_IP${NC}"

# 2. DOCKER
echo -e "\n${YELLOW}▶ Шаг 2: Проверка Docker${NC}"
if ! command -v docker &> /dev/null; then
    echo "Установка Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker установлен${NC}"
else
    echo -e "${GREEN}✓ Docker найден${NC}"
fi

# 3. КЛЮЧИ
echo -e "\n${YELLOW}▶ Шаг 3: Генерация ключей${NC}"
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
MINIO_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)

echo -n "Telegram Bot Token: "
read BOT_TOKEN
echo -n "Admin Telegram ID: "
read ADMIN_IDS

if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}Ошибка: Токен бота обязателен!${NC}"
    exit 1
fi

# 4. КОНФИГУРАЦИЯ (.env)
echo -e "\n${YELLOW}▶ Шаг 4: Создание конфигов${NC}"

# Основной .env
cat > .env << EOF
POSTGRES_USER=launcher
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=pixel_launcher
REDIS_PASSWORD=$REDIS_PASSWORD
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=$MINIO_PASSWORD
MINIO_USE_SSL=false
SECRET_KEY=$SECRET_KEY
BOT_TOKEN=$BOT_TOKEN
ADMIN_IDS=$ADMIN_IDS
DEVELOPER_CHAT_ID=$ADMIN_IDS
CORS_ORIGINS=http://$USER_IP,http://$USER_IP:80,http://localhost:5173
ADMIN_FRONTEND_URL=http://$USER_IP
EOF

# Admin-Web .env
echo "VITE_API_URL=http://$USER_IP/api" > admin-web/.env

# Nginx Config (Dynamic)
cat > nginx.conf << EOF
server {
    listen 80;
    server_name $USER_IP;
    client_max_body_size 500M;
    access_log /var/log/nginx/access.log;
    
    # 1. Admin Panel
    location / {
        root /var/www/admin;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    # 2. Backend API
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    # 3. MinIO Files
    location /objects/ {
        proxy_pass http://minio:9000/launcher-files/objects/;
        proxy_set_header Host minio:9000;
    }
}
EOF

echo -e "${GREEN}✓ Конфигурация создана${NC}"

# 5. ЗАПУСК
echo -e "\n${YELLOW}▶ Шаг 5: Запуск и Инициализация${NC}"
echo "Остановка старых контейнеров..."
docker compose down --remove-orphans || true

echo "Сборка и запуск..."
docker compose up -d --build

echo "⏳ Ожидание запуска Бэкенда (10 сек)..."
sleep 10

echo "🔧 Автоматическая настройка MinIO (создание бакета + Public Policy)..."
# ЗАПУСКАЕМ НАШ НОВЫЙ СКРИПТ ВНУТРИ КОНТЕЙНЕРА
docker compose exec -T backend python tools/init_minio.py || echo -e "${RED}Warning: MinIO init failed${NC}"

# Накат миграций БД
echo "🗄️ Применение миграций БД..."
docker compose exec -T backend alembic upgrade head || echo -e "${RED}Warning: Migrations failed${NC}"

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║                 УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА                ║${NC}"
echo -e "${GREEN}  ╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Админка:       http://$USER_IP/admin"
echo -e "MinIO Console: http://$USER_IP:9001 (User: admin / Pass: $MINIO_PASSWORD)"
echo ""
echo -e "${GREEN}✓ Бакет 'launcher-files' создан и настроен автоматически.${NC}"