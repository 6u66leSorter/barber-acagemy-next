const path = require('path')

const appDir = process.env.APP_DIR || __dirname

/** Чтобы PM2 подставил настройки из .env при запуске. */
require('dotenv').config({ path: path.join(appDir, '.env') })

module.exports = {
  apps: [
    {
      name: 'barber-api',
      script: path.join(appDir, 'bot', 'apiServer.js'),
      cwd: appDir,
      env: {
        NODE_ENV: 'production',
        API_PORT: '8787',
        MAX_BOT_TOKEN: process.env.MAX_BOT_TOKEN,
        MAX_WEBAPP_AUTH: 'strict',
        /** См. apiServer.js: виртуально дописывает /api, если nginx срезал префикс у proxy_pass */
        API_PREFIX_STRIP_REWRITE: process.env.API_PREFIX_STRIP_REWRITE ?? '1',
      },
    },
  ],
}
