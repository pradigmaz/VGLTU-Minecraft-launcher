## 2026-08-24 — точечная очистка launcher

TASK: Проверить локальный клон VGLTU Minecraft launcher и внести только малые подтверждённые правки без публикации.

STATE: Завершено с остаточными рисками. Commit/push не выполнялись.

CHANGED: `vgltu_launcher/desktop/package.json` — закреплены `@xmcl/core@2.15.1`, `@xmcl/installer@6.1.2`, `@xmcl/user@4.3.0`; `README.md` — исправлен путь к `vgltu_launcher/DOCKER_COMMANDS.md`.

VERIFIED: Изолированная чистая npm-установка, `npx tsc --noEmit`, `npx vite build`, runtime exports XMCL, admin Vite build, JSON/README-link check и `git diff --check` прошли.

NEXT: Docker отсутствует, поэтому Compose и полный запуск не проверены. Отдельно планировать 8 admin и 29 desktop lint-ошибок; не маскировать их отключениями правил.

## 2026-08-24 — Docker для Compose-проверки

TASK: Установить Docker Desktop и подготовить запуск Compose для локального тестирования launcher.

STATE: Частично завершено. Docker Desktop 4.87.0 и Docker CLI 29.7.2 установлены; движок не стартует.

CHANGED: Установлен официальный пакет `Docker.DockerDesktop` через Winget. Изменений кода, документации репозитория, commit/push нет.

VERIFIED: Winget подтверждает Docker Desktop 4.87.0; CLI возвращает версию 29.7.2. Встроенная диагностика/журнал показывают `Wsl/Service/ReadDistroConfig/E_UNEXPECTED` для `docker-desktop` с пустым `BasePath`.

NEXT: Перед удалением только повреждённой WSL-записи `docker-desktop` нужно отдельное подтверждение; Ubuntu не затрагивать. После этого повторно запустить Docker и проверить Compose.

## 2026-08-24 — исправление Compose runtime

TASK: Исправить подтверждённые блокеры Docker/Compose launcher и проверить реальные локальные сервисы.

STATE: Завершено. Docker Desktop работает через Hyper-V backend; WSL и Ubuntu не менялись.

CHANGED: Admin Dockerfile использует Node 22; Compose хранит PostgreSQL в postgres_data; env example оставляет числовые Telegram ID пустыми с пояснениями. Docker Desktop 4.87.0 установлен, ему разрешён только каталог workspace.

VERIFIED: Compose config, полная сборка, healthy PostgreSQL/Redis/MinIO, миграции, backend без fatal-логов, Swagger API и admin-web прошли. Старый PostgreSQL bind-каталог был пуст.

NEXT: Отдельно разбирать 8 admin и 29 desktop lint-ошибок. Для проверки Telegram-бота нужны реальный BOT_TOKEN и числовые ID; текущие сервисы оставлены запущенными.

## 2026-08-24 — полный аудит и точечный ремонт launcher

TASK: Полностью проверить локальный клон на реальные дефекты, применить только малые обоснованные правки и не публиковать изменения.

STATE: Завершено с открытыми P0/P1, требующими решения по модели игроков и доступу к файлам. Commit/push не выполнялись; Compose-сервисы оставлены запущенными.

CHANGED: Защищён Telegram callback общим `BOT_CALLBACK_SECRET` и тестом; feedback экранирует HTML; восстановлена desktop-сборка; удалены подтверждённо мёртвые legacy-файлы; добавлен audit record.

VERIFIED: Compose config, backend tests/API, bot HTML-escape test в контейнере, admin build, desktop package build, `rebrand.py` compile, stale-path search и `git diff --check` прошли. Линтеры честно оставляют 8 admin ошибок + 2 предупреждения и 29 desktop ошибок.

NEXT: До закрытия P0 согласовать действительную аутентификацию Yggdrasil; до P1 — разделение публичных игровых артефактов и приватных конфигов MinIO. Перед реальным admin login задать одинаковый `BOT_CALLBACK_SECRET` в рабочем `.env`.

## 2026-08-24 — финальное закрытие исправлений

TASK: Закрыть все подтверждённые дефекты launcher без commit, push или публикации.

STATE: Завершено локально. Compose оставлен запущенным без bot; commit/push не выполнялись.

CHANGED: Закрыты Yggdrasil password bypass и public provisioning, private MinIO/proxy visibility, encryption SFTP/RCON, SFTP admin/auth/error handling, production reload, активные lint-ошибки и риск удаления game data при uninstall.

VERIFIED: 20 backend-тестов, оба ESLint, production builds, legacy SFTP migration, installer syntax, `git diff --check`, token scan и Compose port exposure прошли. PostgreSQL, Redis и MinIO остаются внутренними Docker-сервисами; временная migration DB удалена.

NEXT: Перед реальным deployment задать уникальные рабочие secrets в `.env`, включая `SFTP_ENCRYPTION_KEY` и `BOT_CALLBACK_SECRET`. Не-функциональные package metadata warnings требуют предоставленных author/description и брендовой иконки; ничего не выдумывать.

## 2026-08-24 — семантический commit и push

TASK: Разделить подтверждённые изменения launcher на смысловые commits, проверить publish gate и отправить их в GitHub.

STATE: Четыре смысловых commits отправлены в `origin/main` (`37d485f..eb8d268`); этот checkpoint будет отправлен отдельным docs commit.

CHANGED: `eb7a706` — security backend/storage; `2766fdd` — desktop login/build; `6232d95` — admin lint/build; `eb8d268` — audit documentation.

VERIFIED: Перед push выполнены `git fetch origin main`, `git diff --check origin/main..HEAD` и scan 60 добавленных/изменённых файлов на токены, ключи и локальные пути; `origin/main` не имела новых commits.

NEXT: После отправки checkpoint задать реальные deployment secrets в `.env`; локальные `.agents/skills`, `.agents/AGENTS.md` и исторический cleanup task намеренно не публиковать.
