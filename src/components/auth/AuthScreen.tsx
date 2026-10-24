import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Loader2, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { authApi, CurrentUser } from '../../utils/authApi';

interface AuthScreenProps {
  onAuthenticated: (user: CurrentUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.signup(email, name, password);
      onAuthenticated(user);
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FD] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-[#DDD6FE] rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-8">
          <BrandLogo variant="hero" />
        </div>

        <div className="flex mb-6 bg-[#F5F3FF] rounded-lg p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
              mode === 'login' ? 'bg-white shadow-xs text-[#1E084A]' : 'text-[#7C709A]'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
              mode === 'signup' ? 'bg-white shadow-xs text-[#1E084A]' : 'text-[#7C709A]'
            }`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-bold text-[#534674] mb-1 block">Nom complet</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A78BFA]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#DDD6FE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7024E3]"
                  placeholder="Nathan"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#534674] mb-1 block">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A78BFA]" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#DDD6FE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7024E3]"
                placeholder="vous@exemple.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#534674] mb-1 block">Mot de passe</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A78BFA]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-[#DDD6FE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7024E3]"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A78BFA] hover:text-[#7024E3]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="text-[11px] text-[#7C709A] mt-1">Au moins 8 caractères.</p>
            )}
          </div>

          {error && (
            <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
      </div>
    </div>
  );
};
