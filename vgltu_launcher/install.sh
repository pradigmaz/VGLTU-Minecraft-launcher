#!/bin/bash

# ========================================================
# PIXEL LAUNCHER - ULTIMATE CLEAN INSTALLER
# Гарантирует запуск на чистой системе.
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

# --------------------------------------------
# START FUNCTION DEFINITIONS (MUST BE FIRST)
# --------------------------------------------
log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${BLUE}▶ $1${NC}"; }

ask() {
    local var_name="$1"
    local default_value="$2"
    local prompt="$3"
    local env_var="$4"
    
    echo -e "${CYAN}$prompt${NC}"
    if [ -n "$default_value" ]; then
        echo -n "[$default_value]: "
    else
        echo -n ": "
    fi

    read user_input
    
    if [ -z "$user_input" ]; then
        user_input="$default_value"
    fi
    
    if [ -z "$user_input" ]; then
        log_error "Значение не может быть пустым!"
        # Используем рекурсию с return, чтобы не сломать основной поток
        ask "$var_name" "$default_value" "$prompt" "$env_var"
        return
    fi
    
    eval "$env_var=\"$user_input\""
}

ask_generate() {
    local var_name="$1"
    local prompt="$2"
    local env_var="$3"
    local length="$4"
    
    local generated_value=$(openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length)
    
    echo -e "${CYAN}$prompt${NC}"
    echo -n "Сгенерировано: $generated_value. Использовать? [Y/n]: "
    read use_generated
    
    if [ "$use_generated" = "n" ] || [ "$use_generated" = "N" ]; then
        ask "$var_name" "" "$prompt (введите вручную)" "$env_var"
    else
        eval "$env_var=\"$generated_value\""
    fi
}
# --------------------------------------------
# END FUNCTION DEFINITIONS
# --------------------------------------------

# ============================================
# STEP 0: CRITICAL CLEANUP (START)
# ============================================
log_step "Шаг 0/7: КРИТИЧЕСКАЯ ОЧИСТКА ХОСТА"
echo -e "${RED}⚠️  Это действие удалит ВСЕ Docker-контейнеры, volumes, Nginx и Docker Engine с хоста.${NC}"
echo -n "Введите 'CLEANUP' для подтверждения полного сброса: "; read CLEANUP_CONFIRM
if [ "$CLEANUP_CONFIRM" != "CLEANUP" ]; then
    log_error "Установка отменена."
    exit 1
fi

# 0.1 Удаление Docker
log_info "Удаление старых Docker-контейнеров и образов..."
docker compose down -v --remove-orphans 2>/dev/null || true
sudo systemctl stop docker 2>/dev/null || true
sudo apt purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null || true
sudo rm -rf /var/lib/docker /etc/docker 2>/dev/null

# 0.2 Удаление Nginx
log_info "Удаление Nginx и его конфигов..."
sudo systemctl stop nginx 2>/dev/null || true
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo rm -f /etc/nginx/sites-available/launcher 2>/dev/null || true
sudo apt purge -y nginx 2>/dev/null || true

# 0.3 Локальная очистка
log_info "Удаление локальных конфигов..."
rm -f .env admin-web/.env nginx.conf 2>/dev/null
rm -rf docker-data 2>/dev/null

log_info "Очистка завершена. Система чиста."


# --------------------------------------------
# STEP 1: SYSTEM PREP & PACKAGE INSTALL
# --------------------------------------------
log_step "Шаг 1/7: Установка Базовых Пакетов"
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw nginx curl git apt-transport-https ca-certificates python3-certbot-nginx

# UFW Setup
log_info "Настройка UFW (Firewall)..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable || true

# --------------------------------------------
# STEP 2: DOCKER INSTALL & RIGHTS FIX
# --------------------------------------------
log_step "Шаг 2/7: Установка Docker и Применение Прав"
if ! command -v docker &> /dev/null; then
    log_info "Установка Docker Engine..."
    curl -fsSL https://get.docker.com | sudo sh
fi

# КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Добавляем пользователя в группу docker
sudo usermod -aG docker $USER

# ПРИМЕНЕНИЕ ПРАВ в текущей сессии
# Запуск нового процесса с обновленными группами.
log_info "Применение прав доступа (newgrp docker)..."
newgrp docker || log_warn "Не удалось применить newgrp. Может потребоваться переподключение."

# --------------------------------------------
# STEP 3: DOMAIN & SECRETS
# --------------------------------------------
DETECTED_IP=$(curl -s ifconfig.me || echo "31.129.97.134")
log_step "Шаг 3/7: Домен и Пароли"

ask "PUBLIC_HOST" "$DETECTED_IP" \
    "Введите публичный домен или IP адрес" \
    "PUBLIC_HOST"

ask_generate "POSTGRES_PASSWORD" "Пароль БД" "POSTGRES_PASSWORD" 16
ask_generate "MINIO_ROOT_PASSWORD" "Пароль MinIO (S3)" "MINIO_ROOT_PASSWORD" 16
ask_generate "SECRET_KEY" "JWT Secret Key" "SECRET_KEY" 32
ask "BOT_TOKEN" "" "Токен бота от @BotFather" "BOT_TOKEN"
ask "ADMIN_IDS" "" "Telegram ID админов" "ADMIN_IDS"


# --------------------------------------------
# STEP 4: CONFIGURATION GENERATION
# --------------------------------------------
log_step "Шаг 4/7: Генерация Конфигурации"

# 4.1 Nginx Config Generation
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

# 4.4 УДАЛЕНИЕ ПРОБРОСА ПОРТОВ ИЗ docker-compose
log_info "Удаление пробросов портов 8000/5173 из docker-compose.yml..."
# Эта команда ищет блок ports: и удаляет его для backend/admin-web
sed -i '/backend:/,/^[^ ]/ {/ports:/,/^[^ ]/ {/^.*:8000"$/d; /^.*:5173"$/d}}' docker-compose.yml 2>/dev/null || true


# --------------------------------------------
# STEP 5: NGINX DEPLOYMENT & RELOAD
# --------------------------------------------
log_step "Шаг 5/7: Активация Nginx на хосте"

log_info "Копирование и активация конфига Nginx..."
sudo cp nginx/launcher.conf /etc/nginx/sites-available/launcher
sudo ln -sf /etc/nginx/sites-available/launcher /etc/nginx/sites-enabled/default

# Убираем reload, так как контейнеры еще не запущены.
log_warn "Nginx не будет перезагружен. Перезагрузка будет после запуска Docker (Шаг 7)."


# --------------------------------------------
# STEP 6: DOCKER DEPLOY & INIT
# --------------------------------------------
log_step "Шаг 6/7: Запуск и Инициализация Сервисов"

log_info "Сборка и запуск контейнеров..."
# После newgrp docker, docker compose up должен сработать.
docker compose up -d --build

echo "⏳ Ожидание запуска Бэкенда (15 сек)..."
sleep 15

log_info "🔧 Авто-настройка MinIO (бакет + Public Policy)..."
docker compose exec -T backend python tools/init_minio.py || log_error "MinIO Init Failed"

log_info "🗄️ Применение миграций БД..."
docker compose exec -T backend alembic upgrade head || log_error "Миграции БД не применены"


# --------------------------------------------
# STEP 7: FINAL NGINX RELOAD (СУПЕР КРИТИЧНО!)
# --------------------------------------------
log_step "Шаг 7/7: Финальная Проверка Nginx"

# На этом этапе имена pixellauncher_* уже созданы в Docker DNS.
log_info "Проверка конфигурации Nginx и финальная перезагрузка..."
sudo nginx -t
sudo systemctl reload nginx

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