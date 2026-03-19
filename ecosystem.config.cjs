/**
 * PM2 ecosystem config for LorkERP
 * Usage: pm2 start ecosystem.config.cjs
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
        PORT: '3020',
      },
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 8000,
      kill_timeout: 5000,
    },
  ],
};
