#!/usr/bin/env python3
"""
Интерактивный скрипт для ребрендинга лаунчера.

Использование:
    python rebrand.py
    
Скрипт:
    1. Запросит новое название
    2. Заменит во всех файлах
    3. Остановит Docker контейнеры
    4. Удалит старые контейнеры и volumes
    5. Пересоберёт и запустит заново
"""

import os
import sys
import re
import json
import subprocess
from pathlib import Path

FILES_TO_PROCESS = [
    "desktop/src/components/Header.tsx",
    "desktop/src/App.tsx",
    "desktop/electron/main.ts",
    "desktop/electron/game-manager.ts",
    "desktop/package.json",
    "desktop/electron-builder.json5",
    "admin-web/src/components/Header.jsx",
    "admin-web/src/pages/Login.jsx",
    "admin-web/index.html",
    "admin-web/Dockerfile",
    "server/app/main.py",
    "server/app/routes/yggdrasil.py",
    "server/app/routes/admin.py",
    "server/app/routes/client.py",
    "server/tools/gc_minio.py",
    "telegram-bot/bot.py",
    "docker-compose.yml",
    ".env",
    ".env.example",
    "README.md",
    "DOCKER_COMMANDS.md",
    ".github/workflows/deploy-server.yml",
    ".github/workflows/release-desktop.yml"
]

def slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '', name.lower())

def to_snake_case(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '_', name.lower())
    return slug.strip('_')

def to_kebab_case(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower())
    return slug.strip('-')

