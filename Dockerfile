# ── Stage 1: Build React Vite app ──────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Serve via hardened Nginx ──────────────────
FROM nginx:alpine

RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache libcap \
    && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx \
    && sed -i 's|/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf \
    && sed -i 's/^user /#user /' /etc/nginx/nginx.conf \
    && mkdir -p /var/cache/nginx/client_temp /var/run /etc/nginx/conf.d \
    && chown -R nginx:nginx /var/cache/nginx /var/run /etc/nginx/conf.d

COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

USER nginx

CMD ["nginx", "-g", "daemon off;"]
