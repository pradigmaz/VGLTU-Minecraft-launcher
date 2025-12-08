#!/bin/bash

# Interactive Installer Script
# Устанавливает Docker, настраивает .env и запускает проект

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Read branding
if [ -f "branding.json" ]; then
    APP_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' branding.json | cut -d'"' -f4)
else
    APP_NAME="Launcher"
fi

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║       $APP_NAME — Интерактивная установка                  ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${BLUE}▶ $1${NC}"; }
log_hint() { echo -e "  ${CYAN}↳ $1${NC}"; }

ask() {
    local prompt="$1"
    local default="$2"
    local hint="$3"
    local var_name="$4"
    local is_secret="${5:-false}"

    echo ""
    echo -e "${YELLOW}$prompt${NC}"
    [ -n "$hint" ] && log_hint "$hint"
    
    if [ -n "$default" ]; then
        echo -n "[$default]: "
    else
        echo -n ": "
    fi

    if [ "$is_secret" = "true" ]; then
        read -s value
        echo ""
    else
        read value
    fi

    if [ -z "$value" ] && [ -n "$default" ]; then
        value="$default"
    fi

    eval "$var_name=\"$value\""
}

ask_generate() {
    local prompt="$1"
    local hint="$2"
    local var_name="$3"
    local length="${4:-32}"

    echo ""
    echo -e "${YELLOW}$prompt${NC}"
    log_hint "$hint"
    
    local generated=$(openssl rand -hex "$length" 2>/dev/null || head -c "$((length*2))" /dev/urandom | xxd -p | tr -d '\n' | head -c "$((length*2))")
    
    echo -n "Сгенерировать автоматически? [Y/n]: "
    read choice
    
    if [ "$choice" = "n" ] || [ "$choice" = "N" ]; then
        echo -n "Введите значение: "
        read -s value
        echo ""
    else
        value="$generated"
        log_info "Сгенерировано"
    fi

    eval "$var_name=\"$value\""
}

# ============================================
# STEP 1: Check/Install Docker
# ============================================
log_step "Шаг 1/5: Проверка Docker"

if command -v docker &> /dev/null; then
    log_info "Docker установлен: $(docker --version)"
else
    log_warn "Docker не найден. Установить?"
    echo -n "[Y/n]: "
    read install_docker
    
    if [ "$install_docker" != "n" ] && [ "$install_docker" != "N" ]; then
        log_info "Установка Docker через официальный скрипт..."
        log_hint "Работает на Ubuntu, Debian, Mint, Fedora, CentOS и др."
        
        curl -fsSL https://get.docker.com | sudo sh
        
        sudo usermod -aG docker $USER
        log_info "Docker установлен"
        log_warn "Может потребоваться перелогиниться для работы без sudo"
    else
        log_error "Docker обязателен для работы. Установите вручную:"
        echo "    curl -fsSL https://get.docker.com | sudo sh"
        exit 1
    fi
fi

# Check docker-compose
if docker compose version &> /dev/null; then
    log_info "Docker Compose доступен (plugin)"
elif command -v docker-compose &> /dev/null; then
    log_info "Docker Compose доступен (standalone)"
else
    log_info "Установка Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log_info "Docker Compose установлен"
fi

# ============================================
# STEP 2: Telegram Bot Configuration
# ============================================
log_step "Шаг 2/5: Настройка Telegram бота"

ask "BOT_TOKEN" "" \
    "Токен бота от @BotFather (формат: 123456789:ABCdef...)" \
    "BOT_TOKEN"

if [ -z "$BOT_TOKEN" ]; then
    log_error "BOT_TOKEN обязателен!"
    exit 1
fi

ask "BOT_USERNAME" "" \
    "Username бота без @ (например: my_launcher_bot)" \
    "BOT_USERNAME"

ask "ADMIN_IDS" "" \
    "Ваш Telegram ID (узнать: @userinfobot). Несколько через запятую" \
    "ADMIN_IDS"

ask "DEVELOPER_CHAT_ID" "$ADMIN_IDS" \
    "Chat ID для уведомлений об ошибках (обычно = ADMIN_IDS)" \
    "DEVELOPER_CHAT_ID"

