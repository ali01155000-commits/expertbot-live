# Dockerfile — single-container deployment (frontend + expert-service + Nginx)
# Usage:
#   docker build -t expertbot .
#   docker run -p 80:80 -p 443:443 --env-file .env expertbot
#
# For Hostinger VPS: install Docker, then run the above.

FROM oven/bun:1 AS base
WORKDIR /app

# --- Stage 1: install dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY mini-services/expert-service/package.json mini-services/expert-service/bun.lock ./mini-services/expert-service/
RUN cd mini-services/expert-service && bun install --frozen-lockfile

# --- Stage 2: build ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mini-services/expert-service/node_modules ./mini-services/expert-service/node_modules
COPY . .
RUN bun run build
RUN bun run db:push

# --- Stage 3: production runtime ---
FROM node:20-slim AS runner
WORKDIR /app

# Install nginx + supervisor
RUN apt-get update && apt-get install -y nginx supervisor && rm -rf /var/lib/apt/lists/*

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db
COPY --from=builder /app/mini-services/expert-service ./mini-services/expert-service
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src

# Install bun in runtime (for expert-service)
RUN npm install -g bun

# Nginx config
COPY nginx.conf /etc/nginx/sites-available/expertbot.conf
RUN ln -sf /etc/nginx/sites-available/expertbot.conf /etc/nginx/sites-enabled/default

# Supervisor config (runs nginx + next + expert-service together)
RUN mkdir -p /var/log/expertbot /var/www/expertbot
COPY <<'EOF' /etc/supervisor/conf.d/expertbot.conf
[program:nginx]
command=nginx -g "daemon off;"
autorestart=true
stdout_logfile=/var/log/expertbot/nginx-out.log
stderr_logfile=/var/log/expertbot/nginx-error.log

[program:nextjs]
command=node_modules/.bin/next start -p 3000
directory=/app
autorestart=true
environment=NODE_ENV="production"
stdout_logfile=/var/log/expertbot/web-out.log
stderr_logfile=/var/log/expertbot/web-error.log

[program:expert-service]
command=bun run index.ts
directory=/app/mini-services/expert-service
autorestart=true
environment=NODE_ENV="production",SOCKET_PATH="/socket.io",EXPERT_SERVICE_PORT="3003"
stdout_logfile=/var/log/expertbot/service-out.log
stderr_logfile=/var/log/expertbot/service-error.log
EOF

EXPOSE 80 443
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
