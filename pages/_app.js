import { useEffect, useState } from 'react';
// import 'bootstrap/dist/css/bootstrap.min.css';
// Вместо стандартного bootstrap:
import 'bootswatch/dist/darkly/bootstrap.min.css';
// import 'bootswatch/dist/lux/bootstrap.min.css';
// import 'bootswatch/dist/flatly/bootstrap.min.css';
import '../styles/theme.css';
// Если понадобятся JS-компоненты (dropdown, modal и т.д.):
// import 'bootstrap/dist/js/bootstrap.bundle.min.js';

export default function App({ Component, pageProps }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Применяем тему к <html>
    document.documentElement.setAttribute('data-bs-theme', theme);
    // Сохраняем выбор пользователя
    localStorage.setItem('chat-theme', theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('chat-theme');
    if (saved) setTheme(saved);
  }, []);

  return <Component {...pageProps} theme={theme} setTheme={setTheme} />;
}

// import 'bootstrap/dist/css/bootstrap.min.css';
// Если понадобятся JS-компоненты (dropdown, modal и т.д.):
// import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// import '../styles/globals.css';

// export default function App({ Component, pageProps }) {
//   return <Component {...pageProps} />;
// }

// import { useEffect, useState } from 'react';
// import 'bootstrap/dist/css/bootstrap.min.css';

// export default function App({ Component, pageProps }) {
//   const [theme, setTheme] = useState('light');

//   useEffect(() => {
//     // Применяем тему к <html>
//     document.documentElement.setAttribute('data-bs-theme', theme);
//     // Сохраняем выбор пользователя
//     localStorage.setItem('chat-theme', theme);
//   }, [theme]);

//   useEffect(() => {
//     const saved = localStorage.getItem('chat-theme');
//     if (saved) setTheme(saved);
//   }, []);

//   return <Component {...pageProps} theme={theme} setTheme={setTheme} />;
// }