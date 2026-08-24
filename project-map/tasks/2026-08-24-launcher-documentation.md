# Задача: обновление пользовательской документации launcher

## Status

completed

## Objective

Привести README и runbook в соответствие с текущими путями, Compose-стеком, безопасным запуском, Telegram-входом и SFTP/RCON-конфигурацией.

## Scope

- Root README, `vgltu_launcher/DOCKER_COMMANDS.md` и `vgltu_launcher/admin-web/README.md`.
- Только подтверждённые расхождения и полезные инструкции для запуска и обслуживания.
- Без изменения кода, конфигурации, Docker-сервисов или публикации.

## Findings

- Root README запускал `install.sh` и `.env.example` не из каталога `vgltu_launcher`.
- Скрипт `install.sh` удаляет Docker, Nginx и локальные данные хоста, но README называл его рекомендуемым без этого предупреждения.
- README admin-web был стандартным шаблоном Vite и не описывал реальный запуск или Telegram-вход.
- Compose не передаёт `BOT_USERNAME` в backend, хотя backend использует его для ссылки на бота; документация теперь описывает достоверный ручной вход при нестандартном username.

## Verification

- `MARKDOWN_STRUCTURE_AND_LINKS_PASS`: локальные Markdown-ссылки существуют, блоки кода закрыты.
- `STALE_DOCUMENTATION_SURFACE_PASS`: нет устаревших команд `docker-compose`, ссылки на удалённый `DEPLOY.md` или неверного `/storage/` URL.
- `TELEGRAM_DOCUMENTATION_LIMITATION_PASS`: описание `BOT_USERNAME` соответствует `docker-compose.yml` и `auth.py`.
- `COMPOSE_DOCUMENTED_COMMAND_PASS`: `docker compose --env-file .env.example config --quiet` завершилась успешно.

## Residual

- Ссылка на Telegram-бота для нестандартного username остаётся ограничением Compose-конфигурации: `BOT_USERNAME` не передаётся backend. В рамках этой задачи добавлен достоверный ручной сценарий `/start <код>`; код и конфигурация не менялись.
