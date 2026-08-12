import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { closeDatabase } from './db/client';
import { logger } from './lib/logger';
import { attachRealtime } from './realtime/io';
import { confirmMaturedCredits } from './modules/loyalty/loyalty.service';
import { UPLOAD_PRESET, uploadsConfigured } from './modules/uploads/uploads.service';

const app = createApp();
const httpServer = createServer(app);
const io = attachRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`API GeoCras à l'écoute sur le port ${env.PORT} (${env.NODE_ENV})`);

  // Dit au démarrage ce qui manque, plutôt que de laisser un utilisateur le
  // découvrir au moment où il joint une photo à un SOS.
  if (!uploadsConfigured()) {
    logger.warn(
      `Photos DÉSACTIVÉES : CLOUDINARY_* absentes de .env. Les demandes SOS partiront sans image. ` +
        `Renseigner les clés ET créer le preset « ${UPLOAD_PRESET} » (mode : Signed) côté Cloudinary.`,
    );
  }
});

/**
 * Maturation des crédits de fidélité.
 *
 * Un intervalle interne suffit tant qu'il n'y a qu'une instance. Dès qu'on
 * passe à plusieurs, ce travail devra migrer vers une tâche planifiée unique
 * (sinon chaque instance le rejoue) — l'idempotence du `UPDATE` le rend sûr,
 * mais ce serait du gaspillage.
 */
const MATURATION_INTERVAL_MS = 15 * 60 * 1000;

const maturationTimer = setInterval(() => {
  void confirmMaturedCredits()
    .then((count) => {
      if (count > 0) logger.info(`${count} crédit(s) de fidélité confirmé(s)`);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Échec de la maturation des crédits');
    });
}, MATURATION_INTERVAL_MS);

maturationTimer.unref();

/**
 * Arrêt propre : on cesse d'accepter des connexions, on laisse les requêtes en
 * vol se terminer, puis on ferme le pool. Sans ça, un redéploiement coupe une
 * demande SOS en cours d'écriture.
 */
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} reçu, arrêt en cours…`);
  clearInterval(maturationTimer);

  const forceExit = setTimeout(() => {
    logger.error('Arrêt forcé après 10 s');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
    await closeDatabase();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Échec de l'arrêt propre");
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
