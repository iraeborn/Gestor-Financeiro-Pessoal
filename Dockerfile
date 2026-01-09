# ============================
# 1) STAGE DE BUILD #
# ============================
FROM node:18 AS build

WORKDIR /app

# Copia package.json para aproveitar cache
COPY package*.json ./

# Instala dependências declaradas
RUN npm install

# 👉 Corrige o erro instalando react-markdown diretamente no build
RUN npm install react-markdown

# (Opcional para TypeScript – mas seguro)
RUN npm install -D @types/react-markdown || true

# Copia os demais arquivos
COPY . .

# Build backend (TS)
RUN npm run build

# Build frontend (Vite)
RUN npm run build --workspace-frontend || npm run build

# ============================
# 2) STAGE DE PRODUÇÃO
# ============================
FROM node:18-slim AS production

WORKDIR /app

COPY package*.json ./

# Instala somente as deps de produção
RUN npm install --omit=dev

# Copia artefatos buildados
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules ./node_modules

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
