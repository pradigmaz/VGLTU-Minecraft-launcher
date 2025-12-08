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
    docker-compose up -d
    log_info "Ожидание готовности сервисов..."
    sleep 5
    cmd_status
}

cmd_stop() {
    log_info "Остановка сервисов..."
    docker-compose down
    log_info "Сервисы остановлены"
}

cmd_restart() {
    cmd_stop
    cmd_start
}

cmd_status() {
    log_info "Статус сервисов:"
    docker-compose ps
}

cmd_logs() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        docker-compose logs -f --tail=100 "$service"
    else
        docker-compose logs -f --tail=100
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
    docker-compose down 2>/dev/null || true

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
            docker-compose stop postgres backend bot
            rm -rf docker-data/postgres
            docker-compose up -d
            ;;
        minio|s3)
            log_warn "Это УДАЛИТ данные MinIO/S3!"
            read -p "Вы уверены? (да/нет): " confirm
            [ "$confirm" != "да" ] && exit 0
            docker-compose stop minio
            rm -rf docker-data/minio
            docker-compose up -d
            ;;
        redis)
            log_warn "Это УДАЛИТ данные Redis!"
            read -p "Вы уверены? (да/нет): " confirm
            [ "$confirm" != "да" ] && exit 0
            docker-compose stop redis backend bot
            rm -rf docker-data/redis
            docker-compose up -d
            ;;
        *)
            log_error "Неизвестный сервис: $service"
            echo "Доступные: postgres (pg, db), minio (s3), redis"
            exit 1
            ;;
    esac
    log_info "Сброс сервиса $service завершен"
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
    echo "  logs [сервис]      Показать логи (опционально для конкретного сервиса)"
    echo "  reset              Сбросить ВСЕ данные (postgres, minio, redis)"
    echo "  reset-service X    Сбросить данные конкретного сервиса (postgres|minio|redis)"
    echo "  help               Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  ./manage.sh start"
    echo "  ./manage.sh logs backend"
    echo "  ./manage.sh reset-service postgres"
}

# Main
case "${1:-help}" in
    start)          cmd_start ;;
    stop)           cmd_stop ;;
    restart)        cmd_restart ;;
    status)         cmd_status ;;
    logs)           cmd_logs "$2" ;;
    reset)          cmd_reset ;;
    reset-service)  cmd_reset_service "$2" ;;
    help|--help|-h) cmd_help ;;
    *)
        log_error "Неизвестная команда: $1"
        cmd_help
        exit 1
        ;;
esac
