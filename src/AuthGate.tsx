import React, { useEffect, useState } from 'react';
import App from './App';
import { Preload } from './components/Preload';
import { AuthScreen } from './components/auth/AuthScreen';
import { authApi, CurrentUser } from './utils/authApi';

export default function AuthGate() {
  const [status, setStatus] = useState<'checking' | 'guest' | 'authenticated'>('checking');
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    authApi.me()
      .then(u => {
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => setStatus('guest'));
  }, []);

  if (status === 'checking') {
    return <Preload />;
  }

  if (status === 'guest' || !user) {
    return (
      <AuthScreen
        onAuthenticated={(u) => {
          setUser(u);
          setStatus('authenticated');
        }}
      />
    );
  }

  if (user.role === 'ADMIN') {
    window.location.replace('/admin');
    return <Preload />;
  }

  return (
    <App
      currentUser={user}
      onLogout={async () => {
        try {
          await authApi.logout();
        } finally {
          setUser(null);
          setStatus('guest');
        }
      }}
    />
  );
}
