# Задача: полный аудит VGLTU Minecraft Launcher

## Status

completed

## Objective

Проверить текущий локальный клон на подтверждённые дефекты качества, запуска, конфигурации и границ доверия; протестировать Telegram-бота с переданным тестовым токеном без сохранения токена в файлах.

Переоткрыто по команде пользователя: устранить все подтверждённые открытые ошибки без commit, push или публикации.

## Scope

- Server, admin-web, desktop, telegram-bot, Docker Compose и текущие незакоммиченные правки.
- Статические проверки, сборки, контейнерный запуск и локальная UI/API-проверка.
- Точечное устранение только подтверждённых дефектов из ранее разрешённой задачи «исправь проблемы».
- Сквозное исправление launcher login, защищённого provisioning игроков, private object storage, SFTP/RCON secrets, production runtime и активных lint-ошибок.

## Safety

- Токен передаётся только через временное окружение; не выводится и не записывается.
- Не выполнять commit, push, публикацию, сброс данных или отправку сообщений пользователям.
- Миграции сохраняют существующие данные: старые SFTP/RCON пароли шифруются при наличии ключа, а не удаляются.

## Plan

- [x] Зафиксировать исходную ревизию и существующие изменения.
- [x] Подтвердить статические находки и покрытие маршрутов.
- [x] Выполнить сборки, линтеры, Compose, UI и bot runtime-проверки.
- [x] Исправить только подтверждённые дефекты и повторить проверки.
- [x] Выбрать минимальную совместимую модель аккаунтов и закрыть Yggdrasil P0.
- [x] Закрыть MinIO/SFTP secrets и публичные admin endpoints.
- [x] Исправить lint и production runtime без маскировки правил.
- [x] Повторить миграции, Compose, unit/runtime/build/lint проверки.

## Initial Finding

- P0 callback-подмена подтверждена и устранена через общий `BOT_CALLBACK_SECRET`; минимальный regression test добавлен в `vgltu_launcher/server/tests/test_auth_callback.py`.
- P0 Yggdrasil password bypass и P1 public MinIO policy были подтверждены; минимальная совместимая модель и закрытие перечислены в разделе «Closure» ниже.
- Полный перечень и доказательства: `.agents/reviews/vgltu-minecraft-launcher-review-findings-2026-08-24.md`.

## Fix-all decision and acceptance

### Decision gate

`BUILD_MINIMUM`: текущий desktop сам создаёт произвольную учётную запись и авторизуется фиктивным паролем; оставить поток как есть нельзя. Выбрана наименьшая совместимая граница: игрока создаёт только уже авторизованный admin, launcher передаёт введённый пароль, а backend проверяет scrypt hash. Саморегистрацию и неаутентифицированный `/api/dev/create_user` удаляем.

Для файлов: bucket остаётся private, manifest ведёт на backend download proxy только для `CLIENT`/`BOTH`; конфиги по умолчанию `SERVER`, а публичные client-конфиги назначаются явно. SFTP/RCON секреты шифруются Fernet-ключом из окружения; существующие записи мигрируют без удаления.

### Acceptance

- Неверный/пустой пароль и несуществующий player не получают Yggdrasil session; зарегистрированный admin-provisioned player получает её.
- Нет открытого endpoint для создания player; provisioning требует существующий admin JWT.
- Bucket не имеет public policy; server-only file нельзя скачать через manifest/proxy.
- SFTP endpoints требуют admin JWT; БД хранит ciphertext, а sync получает расшифрованный секрет только в памяти.
- Desktop не создаёт user и не подставляет фиктивный пароль.
- Lint, builds, migration and Compose/runtime checks проходят или содержат конкретный внешний blocker.

## Closure — 2026-08-24

- [x] Игроков создаёт только авторизованный admin; desktop передаёт введённый пароль, а Yggdrasil проверяет scrypt hash. Публичный `/api/dev/create_user` удалён.
- [x] MinIO bucket сделан private; manifest выдаёт backend proxy только для `CLIENT`/`BOTH`, а конфиги и архивы по умолчанию server-only.
- [x] SFTP/RCON секреты шифруются Fernet-ключом из `SFTP_ENCRYPTION_KEY`; отдельная миграция подтверждённо зашифровала синтетическую legacy-запись без удаления данных.
- [x] SFTP admin API требует JWT, не возвращает внешние детали ошибок; production entrypoint больше не использует `--reload`.
- [x] Исправлены активные lint-ошибки admin-web и desktop без отключения правил; desktop uninstall больше не удаляет данные игры.

### Final verification

- 20 backend unit-тестов, admin-web ESLint, desktop ESLint, обе production-сборки и `git diff --check` прошли.
- Compose оставлен запущенным только с `backend` и `admin-web` на localhost; PostgreSQL, Redis и MinIO не опубликованы наружу, bot не запущен.
- Поиск шаблона Telegram-токена в исходниках ничего не нашёл; временная БД миграционного теста удалена.

### Residual

Windows packaging сообщает только не-функциональные metadata warnings: нужны реальные author/description и брендовая иконка. Значения и ассеты намеренно не выдумывались.
