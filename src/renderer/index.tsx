import './index.css';
import '@fontsource-variable/figtree';
import '@fontsource-variable/geist';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { WizardPage } from './pages/wizard/WizardPage';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <WizardPage />
    </React.StrictMode>
  );
}
