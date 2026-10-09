# Package an already validated local production build for the VPS architecture.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 IDEA_STORAGE_DIR=/app/data/ideas
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY dist ./dist
COPY scripts/serve.mjs scripts/idea-api.mjs ./scripts/
RUN mkdir -p /app/data/ideas && chown -R node:node /app/data
RUN node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; const release=JSON.parse(fs.readFileSync('dist/.release.json')); assert.equal(release.production,true); assert.equal(release.site,'https://ittimenow.com');"
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e "fetch('http://127.0.0.1:4321/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve.mjs"]
