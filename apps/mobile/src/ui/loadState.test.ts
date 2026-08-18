import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/ApiError';
import { isTerminal, resolveLoadState, stateForError } from './loadState';

const idle = { pending: false, fetching: false, hasData: false } as const;

describe('stateForError', () => {
  it('sépare les quatre familles qui tombaient toutes dans « erreur »', () => {
    expect(stateForError(new ApiError(0, 'NETWORK_ERROR', ''))).toBe('offline');
    expect(stateForError(new ApiError(401, 'UNAUTHORIZED', ''))).toBe('permission_denied');
    expect(stateForError(new ApiError(403, 'FORBIDDEN', ''))).toBe('permission_denied');
    expect(stateForError(new ApiError(404, 'NOT_FOUND', ''))).toBe('not_found');
    expect(stateForError(new ApiError(500, 'INTERNAL_ERROR', ''))).toBe('error');
  });

  it('range ce qui n’est pas une erreur d’API dans « erreur »', () => {
    expect(stateForError(new TypeError('boom'))).toBe('error');
    expect(stateForError('boom')).toBe('error');
  });
});

describe('resolveLoadState', () => {
  it('donne « idle » quand le préalable manque, sans rien peindre', () => {
    expect(resolveLoadState({ ...idle, enabled: false, pending: true })).toBe('idle');
  });

  it('fait passer le démarrage et l’action de l’utilisateur devant tout', () => {
    expect(resolveLoadState({ ...idle, initializing: true, pending: true })).toBe('initializing');
    expect(resolveLoadState({ ...idle, processing: true, hasData: true })).toBe('processing');
  });

  it('distingue première récupération, nouvelle tentative et actualisation', () => {
    expect(resolveLoadState({ pending: true, fetching: true, hasData: false })).toBe('loading');
    expect(
      resolveLoadState({ pending: true, fetching: true, hasData: false, failureCount: 1 }),
    ).toBe('retrying');
    expect(resolveLoadState({ pending: false, fetching: true, hasData: true })).toBe('refreshing');
  });

  it('sépare le vide du succès', () => {
    expect(resolveLoadState({ ...idle, hasData: true, empty: true })).toBe('empty');
    expect(resolveLoadState({ ...idle, hasData: true })).toBe('success');
  });

  /**
   * La règle la moins évidente, et la plus importante au bord d'une route :
   * une liste de garages vieille de deux minutes vaut mieux qu'une page
   * d'erreur. L'échec se dit par le bandeau global, pas en effaçant l'écran.
   */
  it('ne remplace pas des données déjà là par une page d’erreur', () => {
    const error = new ApiError(0, 'NETWORK_ERROR', '');
    expect(resolveLoadState({ ...idle, error, hasData: true })).toBe('success');
    expect(resolveLoadState({ ...idle, error, hasData: false })).toBe('offline');
  });
});

describe('isTerminal', () => {
  it('ne compte comme terminal que ce qui remplace le contenu', () => {
    for (const state of ['empty', 'error', 'offline', 'permission_denied', 'not_found'] as const) {
      expect(isTerminal(state)).toBe(true);
    }
    for (const state of ['idle', 'loading', 'refreshing', 'retrying', 'success'] as const) {
      expect(isTerminal(state)).toBe(false);
    }
  });
});
