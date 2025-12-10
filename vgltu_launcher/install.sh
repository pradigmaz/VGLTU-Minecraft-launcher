#!/bin/bash

# ==========================================
# PIXEL LAUNCHER - FINAL ONE-STEP INSTALLER
# ==========================================

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

ask() {
    local prompt="$1"; local default="$2"; local hint="$3"; local var_name="$4"; local is_secret="${5:-false}"
    echo ""; echo -e "${YELLOW}$prompt${NC}"
    [ -n "$hint" ] && echo -e "  ${CYAN}↳ $hint${NC}"
    if [ -n "$default" ]; then echo -n "[$default]: "; else echo -n ": "; fi
    if [ "$is_secret" = "true" ]; then read -s value; echo ""; else read value; fi
    if [ -z "$value" ] && [ -n "$default" ]; then value="$default"; fi
    eval "$var_name=\"$value\""
}

ask_generate() {
    local prompt="$1"; local hint="$2"; local var_name="$3"; local length="${4:-32}"
    echo ""; echo -e "${YELLOW}$prompt${NC}"; echo -e "  ${CYAN}↳ $hint${NC}"
    local generated=$(openssl rand -hex "$length" 2>/dev/null || head -c "$((length*2))" /dev/urandom | xxd -p | tr -d '\n' | head -c "$((length*2))")
    echo -n "Сгенерировать автоматически? [Y/n]: "; read choice
    if [ "$choice" = "n" ] || [ "$choice" = "N" ]; then echo -n "Введите значение: "; read -s value; echo ""; else value="$generated"; log_info "Сгенерировано"; fi
    eval "$var_name=\"$value\""
}

# ============================================
# STEP 0: SYSTEM PREP (UFW, APT)
# ============================================
log_step "Шаг 0/5: Подготовка Системы (UFW, APT)"
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw nginx curl git apt-transport-https ca-certificates python3-certbot-nginx

# Настройка UFW
log_info "Настройка UFW (Firewall)..."
sudo ufw allow 22/tcp || log_warn "Порт 22 уже открыт или UFW неактивен."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable || true # Включаем, если выключен
# ============================================
# STEP 1: DOMAIN & DOCKER CHECK
# ============================================
DETECTED_IP=$(curl -s ifconfig.me || echo "31.129.97.134") # Ваш IP
log_step "Шаг 1/5: Домен и Docker"

ask "Введите публичный домен/IP" "$DETECTED_IP" \
    "Для продакшена укажите домен, для теста — IP" \
    "PUBLIC_HOST"

# Проверка и установка Docker
if ! command -v docker &> /dev/null; then
    log_info "Установка Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    log_info "Docker установлен. Перезайдите в SSH, чтобы применить права."
fi

# ============================================
# STEP 2: SECRETS
# ============================================
log_step "Шаг 2/5: Пароли и Ключи"
ask_generate "POSTGRES_PASSWORD" "Пароль БД" "POSTGRES_PASSWORD" 16
ask_generate "MINIO_ROOT_PASSWORD" "Пароль MinIO (S3)" "MINIO_ROOT_PASSWORD" 16
ask_generate "SECRET_KEY" "JWT Secret Key" "SECRET_KEY" 32
ask "BOT_TOKEN" "" "Токен бота от @BotFather" "BOT_TOKEN"
ask "ADMIN_IDS" "" "Telegram ID админов" "ADMIN_IDS"

# ============================================
# STEP 3: CONFIGURATION GENERATION
# ============================================
log_step "Шаг 3/5: Генерация Конфигурации"

# 3.1 Nginx Config Generation (ИСПРАВЛЕНО: используем имена контейнеров)
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
        proxy_pass http://pixellauncher_backend:8000/; # <-- ИСПРАВЛЕНО
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
        proxy_pass http://pixellauncher_minio:9000/; # <-- ИСПРАВЛЕНО
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
        proxy_pass http://pixellauncher_admin_web:5173/; # <-- ИСПРАВЛЕНО
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 3.2 Основной .env
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

# 3.3 Admin-Web .env
echo "VITE_API_URL=$FRONTEND_URL/api" > admin-web/.env

# 3.4 Исправление Docker Compose (УБРАТЬ ПОРТЫ 8000 и 5173!)
log_info "Удаление пробросов портов 8000/5173 из docker-compose.yml для безопасности..."
sed -i '/^.*ports:$/,/^.*:8000"$/d' docker-compose.yml || true
sed -i '/^.*ports:$/,/^.*:5173"$/d' docker-compose.yml || true
# ============================================
# STEP 4: NGINX DEPLOYMENT & SSL
# ============================================
log_step "Шаг 4/5: Активация Nginx на хосте"

log_info "Копирование и активация конфига Nginx..."
sudo cp nginx/launcher.conf /etc/nginx/sites-available/launcher
sudo ln -sf /etc/nginx/sites-available/launcher /etc/nginx/sites-enabled/default # Использование default
    sudo systemctl reload nginx
# ============================================
# STEP 5: DOCKER DEPLOY & INIT
# ============================================
log_step "Шаг 5/5: Запуск и Инициализация"

docker compose down --remove-orphans || true
log_info "Сборка и запуск контейнеров..."
docker compose up -d --build

echo "⏳ Ожидание запуска Бэкенда (15 сек)..."
sleep 15

log_info "🔧 Авто-настройка MinIO (бакет + Public Policy)..."
docker compose exec -T backend python tools/init_minio.py || log_error "MinIO Init Failed"

log_info "🗄️ Применение миграций БД..."
docker compose exec -T backend alembic upgrade head || log_error "Миграции БД не применены"

# ============================================
# FINAL REPORT
# ============================================
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
