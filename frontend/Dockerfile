# ─── Etapa 1: compilación de la SPA ──────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# npm ci (instalación exacta) si existe package-lock.json; si no, npm install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY . .
# Las URLs de las APIs se incrustan en el bundle al compilar (son públicas, no secretas).
ARG VITE_AUTH_API_URL=http://localhost:4000
ARG VITE_BUSINESS_API_URL=http://localhost:8000
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL \
    VITE_BUSINESS_API_URL=$VITE_BUSINESS_API_URL
RUN npm run build

# ─── Etapa 2: servidor estático Nginx ────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost/ >/dev/null || exit 1
