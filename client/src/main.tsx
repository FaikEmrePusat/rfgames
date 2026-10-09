import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './theme/themes.css';
import { ThemeProvider } from './theme/ThemeContext';
import { applyThemeAttribute, readStoredTheme } from './theme/themes';

applyThemeAttribute(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
