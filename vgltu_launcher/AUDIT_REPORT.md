# 🔍 Faculty Launcher — Полный аудит кода

**Дата:** 2025-12-08  
**Компоненты:** Server (FastAPI), Admin Web (React), Desktop (Electron), Telegram Bot (aiogram)

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. БЕЗОПАСНОСТЬ

#### 1.1 Хардкод секретов в docker-compose.yml
```yaml
# ❌ ПЛОХО: Пароли в открытом виде
POSTGRES_PASSWORD: dev_secret_password
MINIO_ROOT_PASSWORD: supersecretkey
```
**Риск:** Утечка при коммите в публичный репозиторий  
**Решение:** Вынести ВСЕ секреты в `.env`, добавить `.env` в `.gitignore`

#### 1.2 Слабый SECRET_KEY по умолчанию
```python
# server/app/utils.py
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
```
**Риск:** Если не задан в env — JWT токены легко подделать  
**Решение:** Убрать дефолтное значение, падать при старте если не задан

#### 1.3 CORS разрешает ВСЁ
```python
# server/app/main.py
allow_origins=["*"]  # ❌ Опасно в проде!
```
**Риск:** XSS атаки, кража токенов  
**Решение:** Указать конкретные домены через env переменную

#### 1.4 Отсутствует валидация входных данных в Yggdrasil
```python
# server/app/routes/yggdrasil.py
# Нет проверки длины username, нет санитизации
result = await db.execute(select(User).where(User.username == payload.username))
```
**Риск:** SQL Injection (маловероятно с SQLAlchemy, но всё же), DoS через длинные строки  
**Решение:** Добавить Pydantic валидацию с ограничениями

#### 1.5 Rate Limiting только на /auth/code
```python
# server/app/routes/auth.py
@limiter.limit("5/minute")  # Только здесь!
async def get_login_code(request: Request):
```
**Риск:** Brute-force на /authserver/authenticate  
**Решение:** Добавить rate limiting на все auth endpoints

---

### 2. ПРОИЗВОДИТЕЛЬНОСТЬ

#### 2.1 N+1 запросы в admin.py
```python
# server/app/routes/admin.py - get_admin_instances
for i in instances:
    AdminInstanceView(..., files_count=0)  # ❌ Всегда 0, нет подсчёта!
```
**Проблема:** files_count всегда 0, нужен JOIN с COUNT  
**Решение:**
```python
stmt = select(Instance, func.count(instance_files.c.file_hash)).outerjoin(instance_files).group_by(Instance.id)
```

#### 2.2 Синхронные операции MinIO в async коде
```python
# server/app/routes/admin.py
if not minio_client.bucket_exists(BUCKET_NAME):  # ❌ Блокирующий вызов
    minio_client.make_bucket(BUCKET_NAME)
```
**Проблема:** Блокирует event loop  
**Решение:** Уже используется `run_in_threadpool` в других местах — применить везде

#### 2.3 Загрузка всего архива в память
```python
# server/app/routes/admin.py - upload_instance_zip
file_data = archive_obj.read(file_info)  # ❌ Весь файл в RAM
```
**Проблема:** При больших модах (100+ МБ) — OOM  
**Решение:** Стриминговая обработка или временные файлы

#### 2.4 Desktop: Отсутствует кэширование версий Minecraft
```typescript
// desktop/electron/game-manager.ts
const versionList = await getVersionList(mirrorOptions)  // Каждый раз заново
```
**Проблема:** Лишние запросы к API Mojang  
**Решение:** Кэшировать version_manifest.json локально на 1 час

#### 2.5 Admin Web: Polling каждые 2 секунды
```javascript
// admin-web/src/pages/Login.jsx
const interval = setInterval(async () => {
    const res = await api.get(`/auth/check/${code}`);
}, 2000);
```
**Проблема:** Нагрузка на сервер при множестве открытых вкладок  
**Решение:** WebSocket или Server-Sent Events

---

### 3. АРХИТЕКТУРНЫЕ ПРОБЛЕМЫ

#### 3.1 Дублирование get_db() в каждом роуте
```python
# Повторяется в admin.py, auth.py, client.py, yggdrasil.py
async def get_db():
    async with async_session_factory() as session:
        yield session
```
**Решение:** Вынести в utils.py (уже есть там!) и импортировать

#### 3.2 Отсутствует централизованная обработка ошибок
```python
# Везде разный формат ошибок
raise HTTPException(status_code=404, detail="Instance not found")
raise HTTPException(status_code=403, detail="Invalid credentials")
```
**Решение:** Создать exception handlers в main.py

