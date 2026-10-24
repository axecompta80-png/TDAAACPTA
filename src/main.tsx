import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AuthGate from './AuthGate.tsx';
import AdminGate from './AdminGate.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';
import { initDeviceNotifications } from './utils/deviceNotify';

initDeviceNotifications();

// Pas de routeur pour une seule page dédiée : /admin affiche la gestion des
// utilisateurs, tout le reste affiche l'application normale.
const isAdminRoute = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {isAdminRoute ? <AdminGate /> : <AuthGate />}
    </ThemeProvider>
  </StrictMode>,
);
