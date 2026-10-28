# ─── Etapa 1: compilación ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Se copian primero los manifiestos para aprovechar la caché de capas de Docker:
# si solo cambia el código, no se reinstalan las dependencias.
COPY package*.json ./
# npm ci (instalación exacta) si existe package-lock.json; si no, npm install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ─── Etapa 2: imagen final (solo lo necesario para ejecutar) ───────────
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Se ejecuta con un usuario sin privilegios.
USER node
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
