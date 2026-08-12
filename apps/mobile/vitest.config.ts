import { defineConfig } from 'vitest/config';

/**
 * Tests de la logique **pure** du mobile uniquement.
 *
 * Pas de rendu React Native ici : monter des composants demanderait un
 * environnement natif simulé, pour une valeur faible à ce stade. Ce qui mérite
 * d'être testé maintenant, c'est ce qui contient des règles — le filtre de
 * positions et le moteur de simulation de conduite — et ces modules sont
 * volontairement écrits sans dépendance à React.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
