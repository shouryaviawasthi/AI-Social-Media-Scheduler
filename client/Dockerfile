FROM node:20-alpine AS builder

WORKDIR /app/client

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app/client

RUN npm install -g serve

COPY --from=builder /app/client/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
