// Source du point d'entrée serverless Vercel pour l'API AxeCompta.
//
// Ce fichier n'est jamais déployé tel quel : `npm run build:vercel-api` le
// bundle avec esbuild vers api/index.js (un unique fichier JS autonome,
// dépendances locales inlinées, packages npm externalisés, format ESM car
// package.json déclare "type": "module"). On évite ainsi de dépendre du
// bundler interne de Vercel, qui ne parvenait pas à résoudre les imports
// locaux (`Cannot find module '/var/task/server/app'`) — que ce soit via un
// import statique ou dynamique, avec ou sans `functions.includeFiles`.
// Le même principe est déjà utilisé pour l'hébergement Node classique
// (server.ts → dist/server.cjs).
//
// IMPORTANT : api/index.js est COMMITÉ (pas un artefact ignoré comme dist/) —
// Vercel détecte les fonctions serverless sur les fichiers du dépôt tels
// qu'ils existent AVANT l'exécution de buildCommand, donc un fichier généré
// mais absent de git n'est jamais reconnu comme une fonction à déployer.
// ⚠️ Après toute modification de server/app.ts (ou de ce fichier), relancer
// `npm run build:vercel-api` et committer le nouveau api/index.js.
import type { IncomingMessage, ServerResponse } from 'http';
import { app, ensureSeeded } from './app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await ensureSeeded();
    app(req as any, res as any);
  } catch (e: any) {
    console.error('[AxeCompta] Erreur non interceptée dans la fonction serverless :', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'Erreur interne du serveur.' }));
    }
  }
}
