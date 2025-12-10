# 1. Сборка React приложения
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Используем npm install вместо npm ci (package-lock.json может отсутствовать)
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# 2. Раздача через Nginx
FROM nginx:alpine
# Удаляем дефолтный конфиг
RUN rm -rf /etc/nginx/conf.d/*
# Копируем конфиг nginx для SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Копируем собранную статику
COPY --from=builder /app/dist /usr/share/nginx/html
# Этот контейнер не запускает Nginx сам в нашем docker-compose (там он builder),
# но для standalone запуска или production образа это полезно.
CMD ["nginx", "-g", "daemon off;"]