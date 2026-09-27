# SSSInstagram backend — production image for Back4App / Render / Cloud Run.
# Build: vite frontend -> dist/ + esbuild server -> dist/server.cjs
# Run:   node dist/server.cjs (serves API + static frontend)

FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Back4App/Render inject PORT at runtime; server listens on 0.0.0.0:$PORT.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
