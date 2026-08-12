// Configuration Metro pour monorepo.
//
// Depuis le SDK 52, `expo/metro-config` détecte le monorepo tout seul : il
// surveille déjà `packages/shared` et résout les dépendances hissées à la racine
// par npm workspaces. La documentation demande explicitement de SUPPRIMER
// `watchFolders`, `resolver.nodeModulesPaths` et `resolver.disableHierarchicalLookup`.
//
// Ne pas les réintroduire : `disableHierarchicalLookup` empêchait Metro de
// remonter l'arborescence, donc de voir les paquets que npm imbrique
// légitimement (`react-native/node_modules/@react-native/virtualized-lists`,
// `expo/node_modules/expo-asset`), et cassait le bundle au build EAS.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
