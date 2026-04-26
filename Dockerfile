# Frontend Build
FROM node:20-slim as builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime
FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

RUN npm install --production
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server.ts"]
