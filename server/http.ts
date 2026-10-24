import type { Request, Response, NextFunction } from 'express';

/** Enveloppe une route asynchrone et délègue toute erreur au gestionnaire centralisé. */
export function handler(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}
