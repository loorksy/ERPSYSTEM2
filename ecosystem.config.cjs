/**
 * PM2 ecosystem config for LorkERP
 * Usage: pm2 start ecosystem.config.cjs
 *
 * Ensure .env exists with PORT=3020 (or set env.PORT below).
 */
module.exports = {
  apps: [
    {
      name: 'lorkerp',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env',
      // PORT comes from .env; override here if needed:
      // env: { PORT: '3020', NODE_ENV: 'production' },
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 8000,
      kill_timeout: 5000,
    },
  ],
};
