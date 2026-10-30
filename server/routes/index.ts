import { Router } from 'express';
import { handler } from '../http';
import recurringRouter from './recurring';
import { buildBootstrapPayload } from './bootstrap';
import dossiersRouter from './dossiers';
import entriesRouter from './entries';
import notificationsRouter from './notifications';
import settingsRouter from './settings';
import backupRouter from './backup';
import accountsRouter from './accounts';
import invoicesRouter from './invoices';

/**
 * Routes applicatives AxeCompta (données comptables).
 *
 * Toutes les mutations sont exposées en POST avec un suffixe descriptif
 * (/update, /delete, /read, /clear...) : aucune méthode PUT, PATCH ou DELETE
 * n'est exposée au client, conformément à la politique de sécurité CORS.
 */
const router = Router();

router.get('/bootstrap', handler(async (req, res) => {
  res.json(await buildBootstrapPayload(req));
}));

router.use(dossiersRouter);
router.use(entriesRouter);
router.use(notificationsRouter);
router.use(settingsRouter);
router.use(backupRouter);
router.use(accountsRouter);
router.use(invoicesRouter);
router.use(recurringRouter);

export default router;
