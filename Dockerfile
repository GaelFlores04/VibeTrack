FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci
COPY frontend/ frontend/
COPY backend/ backend/
COPY scripts/ scripts/
RUN npm run build

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace=backend --include-workspace-root=false

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules/ node_modules/
COPY --from=build --chown=node:node /app/backend/package.json backend/package.json
COPY --from=build --chown=node:node /app/backend/dist/ backend/dist/
COPY --from=build --chown=node:node /app/frontend/dist/ frontend/dist/
USER node
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
