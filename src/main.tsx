import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// Provider order: Router (outermost — Auth's redirects need it) → Theme (drives
// the `dark` class) → Toast (so any child can raise notifications) → Auth.
// Deep links depend on the server rewriting unknown paths to index.html: nginx
// already does this (`try_files ... /index.html`), and Vite's dev server does it
// by default.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
