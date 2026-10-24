import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Preload } from './components/Preload';
import { AuthScreen } from './components/auth/AuthScreen';
import { AdminPage } from './pages/AdminPage';
import { authApi, CurrentUser } from './utils/authApi';

export default function AdminGate() {
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

  if (user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-[#F8F7FD] flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-white border border-[#DDD6FE] rounded-2xl shadow-xl p-8 space-y-3">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="font-heading text-lg font-black text-[#1E084A]">Accès refusé</h1>
          <p className="text-sm text-[#7C709A]">
            Cette page est réservée aux administrateurs. Connecté en tant que {user.name} ({user.email}).
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-[#7024E3] hover:bg-[#5B18C4] text-white rounded-xl text-xs font-bold transition-colors"
          >
            Retour à l'application
          </a>
        </div>
      </div>
    );
  }

  return (
    <AdminPage
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
