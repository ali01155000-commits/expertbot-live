// ecosystem.config.cjs — PM2 process manager config
// Run: pm2 start ecosystem.config.cjs
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/
//
// This runs BOTH the Next.js frontend AND the expert-service backend,
// keeping them alive 24/7 with auto-restart on crash.

module.exports = {
  apps: [
    {
      name: "expertbot-web",
      cwd: "/var/www/expertbot",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_file: ".env",
      error_file: "/var/log/expertbot/web-error.log",
      out_file: "/var/log/expertbot/web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "expertbot-service",
      cwd: "/var/www/expertbot/mini-services/expert-service",
      script: "index.ts",
      interpreter: "bun",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        SOCKET_PATH: "/socket.io",
        EXPERT_SERVICE_PORT: "3003",
      },
      env_file: "../../.env",
      error_file: "/var/log/expertbot/service-error.log",
      out_file: "/var/log/expertbot/service-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
