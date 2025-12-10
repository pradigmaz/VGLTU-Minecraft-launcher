#!/bin/bash

# ========================================================
# PIXEL LAUNCHER - ULTIMATE CLEAN INSTALLER
# 1. Удаляет старые Nginx/Docker/UFW конфиги
# 2. Устанавливает всё с нуля и разворачивает проект
# ========================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${BLUE}▶ $1${NC}"; }

# --- Utility Functions (ask, ask_generate remain the same) ---

# ... (Utility functions ask and ask_generate go here) ...

# --------------------------------------------
# CRITICAL STEP 0: FULL CLEANUP
# --------------------------------------------
log_step "Шаг 0/6: ПОЛНАЯ ОЧИСТКА ХОСТА (Docker, Nginx, UFW)"
echo -e "${RED}⚠️  Это действие удалит ВСЕ Docker-контейнеры, volumes и сервисы Nginx с хоста.${NC}"
echo -n "Продолжить очистку? [Y/n]: "; read CLEANUP_CONFIRM
if [ "$CLEANUP_CONFIRM" = "n" ] || [ "$CLEANUP_CONFIRM" = "N" ]; then
    log_error "Установка отменена."
    exit 1
fi

# Docker Cleanup
docker compose down -v --remove-orphans 2>/dev/null || true
sudo systemctl stop nginx docker || true
sudo apt purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true
sudo rm -rf /var/lib/docker /etc/docker 2>/dev/null

# Nginx Cleanup
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo rm -f /etc/nginx/sites-available/launcher 2>/dev/null || true
sudo systemctl reload nginx 2>/dev/null || true
sudo apt purge -y nginx 2>/dev/null || true

# Local Config Cleanup
rm -f .env admin-web/.env nginx.conf 2>/dev/null

log_info "Очистка завершена. Система чиста."

# --------------------------------------------
# STEP 1: SYSTEM PREP & PACKAGE INSTALL
# --------------------------------------------
log_step "Шаг 1/6: Установка Базовых Пакетов"
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw nginx curl git apt-transport-https ca-certificates python3-certbot-nginx

# UFW Setup
log_info "Настройка UFW (Firewall)..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable || true
log_info "Базовые пакеты установлены."

# --------------------------------------------
# STEP 2: DOMAIN & DOCKER CHECK
# --------------------------------------------
DETECTED_IP=$(curl -s ifconfig.me || echo "31.129.97.134")
log_step "Шаг 2/6: Домен и Docker"

ask "Введите публичный домен/IP" "$DETECTED_IP" \
    "Для продакшена укажите домен, для теста — IP" \
    "PUBLIC_HOST"

if ! command -v docker &> /dev/null; then
    log_info "Установка Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    log_warn "Docker установлен. Рекомендуется переподключиться для применения прав."
fi

# --------------------------------------------
# STEP 3: SECRETS
# --------------------------------------------
log_step "Шаг 3/6: Пароли и Ключи"
ask_generate "POSTGRES_PASSWORD" "Пароль БД" "POSTGRES_PASSWORD" 16
ask_generate "MINIO_ROOT_PASSWORD" "Пароль MinIO (S3)" "MINIO_ROOT_PASSWORD" 16
ask_generate "SECRET_KEY" "JWT Secret Key" "SECRET_KEY" 32
ask "BOT_TOKEN" "" "Токен бота от @BotFather" "BOT_TOKEN"
ask "ADMIN_IDS" "" "Telegram ID админов" "ADMIN_IDS"

# --------------------------------------------
# STEP 4: CONFIGURATION GENERATION
# --------------------------------------------
log_step "Шаг 4/6: Генерация Конфигурации"

