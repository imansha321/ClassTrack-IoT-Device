# Stage 1 - Build TS
FROM node:20-alpine as builder

WORKDIR /app

# Prisma must know binaries target
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl"

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2 - Run JS
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Needed for prisma engine runtime
RUN apk add --no-cache openssl

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5000
CMD ["node", "dist/index.js"]
