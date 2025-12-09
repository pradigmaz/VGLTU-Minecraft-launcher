#!/bin/bash

# Docker Management Script (reads name from branding.json)
# Usage: ./manage.sh [command]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Read branding
if [ -f "branding.json" ]; then
    APP_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' branding.json | cut -d'"' -f4)
else
    APP_NAME="Launcher"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[ИНФО]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[ПРЕДУПРЕЖДЕНИЕ]${NC} $1"; }
log_error() { echo -e "${RED}[ОШИБКА]${NC} $1"; }

# Detect Docker Compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    log_error "Docker Compose не найден!"
    exit 1
fi

# Debug output
# echo "Using Docker Compose command: $DOCKER_COMPOSE_CMD"

check_env() {
    if [ ! -f ".env" ]; then
        log_error "Файл .env не найден!"
        log_info "Скопируйте .env.example в .env и настройте его:"
        echo "  cp .env.example .env"
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker не установлен"
        exit 1
    fi
    if ! docker info &> /dev/null; then
        log_error "Демон Docker не запущен"
        exit 1
    fi
}

cmd_start() {
    check_env
    check_docker
    log_info "Запуск сервисов..."
    $DOCKER_COMPOSE_CMD up -d
    log_info "Ожидание готовности сервисов..."
    sleep 5
    cmd_status
}

cmd_stop() {
    log_info "Остановка сервисов..."
    $DOCKER_COMPOSE_CMD down
    log_info "Сервисы остановлены"
}

cmd_restart() {
    cmd_stop
    cmd_start
}

cmd_status() {
    log_info "Статус сервисов:"
    $DOCKER_COMPOSE_CMD ps
}

cmd_logs() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE_CMD logs -f --tail=100 "$service"
    else
        $DOCKER_COMPOSE_CMD logs -f --tail=100
    fi
}

cmd_reset() {
    log_warn "Это УДАЛИТ ВСЕ ДАННЫЕ (postgres, minio, redis)!"
    read -p "Вы уверены? (да/нет): " confirm
    if [ "$confirm" != "да" ]; then
        log_info "Отменено"
        exit 0
    fi

    log_info "Остановка сервисов..."
    $DOCKER_COMPOSE_CMD down 2>/dev/null || true

    log_info "Удаление директорий с данными..."
    rm -rf docker-data/postgres
    rm -rf docker-data/minio
    rm -rf docker-data/redis

    log_info "Данные очищены. Запуск с чистого листа..."
    cmd_start
}

cmd_reset_service() {
    local service="$1"
    case "$service" in
        postgres|pg|db)
            log_warn "Это УДАЛИТ данные PostgreSQL!"
            read -p "Вы уверены? (да/нет): " confirm
            [ "$confirm" != "да" ] && exit 0
            $DOCKER_COMPOSE_CMD stop postgres backend bot
            rm -rf docker-data/postgres
            $DOCKER_COMPOSE_CMD up -d
            ;;
        minio|s3)
            log_warn "Это УДАЛИТ данные MinIO/S3!"
            read -p "Вы уверены? (да/нет): " confirm
            [ "$confirm" != "да" ] && exit 0
            $DOCKER_COMPOSE_CMD stop minio
            rm -rf docker-data/minio
            $DOCKER_COMPOSE_CMD up -d
            ;;
        redis)
            log_warn "Это УДАЛИТ данные Redis!"
            read -p "Вы уверены? (да/нет): " confirm
            [ "$confirm" != "да" ] && exit 0
            $DOCKER_COMPOSE_CMD stop redis backend bot
            rm -rf docker-data/redis
            $DOCKER_COMPOSE_CMD up -d
            ;;
        *)
            log_error "Неизвестный сервис: $service"
            echo "Доступные: postgres (pg, db), minio (s3), redis"
            exit 1
            ;;
    esac
    log_info "Сброс сервиса $service завершен"
}

cmd_backup() {
    check_docker
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    log_info "Создание backup в $backup_dir..."
    
    # PostgreSQL
    log_info "Backup PostgreSQL..."
    $DOCKER_COMPOSE_CMD exec -T postgres pg_dump -U launcher pixel_launcher > "$backup_dir/postgres.sql"
    
    # MinIO (копирование данных)
    log_info "Backup MinIO..."
    tar -czf "$backup_dir/minio.tar.gz" docker-data/minio 2>/dev/null || log_warn "MinIO данные пусты"
    
    # .env (без секретов)
    log_info "Backup конфигурации..."
    cp .env "$backup_dir/.env.backup"
    
    log_info "Backup завершён: $backup_dir"
    du -sh "$backup_dir"
}

