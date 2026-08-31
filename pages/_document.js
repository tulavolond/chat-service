import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        {/* Bootstrap CSS */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        
        {/* 🚀 СКРИПТ ДЛЯ МГНОВЕННОЙ ТЕМЫ (без моргания) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // 1. Пробуем взять тему из localStorage
                  var theme = localStorage.getItem('chat-theme');
                  
                  // 2. Если нет, проверяем системные настройки пользователя
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  
                  // 3. Применяем ДО отрисовки body, чтобы не было моргания
                  document.documentElement.setAttribute('data-bs-theme', theme);
                } catch (e) {
                  // На случай ошибок доступа к localStorage (например, в приватном режиме)
                  document.documentElement.setAttribute('data-bs-theme', 'light');
                }
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
                );
}