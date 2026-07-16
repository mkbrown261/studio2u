module.exports = {
  apps: [
    {
      name: 'studio2u',
      script: 'npx',
      args: 'wrangler pages dev dist -b ADMIN_PASSWORD=mason2026 --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
