import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'geocras.trustedContacts';

/**
 * Plafond volontaire.
 *
 * Trois numéros, c'est le conjoint, un frère, un ami. Au-delà, prévenir « ses
 * contacts » devient une liste de diffusion qu'on ne relit jamais, et le SMS
 * groupé arrive à des gens qui ne peuvent rien faire.
 */
export const MAX_TRUSTED_CONTACTS = 3;

export type TrustedContact = {
  id: string;
  name: string;
  /** Numéro complet, indicatif compris. */
  phone: string;
};

/**
 * Contacts à prévenir en cas de panne.
 *
 * **Ils ne quittent jamais l'appareil.** C'est un choix, pas une facilité : la
 * liste des proches de quelqu'un n'a aucune raison d'exister sur nos serveurs,
 * elle ne sert qu'à composer un SMS depuis ce téléphone-ci. Rien à fuiter, rien
 * à supprimer côté serveur le jour où le compte l'est.
 *
 * `SecureStore` plutôt qu'`AsyncStorage` : le contenu est chiffré par le
 * trousseau du système. Des numéros de famille méritent au moins autant de soin
 * qu'un jeton d'accès.
 *
 * Conséquence assumée : la liste est propre à l'appareil et ne suit pas
 * l'utilisateur d'un téléphone à l'autre. Elle se refait en trente secondes ;
 * l'inverse aurait coûté un carnet d'adresses hébergé.
 */
async function read(): Promise<TrustedContact[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filtrage défensif : un stockage écrit par une version antérieure ne doit
    // pas faire tomber l'écran de sécurité, qui est justement celui qu'on ouvre
    // quand quelque chose ne va pas.
    return parsed.filter(
      (item): item is TrustedContact =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as TrustedContact).id === 'string' &&
        typeof (item as TrustedContact).name === 'string' &&
        typeof (item as TrustedContact).phone === 'string',
    );
  } catch {
    return [];
  }
}

async function write(contacts: TrustedContact[]): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(contacts));
}

/**
 * Identifiant local.
 *
 * `Date.now()` suffit : ces identifiants ne servent qu'à distinguer trois
 * lignes dans une liste locale, jamais à référencer quoi que ce soit ailleurs.
 */
function nextId(): string {
  return `c${Date.now().toString(36)}`;
}

export type TrustedContactsState = {
  contacts: TrustedContact[];
  loading: boolean;
  add: (contact: Omit<TrustedContact, 'id'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useTrustedContacts(): TrustedContactsState {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void read().then((stored) => {
      if (cancelled) return;
      setContacts(stored);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(async (contact: Omit<TrustedContact, 'id'>) => {
    const next = await read();
    if (next.length >= MAX_TRUSTED_CONTACTS) return;

    const updated = [...next, { ...contact, id: nextId() }];
    await write(updated);
    setContacts(updated);
  }, []);

  const remove = useCallback(async (id: string) => {
    const updated = (await read()).filter((contact) => contact.id !== id);
    await write(updated);
    setContacts(updated);
  }, []);

  return { contacts, loading, add, remove };
}

/**
 * Lien de position lisible par n'importe quel téléphone.
 *
 * Un lien Google Maps et non une page à nous : le destinataire n'a pas
 * l'application, et souvent pas de forfait data au moment où il reçoit le
 * message. Ce format s'ouvre dans toutes les applications de carte du marché,
 * et se lit encore à voix haute s'il n'a rien de tout ça.
 */
export function positionLink(position: { lat: number; lng: number }): string {
  return `https://maps.google.com/?q=${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
}
