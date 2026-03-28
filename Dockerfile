FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-alpine
RUN apk add --no-cache android-tools
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
RUN chown -R node:node /app
USER node
ENTRYPOINT ["node", "dist/index.js"]