# ============================================
# STEP 3: Database & Services Passwords
# ============================================
log_step "Шаг 3/5: Пароли для сервисов"

echo -e "${CYAN}Сейчас нужно задать пароли для внутренних сервисов.${NC}"
echo -e "${CYAN}Можно сгенерировать автоматически (рекомендуется).${NC}"

ask_generate "POSTGRES_PASSWORD" \
    "Пароль для PostgreSQL (база данных)" \
    "POSTGRES_PASSWORD" 16

ask_generate "REDIS_PASSWORD" \
    "Пароль для Redis (кэш и сессии)" \
    "REDIS_PASSWORD" 16

ask_generate "MINIO_ROOT_PASSWORD" \
    "Пароль для MinIO (S3 хранилище файлов)" \
    "MINIO_ROOT_PASSWORD" 16

ask_generate "SECRET_KEY" \
    "Секретный ключ для JWT токенов (64 символа hex)" \
    "SECRET_KEY" 32

# ============================================
# STEP 4: Optional Settings
# ============================================
log_step "Шаг 4/5: Дополнительные настройки"

ask "POSTGRES_USER" "launcher" \
    "Имя пользователя PostgreSQL" \
    "POSTGRES_USER"

ask "POSTGRES_DB" "pixel_launcher" \
    "Имя базы данных" \
    "POSTGRES_DB"

ask "MINIO_ROOT_USER" "admin" \
    "Имя пользователя MinIO" \
    "MINIO_ROOT_USER"

ask "CORS_ORIGINS" "http://localhost:5173,http://localhost:3000" \
    "Разрешённые домены для CORS (через запятую)" \
    "CORS_ORIGINS"

# ============================================
# STEP 5: Create .env and Start
# ============================================
log_step "Шаг 5/5: Создание конфигурации и запуск"

# Backup existing .env
if [ -f ".env" ]; then
    cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
    log_info "Старый .env сохранён в backup"
fi

# Create .env
cat > .env << EOF
# ===== TELEGRAM BOT =====
BOT_TOKEN=$BOT_TOKEN
BOT_USERNAME=$BOT_USERNAME
ADMIN_IDS=$ADMIN_IDS
DEVELOPER_CHAT_ID=$DEVELOPER_CHAT_ID

# ===== БАЗА ДАННЫХ =====
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB

# ===== REDIS =====
REDIS_PASSWORD=$REDIS_PASSWORD

# ===== MINIO (S3) =====
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_USE_SSL=false

# ===== JWT =====
SECRET_KEY=$SECRET_KEY

# ===== CORS =====
CORS_ORIGINS=$CORS_ORIGINS
EOF

log_info "Файл .env создан"

# Make manage.sh executable
chmod +x manage.sh

echo ""
echo -e "${YELLOW}Запустить сервисы сейчас?${NC}"
echo -n "[Y/n]: "
read start_now

if [ "$start_now" != "n" ] && [ "$start_now" != "N" ]; then
    log_info "Запуск сервисов..."
    
    # Use sudo for docker if not in group yet
    if groups | grep -q docker; then
        docker-compose up -d
    else
        sudo docker-compose up -d
    fi
    
    echo ""
    log_info "Ожидание запуска (10 сек)..."
    sleep 10
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    УСТАНОВКА ЗАВЕРШЕНА                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}Backend API:${NC}     http://localhost:8000"
    echo -e "  ${CYAN}MinIO Console:${NC}   http://localhost:9001"
    echo -e "  ${CYAN}Telegram Bot:${NC}    @$BOT_USERNAME"
    echo ""
    echo -e "  ${YELLOW}Управление:${NC}"
    echo "    ./manage.sh status    — статус сервисов"
    echo "    ./manage.sh logs      — просмотр логов"
    echo "    ./manage.sh stop      — остановка"
    echo ""
else
    echo ""
    log_info "Конфигурация сохранена. Для запуска выполните:"
    echo "    ./manage.sh start"
fi
