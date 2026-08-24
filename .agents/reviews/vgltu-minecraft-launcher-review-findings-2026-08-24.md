# Аудит VGLTU Minecraft Launcher — подтверждённые находки

- Дата: 2026-08-24
- Ревизия: `37d485fb07fc6956d001df55f997c9377371f831` (`main`)
- Область: `server`, `telegram-bot`, `admin-web`, `desktop`, Compose и текущие незакоммиченные изменения.
- Статус: закрыт после точечных исправлений и повторной проверки; commit, push и публикация не выполнялись.

## Исправлено

### P0 — подмена Telegram ID в callback авторизации

`POST /api/auth/callback` ранее принимал `telegram_id` из тела запроса без проверки источника и выдавал роль администратора, если ID находился в `ADMIN_IDS`. Это воспроизведено изолированным тестом.

Исправление: backend и bot требуют общий `BOT_CALLBACK_SECRET`; backend сравнивает заголовок `X-Bot-Callback-Secret` через `hmac.compare_digest` и закрывает callback без секрета. Добавлены минимальные тесты отказа и успешного callback.

Перед реальным входом в admin-панель в рабочем `.env` нужно задать одинаковый случайный `BOT_CALLBACK_SECRET` для обоих сервисов. Пример оставлен пустым намеренно.

### P2 — текст feedback ломал HTML-сообщение

Бот работает с `ParseMode.HTML`, но вставлял имя, username и `message.text` в HTML без экранирования. Символы `<` и `&` могли сломать отправку feedback.

Исправление: эти три значения экранируются стандартным `html.escape`. Проверка в изолированном bot-контейнере подтвердила корректную обработку опасных символов; polling и отправка реальных сообщений не запускались.

### P2 — desktop-пакетирование ссылалось на отсутствующий NSIS include

Из `desktop/package.json` убрана ссылка на отсутствующий `build/installer.nsh`; актуализирован `rebrand.py`. `npm run build` снова создаёт установщик и portable-версию.

### P2 — мёртвые Electron-исходники и generated lint noise

Удалены неиспользуемые legacy-исходники (`src/main/index.js`, `src/preload/index.js`, `src/renderer/src/App.jsx`) и пустой `AuthGuard.jsx`. ESLint desktop теперь игнорирует generated `dist-electron`; активные ошибки не скрыты.

## Исходные находки, закрытые 2026-08-24

### P0 — Yggdrasil выдаёт сессию без проверки пароля

`server/app/routes/yggdrasil.py:40` публикует `/api/dev/create_user` без аутентификации, а `:66` обрабатывает `/authserver/authenticate`; комментарий в `:75` подтверждает временный допуск по нику. Проверка воспроизвела получение сессии без действительного пароля.

Не исправлено намеренно: безопасная правка требует выбрать модель учётных записей лаунчера (назначенные admin-пользователи, отдельные игроки с паролем, JWT/OAuth либо отключение dev/Yggdrasil API). Отключение маршрутов сейчас сломало бы существующий сценарий без согласованной замены.

### P1 — содержимое MinIO публично доступно без строгого разделения

`server/tools/init_minio.py:33` задаёт public `s3:GetObject`. Неаутентифицированный manifest возвращает `SideType.CLIENT` и `SideType.BOTH` с прямыми URL (`server/app/routes/client.py:75,82`), а загрузка архива по умолчанию назначает файлам `BOTH` (`server/app/routes/admin.py:132`). Конфигурационный файл, случайно попавший в архив, может стать доступен игрокам.

Нужна отдельная продуктовая граница: публичные игровые артефакты против приватных server-конфигов, затем ограничение upload-классификации и способ выдачи файлов (private bucket/signed URL или авторизованная загрузка).

### P2 — SFTP и RCON секреты лежат в БД открытым текстом

`server/app/models.py:73,79` хранят `password` и `rcon_password` в строковых полях. Требуется выбрать хранение внешних секретов (например, секрет-хранилище либо шифрование с отдельным ключом и миграцией); самовольная миграция может сделать текущие подключения неработоспособными.

### P2 — активные lint-ошибки

- `admin-web`: 8 ошибок и 2 предупреждения в 6 файлах; Vite build проходит.
- `desktop`: 29 ошибок в 7 активных исходниках; typecheck и package build проходят.

Ошибки правил не отключались. Их стоит устранять отдельными малыми задачами по файлам, а не массовым рефакторингом.

### P2 — backend запущен в reload-режиме

`server/entrypoint.sh:73` запускает `uvicorn --reload`. Это допустимо для локальной разработки, но не для production-образа: нужен отдельный production command/compose override.

## Проверки

- Compose config, работающие backend/admin/MinIO/PostgreSQL/Redis и `GET /openapi.json` — успешно.
- Backend callback tests — успешно.
- Admin Vite build, desktop package build, `rebrand.py` compile и `git diff --check` — успешно.
- Проверка отсутствия ссылок на удалённые legacy-файлы — успешно.
- Тестовый Telegram token проверен вызовом `getMe`; исходный token нигде не записывался и не выводился.

## Ponytail-аудит

Реальными кандидатами на удаление были только неиспользуемые legacy-файлы и пустой компонент; они удалены после проверки входных точек. Новые зависимости, абстракции и косметический массовый рефакторинг не добавлялись.

## Закрытие находок

- **P0 Yggdrasil:** игрока теперь создаёт только уже авторизованный admin, пароль хранится как scrypt hash, `/api/dev/create_user` удалён, а launcher больше не подставляет пароль или случайный ID.
- **P1 MinIO:** bucket private; клиентские файлы выдаёт backend proxy только для `CLIENT`/`BOTH`; конфиги и архивы по умолчанию server-only. Публичные Nginx storage routes удалены.
- **P2 SFTP/RCON:** значения хранятся Fernet ciphertext с ключом из окружения; legacy migration проверена на отдельной временной БД и очищена после проверки. SFTP endpoints требуют admin JWT и не раскрывают внешние ошибки.
- **P2 lint/runtime:** оба ESLint проходят без отключения правил; production entrypoint не запускает reload watcher; uninstall desktop больше не удаляет game data.

## Итоговая проверка

- Пройдены 20 backend unit-тестов, admin-web ESLint, desktop ESLint, admin и desktop production builds, `git diff --check`.
- Compose работает без bot; PostgreSQL, Redis и MinIO доступны лишь внутри Docker network.
- Остаются только не-функциональные предупреждения Windows package builder о незаданных author/description и брендовой иконке; эти значения не выдумывались.