cmd_restore() {
    local backup_path="$1"
    if [ -z "$backup_path" ] || [ ! -d "$backup_path" ]; then
        log_error "Укажите путь к backup: ./manage.sh restore backups/YYYYMMDD_HHMMSS"
        exit 1
    fi
    
    log_warn "Это ВОССТАНОВИТ данные из $backup_path"
    read -p "Вы уверены? (да/нет): " confirm
    [ "$confirm" != "да" ] && exit 0
    
    check_docker
    
    # PostgreSQL
    if [ -f "$backup_path/postgres.sql" ]; then
        log_info "Восстановление PostgreSQL..."
        $DOCKER_COMPOSE_CMD exec -T postgres psql -U launcher pixel_launcher < "$backup_path/postgres.sql"
    fi
    
    # MinIO
    if [ -f "$backup_path/minio.tar.gz" ]; then
        log_info "Восстановление MinIO..."
        $DOCKER_COMPOSE_CMD stop minio
        rm -rf docker-data/minio
        tar -xzf "$backup_path/minio.tar.gz"
        $DOCKER_COMPOSE_CMD start minio
    fi
    
    log_info "Восстановление завершено"
}

cmd_health() {
    check_docker
    log_info "Проверка здоровья сервисов..."
    echo ""
    $DOCKER_COMPOSE_CMD ps
    echo ""
    log_info "Health checks:"
    docker inspect --format='{{.Name}}: {{.State.Health.Status}}' $($DOCKER_COMPOSE_CMD ps -q) 2>/dev/null || log_warn "Health checks не настроены"
}

cmd_node_install() {
    log_info "Установка/Обновление Node.js (v20)..."
    
    # Constants for Node.js
    local REQUIRED_NODE_MAJOR=20
    
    if command -v node &> /dev/null; then
        log_info "Удаление старой версии Node.js..."
        sudo apt remove --purge -y nodejs npm libnode-dev libnode72 2>/dev/null || true
        sudo apt autoremove -y
    fi
    
    log_info "Очистка старых файлов..."
    sudo rm -rf /usr/include/node /usr/local/include/node 2>/dev/null || true
    
    log_info "Добавление репозитория NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_${REQUIRED_NODE_MAJOR}.x | sudo -E bash -
    
    log_info "Установка Node.js..."
    sudo apt-get install -y nodejs
    
    if command -v node &> /dev/null; then
        log_info "Node.js установлен: $(node -v)"
        log_info "npm установлен: $(npm -v)"
    else
        log_error "Не удалось установить Node.js"
    fi
}

cmd_node_check() {
    if command -v node &> /dev/null; then
        log_info "Node.js: $(node -v)"
        log_info "npm:     $(npm -v)"
    else
        log_warn "Node.js не установлен"
        echo "Для установки выполните: ./manage.sh node-install"
    fi
}

cmd_admin_start() {
    log_info "Запуск admin-web (dev)..."
    cd admin-web
    if [ ! -d "node_modules" ]; then
        log_info "Установка зависимостей..."
        npm install
    fi
    npm run dev
}

cmd_admin_build() {
    log_info "Сборка admin-web..."
    cd admin-web
    if [ ! -d "node_modules" ]; then
        log_info "Установка зависимостей..."
        npm install
    fi
    npm run build
    log_info "Сборка завершена (dist/)"
}

cmd_help() {
    echo "Управление Docker для $APP_NAME"
    echo ""
    echo "Использование: ./manage.sh [команда]"
    echo ""
    echo "Команды:"
    echo "  start              Запустить все сервисы"
    echo "  stop               Остановить все сервисы"
    echo "  restart            Перезапустить все сервисы"
    echo "  status             Показать статус сервисов"
    echo "  health             Проверить health checks"
    echo "  logs [сервис]      Показать логи (опционально для конкретного сервиса)"
    echo "  backup             Создать backup (postgres, minio, .env)"
    echo "  restore <путь>     Восстановить из backup"
    echo "  reset              Сбросить ВСЕ данные (postgres, minio, redis)"
    echo "  reset-service X    Сбросить данные конкретного сервиса (postgres|minio|redis)"
    echo ""
    echo "Node.js / Admin Web:"
    echo "  node-install       Установить/Обновить Node.js (v20)"
    echo "  node-check         Проверить версию Node.js"
    echo "  admin-start        Запустить admin-web (dev режим)"
    echo "  admin-build        Собрать admin-web (production build)"
    echo ""
    echo "  help               Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  ./manage.sh start"
    echo "  ./manage.sh logs backend"
    echo "  ./manage.sh backup"
    echo "  ./manage.sh restore backups/20250109_120000"
}

# Main
case "${1:-help}" in
    start)          cmd_start ;;
    stop)           cmd_stop ;;
    restart)        cmd_restart ;;
    status)         cmd_status ;;
    health)         cmd_health ;;
    logs)           cmd_logs "$2" ;;
    backup)         cmd_backup ;;
    restore)        cmd_restore "$2" ;;
    reset)          cmd_reset ;;
    reset-service)  cmd_reset_service "$2" ;;
    node-install)   cmd_node_install ;;
    node-check)     cmd_node_check ;;
    admin-start)    cmd_admin_start ;;
    admin-build)    cmd_admin_build ;;
    help|--help|-h) cmd_help ;;
    *)
        log_error "Неизвестная команда: $1"
        cmd_help
        exit 1
        ;;
esac
