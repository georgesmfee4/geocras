import { EventEmitter } from 'node:events';
import type { PartyRole, RequestEventType } from '@geocras/shared';

/**
 * Bus interne entre la logique métier et la couche temps réel.
 *
 * Les services ne connaissent pas Socket.io : ils publient un fait, la couche
 * realtime décide quoi en diffuser. Sans cette indirection, `requests.service`
 * importerait le serveur socket, qui importe l'app, qui importe les routes, qui
 * importent le service — une dépendance circulaire, et un service impossible à
 * tester sans démarrer un serveur.
 */
export type RequestChangedEvent = {
  requestId: string;
  seq: number;
  type: RequestEventType;
  actorRole: PartyRole | null;
};

export type PositionReceivedEvent = {
  requestId: string;
};

type Events = {
  'request:changed': [RequestChangedEvent];
  'request:position': [PositionReceivedEvent];
};

class TypedBus extends EventEmitter {
  override emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
}

export const bus = new TypedBus();
