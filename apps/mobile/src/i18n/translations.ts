import type { ErrorCode } from '@geocras/shared';

/**
 * Traductions.
 *
 * Français par défaut, anglais prévu. Le dictionnaire anglais est **complet dès
 * maintenant** : ajouter une langue plus tard en ayant laissé des trous, c'est
 * découvrir les manques en production.
 *
 * Les libellés métier (pannes, véhicules, urgence, alertes) ne sont PAS ici :
 * ils vivent dans `@geocras/shared`, avec les codes qu'ils décrivent, pour que
 * le serveur puisse les utiliser aussi.
 */
export const translations = {
  fr: {
    'tab.map': 'Carte',
    'tab.driving': 'Conduite',
    'tab.jobs': 'Interventions',

    'drawer.security': 'Sécurité',
    'drawer.support': 'Assistance',
    'drawer.settings': 'Paramètres',
    'drawer.history': 'Historique',
    'drawer.logout': 'Déconnexion',
    'drawer.account': 'Mon compte',
    'drawer.guest': 'Mode invité',
    // Ce qu'on perd sans compte, dans l'ordre où on le perd : le SOS d'abord,
    // qui est la raison d'être de l'app.
    'drawer.guestLead':
      'Vous naviguez actuellement comme invité. Connectez-vous pour lancer un SOS, suivre vos interventions et cumuler vos points.',
    'drawer.login': 'Se connecter',
    'drawer.notSignedIn': 'non connecté',
    'drawer.hello': 'Bonjour',
    'drawer.manageAccount': 'Gérer mon compte GEOCRAS',
    'drawer.more': 'Plus dans GeoCras',
    'drawer.startDriving': 'Activer le mode conduite',
    'drawer.beta': 'Bêta',
    'drawer.loyalty': 'Ma fidélité',
    'drawer.privacy': 'Règles de confidentialité',
    'drawer.terms': 'Conditions d’utilisation',

    // Descriptions des entrées de menu : ce que la page contient, pas une
    // reformulation du libellé. « Sécurité » ne dit pas ce qu'on y règle.
    'drawer.historyHint': 'Vos demandes passées et en cours',
    'drawer.loyaltyHint': 'Vos points, vos grades et vos badges',
    'drawer.securityHint': 'Contacts de confiance et appareils connectés',
    'drawer.settingsHint': 'Apparence, langue, notifications, rayon',

    // La déconnexion se confirme : elle est réversible, mais elle coupe le
    // suivi d'une intervention en cours, et on la déclenche du pouce en
    // refermant le tiroir.
    'drawer.logoutTitle': 'Se déconnecter ?',
    'drawer.logoutBody':
      'Il faudra vous reconnecter pour retrouver vos demandes, vos points et vos véhicules.',
    'drawer.logoutConfirm': 'Se déconnecter',

    'account.title': 'Gérer mon compte',
    'account.identity': 'Mes informations',
    'account.photoRemove': 'Retirer la photo',
    'account.photoFailed': 'La photo n’a pas pu être envoyée',
    'account.photoPermission': 'Autorisez l’accès aux photos pour en choisir une.',
    'account.photoTake': 'Prendre une photo',
    'account.photoChoose': 'Choisir une photo',
    'account.photoChooseMany': 'Choisir des photos',
    'account.fullName': 'Nom complet',
    'account.email': 'Adresse e-mail',
    'account.emailPlaceholder': 'Facultative',
    'account.emailInvalid': 'Adresse e-mail invalide',
    'account.phone': 'Numéro de téléphone',
    'account.phoneHint': 'C’est avec lui que vous vous connectez, et que le garagiste vous rappelle.',
    'account.phoneIncomplete': 'Neuf chiffres attendus après +237',
    'account.phoneChangeTitle': 'Changement de numéro',
    'account.phoneChangeBody':
      'Nous transférerons tout votre historique — interventions, avis, points de fidélité — vers ce nouveau numéro. Le transfert peut prendre plusieurs minutes.',
    'account.phoneChangedTitle': 'Nouveau numéro enregistré',
    'account.phoneChangedBody':
      'Connectez-vous désormais avec ce numéro. Le transfert de votre historique est en cours et peut prendre plusieurs minutes.',
    'account.saved': 'Enregistré',
    'account.activity': 'Mon activité',
    'account.becomeGarage': 'Devenir garagiste',
    'account.becomeGarageHint': 'Inscrire mon garage et recevoir les SOS',
    'account.myGarage': 'Mon garage',
    'account.session': 'Session',
    'account.logoutTitle': 'Se déconnecter ?',
    'account.logoutBody':
      'Vous devrez saisir votre numéro et votre mot de passe pour revenir.',
    'account.delete': 'Supprimer mon compte',
    'account.deleteHint': 'Définitif, sans retour possible',
    'account.deleteTitle': 'Supprimer définitivement ?',
    'account.deleteBody':
      'Votre historique d’interventions, vos avis et vos points de fidélité seront effacés. Cette action ne peut pas être annulée.',
    'account.deleteConfirm': 'Supprimer',

    'myGarage.title': 'Mon garage',
    'myGarage.detection': 'Détection',
    'myGarage.detectionLabel': 'Visible pour les SOS',
    'myGarage.detectionOnHint':
      'Votre garage remonte dans les recherches des conducteurs en panne autour de vous.',
    'myGarage.detectionOffHint':
      'Détection fermée : votre garage n’apparaît dans aucune recherche. Rouvrez-la quand vous reprenez le travail.',
    'myGarage.closedBanner': 'Détection fermée',
    'myGarage.certified': 'Garage certifié',
    'myGarage.notCertifiedHint':
      'La certification est accordée par GeoCras après vérification sur place.',
    'myGarage.publicPage': 'Voir ma fiche publique',
    'myGarage.services': 'Compétences déclarées',
    'myGarage.contact': 'Contact',
    'myGarage.noRating': 'Pas encore noté',
    'myGarage.none': 'Aucun garage rattaché à ce compte',
    'myGarage.pendingBadge': 'En vérification',
    'myGarage.pendingTitle': 'Dossier en cours de vérification',
    'myGarage.pendingBody':
      'Nous contrôlons les informations transmises. Votre garage n’apparaît dans aucune recherche tant que ce contrôle n’est pas terminé. Nous vous écrivons ou vous appelons dès qu’il l’est.',
    'myGarage.editDossier': 'Modifier ma demande',
    'myGarage.withdrawDossier': 'Retirer ma demande',
    'myGarage.withdrawHint': 'Le dossier est supprimé, le compte redevient client',
    'myGarage.withdrawTitle': 'Retirer votre demande ?',
    'myGarage.withdrawBody':
      'Le dossier envoyé sera supprimé et votre compte redeviendra un compte client. Vous pourrez en déposer un nouveau plus tard.',
    'myGarage.withdrawConfirm': 'Retirer',

    'hours.modeClosed': 'Fermé',
    'hours.modeOpen': 'Ouvert',
    'hours.mode24h': '24h',
    'hours.from': 'ouverture',
    'hours.to': 'fermeture',
    'hours.hourColumn': 'Heure',
    'hours.minuteColumn': 'Minute',
    'hours.confirm': 'Valider',
    'hours.copyWeekdays': 'Copier lun–ven',
    'hours.copyWeekdaysA11y': 'Appliquer les horaires du lundi du lundi au vendredi',
    'hours.copyWeek': 'Copier 7 jours',
    'hours.copyWeekA11y': 'Appliquer les horaires du lundi à toute la semaine',

    'becomeGarage.title': 'Devenir garagiste',
    'becomeGarage.lead':
      'Inscrivez votre atelier pour recevoir les SOS des conducteurs en panne autour de vous.',
    'becomeGarage.reviewTitle': 'Votre dossier sera vérifié',
    'becomeGarage.reviewBody':
      'Nous contrôlons chaque garage avant de le rendre visible : existence de l’atelier, exactitude de l’adresse, numéro qui répond. Renseignez donc un téléphone et un e-mail que vous consultez — c’est par là que nous vous contacterons après validation.',
    'becomeGarage.sectionGarage': 'Le garage',
    'becomeGarage.sectionContact': 'Vous joindre',
    'becomeGarage.sectionPlace': 'Où vous trouver',
    'becomeGarage.name': 'Nom du garage',
    'becomeGarage.namePlaceholder': 'Garage Central',
    'becomeGarage.description': 'Description',
    'becomeGarage.descriptionPlaceholder':
      'Atelier mécanique générale, dépannage sur place et remorquage.',
    'becomeGarage.descriptionHint': 'Visible sur votre fiche. 400 caractères au plus.',
    'becomeGarage.years': 'Années d’activité',
    'becomeGarage.yearsHint': 'Depuis combien d’années l’atelier tourne.',
    'becomeGarage.phone': 'Numéro à appeler',
    'becomeGarage.phoneHint':
      'C’est le numéro que composera le client, et celui que nous appellerons pour vérifier.',
    'becomeGarage.email': 'Adresse e-mail',
    'becomeGarage.emailHint': 'Obligatoire : la réponse à votre demande y sera envoyée.',
    'becomeGarage.quarter': 'Quartier',
    'becomeGarage.quarterPlaceholder': 'Bastos',
    'becomeGarage.address': 'Repère ou adresse',
    'becomeGarage.addressPlaceholder': 'En face de la station-service',
    'becomeGarage.addressHint':
      'Le repère que vous donnez au téléphone à quelqu’un qui vous cherche.',
    'becomeGarage.services': 'Vos compétences',
    'becomeGarage.servicesHint':
      'Elles décident des SOS qui vous sont proposés. Au moins une.',
    'becomeGarage.hours': 'Horaires d’ouverture',
    'becomeGarage.hoursHint':
      'Pour chaque jour : fermé, ouvert sur une plage, ou ouvert 24h. Réglez le lundi puis recopiez-le.',
    'becomeGarage.photos': 'Photos de l’atelier',
    'becomeGarage.photoAdd': 'Ajouter',
    'becomeGarage.photosHint':
      'Facultatives, mais un atelier qu’on a vu inspire davantage confiance. Vous pouvez en choisir plusieurs à la fois, six au maximum.',
    'becomeGarage.positionTitle': 'Placez-vous dans le garage',
    'becomeGarage.positionBody':
      'La position est relevée par GPS au moment de l’envoi, et c’est elle qui décidera des SOS qui vous seront proposés. Envoyez votre demande depuis l’atelier lui-même, pas de chez vous.',
    'becomeGarage.positionMissing':
      'Position indisponible. Activez la localisation pour inscrire votre garage.',
    'becomeGarage.positionCoarse':
      'Position imprécise. Sortez à l’air libre quelques secondes avant d’envoyer.',
    'becomeGarage.submit': 'Envoyer ma demande',
    'becomeGarage.submitHint':
      'Nous revenons vers vous après vérification, par téléphone ou par e-mail.',

    'becomeGarage.editTitle': 'Modifier ma demande',
    'becomeGarage.editLead':
      'Corrigez ce qui doit l’être : votre dossier est encore à l’étude.',
    'becomeGarage.editNoticeTitle': 'Dossier encore à l’étude',
    'becomeGarage.editNoticeBody':
      'Vos corrections repartent avec le dossier. Une fois le garage vérifié, ces informations ne se modifient plus depuis l’application.',
    'becomeGarage.saveEdit': 'Enregistrer les modifications',
    'becomeGarage.saveEditHint':
      'La vérification se poursuit sur les informations corrigées.',
    'becomeGarage.positionEditBody':
      'La position enregistrée est conservée. Ne la remplacez que depuis l’atelier lui-même : c’est elle qui décidera des SOS qui vous seront proposés.',
    'becomeGarage.positionSaved': 'Position enregistrée avec le dossier',
    'becomeGarage.positionUpdate': 'Relever ma position ici',
    'becomeGarage.positionUnavailable':
      'Position indisponible : le garage ne peut pas être déplacé pour l’instant.',
    'becomeGarage.positionRestore': 'Revenir à la position enregistrée',
    'becomeGarage.editMissing': 'Aucun dossier à modifier sur ce compte.',
    'becomeGarage.editLocked':
      'Votre garage est déjà vérifié : son dossier ne se modifie plus depuis l’application.',

    'auth.loginTitle': 'Connexion',
    'auth.signupTitle': 'Créer un compte',
    // Une ligne, pas une phrase : ces deux libellés vivent sous le titre du
    // bandeau, en capitales mono. Ce qu'ils disaient en long — pourquoi le
    // compte est exigé avant un SOS — est déjà dit par 'auth.requiredLead',
    // sur l'écran qui renvoie ici.
    'auth.loginLead': 'Votre numéro vous identifie',
    'auth.signupLead': 'Nécessaire pour lancer un SOS',
    'auth.fullName': 'Nom complet',
    'auth.fullNamePlaceholder': 'Jean Djomo',
    'auth.phone': 'Numéro de téléphone',
    'auth.password': 'Mot de passe',
    'auth.passwordPlaceholder': '••••••••',
    // Sans point final : l'aide sous le champ est rendue en capitales, où la
    // ponctuation de fin ne se lit plus comme une phrase mais comme une tache.
    'auth.passwordHint': '8 caractères minimum',
    'auth.login': 'Se connecter',
    'auth.signup': 'Créer mon compte',
    // La question et l'action sont séparées : la première est du texte discret,
    // la seconde le lien rouge sur lequel on appuie. Une seule chaîne les
    // condamnerait à la même couleur.
    'auth.noAccount': 'Pas encore de compte ?',
    'auth.hasAccount': 'Déjà inscrit ?',
    'auth.legalPrefix': 'En continuant, vous acceptez les',
    'auth.legalTerms': 'conditions d’utilisation',
    'auth.showPassword': 'Afficher le mot de passe',
    'auth.hidePassword': 'Masquer le mot de passe',
    'auth.required': 'Connexion requise',
    'auth.requiredLead':
      'Le SOS engage un garagiste qui se déplace vers vous. Il doit pouvoir vous identifier et vous rappeler — un compte est donc nécessaire.',

    'splash.acquiring': 'acquisition GPS…',
    'splash.tagline': 'Un garage proche, en un geste',
    'location.unavailable': 'Position indisponible',
    'location.retry': 'Réessayer',
    'location.denied': 'Autorisez la localisation pour trouver un garage',

    'map.searchPlaceholder': 'Rechercher un garage',
    'map.openGarages': 'garages ouverts autour de vous',
    'map.openGarages.one': 'garage ouvert autour de vous',
    'map.garagesAround': 'garages autour de vous',
    'map.garagesAround.one': 'garage autour de vous',
    'map.filterCertified': 'Certifiés',
    'map.filterOpen': 'Ouverts',
    'map.filterTowing': 'Remorquage',
    'map.exactPosition': 'Position exacte',
    'map.openMenu': 'Ouvrir le menu',
    'map.recenter': 'Recentrer sur ma position',
    'map.following': 'La carte suit votre position',
    'map.tiltFlat': 'Vue à plat',
    'map.tiltTilted': 'Vue inclinée',
    'map.searching': 'Recherche des garages…',
    'map.loadFailed': 'Garages indisponibles',
    'map.noneInRadius': 'Aucun garage dans ce rayon',
    'map.noneInRadiusLead': 'Nous n’avons trouvé aucun garage à moins de',
    'map.acquiring': 'Acquisition de votre position…',

    'sos.title': 'SOS — Trouver un garage',
    'sos.subtitle': 'Position envoyée automatiquement',
    'sos.declare': 'Signaler une panne',
    'sos.vehicleType': 'Type de véhicule',
    'sos.savedVehiclesHint':
      'Choisissez un véhicule enregistré, ou décrivez celui que vous conduisez aujourd’hui.',
    'sos.otherVehicle': 'Un autre véhicule',
    'sos.otherVehicleHint': 'Non enregistré — à décrire',
    'sos.problemType': 'Nature de la panne',
    'sos.autoSort': 'tri auto',
    'sos.details': 'Précisions',
    'sos.submit': 'Lancer la recherche SOS',

    // — Étape 1 : accueil et consentement —
    'sos.service': 'Service SOS',
    'sos.welcomeTitle': 'Assistance en cas de panne',
    'sos.welcomeLead':
      'Vous êtes sur le point de signaler une panne. Nous cherchons les garages capables de la traiter autour de vous et vous les proposons classés.',
    'sos.pointPosition': 'Votre position exacte est partagée',
    'sos.pointPositionHint':
      'Elle est transmise au garage que vous choisirez, et à lui seul, le temps de l’intervention.',
    'sos.pointVisible': 'Ce que le garage voit',
    'sos.pointVisibleHint':
      'Votre véhicule, la nature de la panne, vos précisions et votre photo. Votre numéro n’apparaît qu’après acceptation.',
    'sos.pointData': 'Traitement de vos données',
    'sos.pointDataHint':
      'Position, demande et échanges sont conservés pour le suivi de l’intervention et la lutte contre la fraude. Vous pouvez demander leur suppression.',
    'sos.pointSingle': 'Une seule demande à la fois',
    'sos.pointSingleHint':
      'Terminez ou annulez la demande en cours avant d’en ouvrir une autre.',
    'sos.emergencyNote':
      'En cas de blessé ou de danger immédiat, appelez d’abord les secours. GeoCras n’est pas un service d’urgence médicale.',
    'sos.consent': 'J’accepte le partage de ma position et le traitement de mes données',
    'sos.consentRequired': 'Cochez la case pour continuer',
    'sos.start': 'Commencer',
    'sos.cancel': 'Annuler',

    // — Étape 2 : description —
    'sos.describeTitle': 'Décrivez la panne',
    'sos.vehicleOtherLabel': 'Précisez le véhicule',
    'sos.vehicleOtherPlaceholder': 'Tricycle, minibus, engin…',
    'sos.problemOtherLabel': 'Décrivez la panne',
    'sos.detailsPlaceholder': 'Aucun bruit au contact, les phares faiblissent…',
    'sos.problemOtherPlaceholder': 'Ce qui se passe, depuis quand, ce que vous avez essayé…',
    'sos.urgency': 'Niveau d’urgence',
    'sos.immobilized': 'Véhicule immobilisé',
    'sos.immobilizedHint': 'Détermine si un remorquage est nécessaire.',
    'sos.vulnerable': 'Enfant, personne âgée ou blessée à bord',
    'sos.vulnerableHint': 'Le garage priorise ces interventions.',
    'sos.photo': 'Photo de la panne',
    'sos.photoOptional': 'Facultatif — aide le garage à venir équipé.',
    'sos.photoTake': 'Prendre',
    'sos.photoChoose': 'Choisir',
    'sos.photoAttached': 'Photo jointe',
    'sos.photoRemove': 'Retirer la photo',
    'sos.photoPermission': 'Autorisation refusée.',
    'sos.photoFailed': 'Impossible d’ouvrir la photo.',
    'sos.checkingActive': 'Recherche d’une demande en cours',
    'sos.checkingActiveLead':
      'Nous vérifions si vous avez déjà un SOS ouvert, pour le reprendre là où vous l’aviez laissé.',
    'sos.resumeTitle': 'Demande en cours',
    'sos.photoUploading': 'Envoi en cours…',
    'sos.photoReady': 'Prête à être envoyée',
    'sos.photoUnavailable': 'Envoi impossible — la demande partira sans la photo.',
    'sos.photoNotConfigured':
      "Les photos ne sont pas encore activées sur le serveur. La demande partira sans l'image.",
    'sos.continue': 'Continuer',

    // — Étape 3 : récapitulatif —
    'sos.reviewTitle': 'Vérifiez et envoyez',
    'sos.reviewLead': 'Un dernier coup d’œil avant d’alerter les garages.',
    'sos.vehicle': 'Véhicule',
    'sos.problem': 'Panne',
    'sos.position': 'Position',
    'sos.none': '—',
    'sos.yes': 'Oui',
    'sos.no': 'Non',
    'sos.edit': 'Modifier',
    'sos.back': 'Retour',
    'sos.needAccount': 'Créez un compte pour envoyer une demande',
    'sos.noPosition': 'Position introuvable — impossible d’envoyer la demande.',

    'results.title': 'Garages pour votre panne',
    'results.count': 'résultats',
    'results.countOne': 'résultat',
    'results.forProblem': 'Peut traiter :',
    'results.byCar': 'En voiture',
    'results.onFoot': 'À pied',
    'results.emptyLead':
      'Aucun garage équipé pour cette panne dans le rayon. Appelez l’assistance, nous cherchons pour vous.',
    'results.callSupport': 'Appeler l’assistance',
    'results.searching': 'Recherche des garages…',
    'results.cancelRequest': 'Annuler la demande',
    'results.cancelConfirmTitle': 'Annuler ce SOS ?',
    'results.cancelConfirmLead':
      'La demande sera fermée et aucun garage ne sera prévenu. Vous pourrez en lancer une nouvelle aussitôt.',
    'results.keepSearching': 'Continuer la recherche',
    'results.pinnedLabel': 'Votre demande',
    'results.pinnedLead': 'Vous avez demandé l’assistance de ce garage. Il est placé en tête.',
    'results.pinnedMissing':
      'Le garage que vous avez ouvert ne traite pas cette panne. Voici ceux qui en sont capables.',
    'results.pinnedDismiss': 'Masquer ce rappel',
    'results.nearestOutside': 'Le plus proche hors rayon',
    'results.sortDistance': 'Plus proche',
    'results.sortRating': 'Mieux noté',
    'results.sortCertified': 'Certifié',
    'results.empty': 'Aucun garage dans ce rayon',
    'results.widen': 'Élargir la recherche',

    'garage.call': 'Appeler',
    'garage.directions': 'Itinéraire',
    'garage.certified': 'Certifié',
    'garage.open': 'Ouvert',
    'garage.closed': 'Fermé',
    'garage.reviews': 'Avis clients',
    'garage.contact': 'Contacter le garage',
    'garage.cannotReview': 'Vous devez avoir terminé une intervention avec ce garage',

    'garage.photos': 'Photos',
    'garage.reviewOne': 'avis',
    'garage.reviewMany': 'avis',
    'garage.noPhoto': 'Aucune photo',
    'garage.today': 'Aujourd’hui',
    'garage.trade': 'Métier',
    'garage.years': 'ans',
    'garage.yearsOne': 'an',
    'garage.towing': 'Remorquage',
    'garage.yes': 'Oui',
    'garage.no': 'Non',
    'garage.open24h': '24h',
    'garage.about': 'Le garage',
    'garage.services': 'Services',
    'garage.hours': 'Horaires',
    'garage.route': 'Itinéraire',
    'garage.routeLead': 'Distance à vol d’oiseau depuis votre position.',
    'garage.routeNoPosition': 'Activez la localisation pour voir la distance.',
    'garage.reviewsAll': 'Voir plus d’avis',
    'garage.reviewsEmpty': 'Aucun avis pour l’instant. Soyez le premier après une intervention.',
    'garage.rate': 'Noter',
    'garage.requestAssistance': 'Demander une assistance',
    'garage.noDirectContact':
      'Le contact avec un garage passe toujours par une demande d’assistance : il doit connaître votre panne avant de vous répondre.',
    'garage.notFound': 'Ce garage est introuvable',

    'legal.provisional':
      'Le texte contractuel complet est en cours de finalisation. Cette page décrit dès aujourd’hui ce que l’application fait réellement de vos données.',
    'legal.contact': 'Une question ? Appelez l’assistance',

    'privacy.title': 'Règles de confidentialité',
    'privacy.intro':
      'GeoCras met en relation des conducteurs en panne et des garages. Nous ne collectons que ce qui sert à faire arriver un garagiste jusqu’à vous.',
    'privacy.collect': 'Ce que nous enregistrons',
    'privacy.collect1': 'Votre nom, votre numéro de téléphone, votre ville, et votre e-mail si vous en donnez un.',
    'privacy.collect2': 'Vos véhicules : type, marque, modèle, année, plaque — uniquement ce que vous saisissez.',
    'privacy.collect3':
      'Vos demandes d’assistance : type de panne, description, photo si vous en joignez une, position au moment de la demande.',
    'privacy.collect4': 'Vos avis sur les garages et vos points de fidélité.',
    'privacy.position': 'Votre position',
    'privacy.position1':
      'Elle est relevée quand l’application est ouverte, pour afficher les garages autour de vous. Elle n’est envoyée à personne tant que vous n’avez pas lancé de demande.',
    'privacy.position2':
      'Pendant une intervention, elle est transmise en direct au garagiste que vous avez choisi — et à lui seul — afin qu’il vous trouve. Cette transmission s’arrête à la clôture de l’intervention.',
    'privacy.garage': 'Ce que le garagiste voit',
    'privacy.garage1': 'Avant qu’il accepte : votre quartier et le type de panne. Ni votre nom, ni votre numéro.',
    'privacy.garage2': 'Après acceptation : votre nom, votre numéro et votre position en direct.',
    'privacy.garage3':
      'Jamais : votre historique, vos points de fidélité, vos autres véhicules, vos contacts de confiance.',
    'privacy.device': 'Ce qui ne quitte pas votre téléphone',
    'privacy.device1':
      'Vos contacts de confiance, vos réglages d’affichage et de langue restent stockés sur l’appareil. Ils ne sont jamais envoyés à nos serveurs.',
    'privacy.rights': 'Vos droits',
    'privacy.rights1':
      'Vous pouvez modifier vos informations à tout moment depuis « Gérer mon compte ».',
    'privacy.rights2':
      'La suppression de votre compte efface vos demandes, vos avis et vos points. Elle est immédiate et définitive.',

    'terms.title': 'Conditions d’utilisation',
    'terms.intro':
      'En utilisant GeoCras, vous acceptez les règles ci-dessous. Elles décrivent ce que l’application fait, et ce qu’elle ne fait pas.',
    'terms.role': 'Notre rôle',
    'terms.role1':
      'GeoCras met en relation. Nous ne réparons pas les véhicules et n’employons pas les garagistes : l’intervention est un accord entre vous et le garage que vous choisissez.',
    'terms.role2':
      'Les garages certifiés ont été vérifiés sur place par GeoCras. La certification peut être retirée.',
    'terms.payment': 'Prix et paiement',
    'terms.payment1':
      'Le prix se convient directement avec le garage. GeoCras n’encaisse rien et ne fixe aucun tarif.',
    'terms.payment2':
      'Ne payez jamais avant l’intervention. Aucun garagiste inscrit n’est autorisé à réclamer un acompte pour se déplacer.',
    'terms.requests': 'Vos demandes',
    'terms.requests1': 'Une seule demande peut être en cours à la fois.',
    'terms.requests2':
      'Vous pouvez annuler tant que le garagiste n’est pas arrivé. Les annulations répétées peuvent limiter l’accès au service.',
    'terms.requests3':
      'La clôture d’une intervention exige la confirmation des deux parties, sur place.',
    'terms.loyalty': 'Points de fidélité',
    'terms.loyalty1':
      'Les points récompensent des interventions réellement effectuées et vérifiées. Ils n’ont pas de valeur marchande tant qu’ils ne sont pas convertis.',
    'terms.loyalty2':
      'Des points obtenus par fraude — interventions fictives, comptes complices — sont annulés et le compte peut être fermé.',
    'terms.account': 'Votre compte',
    'terms.account1': 'Un numéro de téléphone donne droit à un compte. Il vous identifie.',
    'terms.account2':
      'Vous restez responsable de l’usage fait depuis vos appareils connectés. Vous pouvez les déconnecter à tout moment depuis l’écran Sécurité.',

    'security.title': 'Sécurité',

    'security.contacts': 'Contacts de confiance',
    'security.contactsLead':
      'Prévenez un proche en un geste quand vous tombez en panne. Ces contacts restent sur cet appareil : ils ne sont jamais envoyés à GeoCras.',
    'security.contactsEmpty': 'Aucun contact enregistré pour l’instant.',
    'security.contactsFull': 'Trois contacts au maximum — au-delà, on ne prévient plus personne en particulier.',
    'security.contactAdd': 'Ajouter un contact',
    'security.contactName': 'Nom',
    'security.contactNamePlaceholder': 'Ma sœur',
    'security.contactPhone': 'Numéro',
    'security.contactSave': 'Enregistrer ce contact',
    'security.contactRemove': 'Retirer ce contact',
    'security.contactRemoveTitle': 'Retirer ce contact ?',
    'security.sendPosition': 'Envoyer ma position',
    'security.sendPositionHint':
      'Ouvre votre application SMS avec le message prêt. Un SMS passe là où les données mobiles ne passent pas.',
    'security.smsBody': 'Je suis en panne avec GeoCras. Ma position',
    'security.noPosition': 'Position indisponible : activez la localisation pour partager votre position.',

    'security.account': 'Accès au compte',
    'security.password': 'Changer mon mot de passe',
    'security.passwordHint': 'Déconnecte aussi les autres appareils',
    'security.devicesOne': 'appareil connecté',
    'security.devicesMany': 'appareils connectés',
    'security.devicesLead': 'Un appareil connecté peut ouvrir votre compte sans ressaisir le mot de passe.',
    'security.devicesSince': 'depuis le',
    'security.devicesMultiple':
      'Plusieurs appareils ont accès à votre compte. Si l’un d’eux ne vous appartient plus, déconnectez-le.',
    'security.revokeOthers': 'Déconnecter les autres appareils',
    'security.revokeOthersTitle': 'Déconnecter les autres appareils ?',
    'security.revokeOthersBody':
      'Ils devront ressaisir votre numéro et votre mot de passe. Cet appareil-ci reste connecté.',
    'security.revokedNone': 'Aucun autre appareil n’était connecté',
    'security.revokedOne': 'appareil déconnecté',
    'security.revokedMany': 'appareils déconnectés',

    'security.visibility': 'Ce que le garagiste voit',
    'security.visibilityBefore':
      'Avant qu’il accepte : votre quartier et le type de panne. Ni votre nom, ni votre numéro.',
    'security.visibilityAfter':
      'Après acceptation : votre nom, votre numéro et votre position en direct — le temps de l’intervention, pas au-delà.',
    'security.visibilityNever':
      'Jamais : votre historique, vos points de fidélité, vos autres véhicules, vos contacts de confiance.',

    'security.scams': 'Éviter les arnaques',
    'security.scam1':
      'Ne payez jamais avant l’intervention. Aucun garagiste sérieux ne réclame un acompte Mobile Money pour se déplacer.',
    'security.scam2':
      'Vérifiez l’écusson rouge : un garage certifié a été contrôlé sur place par GeoCras.',
    'security.scam3':
      'Le garagiste qui arrive doit être celui que l’app annonce. Demandez-lui le nom de son garage avant d’ouvrir le capot.',
    'security.scam4':
      'Payez une fois le travail fait, sur place, et gardez la trace du paiement Mobile Money.',
    'security.report': 'Signaler un problème à l’assistance',

    'password.title': 'Changer mon mot de passe',
    'password.lead':
      'Les autres appareils connectés seront déconnectés. Celui-ci reste connecté.',
    'password.current': 'Mot de passe actuel',
    'password.new': 'Nouveau mot de passe',
    'password.confirm': 'Confirmer le nouveau',
    'password.tooShort': 'Au moins 8 caractères',
    'password.mismatch': 'Les deux saisies ne correspondent pas',
    'password.same': 'Le nouveau mot de passe est identique à l’ancien',
    'password.submit': 'Enregistrer',
    'password.doneTitle': 'Mot de passe modifié',
    'password.doneBody': 'Les autres appareils ont été déconnectés.',
    'password.doneBodyAlone': 'Aucun autre appareil n’était connecté.',

    'loyalty.title': 'Ma fidélité',
    'loyalty.balanceLabel': 'Solde de points',
    'loyalty.points': 'pts',
    'loyalty.pending': 'en attente de confirmation',
    'loyalty.pendingHint':
      'Les points d’une intervention se confirment après 24 h, le temps qu’un litige puisse encore l’annuler.',
    'loyalty.repairsDone': 'réparations terminées',
    'loyalty.repairsDoneOne': 'réparation terminée',
    'loyalty.nextTier': 'Prochain grade',
    'loyalty.repairsLeftOne': 'réparation restante',
    'loyalty.repairsLeftMany': 'réparations restantes',
    'loyalty.maxTier': 'Grade maximum atteint',
    'loyalty.maxTierLead': 'Vous êtes au sommet de l’échelle. Merci de rouler avec nous.',
    'loyalty.discountShort': 'de remise chez les garages certifiés',

    'loyalty.grades': 'Les grades',
    'loyalty.gradesLead':
      'Ils se gagnent en réparations terminées, jamais en points : les points se dépensent, un grade non.',
    'loyalty.stateCurrent': 'Votre grade',
    'loyalty.stateReached': 'Acquis',
    'loyalty.stateLocked': 'À atteindre',
    'loyalty.condition': 'Condition',
    'loyalty.fromStart': 'Dès l’inscription',
    'loyalty.repairOne': 'réparation',
    'loyalty.repairMany': 'réparations',
    'loyalty.discount': 'Remise garages certifiés',

    'loyalty.badges': 'Mes badges',
    'loyalty.badgeLocked': 'À débloquer',

    'loyalty.earn': 'Comment gagner des points',
    'loyalty.checks': 'Comment les points sont vérifiés',
    'loyalty.checksBody':
      'Un dépannage ne compte que si les deux parties ont confirmé l’arrivée, que le garagiste s’est réellement déplacé et que l’intervention a duré plus de trois minutes. Les points arrivent en attente, puis deviennent utilisables au bout de 24 h.',
    'loyalty.referral': 'Mon code de parrainage',
    'loyalty.referralLead':
      'Votre filleul reçoit ses points à l’inscription ; les vôtres arrivent quand il termine sa première intervention.',
    'loyalty.referralShare': 'Partager mon code',
    'loyalty.referralMessage': 'Rejoignez-moi sur GeoCras avec mon code de parrainage',
    'loyalty.history': 'Mouvements récents',
    'loyalty.historyEmpty': 'Aucun mouvement pour l’instant.',
    'loyalty.statePendingLabel': 'En attente',
    'loyalty.stateConfirmedLabel': 'Confirmé',
    'loyalty.stateReversedLabel': 'Annulé',
    'loyalty.failed': 'Fidélité indisponible',

    'month.1': 'Janvier',
    'month.2': 'Février',
    'month.3': 'Mars',
    'month.4': 'Avril',
    'month.5': 'Mai',
    'month.6': 'Juin',
    'month.7': 'Juillet',
    'month.8': 'Août',
    'month.9': 'Septembre',
    'month.10': 'Octobre',
    'month.11': 'Novembre',
    'month.12': 'Décembre',

    'history.title': 'Historique',
    'history.ongoing': 'En cours',
    'history.resume': 'Reprendre le suivi',
    'history.requestsOne': 'demande',
    'history.requestsMany': 'demandes',
    'history.emptyTitle': 'Aucune demande pour l’instant',
    'history.emptyLead':
      'Vos SOS apparaîtront ici : le garage qui est intervenu, la date, la durée et votre note.',
    'history.emptyAction': 'Voir la carte',
    'history.emptyLeadGarage':
      'Vos interventions apparaîtront ici : qui vous avez dépanné, quand, et combien de temps cela a pris.',
    'history.loadMore': 'Charger les plus anciennes',
    'history.failed': 'Historique indisponible',
    'history.rate': 'Noter ce garage',
    'history.rated': 'Noté',
    'history.noGarage': 'Aucun garage retenu',
    'history.duration': 'durée',
    'history.cancelledBy': 'Motif',

    'day.mon': 'Lundi',
    'day.tue': 'Mardi',
    'day.wed': 'Mercredi',
    'day.thu': 'Jeudi',
    'day.fri': 'Vendredi',
    'day.sat': 'Samedi',
    'day.sun': 'Dimanche',

    'review.label': 'Votre avis',
    'review.title': 'Noter ce garage',
    'review.lead': 'Votre note est publique et signée de votre prénom. Elle aide le prochain automobiliste en panne à choisir.',
    'review.ratingLabel': 'Votre note',
    'review.rate1': 'Mauvais',
    'review.rate2': 'Décevant',
    'review.rate3': 'Correct',
    'review.rate4': 'Bien',
    'review.rate5': 'Excellent',
    'review.ratingRequired': 'Touchez une étoile pour noter',
    'review.commentLabel': 'Votre commentaire',
    'review.commentOptional': 'Facultatif',
    'review.commentPlaceholder': 'Ce qui s’est bien passé, le délai, le prix annoncé…',
    'review.publish': 'Publier mon avis',
    'review.published': 'Avis publié',
    'review.cannotTitle': 'Notation indisponible',
    'review.needsClosed': 'Vous pourrez noter ce garage après une intervention terminée avec lui.',
    'review.alreadyDone': 'Vous avez déjà noté votre intervention avec ce garage.',
    'review.needsAccount': 'Connectez-vous pour noter ce garage.',

    'results.sheetTitle': 'Garages proposés',
    'results.sortedBy': 'Trié par',
    'results.expandList': 'Voir toute la liste',
    'results.collapseList': 'Réduire la liste',
    'results.routeShown': 'Itinéraire estimé',
    'results.routeStraight': 'À vol d’oiseau, en attendant le calcul routier.',
    'results.routeHide': 'Masquer l’itinéraire',

    'garage.details': 'Détails',
    'garage.sendSos': 'Envoyer le SOS',
    'garage.sendSosHint': 'Engage définitivement votre demande auprès de ce garage',

    'confirm.label': 'Confirmation',
    'confirm.title': 'Envoyer votre SOS à ce garage ?',
    'confirm.privacy': 'Ce que le garage voit',
    'confirm.privacyLead':
      'Il reçoit la nature de votre panne et votre quartier. Votre numéro et votre position exacte ne lui sont transmis que s’il accepte de gérer votre cas.',
    'confirm.now': 'Maintenant',
    'confirm.afterAccept': 'S’il accepte',
    'confirm.phone': 'Numéro',
    'confirm.position': 'Position',
    'confirm.positionHidden': 'Quartier seul',
    'confirm.positionShared': 'Exacte, en direct',
    'confirm.irreversible': 'Action irréversible',
    'confirm.irreversibleLead':
      'La demande part vers ce garage et lui reste attachée. Pour en choisir un autre, il faudra l’annuler et relancer un SOS.',
    'confirm.send': 'Envoyer le SOS',
    'confirm.keepComparing': 'Continuer à comparer',

    'awaiting.label': 'Demande envoyée',
    'awaiting.title': 'En attente de réponse',
    'awaiting.lead':
      'Le garage a reçu votre demande. Il doit l’accepter avant de se mettre en route.',
    'awaiting.waitingFor': 'En attente depuis',
    'awaiting.step1': 'Demande envoyée',
    'awaiting.step2': 'Acceptation du garage',
    'awaiting.step3': 'Départ vers vous',
    'awaiting.pending': 'en attente',
    'awaiting.masked':
      'Votre numéro et votre position exacte restent masqués tant que le garage n’a pas accepté.',
    'awaiting.noAnswer':
      'Sans réponse d’ici quelques minutes, annulez et choisissez un autre garage.',
    'awaiting.cancelConfirmLead':
      'Le garage sera prévenu de l’annulation. Vous pourrez relancer un SOS aussitôt.',
    'awaiting.loading': 'Chargement du suivi…',

    'tracking.enRoute': 'Le garagiste est en route',
    'tracking.toYou': 'Vers vous',
    'tracking.toGarage': 'Vers garage',
    'tracking.confirmArrival': "Confirmer l'arrivée",
    'tracking.onFoot': 'à pied',
    'tracking.updated': 'MAJ',
    'tracking.degraded': 'Connexion instable',
    'tracking.offline': 'Hors ligne',

    // — États de chargement —
    // Génériques et courts : ce sont les seuls messages d'état qui ne
    // s'attachent à aucun écran. Tout ce qui peut être dit précisément l'est
    // par l'écran lui-même, avec ses mots à lui.
    'state.loading': 'Chargement…',
    'state.initializing': 'Démarrage…',
    'state.retrying': 'Nouvelle tentative…',
    'state.retry': 'Réessayer',
    'state.offlineTitle': 'Serveur injoignable',
    'state.offlineBody':
      'Votre téléphone n’arrive pas à joindre GeoCras. Vérifiez votre connexion, puis réessayez.',
    'state.errorTitle': 'Quelque chose a cassé',
    'state.errorBody': 'Le serveur a répondu de travers. Ce n’est pas de votre fait.',
    'state.notFoundTitle': 'Introuvable',
    'state.notFoundBody': 'Cette page n’existe pas, ou n’existe plus.',
    'state.deniedTitle': 'Compte requis',
    'state.deniedBody': 'Connectez-vous pour accéder à cette page.',
    // Bandeau global, affiché dès que le serveur cesse de répondre.
    'state.offlineBanner': 'Hors ligne — les données affichées peuvent dater',

    // Annulation d'un SOS. Les deux messages d'échec disent **la même chose en
    // premier** : la demande est toujours active. C'est la seule information
    // qui compte — croire avoir annulé alors qu'un garagiste est en route est
    // le pire malentendu possible sur ce produit.
    'results.cancelling': 'Annulation en cours…',
    'results.cancelOffline': 'Demande toujours active : le serveur est injoignable.',
    'results.cancelFailed': 'Demande toujours active : l’annulation n’a pas abouti.',

    'driving.ready': 'Prêt à conduire ?',
    // Ce que le mode surveille, dans l'ordre de gravité. La phrase tient en
    // deux lignes sur la maquette : ne pas l'allonger.
    'driving.readyLead':
      'Alertes en temps réel : feux, obstacles, angle mort et chocs latéraux.',
    'driving.mode': 'Mode conduite',
    'driving.start': 'Démarrer',
    'driving.pause': 'Pause',
    'driving.resume': 'Reprendre',
    'driving.stop': 'Arrêter',
    'driving.recording': 'Enregistrement…',
    'driving.activeSession': 'Session active',
    'driving.alerts': 'Alertes',
    'driving.distance': 'Distance',
    'driving.score': 'Score',
    'driving.soundAlerts': 'Alertes sonores',
    'driving.blindSpot': "Détection d'angle mort",
    // Unité de la vitesse. Traduite comme le reste : l'anglais l'écrit sans
    // changer, mais un dictionnaire à trous se découvre en production.
    'driving.kmh': 'km/h',
    // Ce que la pile d'alertes dit quand elle est vide — c'est-à-dire au
    // meilleur moment du trajet, pas à un moment d'échec.
    'driving.watching': 'La route est surveillée',

    'settings.title': 'Paramètres',

    'settings.appearance': 'Apparence',
    'settings.light': 'Clair',
    'settings.dark': 'Sombre',
    'settings.auto': 'Auto',

    'settings.language': 'Langue',
    'settings.languageFr': 'Français',
    'settings.languageEn': 'English',

    'settings.search': 'Recherche sur la carte',

    'settings.vehicles': 'Mes véhicules',
    'settings.vehiclesNone': 'Aucun véhicule enregistré',
    'settings.vehiclesTitle': 'Mes véhicules',
    'settings.vehiclesLead':
      'Le véhicule par défaut est celui qui part avec votre SOS. Le garagiste sait ainsi quoi préparer avant d’arriver.',
    'settings.vehicleAdd': 'Ajouter un véhicule',
    'settings.vehicleNew': 'Nouveau véhicule',
    'settings.vehicleEditing': 'Modifier le véhicule',
    'settings.vehicleNoPlate': 'Plaque non renseignée',
    'settings.vehicleRemoveFailed': 'Le véhicule n’a pas pu être supprimé.',
    'settings.vehicleEdit': 'Modifier',
    'settings.vehicleDefault': 'Par défaut',
    'settings.vehicleSetDefault': 'Choisir par défaut',
    'settings.vehicleRemove': 'Supprimer',
    'settings.vehicleRemoveTitle': 'Supprimer ce véhicule ?',
    'settings.vehicleRemoveBody': 'Vos demandes passées le gardent en mémoire.',
    'settings.vehicleType': 'Type',
    'settings.vehicleBrand': 'Marque',
    'settings.vehicleBrandPlaceholder': 'Toyota',
    'settings.vehicleModel': 'Modèle',
    'settings.vehicleModelPlaceholder': 'Corolla',
    'settings.vehicleYear': 'Année',
    'settings.vehiclePlate': 'Plaque',
    'settings.vehiclePlatePlaceholder': 'LT 4821 AB',
    'settings.vehiclePlateHint': 'Elle aide le garagiste à vous reconnaître sur place.',
    'settings.vehicleSave': 'Enregistrer',
    'settings.vehicleMax': 'Cinq véhicules au maximum.',

    'settings.notifications': 'Notifications',
    'settings.notificationsSystem': 'Alertes du téléphone',
    'settings.haptics': 'Vibration',
    'settings.notificationsDeniedHint':
      'Vous les avez refusées. Le téléphone ne redemandera plus : il faut passer par ses réglages.',
    'settings.notificationsPending': 'Les alertes d’intervention arriveront dans une prochaine version.',

    'settings.about': 'À propos',
    'settings.version': 'Version',
    'settings.support': 'Assistance',
    'settings.privacy': 'Règles de confidentialité',
    'settings.terms': 'Conditions d’utilisation',

    'common.callSupport': 'Appeler l’assistance',

    'soon.drivingTitle': 'Mode conduite',
    'soon.drivingLead':
      'Le mode conduite affichera votre vitesse, les alertes sur votre trajet et un score de conduite à l’arrivée. Il ouvre bientôt.',

    'common.cancel': 'Annuler',
    'common.retry': 'Réessayer',
    'common.close': 'Fermer',
    'common.save': 'Enregistrer',
    'common.loading': 'Chargement…',
    'common.error': 'Échec',

    // — Côté garagiste : le poste de travail ————————————————————————
    'jobs.deskLabel': 'Poste de travail',
    'jobs.listening': 'À L’ÉCOUTE',
    'jobs.deskUnstable': 'LIAISON INSTABLE',
    'jobs.soon': 'BIENTÔT',
    'jobs.detectionOpen': 'Détection ouverte',

    // L'ardoise SOS. Le libellé est un état, pas un nom de rubrique : « SOS »
    // tout seul nommait un menu, « SOS en attente » dit ce que le chiffre à
    // côté est en train de compter.
    'jobs.queueLabel': 'SOS en attente',
    'jobs.oldestWaiting': 'Attente la plus longue',
    'jobs.firstToHandle': 'À prendre en premier',
    'jobs.queueMix': 'Répartition par urgence',

    'jobs.calmTitle': 'Personne n’attend',
    'jobs.calmLead':
      'Votre garage est visible sur la carte et écoute les SOS en direct. Le premier conducteur qui vous choisit s’affiche ici, et le téléphone sonne.',
    'jobs.calmClosedLead':
      'Votre garage n’apparaît dans aucune recherche : aucun SOS ne peut vous parvenir tant que la détection est fermée.',
    'jobs.reopenDetection': 'Rouvrir depuis Mon garage',

    'jobs.commitments': 'Vos engagements',
    'jobs.commitmentsLead':
      'Ce que vous avez accepté et pas encore terminé. Chacun attend votre prochain geste.',
    'jobs.awaitingClientShort': 'En attente du client',

    'jobs.radarTile': 'Radar',
    'jobs.radarLead':
      'Bientôt : les pannes déclarées autour de votre atelier, avant même qu’un conducteur vous choisisse.',

    'jobs.sosTitle': 'Demandes SOS',
    'jobs.incoming': 'À traiter',
    'jobs.active': 'En cours',

    'jobs.stateToAnswer': 'À RÉPONDRE',
    'jobs.stateToLeave': 'À PARTIR',
    'jobs.stateDriving': 'EN ROUTE',
    'jobs.stateToConfirm': 'ARRIVÉE À CONFIRMER',
    'jobs.stateOngoing': 'EN COURS',

    'jobs.distance': 'Distance',
    'jobs.approach': 'Approche',
    'jobs.waiting': 'Attente',
    'jobs.words': 'Ce que dit le client',
    'jobs.constraints': 'À prévoir',
    'jobs.requester': 'Le demandeur',
    'jobs.where': 'Où',

    'jobs.dangerBanner': 'Danger déclaré — intervenir en priorité',
    'jobs.immobilized': 'Ne roule plus',
    'jobs.immobilizedLead': 'Prévoir le plateau ou la barre de remorquage.',
    'jobs.vulnerable': 'Passagers vulnérables',
    'jobs.vulnerableLead': 'Enfant, personne âgée ou blessée à bord.',
    'jobs.noPhoto': 'Aucune photo envoyée',
    'jobs.phoneHidden': 'Numéro masqué jusqu’à l’acceptation',
    'jobs.areaOnly': 'Zone approchée. La position exacte s’affiche dès que vous acceptez.',
    'jobs.approxLocation': 'position approchée',
    'jobs.gone': 'Cette demande n’est plus dans votre file. Le client l’a peut-être annulée.',

    'jobs.accept': 'Accepter',
    'jobs.decline': 'Décliner',
    'jobs.callClient': 'Joindre',
    'jobs.goThere': 'Y aller',
    'jobs.enRoute': 'Je pars',
    'jobs.confirmArrival': 'Je suis arrivé',
    'jobs.waitingClient': 'Arrivée enregistrée — en attente du client',

    'jobs.declineTitle': 'Décliner cette demande ?',
    'jobs.declineBody':
      'Le client sera prévenu et reprendra sa recherche : sa demande reste ouverte et il choisira un autre garage. Elle disparaîtra de votre file.',
    'jobs.declineReason': 'garage indisponible',

    // — Itinéraire ——————————————————————————————————————————————
    'jobs.timeToArrive': 'Temps de route',
    'jobs.arrivalAt': 'Arrivée',
    'jobs.recenter': 'Recentrer sur le trajet',
    'jobs.waitingGps': 'Recherche de votre position…',
    'jobs.roughEstimate':
      'Estimation à vol d’oiseau : le calcul routier n’a pas répondu. Comptez plus long.',

    'jobs.closedTitle': 'Détection fermée',
    'jobs.closedBody':
      'Votre garage n’apparaît dans aucune recherche : aucun nouveau SOS ne peut vous parvenir. Rouvrez la détection depuis « Mon garage ».',
    'jobs.noGarage': 'Aucun garage n’est rattaché à ce compte.',
    'jobs.emptyTitle': 'Aucune demande',
    'jobs.emptyLead':
      'Votre garage est à l’écoute. Les SOS des conducteurs en panne autour de vous arriveront ici.',

    // — Le dernier mètre : la reconnaissance mutuelle sur place ——————————
    'proximity.label': 'À proximité',
    // Court, et c'est une contrainte de gabarit autant que de style : le
    // libellé est rendu en Bebas 17 avec deux points d'interlettrage, dans un
    // bouton qui fait cent cinquante points sur un petit écran.
    'proximity.question': 'Vous le voyez ?',
    'proximity.confirm': 'Je le vois',
    'proximity.call': 'Appeler',
    'proximity.dismiss': 'Pas encore',

    'proximity.garageLead':
      'Vous êtes arrivé dans la zone de la panne. Regardez autour de vous : le véhicule devrait être en vue.',
    'proximity.clientLead':
      'Votre garagiste est tout près du lieu de la panne, et vous cherche peut-être déjà du regard.',


    // — Côté client : le suivi en direct ————————————————————————————
    'live.stepAccepted': 'Acceptée',
    'live.stepEnRoute': 'En route',
    'live.stepArrived': 'Sur place',
    'live.stepConfirmed': 'Confirmée',
    'live.arrivesIn': 'Arrive dans',
    'live.onSite': 'Sur place',
    'live.moving': 'En approche',
    'live.stopped': 'À l’arrêt — circulation ou pause',
    'live.notMovingYet': 'Le garagiste n’a pas encore émis sa position : trajet depuis son atelier.',
    'live.roughEstimate':
      'Estimation à vol d’oiseau : le calcul routier n’a pas répondu. Comptez plus long.',
    'live.degraded': 'Connexion instable — les informations peuvent dater.',
    'live.callMechanic': 'Appeler',
    'live.confirmArrival': 'Il est arrivé',
    'live.confirmedWaiting': 'En attente du garagiste',
    'live.confirmTitle': 'Le garagiste est arrivé ?',
    'live.confirmBody':
      'Ne confirmez que s’il est réellement sur place. L’intervention se clôture lorsque vous confirmez tous les deux, et c’est ce qui déclenche vos points.',
    'live.confirmAction': 'Oui, il est là',
    'live.doneTitle': 'Intervention terminée',
    'live.doneLead': 'Vous avez confirmé l’arrivée tous les deux. Vos points sont crédités.',
    'live.doneSummary': 'Récapitulatif',
    'live.rate': 'Noter ce garage',
    'live.backToMap': 'Revenir à la carte',
    'live.overTitle': 'Cette demande est close',
    'live.overLead': 'Elle a été annulée ou terminée. Relancez un SOS depuis la carte si besoin.',

    // — Côté client : le garage a décliné ——————————————————————————
    'results.declinedLabel': 'Réponse du garage',
    'results.declinedTitle': 'Ce garage ne peut pas intervenir',
    'results.declinedLead':
      'Votre demande reste ouverte, rien à ressaisir. Choisissez un autre garage ci-dessous.',
  },

  en: {
    'tab.map': 'Map',
    'tab.driving': 'Driving',
    'tab.jobs': 'Jobs',

    'drawer.security': 'Security',
    'drawer.support': 'Support',
    'drawer.settings': 'Settings',
    'drawer.history': 'History',
    'drawer.logout': 'Log out',
    'drawer.account': 'My account',
    'drawer.guest': 'Guest mode',
    'drawer.guestLead':
      'You are browsing as a guest. Sign in to send an SOS, follow your jobs and collect your points.',
    'drawer.login': 'Sign in',
    'drawer.notSignedIn': 'not signed in',
    'drawer.hello': 'Hello',
    'drawer.manageAccount': 'Manage my GEOCRAS account',
    'drawer.more': 'More in GeoCras',
    'drawer.startDriving': 'Start driving mode',
    'drawer.beta': 'Beta',
    'drawer.loyalty': 'My loyalty',
    'drawer.privacy': 'Privacy policy',
    'drawer.terms': 'Terms of use',

    'drawer.historyHint': 'Your past and ongoing requests',
    'drawer.loyaltyHint': 'Your points, tiers and badges',
    'drawer.securityHint': 'Trusted contacts and signed-in devices',
    'drawer.settingsHint': 'Appearance, language, alerts, radius',

    'drawer.logoutTitle': 'Log out?',
    'drawer.logoutBody':
      'You will need to sign in again to find your requests, points and vehicles.',
    'drawer.logoutConfirm': 'Log out',

    'account.title': 'Manage my account',
    'account.identity': 'My details',
    'account.photoRemove': 'Remove photo',
    'account.photoFailed': 'The photo could not be uploaded',
    'account.photoPermission': 'Allow access to your photos to pick one.',
    'account.photoTake': 'Take a photo',
    'account.photoChoose': 'Choose a photo',
    'account.photoChooseMany': 'Choose photos',
    'account.fullName': 'Full name',
    'account.email': 'Email address',
    'account.emailPlaceholder': 'Optional',
    'account.emailInvalid': 'Invalid email address',
    'account.phone': 'Phone number',
    'account.phoneHint': 'You sign in with it, and the garage calls you back on it.',
    'account.phoneIncomplete': 'Nine digits expected after +237',
    'account.phoneChangeTitle': 'Changing your number',
    'account.phoneChangeBody':
      'We will move your whole history — jobs, reviews, loyalty points — to this new number. The transfer can take several minutes.',
    'account.phoneChangedTitle': 'New number saved',
    'account.phoneChangedBody':
      'Sign in with this number from now on. Your history is being transferred and it can take several minutes.',
    'account.saved': 'Saved',
    'account.activity': 'My activity',
    'account.becomeGarage': 'Become a garage owner',
    'account.becomeGarageHint': 'Register my garage and receive SOS calls',
    'account.myGarage': 'My garage',
    'account.session': 'Session',
    'account.logoutTitle': 'Log out?',
    'account.logoutBody': 'You will need your number and password to come back.',
    'account.delete': 'Delete my account',
    'account.deleteHint': 'Permanent, with no way back',
    'account.deleteTitle': 'Delete permanently?',
    'account.deleteBody':
      'Your job history, reviews and loyalty points will be erased. This cannot be undone.',
    'account.deleteConfirm': 'Delete',

    'myGarage.title': 'My garage',
    'myGarage.detection': 'Detection',
    'myGarage.detectionLabel': 'Visible for SOS calls',
    'myGarage.detectionOnHint':
      'Your garage shows up in searches by stranded drivers around you.',
    'myGarage.detectionOffHint':
      'Detection closed: your garage appears in no search. Reopen it when you are back at work.',
    'myGarage.closedBanner': 'Detection closed',
    'myGarage.certified': 'Certified garage',
    'myGarage.notCertifiedHint': 'GeoCras grants certification after an on-site check.',
    'myGarage.publicPage': 'View my public page',
    'myGarage.services': 'Declared skills',
    'myGarage.contact': 'Contact',
    'myGarage.noRating': 'Not rated yet',
    'myGarage.none': 'No garage linked to this account',
    'myGarage.pendingBadge': 'Under review',
    'myGarage.pendingTitle': 'Application under review',
    'myGarage.pendingBody':
      'We are checking the details you sent. Your garage appears in no search until that check is done. We will email or call you as soon as it is.',
    'myGarage.editDossier': 'Edit my application',
    'myGarage.withdrawDossier': 'Withdraw my application',
    'myGarage.withdrawHint': 'The application is deleted, the account goes back to client',
    'myGarage.withdrawTitle': 'Withdraw your application?',
    'myGarage.withdrawBody':
      'The application will be deleted and your account will go back to being a client account. You can submit a new one later.',
    'myGarage.withdrawConfirm': 'Withdraw',

    'hours.modeClosed': 'Closed',
    'hours.modeOpen': 'Open',
    'hours.mode24h': '24h',
    'hours.from': 'opens',
    'hours.to': 'closes',
    'hours.hourColumn': 'Hour',
    'hours.minuteColumn': 'Minute',
    'hours.confirm': 'Confirm',
    'hours.copyWeekdays': 'Copy Mon–Fri',
    'hours.copyWeekdaysA11y': 'Apply Monday hours from Monday to Friday',
    'hours.copyWeek': 'Copy all 7 days',
    'hours.copyWeekA11y': 'Apply Monday hours to the whole week',

    'becomeGarage.title': 'Become a garage owner',
    'becomeGarage.lead':
      'Register your workshop to receive SOS calls from stranded drivers around you.',
    'becomeGarage.reviewTitle': 'Your application will be checked',
    'becomeGarage.reviewBody':
      'We check every garage before making it visible: that the workshop exists, that the address is right, that the number answers. So give a phone and an email you actually read — that is how we will reach you once approved.',
    'becomeGarage.sectionGarage': 'The garage',
    'becomeGarage.sectionContact': 'Reaching you',
    'becomeGarage.sectionPlace': 'Finding you',
    'becomeGarage.name': 'Garage name',
    'becomeGarage.namePlaceholder': 'Garage Central',
    'becomeGarage.description': 'Description',
    'becomeGarage.descriptionPlaceholder': 'General mechanics, roadside repair and towing.',
    'becomeGarage.descriptionHint': 'Shown on your page. 400 characters at most.',
    'becomeGarage.years': 'Years in business',
    'becomeGarage.yearsHint': 'How long the workshop has been running.',
    'becomeGarage.phone': 'Number to call',
    'becomeGarage.phoneHint': 'The number the customer dials, and the one we call to verify.',
    'becomeGarage.email': 'Email address',
    'becomeGarage.emailHint': 'Required: our answer will be sent there.',
    'becomeGarage.quarter': 'Neighbourhood',
    'becomeGarage.quarterPlaceholder': 'Bastos',
    'becomeGarage.address': 'Landmark or address',
    'becomeGarage.addressPlaceholder': 'Opposite the petrol station',
    'becomeGarage.addressHint': 'The landmark you give on the phone to someone looking for you.',
    'becomeGarage.services': 'Your skills',
    'becomeGarage.servicesHint': 'They decide which SOS calls reach you. At least one.',
    'becomeGarage.hours': 'Opening hours',
    'becomeGarage.hoursHint':
      'For each day: closed, open within a range, or open 24h. Set Monday, then copy it across.',
    'becomeGarage.photos': 'Workshop photos',
    'becomeGarage.photoAdd': 'Add',
    'becomeGarage.photosHint':
      'Optional, but a workshop people have seen inspires more trust. You can pick several at once, six at most.',
    'becomeGarage.positionTitle': 'Stand inside the garage',
    'becomeGarage.positionBody':
      'Your location is taken by GPS when you submit, and it decides which SOS calls reach you. Send your application from the workshop itself, not from home.',
    'becomeGarage.positionMissing':
      'Location unavailable. Turn on location to register your garage.',
    'becomeGarage.positionCoarse':
      'Location is imprecise. Step outside for a few seconds before sending.',
    'becomeGarage.submit': 'Send my application',
    'becomeGarage.submitHint': 'We get back to you after the check, by phone or email.',

    'becomeGarage.editTitle': 'Edit my application',
    'becomeGarage.editLead': 'Fix whatever needs fixing: your application is still under review.',
    'becomeGarage.editNoticeTitle': 'Still under review',
    'becomeGarage.editNoticeBody':
      'Your corrections travel with the application. Once the garage is verified, these details can no longer be edited from the app.',
    'becomeGarage.saveEdit': 'Save changes',
    'becomeGarage.saveEditHint': 'The review carries on with the corrected details.',
    'becomeGarage.positionEditBody':
      'The saved location is kept. Only replace it from the workshop itself: it decides which SOS calls will reach you.',
    'becomeGarage.positionSaved': 'Location saved with the application',
    'becomeGarage.positionUpdate': 'Use my position here',
    'becomeGarage.positionUnavailable':
      'Location unavailable: the garage cannot be moved right now.',
    'becomeGarage.positionRestore': 'Back to the saved location',
    'becomeGarage.editMissing': 'No application to edit on this account.',
    'becomeGarage.editLocked':
      'Your garage is already verified: its application can no longer be edited from the app.',

    'auth.loginTitle': 'Sign in',
    'auth.signupTitle': 'Create an account',
    'auth.loginLead': 'Your number identifies you',
    'auth.signupLead': 'Required to raise an SOS',
    'auth.fullName': 'Full name',
    'auth.fullNamePlaceholder': 'Jean Djomo',
    'auth.phone': 'Phone number',
    'auth.password': 'Password',
    'auth.passwordPlaceholder': '••••••••',
    'auth.passwordHint': '8 characters minimum',
    'auth.login': 'Sign in',
    'auth.signup': 'Create my account',
    'auth.noAccount': 'No account yet?',
    'auth.hasAccount': 'Already registered?',
    'auth.legalPrefix': 'By continuing, you accept the',
    'auth.legalTerms': 'terms of use',
    'auth.showPassword': 'Show password',
    'auth.hidePassword': 'Hide password',
    'auth.required': 'Sign-in required',
    'auth.requiredLead':
      'An SOS commits a mechanic to travel to you. They must be able to identify and call you — so an account is required.',

    'splash.acquiring': 'acquiring GPS…',
    'splash.tagline': 'A garage nearby, in one tap',
    'location.unavailable': 'Location unavailable',
    'location.retry': 'Retry',
    'location.denied': 'Allow location access to find a garage',

    'map.searchPlaceholder': 'Search for a garage',
    'map.openGarages': 'garages open near you',
    'map.openGarages.one': 'garage open near you',
    'map.garagesAround': 'garages near you',
    'map.garagesAround.one': 'garage near you',
    'map.filterCertified': 'Certified',
    'map.filterOpen': 'Open',
    'map.filterTowing': 'Towing',
    'map.exactPosition': 'Exact position',
    'map.openMenu': 'Open menu',
    'map.recenter': 'Recentre on my position',
    'map.following': 'The map is following your position',
    'map.tiltFlat': 'Flat view',
    'map.tiltTilted': 'Tilted view',
    'map.searching': 'Searching for garages…',
    'map.loadFailed': 'Garages unavailable',
    'map.noneInRadius': 'No garage within this radius',
    'map.noneInRadiusLead': 'We found no garage within',
    'map.acquiring': 'Acquiring your position…',

    'sos.title': 'SOS — Find a garage',
    'sos.subtitle': 'Location sent automatically',
    'sos.declare': 'Report a breakdown',
    'sos.vehicleType': 'Vehicle type',
    'sos.savedVehiclesHint': 'Pick a saved vehicle, or describe the one you are driving today.',
    'sos.otherVehicle': 'Another vehicle',
    'sos.otherVehicleHint': 'Not saved — describe it',
    'sos.problemType': 'Type of breakdown',
    'sos.autoSort': 'auto sort',
    'sos.details': 'Details',
    'sos.submit': 'Start SOS search',

    'sos.service': 'SOS service',
    'sos.welcomeTitle': 'Roadside assistance',
    'sos.welcomeLead':
      'You are about to report a breakdown. We find the garages able to handle it around you and rank them for you.',
    'sos.pointPosition': 'Your exact position is shared',
    'sos.pointPositionHint':
      'It is sent to the garage you pick, and to no one else, for the duration of the job.',
    'sos.pointVisible': 'What the garage sees',
    'sos.pointVisibleHint':
      'Your vehicle, the breakdown, your notes and your photo. Your number appears only once they accept.',
    'sos.pointData': 'How your data is handled',
    'sos.pointDataHint':
      'Position, request and messages are kept to track the job and prevent fraud. You may ask for their deletion.',
    'sos.pointSingle': 'One request at a time',
    'sos.pointSingleHint': 'Finish or cancel the current request before opening another.',
    'sos.emergencyNote':
      'If anyone is injured or in immediate danger, call the emergency services first. GeoCras is not a medical emergency service.',
    'sos.consent': 'I agree to share my position and to the processing of my data',
    'sos.consentRequired': 'Tick the box to continue',
    'sos.start': 'Start',
    'sos.cancel': 'Cancel',

    'sos.describeTitle': 'Describe the breakdown',
    'sos.vehicleOtherLabel': 'Specify the vehicle',
    'sos.vehicleOtherPlaceholder': 'Tricycle, minibus, machinery…',
    'sos.problemOtherLabel': 'Describe the breakdown',
    'sos.detailsPlaceholder': 'No sound when starting, headlights fading…',
    'sos.problemOtherPlaceholder': 'What happens, since when, what you have tried…',
    'sos.urgency': 'Urgency',
    'sos.immobilized': 'Vehicle immobilised',
    'sos.immobilizedHint': 'Determines whether towing is needed.',
    'sos.vulnerable': 'Child, elderly or injured person on board',
    'sos.vulnerableHint': 'Garages prioritise these jobs.',
    'sos.photo': 'Photo of the breakdown',
    'sos.photoOptional': 'Optional — helps the garage arrive equipped.',
    'sos.photoTake': 'Take',
    'sos.photoChoose': 'Choose',
    'sos.photoAttached': 'Photo attached',
    'sos.photoRemove': 'Remove photo',
    'sos.photoPermission': 'Permission denied.',
    'sos.photoFailed': 'Could not open the photo.',
    'sos.checkingActive': 'Looking for an ongoing request',
    'sos.checkingActiveLead':
      'We are checking whether you already have an open SOS, so you can pick up where you left off.',
    'sos.resumeTitle': 'Ongoing request',
    'sos.photoUploading': 'Uploading…',
    'sos.photoReady': 'Ready to send',
    'sos.photoUnavailable': 'Upload failed — the request will be sent without the photo.',
    'sos.photoNotConfigured':
      'Photos are not enabled on the server yet. The request will be sent without the image.',
    'sos.continue': 'Continue',

    'sos.reviewTitle': 'Check and send',
    'sos.reviewLead': 'One last look before alerting the garages.',
    'sos.vehicle': 'Vehicle',
    'sos.problem': 'Breakdown',
    'sos.position': 'Position',
    'sos.none': '—',
    'sos.yes': 'Yes',
    'sos.no': 'No',
    'sos.edit': 'Edit',
    'sos.back': 'Back',
    'sos.needAccount': 'Create an account to send a request',
    'sos.noPosition': 'Position unavailable — the request cannot be sent.',

    'results.title': 'Garages for your breakdown',
    'results.count': 'results',
    'results.countOne': 'result',
    'results.forProblem': 'Can handle:',
    'results.byCar': 'By car',
    'results.onFoot': 'On foot',
    'results.emptyLead':
      'No garage equipped for this breakdown within the radius. Call support, we will search for you.',
    'results.callSupport': 'Call support',
    'results.searching': 'Searching for garages…',
    'results.cancelRequest': 'Cancel the request',
    'results.cancelConfirmTitle': 'Cancel this SOS?',
    'results.cancelConfirmLead':
      'The request will be closed and no garage will be notified. You can start a new one right away.',
    'results.keepSearching': 'Keep searching',
    'results.pinnedLabel': 'Your request',
    'results.pinnedLead': 'You asked this garage for assistance. It is pinned at the top.',
    'results.pinnedMissing':
      'The garage you opened does not handle this breakdown. Here are the ones that do.',
    'results.pinnedDismiss': 'Hide this reminder',
    'results.nearestOutside': 'Nearest outside the radius',
    'results.sortDistance': 'Nearest',
    'results.sortRating': 'Top rated',
    'results.sortCertified': 'Certified',
    'results.empty': 'No garage within this radius',
    'results.widen': 'Widen the search',

    'garage.call': 'Call',
    'garage.directions': 'Directions',
    'garage.certified': 'Certified',
    'garage.open': 'Open',
    'garage.closed': 'Closed',
    'garage.reviews': 'Customer reviews',
    'garage.contact': 'Contact the garage',
    'garage.cannotReview': 'You must have completed a job with this garage',

    'garage.photos': 'Photos',
    'garage.reviewOne': 'review',
    'garage.reviewMany': 'reviews',
    'garage.noPhoto': 'No photo',
    'garage.today': 'Today',
    'garage.trade': 'In trade',
    'garage.years': 'years',
    'garage.yearsOne': 'year',
    'garage.towing': 'Towing',
    'garage.yes': 'Yes',
    'garage.no': 'No',
    'garage.open24h': '24h',
    'garage.about': 'About',
    'garage.services': 'Services',
    'garage.hours': 'Opening hours',
    'garage.route': 'Route',
    'garage.routeLead': 'Straight-line distance from your position.',
    'garage.routeNoPosition': 'Turn on location to see the distance.',
    'garage.reviewsAll': 'See more reviews',
    'garage.reviewsEmpty': 'No review yet. Be the first after a job.',
    'garage.rate': 'Rate',
    'garage.requestAssistance': 'Request assistance',
    'garage.noDirectContact':
      'Contacting a garage always goes through an assistance request: they need to know your breakdown before answering.',
    'garage.notFound': 'This garage cannot be found',

    'legal.provisional':
      'The complete contractual text is being finalised. This page already describes what the application actually does with your data.',
    'legal.contact': 'A question? Call support',

    'privacy.title': 'Privacy policy',
    'privacy.intro':
      'GeoCras connects stranded drivers with garages. We collect only what it takes to get a mechanic to you.',
    'privacy.collect': 'What we store',
    'privacy.collect1': 'Your name, phone number, city, and your email if you give one.',
    'privacy.collect2': 'Your vehicles: type, make, model, year, plate — only what you enter.',
    'privacy.collect3':
      'Your assistance requests: kind of breakdown, description, photo if you attach one, location at the time of the request.',
    'privacy.collect4': 'Your garage reviews and loyalty points.',
    'privacy.position': 'Your location',
    'privacy.position1':
      'It is read while the app is open, to show garages around you. It is sent to nobody until you start a request.',
    'privacy.position2':
      'During a job it is shared live with the mechanic you picked — and only them — so they can find you. That sharing stops when the job is closed.',
    'privacy.garage': 'What the mechanic sees',
    'privacy.garage1': 'Before they accept: your neighbourhood and the kind of breakdown. Neither your name nor your number.',
    'privacy.garage2': 'After they accept: your name, your number and your live location.',
    'privacy.garage3':
      'Never: your history, your loyalty points, your other vehicles, your trusted contacts.',
    'privacy.device': 'What never leaves your phone',
    'privacy.device1':
      'Your trusted contacts and your display and language settings stay on the device. They are never sent to our servers.',
    'privacy.rights': 'Your rights',
    'privacy.rights1': 'You can change your details at any time from “Manage my account”.',
    'privacy.rights2':
      'Deleting your account erases your requests, your reviews and your points. It is immediate and final.',

    'terms.title': 'Terms of use',
    'terms.intro':
      'By using GeoCras you accept the rules below. They describe what the app does, and what it does not.',
    'terms.role': 'Our role',
    'terms.role1':
      'GeoCras connects people. We do not repair vehicles and we do not employ mechanics: the job is an agreement between you and the garage you choose.',
    'terms.role2':
      'Certified garages have been checked on site by GeoCras. Certification can be withdrawn.',
    'terms.payment': 'Price and payment',
    'terms.payment1':
      'The price is agreed directly with the garage. GeoCras collects nothing and sets no rate.',
    'terms.payment2':
      'Never pay before the job. No registered mechanic is allowed to ask for a deposit to come out.',
    'terms.requests': 'Your requests',
    'terms.requests1': 'Only one request can be under way at a time.',
    'terms.requests2':
      'You can cancel until the mechanic has arrived. Repeated cancellations may limit access to the service.',
    'terms.requests3': 'Closing a job requires both parties to confirm, on site.',
    'terms.loyalty': 'Loyalty points',
    'terms.loyalty1':
      'Points reward jobs that actually happened and were verified. They hold no cash value until converted.',
    'terms.loyalty2':
      'Points obtained by fraud — fake jobs, colluding accounts — are reversed and the account may be closed.',
    'terms.account': 'Your account',
    'terms.account1': 'One phone number gives one account. It identifies you.',
    'terms.account2':
      'You remain responsible for what is done from your signed-in devices. You can sign them out at any time from the Security screen.',

    'security.title': 'Security',

    'security.contacts': 'Trusted contacts',
    'security.contactsLead':
      'Alert someone close in one tap when you break down. These contacts stay on this device: they are never sent to GeoCras.',
    'security.contactsEmpty': 'No contact saved yet.',
    'security.contactsFull': 'Three contacts at most — beyond that, nobody in particular gets alerted.',
    'security.contactAdd': 'Add a contact',
    'security.contactName': 'Name',
    'security.contactNamePlaceholder': 'My sister',
    'security.contactPhone': 'Number',
    'security.contactSave': 'Save this contact',
    'security.contactRemove': 'Remove this contact',
    'security.contactRemoveTitle': 'Remove this contact?',
    'security.sendPosition': 'Send my location',
    'security.sendPositionHint':
      'Opens your SMS app with the message ready. An SMS gets through where mobile data does not.',
    'security.smsBody': 'I have broken down, sent from GeoCras. My location',
    'security.noPosition': 'Location unavailable: turn on location to share where you are.',

    'security.account': 'Account access',
    'security.password': 'Change my password',
    'security.passwordHint': 'Also signs out the other devices',
    'security.devicesOne': 'device signed in',
    'security.devicesMany': 'devices signed in',
    'security.devicesLead': 'A signed-in device can open your account without the password.',
    'security.devicesSince': 'since',
    'security.devicesMultiple':
      'Several devices can reach your account. If one of them is no longer yours, sign it out.',
    'security.revokeOthers': 'Sign out other devices',
    'security.revokeOthersTitle': 'Sign out other devices?',
    'security.revokeOthersBody':
      'They will need your number and password again. This device stays signed in.',
    'security.revokedNone': 'No other device was signed in',
    'security.revokedOne': 'device signed out',
    'security.revokedMany': 'devices signed out',

    'security.visibility': 'What the mechanic sees',
    'security.visibilityBefore':
      'Before they accept: your neighbourhood and the kind of breakdown. Neither your name nor your number.',
    'security.visibilityAfter':
      'After they accept: your name, your number and your live location — for the length of the job, no longer.',
    'security.visibilityNever':
      'Never: your history, your loyalty points, your other vehicles, your trusted contacts.',

    'security.scams': 'Avoiding scams',
    'security.scam1':
      'Never pay before the job. No serious mechanic asks for a Mobile Money deposit to come out.',
    'security.scam2': 'Check the red shield: a certified garage was inspected on site by GeoCras.',
    'security.scam3':
      'The mechanic who shows up must be the one the app announced. Ask for the garage name before opening the bonnet.',
    'security.scam4':
      'Pay once the work is done, on site, and keep the Mobile Money receipt.',
    'security.report': 'Report a problem to support',

    'password.title': 'Change my password',
    'password.lead': 'Other signed-in devices will be signed out. This one stays signed in.',
    'password.current': 'Current password',
    'password.new': 'New password',
    'password.confirm': 'Confirm the new one',
    'password.tooShort': 'At least 8 characters',
    'password.mismatch': 'The two entries do not match',
    'password.same': 'The new password is the same as the old one',
    'password.submit': 'Save',
    'password.doneTitle': 'Password changed',
    'password.doneBody': 'The other devices have been signed out.',
    'password.doneBodyAlone': 'No other device was signed in.',

    'loyalty.title': 'My loyalty',
    'loyalty.balanceLabel': 'Points balance',
    'loyalty.points': 'pts',
    'loyalty.pending': 'awaiting confirmation',
    'loyalty.pendingHint':
      'Points from a job are confirmed after 24 h, while a dispute could still cancel it.',
    'loyalty.repairsDone': 'completed repairs',
    'loyalty.repairsDoneOne': 'completed repair',
    'loyalty.nextTier': 'Next grade',
    'loyalty.repairsLeftOne': 'repair to go',
    'loyalty.repairsLeftMany': 'repairs to go',
    'loyalty.maxTier': 'Top grade reached',
    'loyalty.maxTierLead': 'You are at the top of the ladder. Thank you for riding with us.',
    'loyalty.discountShort': 'off at certified garages',

    'loyalty.grades': 'The grades',
    'loyalty.gradesLead':
      'They are earned in completed repairs, never in points: points are spent, a grade is not.',
    'loyalty.stateCurrent': 'Your grade',
    'loyalty.stateReached': 'Earned',
    'loyalty.stateLocked': 'To reach',
    'loyalty.condition': 'Requirement',
    'loyalty.fromStart': 'From sign-up',
    'loyalty.repairOne': 'repair',
    'loyalty.repairMany': 'repairs',
    'loyalty.discount': 'Certified garage discount',

    'loyalty.badges': 'My badges',
    'loyalty.badgeLocked': 'Locked',

    'loyalty.earn': 'How to earn points',
    'loyalty.checks': 'How points are verified',
    'loyalty.checksBody':
      'A job only counts if both parties confirmed arrival, the mechanic actually travelled, and the intervention lasted more than three minutes. Points land as pending, then become usable after 24 h.',
    'loyalty.referral': 'My referral code',
    'loyalty.referralLead':
      'Your guest gets their points at sign-up; yours land when they complete their first job.',
    'loyalty.referralShare': 'Share my code',
    'loyalty.referralMessage': 'Join me on GeoCras with my referral code',
    'loyalty.history': 'Recent movements',
    'loyalty.historyEmpty': 'No movement yet.',
    'loyalty.statePendingLabel': 'Pending',
    'loyalty.stateConfirmedLabel': 'Confirmed',
    'loyalty.stateReversedLabel': 'Reversed',
    'loyalty.failed': 'Loyalty unavailable',

    'month.1': 'January',
    'month.2': 'February',
    'month.3': 'March',
    'month.4': 'April',
    'month.5': 'May',
    'month.6': 'June',
    'month.7': 'July',
    'month.8': 'August',
    'month.9': 'September',
    'month.10': 'October',
    'month.11': 'November',
    'month.12': 'December',

    'history.title': 'History',
    'history.ongoing': 'Ongoing',
    'history.resume': 'Back to tracking',
    'history.requestsOne': 'request',
    'history.requestsMany': 'requests',
    'history.emptyTitle': 'No request yet',
    'history.emptyLead':
      'Your SOS calls will show up here: which garage came, when, how long it took, and your rating.',
    'history.emptyAction': 'Open the map',
    'history.emptyLeadGarage':
      'Your jobs will show up here: who you helped, when, and how long it took.',
    'history.loadMore': 'Load older ones',
    'history.failed': 'History unavailable',
    'history.rate': 'Rate this garage',
    'history.rated': 'Rated',
    'history.noGarage': 'No garage picked',
    'history.duration': 'duration',
    'history.cancelledBy': 'Reason',

    'day.mon': 'Monday',
    'day.tue': 'Tuesday',
    'day.wed': 'Wednesday',
    'day.thu': 'Thursday',
    'day.fri': 'Friday',
    'day.sat': 'Saturday',
    'day.sun': 'Sunday',

    'review.label': 'Your review',
    'review.title': 'Rate this garage',
    'review.lead': 'Your rating is public and signed with your first name. It helps the next driver stranded on the road choose.',
    'review.ratingLabel': 'Your rating',
    'review.rate1': 'Poor',
    'review.rate2': 'Disappointing',
    'review.rate3': 'Fair',
    'review.rate4': 'Good',
    'review.rate5': 'Excellent',
    'review.ratingRequired': 'Tap a star to rate',
    'review.commentLabel': 'Your comment',
    'review.commentOptional': 'Optional',
    'review.commentPlaceholder': 'What went well, how long it took, the price quoted…',
    'review.publish': 'Publish my review',
    'review.published': 'Review published',
    'review.cannotTitle': 'Rating unavailable',
    'review.needsClosed': 'You will be able to rate this garage after a completed job with them.',
    'review.alreadyDone': 'You have already rated your job with this garage.',
    'review.needsAccount': 'Sign in to rate this garage.',

    'results.sheetTitle': 'Suggested garages',
    'results.sortedBy': 'Sorted by',
    'results.expandList': 'See the whole list',
    'results.collapseList': 'Collapse the list',
    'results.routeShown': 'Estimated route',
    'results.routeStraight': 'Straight line, until road routing lands.',
    'results.routeHide': 'Hide the route',

    'garage.details': 'Details',
    'garage.sendSos': 'Send the SOS',
    'garage.sendSosHint': 'Commits your request to this garage for good',

    'confirm.label': 'Confirmation',
    'confirm.title': 'Send your SOS to this garage?',
    'confirm.privacy': 'What the garage sees',
    'confirm.privacyLead':
      'They get the type of breakdown and your neighbourhood. Your number and exact position are shared only once they accept to handle your case.',
    'confirm.now': 'Right now',
    'confirm.afterAccept': 'If they accept',
    'confirm.phone': 'Number',
    'confirm.position': 'Position',
    'confirm.positionHidden': 'Neighbourhood only',
    'confirm.positionShared': 'Exact, live',
    'confirm.irreversible': 'This cannot be undone',
    'confirm.irreversibleLead':
      'The request goes to this garage and stays attached to it. To pick another one you will have to cancel and raise a new SOS.',
    'confirm.send': 'Send the SOS',
    'confirm.keepComparing': 'Keep comparing',

    'awaiting.label': 'Request sent',
    'awaiting.title': 'Waiting for an answer',
    'awaiting.lead':
      'The garage has received your request. They must accept it before setting off.',
    'awaiting.waitingFor': 'Waiting for',
    'awaiting.step1': 'Request sent',
    'awaiting.step2': 'Garage accepts',
    'awaiting.step3': 'On the way to you',
    'awaiting.pending': 'pending',
    'awaiting.masked':
      'Your number and exact position stay hidden until the garage accepts.',
    'awaiting.noAnswer':
      'With no answer within a few minutes, cancel and pick another garage.',
    'awaiting.cancelConfirmLead':
      'The garage will be told you cancelled. You can raise a new SOS right away.',
    'awaiting.loading': 'Loading the tracking view…',

    'tracking.enRoute': 'The mechanic is on the way',
    'tracking.toYou': 'To you',
    'tracking.toGarage': 'To garage',
    'tracking.confirmArrival': 'Confirm arrival',
    'tracking.onFoot': 'on foot',
    'tracking.updated': 'UPD',
    'tracking.degraded': 'Unstable connection',
    'tracking.offline': 'Offline',

    'state.loading': 'Loading…',
    'state.initializing': 'Starting…',
    'state.retrying': 'Trying again…',
    'state.retry': 'Try again',
    'state.offlineTitle': 'Server unreachable',
    'state.offlineBody':
      'Your phone cannot reach GeoCras. Check your connection, then try again.',
    'state.errorTitle': 'Something broke',
    'state.errorBody': 'The server answered badly. This is not your fault.',
    'state.notFoundTitle': 'Not found',
    'state.notFoundBody': 'This page does not exist, or no longer does.',
    'state.deniedTitle': 'Account required',
    'state.deniedBody': 'Sign in to open this page.',
    'state.offlineBanner': 'Offline — what you see may be out of date',

    'results.cancelling': 'Cancelling…',
    'results.cancelOffline': 'Request still active: the server is unreachable.',
    'results.cancelFailed': 'Request still active: the cancellation did not go through.',

    'driving.ready': 'Ready to drive?',
    'driving.readyLead': 'Real-time alerts: lights, obstacles, blind spots and side impacts.',
    'driving.mode': 'Driving mode',
    'driving.start': 'Start',
    'driving.pause': 'Pause',
    'driving.resume': 'Resume',
    'driving.stop': 'Stop',
    'driving.recording': 'Recording…',
    'driving.activeSession': 'Active session',
    'driving.alerts': 'Alerts',
    'driving.distance': 'Distance',
    'driving.score': 'Score',
    'driving.soundAlerts': 'Sound alerts',
    'driving.blindSpot': 'Blind spot detection',
    'driving.kmh': 'km/h',
    'driving.watching': 'The road is being watched',

    'settings.title': 'Settings',

    'settings.appearance': 'Appearance',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.auto': 'Auto',

    'settings.language': 'Language',
    'settings.languageFr': 'Français',
    'settings.languageEn': 'English',

    'settings.search': 'Map search',

    'settings.vehicles': 'My vehicles',
    'settings.vehiclesNone': 'No vehicle saved',
    'settings.vehiclesTitle': 'My vehicles',
    'settings.vehiclesLead':
      'The default vehicle is the one sent with your SOS, so the mechanic knows what to bring.',
    'settings.vehicleAdd': 'Add a vehicle',
    'settings.vehicleNew': 'New vehicle',
    'settings.vehicleEditing': 'Edit vehicle',
    'settings.vehicleNoPlate': 'No plate saved',
    'settings.vehicleRemoveFailed': 'The vehicle could not be deleted.',
    'settings.vehicleEdit': 'Edit',
    'settings.vehicleDefault': 'Default',
    'settings.vehicleSetDefault': 'Make default',
    'settings.vehicleRemove': 'Delete',
    'settings.vehicleRemoveTitle': 'Delete this vehicle?',
    'settings.vehicleRemoveBody': 'Your past requests keep a record of it.',
    'settings.vehicleType': 'Type',
    'settings.vehicleBrand': 'Make',
    'settings.vehicleBrandPlaceholder': 'Toyota',
    'settings.vehicleModel': 'Model',
    'settings.vehicleModelPlaceholder': 'Corolla',
    'settings.vehicleYear': 'Year',
    'settings.vehiclePlate': 'Plate',
    'settings.vehiclePlatePlaceholder': 'LT 4821 AB',
    'settings.vehiclePlateHint': 'It helps the mechanic recognise you on arrival.',
    'settings.vehicleSave': 'Save',
    'settings.vehicleMax': 'Five vehicles at most.',

    'settings.notifications': 'Notifications',
    'settings.notificationsSystem': 'Phone alerts',
    'settings.haptics': 'Vibration',
    'settings.notificationsDeniedHint':
      'You blocked them. The phone will not ask again: it has to be changed in its settings.',
    'settings.notificationsPending': 'Job alerts will arrive in a coming version.',

    'settings.about': 'About',
    'settings.version': 'Version',
    'settings.support': 'Support',
    'settings.privacy': 'Privacy policy',
    'settings.terms': 'Terms of use',

    'common.callSupport': 'Call support',

    'soon.drivingTitle': 'Driving mode',
    'soon.drivingLead':
      'Driving mode will show your speed, alerts along the way and a driving score on arrival. It opens soon.',

    'common.cancel': 'Cancel',
    'common.retry': 'Retry',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.loading': 'Loading…',
    'common.error': 'Failed',

    // — Mechanic side: the work desk ——————————————————————————————
    'jobs.deskLabel': 'Work desk',
    'jobs.listening': 'LISTENING',
    'jobs.deskUnstable': 'LINK UNSTABLE',
    'jobs.soon': 'SOON',
    'jobs.detectionOpen': 'Detection open',

    'jobs.queueLabel': 'SOS waiting',
    'jobs.oldestWaiting': 'Longest wait',
    'jobs.firstToHandle': 'Take this one first',
    'jobs.queueMix': 'Split by urgency',

    'jobs.calmTitle': 'Nobody waiting',
    'jobs.calmLead':
      'Your garage is on the map and listening for SOS calls. The first driver who picks you shows up here, and the phone rings.',
    'jobs.calmClosedLead':
      'Your garage shows up in no search: no SOS can reach you while detection is closed.',
    'jobs.reopenDetection': 'Reopen from My garage',

    'jobs.commitments': 'Your commitments',
    'jobs.commitmentsLead':
      'What you accepted and have not finished. Each one is waiting on your next move.',
    'jobs.awaitingClientShort': 'Waiting for the client',

    'jobs.radarTile': 'Radar',
    'jobs.radarLead':
      'Coming soon: breakdowns reported around your workshop, before a driver even picks you.',

    'jobs.sosTitle': 'SOS requests',
    'jobs.incoming': 'To handle',
    'jobs.active': 'In progress',

    'jobs.stateToAnswer': 'TO ANSWER',
    'jobs.stateToLeave': 'TO LEAVE',
    'jobs.stateDriving': 'ON THE WAY',
    'jobs.stateToConfirm': 'ARRIVAL TO CONFIRM',
    'jobs.stateOngoing': 'ONGOING',

    'jobs.distance': 'Distance',
    'jobs.approach': 'Approach',
    'jobs.waiting': 'Waiting',
    'jobs.words': 'What the client says',
    'jobs.constraints': 'Bring along',
    'jobs.requester': 'The requester',
    'jobs.where': 'Where',

    'jobs.dangerBanner': 'Danger reported — intervene first',
    'jobs.immobilized': 'Cannot be driven',
    'jobs.immobilizedLead': 'Plan for a flatbed or a tow bar.',
    'jobs.vulnerable': 'Vulnerable passengers',
    'jobs.vulnerableLead': 'A child, an elderly or injured person on board.',
    'jobs.noPhoto': 'No photo sent',
    'jobs.phoneHidden': 'Number hidden until you accept',
    'jobs.areaOnly': 'Approximate area. The exact spot shows as soon as you accept.',
    'jobs.approxLocation': 'approximate location',
    'jobs.gone': 'This request has left your queue. The client may have cancelled it.',

    'jobs.accept': 'Accept',
    'jobs.decline': 'Decline',
    'jobs.callClient': 'Call',
    'jobs.goThere': 'Go there',
    'jobs.enRoute': 'Leaving',
    'jobs.confirmArrival': 'I have arrived',
    'jobs.waitingClient': 'Arrival recorded — waiting for the client',

    'jobs.declineTitle': 'Decline this request?',
    'jobs.declineBody':
      'The client will be notified and will resume the search: the request stays open and another garage will be picked. It leaves your queue.',
    'jobs.declineReason': 'garage unavailable',

    // — Route ————————————————————————————————————————————————————
    'jobs.timeToArrive': 'Drive time',
    'jobs.arrivalAt': 'Arrival',
    'jobs.recenter': 'Recentre on the route',
    'jobs.waitingGps': 'Looking for your position…',
    'jobs.roughEstimate':
      'Straight-line estimate: road routing did not answer. Expect longer.',

    'jobs.closedTitle': 'Detection closed',
    'jobs.closedBody':
      'Your garage shows in no search: no new SOS can reach you. Reopen detection from “My garage”.',
    'jobs.noGarage': 'No garage is attached to this account.',
    'jobs.emptyTitle': 'No request',
    'jobs.emptyLead':
      'Your garage is listening. SOS calls from stranded drivers around you will land here.',

    // — Client side: live tracking ————————————————————————————————
    'proximity.label': 'Nearby',
    'proximity.question': 'Can you see them?',
    'proximity.confirm': 'I see them',
    'proximity.call': 'Call',
    'proximity.dismiss': 'Not yet',

    'proximity.garageLead':
      'You have reached the breakdown area. Look around — the vehicle should be in sight.',
    'proximity.clientLead':
      'Your mechanic is very close to the breakdown spot, and may already be looking for you.',


    'live.stepAccepted': 'Accepted',
    'live.stepEnRoute': 'On the way',
    'live.stepArrived': 'On site',
    'live.stepConfirmed': 'Confirmed',
    'live.arrivesIn': 'Arrives in',
    'live.onSite': 'On site',
    'live.moving': 'Approaching',
    'live.stopped': 'Stopped — traffic or a break',
    'live.notMovingYet': 'The mechanic has not sent a position yet: route from the workshop.',
    'live.roughEstimate':
      'Straight-line estimate: road routing did not answer. Expect longer.',
    'live.degraded': 'Unstable connection — this information may be outdated.',
    'live.callMechanic': 'Call',
    'live.confirmArrival': 'He has arrived',
    'live.confirmedWaiting': 'Waiting for the mechanic',
    'live.confirmTitle': 'Has the mechanic arrived?',
    'live.confirmBody':
      'Only confirm if he is really on site. The job closes when you both confirm, and that is what releases your points.',
    'live.confirmAction': 'Yes, he is here',
    'live.doneTitle': 'Job completed',
    'live.doneLead': 'You both confirmed the arrival. Your points are credited.',
    'live.doneSummary': 'Summary',
    'live.rate': 'Rate this garage',
    'live.backToMap': 'Back to the map',
    'live.overTitle': 'This request is closed',
    'live.overLead': 'It was cancelled or completed. Start a new SOS from the map if needed.',

    // — Client side: the garage declined ——————————————————————————
    'results.declinedLabel': 'Garage answer',
    'results.declinedTitle': 'This garage cannot come',
    'results.declinedLead':
      'Your request stays open, nothing to fill in again. Pick another garage below.',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['fr'];

/** Messages d'erreur, indexés par CODE serveur — jamais par message brut. */
export const errorMessages: Record<'fr' | 'en', Partial<Record<ErrorCode, string>>> = {
  fr: {
    VALIDATION_ERROR: 'Certaines informations sont incorrectes',
    UNAUTHORIZED: 'Veuillez vous reconnecter',
    FORBIDDEN: "Vous n'avez pas accès à cette action",
    NOT_FOUND: 'Introuvable',
    PHONE_TAKEN: 'Ce numéro est déjà utilisé',
    INVALID_CREDENTIALS: 'Numéro ou mot de passe incorrect',
    RATE_LIMITED: 'Trop de tentatives, réessayez plus tard',
    GARAGE_NOT_FOUND: 'Ce garage n’existe plus',
    REQUEST_NOT_FOUND: 'Demande introuvable',
    REQUEST_NOT_CLOSED: 'L’intervention doit être terminée',
    REQUEST_ALREADY_ACTIVE: 'Vous avez déjà une demande en cours',
    ALREADY_REVIEWED: 'Vous avez déjà noté cette intervention',
    INVALID_STATE_TRANSITION: 'Action impossible à ce stade',
    NOT_A_PARTY: 'Vous n’êtes pas concerné par cette demande',
    REFERRAL_INVALID: 'Code de parrainage invalide',
    VEHICLE_NOT_FOUND: 'Véhicule introuvable',
    UPLOADS_NOT_CONFIGURED: 'L’envoi de photos est indisponible',
    ACCOUNT_HAS_ACTIVE_REQUEST:
      'Une intervention est en cours : terminez-la ou annulez-la avant de supprimer le compte',
    GARAGE_ALREADY_OWNED: 'Ce compte gère déjà un garage',
    GARAGE_NOT_VERIFIED: 'Votre garage est encore en cours de vérification',
    GARAGE_ALREADY_VERIFIED:
      'Votre garage est déjà vérifié : son dossier ne se modifie plus depuis l’application',
    INTERNAL_ERROR: 'Une erreur est survenue',
  },
  en: {
    VALIDATION_ERROR: 'Some information is incorrect',
    UNAUTHORIZED: 'Please sign in again',
    FORBIDDEN: 'You do not have access to this action',
    NOT_FOUND: 'Not found',
    PHONE_TAKEN: 'This number is already in use',
    INVALID_CREDENTIALS: 'Incorrect number or password',
    RATE_LIMITED: 'Too many attempts, try again later',
    GARAGE_NOT_FOUND: 'This garage no longer exists',
    REQUEST_NOT_FOUND: 'Request not found',
    REQUEST_NOT_CLOSED: 'The job must be completed first',
    REQUEST_ALREADY_ACTIVE: 'You already have an ongoing request',
    ALREADY_REVIEWED: 'You have already reviewed this job',
    INVALID_STATE_TRANSITION: 'This action is not possible right now',
    NOT_A_PARTY: 'This request does not concern you',
    REFERRAL_INVALID: 'Invalid referral code',
    VEHICLE_NOT_FOUND: 'Vehicle not found',
    UPLOADS_NOT_CONFIGURED: 'Photo upload is unavailable',
    ACCOUNT_HAS_ACTIVE_REQUEST:
      'A job is under way: finish or cancel it before deleting the account',
    GARAGE_ALREADY_OWNED: 'This account already manages a garage',
    GARAGE_NOT_VERIFIED: 'Your garage is still under review',
    GARAGE_ALREADY_VERIFIED:
      'Your garage is already verified: its application can no longer be edited from the app',
    INTERNAL_ERROR: 'Something went wrong',
  },
};
