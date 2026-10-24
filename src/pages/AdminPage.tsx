import React, { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, LogOut, UserPlus, X, KeyRound, Calculator } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { CurrentUser, authApi } from '../utils/authApi';
import { adminApi, ManagedUser, NewUserInput } from '../utils/adminApi';

interface AdminPageProps {
  currentUser: CurrentUser;
  onLogout: () => void;
}

const roleLabel: Record<ManagedUser['role'], string> = {
  ADMIN: 'Administrateur',
  COMPTABLE: 'Comptable',
};

const emptyNewUser: NewUserInput = { email: '', name: '', password: '', role: 'COMPTABLE' };

export const AdminPage: React.FC<AdminPageProps> = ({ currentUser, onLogout }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newUser, setNewUser] = useState<NewUserInput>(emptyNewUser);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = () => {
    adminApi.listUsers()
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setIsLoaded(true));
  };

  useEffect(load, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);
    try {
      const created = await adminApi.createUser(newUser);
      setUsers(prev => [...prev, created]);
      setNewUser(emptyNewUser);
      setIsFormOpen(false);
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, role: ManagedUser['role']) => {
    try {
      const updated = await adminApi.updateRole(userId, role);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    const password = prompt(`Nouveau mot de passe pour "${email}" (8 caractères minimum) :`);
    if (!password) return;
    try {
      await adminApi.resetPassword(userId, password);
      setError(null);
      alert(`Mot de passe de ${email} modifié. Communiquez-le à l'utilisateur.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Supprimer le compte "${email}" ? Cette action est irréversible.`)) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FD]">
      <header className="w-full bg-white border-b border-[#EDE9FE] px-4 lg:px-8 py-3.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo variant="full" />
            <span className="hidden sm:block w-px h-8 bg-[#EDE9FE]" />
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#7024E3]">
              <ShieldCheck className="w-4 h-4" />
              Administration
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Calculator className="w-4 h-4" />
              <span>Espace comptable</span>
            </a>
            <button
              onClick={onLogout}
              className="p-2.5 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] text-[#7024E3] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-black text-[#1E084A]">
              Utilisateurs & Rôles
            </h1>
            <p className="text-sm text-[#7C709A] mt-1">
              Gérez qui a accès à AxeCompta et avec quel niveau de permission.
            </p>
          </div>
          <button
            onClick={() => { setIsFormOpen(v => !v); setCreateError(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#7024E3] hover:bg-[#5B18C4] text-white text-xs font-bold transition-colors shrink-0"
          >
            {isFormOpen ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            <span>{isFormOpen ? 'Annuler' : 'Nouvel utilisateur'}</span>
          </button>
        </div>

        {isFormOpen && (
          <form
            onSubmit={handleCreateUser}
            className="bg-white border border-[#DDD6FE] rounded-2xl shadow-xs p-5 space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#534674] mb-1.5">Nom complet</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-sm p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                  placeholder="Ex. Awa Traoré"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#534674] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-sm p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                  placeholder="nom@exemple.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#534674] mb-1.5">Mot de passe provisoire</label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full text-sm p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                  placeholder="8 caractères minimum"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#534674] mb-1.5">Rôle</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as ManagedUser['role'] }))}
                  className="w-full text-sm p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                >
                  {(Object.keys(roleLabel) as ManagedUser['role'][]).map(r => (
                    <option key={r} value={r}>{roleLabel[r]}</option>
                  ))}
                </select>
              </div>
            </div>

            {createError && (
              <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {createError}
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2.5 bg-[#7024E3] hover:bg-[#5B18C4] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {isCreating ? 'Création…' : 'Créer le compte'}
            </button>
          </form>
        )}

        {error && (
          <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white border border-[#DDD6FE] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#1E084A] text-white uppercase font-mono text-xs">
                  <th className="p-4">Utilisateur</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Entreprise</th>
                  <th className="p-4">Rôle</th>
                  <th className="p-4">Créé le</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE9FE]">
                {!isLoaded && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#7C709A]">Chargement…</td>
                  </tr>
                )}

                {isLoaded && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#7C709A]">Aucun utilisateur.</td>
                  </tr>
                )}

                {users.map(u => {
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-[#F5F3FF] transition-colors">
                      <td className="p-4 font-bold text-[#1E084A]">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-[#EDE9FE] text-[#7024E3] rounded">
                            Vous
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-[#534674] font-mono text-xs">{u.email}</td>
                      <td className="p-4 text-[#534674] text-xs">{u.organizationName ?? '—'}</td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as ManagedUser['role'])}
                          className="text-xs font-bold p-1.5 px-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                        >
                          {(Object.keys(roleLabel) as ManagedUser['role'][]).map(r => (
                            <option key={r} value={r}>{roleLabel[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-[#7C709A] text-xs">
                        {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleResetPassword(u.id, u.email)}
                          className="p-2 rounded-lg text-[#7C709A] hover:bg-[#F5F3FF] hover:text-[#7024E3] transition-all"
                          title="Réinitialiser le mot de passe"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          disabled={isSelf}
                          className="p-2 rounded-lg text-[#7C709A] hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          title={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