#### 3.3 Desktop: Хардкод URL API
```typescript
// desktop/electron/main.ts
const API_URL = "http://localhost:8000/api"
const AUTH_URL = "http://localhost:8000"
```
**Проблема:** Невозможно сменить сервер без пересборки  
**Решение:** Читать из конфига или env

#### 3.4 Отсутствует логирование
```python
# server/app/routes/admin.py
print(f"🗑️ Deleting instance: {instance_id}")  # ❌ print вместо logging
```
**Решение:** Использовать `logging` модуль везде

---

### 4. ПОТЕНЦИАЛЬНЫЕ БАГИ

#### 4.1 Race condition при создании bucket
```python
# server/app/routes/admin.py
if not minio_client.bucket_exists(BUCKET_NAME):
    minio_client.make_bucket(BUCKET_NAME)  # ❌ Может упасть если создан между проверкой
```
**Решение:** try/except BucketAlreadyOwnedByYou

#### 4.2 Утечка памяти в Desktop при множественных запусках
```typescript
// desktop/electron/game-manager.ts
gameProcess.stdout?.on('data', ...)  // Listeners не очищаются
```
**Решение:** Хранить ссылку на процесс и очищать при новом запуске

#### 4.3 Telegram Bot: Нет обработки ошибок сети
```python
# telegram-bot/bot.py
async with aiohttp.ClientSession() as session:
    async with session.post(...) as resp:  # ❌ Нет timeout, нет retry
```
**Решение:** Добавить timeout и retry логику

#### 4.4 Неиспользуемые переменные в Desktop
```typescript
// desktop/src/App.tsx
const [loadingText, setLoadingText] = useState<string | null>(null)  // ❌ Не используется
```

#### 4.5 Отсутствует import rarfile в admin.py
```python
# server/app/routes/admin.py
# rarfile импортирован в utils.py, но используется в admin.py без импорта!
archive_obj = rarfile.RarFile(archive_buffer)  # ❌ NameError в runtime
```
**Критично:** RAR архивы не будут работать!

---

### 5. БЕЗОПАСНОСТЬ ДЕСКТОПА

#### 5.1 Небезопасное хранение токенов
```typescript
// desktop/src/App.tsx
localStorage.setItem('faculty_username', username)  // ❌ Только username
```
**Проблема:** accessToken хранится только в памяти, теряется при перезапуске  
**Решение:** Использовать electron-store с шифрованием

#### 5.2 Отсутствует проверка подписи обновлений
```typescript
// desktop/electron/game-manager.ts
await this.downloadFile(AUTHLIB_URL, AUTHLIB_PATH)  // ❌ Нет проверки хеша
```
**Риск:** MITM атака может подменить authlib-injector  
**Решение:** Проверять SHA256 после скачивания

---

## 🟡 РЕКОМЕНДАЦИИ (Средний приоритет)

1. **Добавить health check endpoint** — `/health` для мониторинга
2. **Версионирование API** — `/api/v1/...`
3. **Добавить тесты** — Сейчас 0% coverage
4. **Документация API** — Swagger/OpenAPI уже есть через FastAPI, но не настроен
5. **Миграции Alembic** — Проверить что все модели синхронизированы
6. **Desktop: Auto-update** — Сейчас нет механизма обновления лаунчера

---

## 🟢 ЧТО СДЕЛАНО ХОРОШО

1. ✅ Content-addressable storage для файлов (дедупликация)
2. ✅ Защита от ZIP-бомб в validate_uploaded_archive
3. ✅ Async SQLAlchemy — правильный подход
4. ✅ Rate limiting настроен (хоть и не везде)
5. ✅ Stealth mode в лаунчере — хороший UX
6. ✅ Lazy loading @xmcl/installer — экономия памяти
7. ✅ Mirror fallback для скачивания Minecraft

---

## 📊 СВОДКА

| Категория | Критических | Средних | Низких |
|-----------|-------------|---------|--------|
| Безопасность | 5 | 2 | 1 |
| Производительность | 2 | 3 | 2 |
| Архитектура | 1 | 3 | 2 |
| Баги | 2 | 3 | 2 |

**Общая оценка:** 6/10 — Работает, но требует доработки перед продом.

---

## 🎯 ПРИОРИТЕТНЫЙ ПЛАН ДЕЙСТВИЙ

1. **СРОЧНО:** Исправить отсутствующий import rarfile
2. **СРОЧНО:** Вынести секреты из docker-compose в .env
3. **ВАЖНО:** Добавить rate limiting на auth endpoints
4. **ВАЖНО:** Исправить CORS для прода
5. **ЖЕЛАТЕЛЬНО:** Заменить print на logging
6. **ЖЕЛАТЕЛЬНО:** Добавить проверку хеша authlib-injector
