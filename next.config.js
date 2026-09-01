// next.config.js
const nextConfig = {
  compress: false, // Отключено из прошлого шага
  // webpack: (config, { dev, isServer }) => {
  //   if (dev && !isServer) {
  //     // Говорим Next.js, что HMR сокет должен ожидать подключения через внешний домен
  //     config.config.infrastructureLogging = { level: 'error' };
  //   }
  //   return config;
  // },
  // Альтернативный и самый надежный способ для свежих версий Next.js:
  // experimental: {
  //   // Если используете Turbopack (флаг --turbo)
  //   turbo: {
  //     // настройки турбопака при необходимости
  //   }
  // }
};

module.exports = nextConfig;
