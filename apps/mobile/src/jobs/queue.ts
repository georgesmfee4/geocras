import { compareIncomingJobs, URGENCY_RANK, type Job, type UrgencyLevel } from '@geocras/shared';

/**
 * Ce que la file **dit** au garagiste, avant qu'il ait lu une seule ligne.
 *
 * Trois questions, trois fonctions, et aucune d'elles ne connaît React : c'est
 * ce qui les rend vérifiables dans un projet qui ne monte volontairement aucun
 * composant. Le poste de travail les pose dans cet ordre — laquelle d'abord,
 * qui attend depuis le plus longtemps, de quoi la file est faite — et l'écran
 * ne fait plus que peindre les réponses.
 *
 * Aucune ne trie une copie du tableau : la file arrive par socket plusieurs
 * fois par minute, et allouer trois tableaux triés à chaque poussée pour n'en
 * lire qu'un élément se paierait au défilement sur un Android d'entrée de
 * gamme.
 */

/**
 * L'instant d'où part le compteur d'attente.
 *
 * `selectedAt` — l'instant où le client a retenu **ce** garage — et non
 * `createdAt` : une demande peut avoir traîné dix minutes chez un confrère qui
 * l'a déclinée, ce n'est pas l'attente de celui qui la reçoit maintenant. Le
 * repli sur `createdAt` couvre le cas où le serveur n'a pas encore horodaté la
 * sélection.
 */
export function waitStartedAt(job: Pick<Job, 'selectedAt' | 'createdAt'>): string {
  return job.selectedAt ?? job.createdAt;
}

/**
 * La demande à traiter en premier.
 *
 * Le comparateur vient du contrat partagé : le serveur ordonne la file avec le
 * même, et une seconde règle écrite ici ferait désigner deux demandes
 * différentes selon qu'on regarde le poste de travail ou la liste SOS.
 */
export function firstToHandle(incoming: readonly Job[]): Job | null {
  let first: Job | null = null;
  for (const job of incoming) {
    if (first === null || compareIncomingJobs(job, first) < 0) first = job;
  }
  return first;
}

/**
 * Le début d'attente le plus ancien de la file, en ISO — `null` si la file est
 * vide ou si aucun horodatage n'est lisible.
 *
 * Ce n'est **pas** forcément l'attente de `firstToHandle` : un danger déclaré
 * il y a trente secondes passe devant une panne sèche qui patiente depuis dix
 * minutes. Les deux chiffres racontent deux choses, et le poste de travail
 * montre le second — c'est celui qui dit si le garage tient son rythme.
 */
export function longestWaitStart(incoming: readonly Job[]): string | null {
  let oldestIso: string | null = null;
  let oldestMs = Number.POSITIVE_INFINITY;

  for (const job of incoming) {
    const iso = waitStartedAt(job);
    const ms = Date.parse(iso);
    if (Number.isNaN(ms) || ms >= oldestMs) continue;
    oldestIso = iso;
    oldestMs = ms;
  }

  return oldestIso;
}

/** Une tranche de la file : un niveau d'urgence et la place qu'il y occupe. */
export type QueueSegment = {
  urgency: UrgencyLevel;
  count: number;
  /** Part de la file, entre 0 et 1. Les tranches somment à 1. */
  share: number;
};

/**
 * De quoi la file est faite, du plus grave au plus léger.
 *
 * Sert la jauge posée au bord bas du panneau SOS : trois demandes dont un
 * danger et deux qui peuvent attendre, ce n'est pas la même journée que trois
 * dangers, et le chiffre seul ne le dit pas.
 *
 * Les niveaux absents ne produisent pas de tranche vide : une jauge qui
 * réserverait un tiers de sa largeur à zéro demande mentirait sur la
 * proportion, qui est tout ce qu'elle a à dire.
 */
export function queueMix(incoming: readonly Job[]): QueueSegment[] {
  const total = incoming.length;
  if (total === 0) return [];

  const counts = new Map<UrgencyLevel, number>();
  for (const job of incoming) counts.set(job.urgency, (counts.get(job.urgency) ?? 0) + 1);

  return [...counts.entries()]
    .sort(([a], [b]) => URGENCY_RANK[a] - URGENCY_RANK[b])
    .map(([urgency, count]) => ({ urgency, count, share: count / total }));
}
