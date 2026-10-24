// Entrée pour un hébergement Node classique (dev local avec Vite en middleware,
// ou `node dist/server.cjs` en production sur un serveur/PaaS qui écoute un port).
// Sur Vercel, c'est `api/index.ts` qui sert de point d'entrée à la place de ce fichier
// (fonction serverless, sans app.listen ; le dossier `dist/` est servi par le CDN Vercel).
import path from 'path';
import express from 'express';
import { app, ensureSeeded } from './server/app';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  await ensureSeeded();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AxeCompta] Serveur actif sur http://0.0.0.0:${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();
