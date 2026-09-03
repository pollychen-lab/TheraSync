# TheraSync, packaged as a single Cloud Run service.
#
# The React bundle and the Express API ship in one container so the SPA and the
# /api calls it makes on relative paths share an origin: no CORS negotiation,
# and no second service to route through. Cloud Run injects PORT at runtime,
# which server.js already honours.

# --- Stage 1: build the React bundle -----------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: resolve backend production dependencies ------------------------
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 3: runtime --------------------------------------------------------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Pinned CA for the managed Postgres TLS chain. db.js verifies against this
# instead of disabling certificate verification.
COPY certs/prod-ca-2021.crt /etc/ssl/certs/supabase-prod-ca-2021.crt
ENV DATABASE_CA_CERT=/etc/ssl/certs/supabase-prod-ca-2021.crt

COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend /app/build ./public

# Drop to the unprivileged user the node image already provides.
USER node

EXPOSE 8080
CMD ["node", "server.js"]
