# ==========================================
# Etap 1: Budowanie frontendu (React + Vite PWA)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Instalacja zależności frontendu
COPY package*.json ./
RUN npm ci

# Kopiowanie kodu źródłowego frontendu i budowanie
COPY . ./
# W kontenerze API jest na tym samym hoście (/api)
ENV VITE_API_URL=/api
RUN npm run build

# ==========================================
# Etap 2: Backend Node.js API + Serwowanie Frontendu
# ==========================================
FROM node:20-alpine
WORKDIR /app

# Kopiowanie package.json backendu i instalacja zależności produkcyjnych
COPY backend/api/package*.json ./
RUN npm ci --only=production

# Kopiowanie kodu backendu
COPY backend/api/src/ ./src/

# Kopiowanie zbudowanego frontendu do publicDir
COPY --from=frontend-builder /app/dist ./public/

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
