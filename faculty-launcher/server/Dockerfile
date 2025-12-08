FROM python:3.11-slim

# Отключаем буферизацию вывода (чтобы логи видеть сразу)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Сначала копируем зависимости (для кэширования слоев Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код
COPY . .

# Копируем скрипт запуска
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Запускаем через entrypoint (миграции + сервер)
ENTRYPOINT ["./entrypoint.sh"]