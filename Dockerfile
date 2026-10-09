FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG DEPLOY_ENV=staging
ARG SITE_URL
ENV DEPLOY_ENV=$DEPLOY_ENV SITE_URL=$SITE_URL
RUN npm run check && npm run build && npm run test:build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 IDEA_STORAGE_DIR=/app/data/ideas
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY scripts/serve.mjs scripts/idea-api.mjs ./scripts/
RUN mkdir -p /app/data/ideas && chown -R node:node /app/data
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4321/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve.mjs"]
