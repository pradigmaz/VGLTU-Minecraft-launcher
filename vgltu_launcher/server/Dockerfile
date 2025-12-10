FROM python:3.11-slim

# Отключаем буферизацию вывода (чтобы логи видеть сразу)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Устанавливаем postgresql-client и redis-tools
RUN apt-get update && \
    apt-get install -y postgresql-client redis-tools && \
    rm -rf /var/lib/apt/lists/*

# Сначала копируем зависимости (для кэширования слоев Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY . .
# Копируем скрипт запуска (если он не скопировался точкой выше)
COPY entrypoint.sh .
# 🔥 Исправляем переводы строк (на случай если забыл п.2) и даем права на запуск
RUN sed -i 's/\r$//g' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Запускаем
ENTRYPOINT ["/app/entrypoint.sh"]