# 4.1 Nginx Config Generation (ИСПРАВЛЕНО: используем имена контейнеров)
log_info "Генерация Nginx-конфига для $PUBLIC_HOST..."
cat > nginx/launcher.conf << EOF
# Базовая конфигурация Nginx для $PUBLIC_HOST
server {
    listen 80;
    server_name $PUBLIC_HOST;

    access_log /var/log/nginx/launcher_access.log;
    error_log /var/log/nginx/launcher_error.log;
    client_max_body_size 500M;

    # Backend API
    location /api/ {
        proxy_pass http://pixellauncher_backend:8000/; 
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # MinIO S3 API (Для загрузки файлов)
    location /storage/ {
        proxy_pass http://pixellauncher_minio:9000/; 
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Admin Web (React)
    location / {
        proxy_pass http://pixellauncher_admin_web:5173/; 
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 4.2 Основной .env
FRONTEND_URL="http://$PUBLIC_HOST"
cat > .env << EOF
POSTGRES_USER=launcher
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=pixel_launcher
REDIS_PASSWORD=$REDIS_PASSWORD
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_USE_SSL=false
SECRET_KEY=$SECRET_KEY
BOT_TOKEN=$BOT_TOKEN
ADMIN_IDS=$ADMIN_IDS
DEVELOPER_CHAT_ID=$ADMIN_IDS
CORS_ORIGINS=$FRONTEND_URL,http://localhost:5173
ADMIN_FRONTEND_URL=$FRONTEND_URL
EOF

# 4.3 Admin-Web .env
echo "VITE_API_URL=$FRONTEND_URL/api" > admin-web/.env

# 4.4 УДАЛЕНИЕ ПРОБРОСА ПОРТОВ ИЗ docker-compose (Если они есть)
log_info "Удаление пробросов портов 8000/5173 из docker-compose.yml..."
sed -i '/backend:/,/^[^ ]/ {/ports:/,/^[^ ]/ {/^.*:8000"$/d; /^.*:5173"$/d}}' docker-compose.yml 2>/dev/null || true


# --------------------------------------------
# STEP 5: NGINX DEPLOYMENT & SSL
# --------------------------------------------
log_step "Шаг 5/6: Активация Nginx на хосте"

log_info "Копирование и активация конфига Nginx..."
# Копируем конфиг, который мы только что сгенерировали
sudo cp nginx/launcher.conf /etc/nginx/sites-available/launcher
sudo ln -sf /etc/nginx/sites-available/launcher /etc/nginx/sites-enabled/default

# Проверка и перезагрузка (это должно работать, так как контейнеры еще не запущены)
sudo nginx -t
sudo systemctl reload nginx

# --------------------------------------------
# STEP 6: DOCKER DEPLOY & INIT
# --------------------------------------------
log_step "Шаг 6/6: Запуск и Инициализация Сервисов"

log_info "Сборка и запуск контейнеров..."
# Используем --build, чтобы admin-web подхватил VITE_API_URL
docker compose up -d --build

echo "⏳ Ожидание запуска Бэкенда (15 сек)..."
sleep 15

log_info "🔧 Авто-настройка MinIO (бакет + Public Policy)..."
# Внутри контейнера запустится init_minio.py
docker compose exec -T backend python tools/init_minio.py || log_error "MinIO Init Failed"

log_info "🗄️ Применение миграций БД..."
docker compose exec -T backend alembic upgrade head || log_error "Миграции БД не применены"

# --------------------------------------------
# FINAL REPORT
# --------------------------------------------
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               УСТАНОВКА УСПЕШНО ЗАВЕРШЕНА!                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}АДМИНКА:${NC}       http://$PUBLIC_HOST/"
echo -e "  ${CYAN}MinIO Console:${NC} http://$PUBLIC_HOST:9001"
echo ""

# SSL
if [ "$PUBLIC_HOST" != "$DETECTED_IP" ]; then
    echo -e "${YELLOW}Установить SSL-сертификат (Let's Encrypt)?${NC}"
    echo -n "[Y/n]: "
    read INSTALL_SSL
    if [ "$INSTALL_SSL" != "n" ] && [ "$INSTALL_SSL" != "N" ]; then
        sudo certbot --nginx -d "$PUBLIC_HOST" --non-interactive --agree-tos --register-unsafely-without-email || log_error "SSL FAILED"
    fi
fi