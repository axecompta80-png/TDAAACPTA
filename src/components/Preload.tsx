import React from 'react';

/** Écran de démarrage minimal : uniquement le logo, le temps de vérifier la session. */
export const Preload: React.FC = () => (
  <div className="min-h-screen bg-[#F8F7FD] flex items-center justify-center">
    <img
      src="/logo.png"
      alt="AxeCompta"
      className="w-40 h-40 object-contain animate-pulse"
    />
  </div>
);