def run_cmd(cmd: str, check: bool = False) -> bool:
    """Выполняет команду и возвращает успех"""
    print(f"   $ {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.stdout.strip():
            print(f"     {result.stdout.strip()}")
        return result.returncode == 0
    except Exception as e:
        print(f"     ❌ {e}")
        return False

def load_branding(script_dir: Path) -> dict:
    """Загружает текущий branding.json"""
    branding_path = script_dir / "branding.json"
    if branding_path.exists():
        return json.loads(branding_path.read_text(encoding='utf-8'))
    print("❌ branding.json не найден!")
    print("   Создай файл branding.json с текущим названием")
    sys.exit(1)

def rebrand_files(script_dir: Path, old_branding: dict, new_name: str) -> list:
    """Заменяет название во всех файлах"""
    new_slug = slugify(new_name)
    new_snake = to_snake_case(new_name)
    new_kebab = to_kebab_case(new_name)
    new_upper = new_snake.upper()
    
    old_name = old_branding.get("name", "Faculty Launcher")
    old_slug = old_branding.get("shortName", "faculty")
    old_snake = old_branding.get("dbName", "faculty_launcher")
    old_kebab = to_kebab_case(old_name)
    old_upper = old_branding.get("envPrefix", "FACULTY")
    old_container = old_branding.get("containerPrefix", "faculty")
    
    replacements = [
        (old_name, new_name),
        (old_branding.get("adminTitle", "Faculty Admin"), f"{new_name.split()[0]} Admin" if ' ' in new_name else f"{new_name} Admin"),
        (f"com.{old_slug}.launcher", f"com.{new_slug}.launcher"),
        (f".{old_kebab}", f".{new_kebab}"),
        (old_snake, new_snake),
        (f"{old_slug}-storage", f"{new_slug}-storage"),
        (f"{old_slug}-yggdrasil", f"{new_slug}-yggdrasil"),
        (f"{old_upper}_", f"{new_upper}_"),
        (f"{old_container}_postgres", f"{new_slug}_postgres"),
        (f"{old_container}_minio", f"{new_slug}_minio"),
        (f"{old_container}_redis", f"{new_slug}_redis"),
        (f"{old_container}_backend", f"{new_slug}_backend"),
        (f"{old_container}_bot", f"{new_slug}_bot"),
        (f"{old_slug}_username", f"{new_slug}_username"),
        (f"{old_slug}_ram", f"{new_slug}_ram"),
        (f"{old_slug}-launcher-desktop", f"{new_slug}-launcher-desktop"),
        (f"{old_slug}-launcher-updater", f"{new_slug}-launcher-updater"),
    ]
    
    changed_files = []
    
    for file_path in FILES_TO_PROCESS:
        full_path = script_dir / file_path
        if not full_path.exists():
            continue
        try:
            content = full_path.read_text(encoding='utf-8')
            original = content
            for old, new in replacements:
                content = content.replace(old, new)
            if content != original:
                full_path.write_text(content, encoding='utf-8')
                print(f"   ✅ {file_path}")
                changed_files.append(file_path)
        except Exception as e:
            print(f"   ❌ {file_path}: {e}")
    
    # Обновляем branding.json
    branding = {
        "name": new_name,
        "shortName": new_slug,
        "appId": f"com.{new_slug}.launcher",
        "dataFolder": f".{new_kebab}",
        "dbName": new_snake,
        "storageBucket": f"{new_slug}-storage",
        "envPrefix": new_upper,
        "containerPrefix": new_slug,
        "yggdrasilName": f"{new_slug}-yggdrasil",
        "adminTitle": f"{new_name.split()[0]} Admin" if ' ' in new_name else f"{new_name} Admin"
    }
    branding_path = script_dir / "branding.json"
    branding_path.write_text(json.dumps(branding, indent=2, ensure_ascii=False), encoding='utf-8')
    
    return changed_files, old_container, new_slug

def cleanup_docker(old_prefix: str, new_prefix: str):
    """Останавливает, удаляет старые контейнеры и volumes"""
    containers = ["postgres", "minio", "redis", "backend", "bot"]
    
    print("\n🛑 Останавливаем Docker...")
    run_cmd("docker-compose down")
    
    print("\n🗑️  Удаляем старые контейнеры...")
    for c in containers:
        run_cmd(f"docker rm -f {old_prefix}_{c} 2>nul")
        run_cmd(f"docker rm -f {new_prefix}_{c} 2>nul")
    
    print("\n🗑️  Удаляем старые volumes...")
    run_cmd(f"docker volume ls -q | findstr {old_prefix}", check=False)
    # Получаем список volumes с старым префиксом
    result = subprocess.run(
        f'docker volume ls -q',
        shell=True, capture_output=True, text=True
    )
    if result.stdout:
        for vol in result.stdout.strip().split('\n'):
            if old_prefix in vol.lower():
                run_cmd(f"docker volume rm {vol}")

def rebuild_docker():
    """Пересобирает и запускает Docker"""
    print("\n🔨 Пересобираем Docker...")
    run_cmd("docker-compose build --no-cache")
    
    print("\n🚀 Запускаем контейнеры...")
    run_cmd("docker-compose up -d")
    
    print("\n📊 Статус контейнеров:")
    run_cmd("docker-compose ps")

def main():
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("=" * 50)
    print("🎨 REBRAND LAUNCHER")
    print("=" * 50)
    
    # Загружаем текущий branding
    old_branding = load_branding(script_dir)
    current_name = old_branding.get("name", "Faculty Launcher")
    
    print(f"\n📌 Текущее название: {current_name}")
    print(f"   Slug: {old_branding.get('shortName', 'faculty')}")
    print(f"   Контейнеры: {old_branding.get('containerPrefix', 'faculty')}_*")
    
    # Запрашиваем новое название
    print("\n" + "-" * 50)
    new_name = input("✏️  Введите новое название (или Enter для отмены): ").strip()
    
    if not new_name:
        print("❌ Отменено")
        sys.exit(0)
    
    if len(new_name) < 3:
        print("❌ Название слишком короткое (мин. 3 символа)")
        sys.exit(1)
    
    if new_name == current_name:
        print("❌ Название не изменилось")
        sys.exit(0)
    
    # Показываем что будет
    new_slug = slugify(new_name)
    new_snake = to_snake_case(new_name)
    
    print(f"\n📋 Будет изменено:")
    print(f"   Название: {current_name} → {new_name}")
    print(f"   Slug: {old_branding.get('shortName', 'faculty')} → {new_slug}")
    print(f"   Контейнеры: {old_branding.get('containerPrefix', 'faculty')}_* → {new_slug}_*")
    print(f"   База данных: {old_branding.get('dbName', 'faculty_launcher')} → {new_snake}")
    
    # БОЛЬШОЕ ПРЕДУПРЕЖДЕНИЕ
    print("\n")
    print("!" * 70)
    print("!" * 70)
    print("!!                                                                  !!")
    print("!!    ⚠️⚠️⚠️  ВНИМАНИЕ! ВСЕ ДАННЫЕ БУДУТ УДАЛЕНЫ!  ⚠️⚠️⚠️           !!")
    print("!!                                                                  !!")
    print("!!    Это действие:                                                 !!")
    print("!!    • Остановит ВСЕ Docker контейнеры                             !!")
    print("!!    • УДАЛИТ ВСЕ Docker volumes (PostgreSQL, MinIO, Redis)        !!")
    print("!!    • ВСЕ ДАННЫЕ В БАЗЕ БУДУТ ПОТЕРЯНЫ                            !!")
    print("!!    • Все загруженные файлы в MinIO будут удалены                 !!")
    print("!!                                                                  !!")
    print("!!    Если у тебя есть важные данные - СДЕЛАЙ БЭКАП СЕЙЧАС!         !!")
    print("!!                                                                  !!")
    print("!" * 70)
    print("!" * 70)
    print("\n")
    
    confirm = input("⚠️  Введи 'YES' (большими буквами) для подтверждения: ").strip()
    if confirm != 'YES':
        print("❌ Отменено (нужно ввести YES)")
        sys.exit(0)
    
    # Выполняем замену
    print("\n" + "=" * 50)
    print("📝 Заменяем в файлах...")
    changed, old_prefix, new_prefix = rebrand_files(script_dir, old_branding, new_name)
    print(f"\n   Изменено файлов: {len(changed)}")
    
    # Docker операции
    cleanup_docker(old_prefix, new_prefix)
    rebuild_docker()
    
    print("\n" + "=" * 50)
    print("✅ ГОТОВО!")
    print("=" * 50)
    print(f"\n🎉 Лаунчер переименован в: {new_name}")
    print(f"\n⚠️  Не забудь:")
    print(f"   1. Переименовать папку 'faculty-launcher' → '{to_kebab_case(new_name)}'")
    print(f"   2. Пересобрать desktop: cd desktop && npm run build")

if __name__ == "__main__":
    main()
