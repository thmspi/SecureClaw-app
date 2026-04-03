import './index.css';
import '@fontsource-variable/figtree';
import '@fontsource-variable/geist';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const THEME_STORAGE_KEY = 'secureclaw-theme';

function applyInitialTheme(): void {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    return;
  }
  if (storedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  }
}

applyInitialTheme();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
