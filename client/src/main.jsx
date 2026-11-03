import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AppProvider } from './state/AppState.jsx';
import { I18nProvider } from './i18n/index.jsx';
import App from './App.jsx';
import './styles/global.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/experiences.css';
import './styles/intro-music.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <I18nProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </I18nProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);
