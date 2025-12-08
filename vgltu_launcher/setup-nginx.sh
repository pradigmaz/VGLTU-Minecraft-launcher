#!/bin/bash

# Скрипт настройки Nginx для Launcher
# Использование: sudo ./setup-nginx.sh your-domain.com

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Проверка root
if [ "$EUID" -ne 0 ]; then
    log_error "Запустите с sudo: sudo ./setup-nginx.sh your-domain.com"
    exit 1
fi

# Проверка домена
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
    echo -e "${CYAN}Введите домен (например: launcher.example.com):${NC}"
    read DOMAIN
fi

if [ -z "$DOMAIN" ]; then
    log_error "Домен обязателен!"
    exit 1
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Настройка Nginx для: $DOMAIN${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Установка Nginx
if ! command -v nginx &> /dev/null; then
    log_info "Установка Nginx..."
    apt update
    apt install -y nginx
fi
log_info "Nginx установлен"

# Копирование конфига
log_info "Создание конфигурации..."
cp nginx/launcher.conf /etc/nginx/sites-available/launcher

# Замена домена
sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/launcher

# Активация
if [ -L /etc/nginx/sites-enabled/launcher ]; then
    rm /etc/nginx/sites-enabled/launcher
fi
ln -s /etc/nginx/sites-available/launcher /etc/nginx/sites-enabled/

# Проверка конфига
log_info "Проверка конфигурации..."
nginx -t

# Перезагрузка
systemctl reload nginx
log_info "Nginx перезагружен"

echo ""
echo -e "${YELLOW}Установить SSL сертификат (Let's Encrypt)?${NC}"
echo -n "[Y/n]: "
read INSTALL_SSL

if [ "$INSTALL_SSL" != "n" ] && [ "$INSTALL_SSL" != "N" ]; then
    # Установка certbot
    if ! command -v certbot &> /dev/null; then
        log_info "Установка Certbot..."
        apt install -y certbot python3-certbot-nginx
    fi
    
    log_info "Получение SSL сертификата..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
        log_warn "Автоматическая установка не удалась. Запустите вручную:"
        echo "    sudo certbot --nginx -d $DOMAIN"
    }
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ГОТОВО!                                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Сайт доступен: ${CYAN}http://$DOMAIN${NC}"
if [ "$INSTALL_SSL" != "n" ] && [ "$INSTALL_SSL" != "N" ]; then
    echo -e "  SSL:           ${CYAN}https://$DOMAIN${NC}"
fi
echo ""
echo -e "  ${YELLOW}Не забудьте:${NC}"
echo "    1. Направить DNS записи $DOMAIN на этот сервер"
echo "    2. Обновить CORS_ORIGINS в .env:"
echo "       CORS_ORIGINS=https://$DOMAIN"
echo ""
