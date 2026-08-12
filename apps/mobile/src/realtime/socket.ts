import { io, type Socket } from 'socket.io-client';
import { EMISSION, haversineMeters, SOCKET_EVENTS, type Position } from '@geocras/shared';
import { env } from '../config/env';
import { getCachedAccessToken, loadTokens } from '../api/tokens';

/**
 * Connexion temps réel.
 *
 * Une seule instance pour toute l'app : ouvrir un socket par écran multiplierait
 * les reconnexions sur un réseau instable, et chaque poignée de main coûte des
 * données mobiles.
 */
let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = getCachedAccessToken() ?? (await loadTokens())?.accessToken ?? null;

  socket ??= io(env.apiUrl, {
    autoConnect: false,
    // Le repli long-polling n'est pas un confort : sur une 2G camerounaise,
    // c'est souvent le seul transport qui s'établit.
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    // Illimité : une coupure de tunnel ou de réseau ne doit pas condamner le
    // suivi d'une intervention en cours.
    reconnectionAttempts: Infinity,
    auth: { token },
  });

  // Le jeton peut avoir été rafraîchi depuis la création de l'instance.
  socket.auth = { token };

  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

/**
 * Émetteur de position throttlé.
 *
 * Deux garde-fous cumulés : un intervalle minimal ET un seuil de distance. Un
 * appareil immobile n'émet rien du tout — inutile de consommer un forfait pour
 * répéter la même coordonnée. Un ping pèse environ 120 octets ; vingt minutes
 * d'intervention coûtent ainsi une trentaine de kilo-octets.
 */
export class PositionEmitter {
  private lastSentAt = 0;
  private lastPosition: { lat: number; lng: number } | null = null;

  constructor(private readonly requestId: string) {}

  /** Renvoie `true` si la position a effectivement été émise. */
  async maybeEmit(position: Position): Promise<boolean> {
    const now = Date.now();

    if (now - this.lastSentAt < EMISSION.throttleMs) return false;

    if (this.lastPosition) {
      const moved = haversineMeters(this.lastPosition, {
        lat: position.lat,
        lng: position.lng,
      });
      if (moved < EMISSION.minMoveMeters) return false;
    }

    const connection = await getSocket();
    if (!connection.connected) return false;

    connection.emit(SOCKET_EVENTS.position, { requestId: this.requestId, position });
    this.lastSentAt = now;
    this.lastPosition = { lat: position.lat, lng: position.lng };
    return true;
  }

  reset(): void {
    this.lastSentAt = 0;
    this.lastPosition = null;
  }
}
