# ============================
# 1) STAGE DE BUILD
# ============================
FROM node:18 AS build

# Diretório do app
WORKDIR /app

# Copia apenas o package.json para aproveitar cache
COPY package*.json ./

# Instala dependências (com todas devDependencies)
RUN npm install

# Copia o resto do projeto
COPY . .

# Build do backend (TypeScript)
RUN npm run build

# Build do frontend (Vite)
RUN npm run build --workspace-frontend || npm run build

# ============================
# 2) STAGE DE PRODUÇÃO
# ============================
FROM node:18-slim AS production

WORKDIR /app

# Apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia artefatos buildados do stage anterior
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules ./node_modules

# Porta padrão do Cloud Run
ENV PORT=8080

# Variável usada pelo Express para servir o Vite
ENV NODE_ENV=production

# Comando de entrada
CMD ["node", "server/index.js"]
