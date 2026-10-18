/* site/site.js - Logique d'interface et dictionnaire bilingue pour GitHub Pages */
const I18N = {
  fr: {
    // Navigation
    'nav.marque': 'MyTeam',
    'nav.sous-titre': 'Le Bureau des agents',
    'nav.presentation': 'Présentation',
    'nav.fonctions': 'Fonctionnalités',
    'nav.captures': 'Captures',
    'nav.installation': 'Installation',
    'nav.compatibilite': 'Compatibilité',
    'nav.contribuer': 'Participer',
    'nav.telecharger': 'Télécharger',
    'nav.code': 'Code source',
    'nav.langue.aria': 'Changer la langue (FR / EN)',

    // Hero
    'hero.badge': '100% Local · Zéro Dépendance npm · Vérité des faits',
    'hero.titre': 'Surveillez, lisez et dirigez vos agents d\'IA dans un atelier vivant en pixel art',
    'hero.description': 'Un tableau de bord local immersif pour orchestrer vos équipes d\'agents autonomes exécutés dans Herdr. Fini les terminaux aveugles : chaque agent a son poste, ses outils et ses dossiers visibles.',
    'hero.btn-telecharger': 'Télécharger la release v0.4.0',
    'hero.btn-github': 'Voir le projet sur GitHub',
    'hero.preview-caption': 'Scène vivante de l\'atelier : chef au bureau Direction, tableau mural, collaborateurs à leurs postes et salle de réflexion.',

    // Piliers (3 idées)
    'pillars.badge': 'Philosophie',
    'pillars.titre': 'Ce que c\'est en trois idées',
    'pillars.desc': 'Conçu pour reprendre le contrôle visuel sur l\'activité des agents sans artifice ni mensonge.',
    
    'pillar1.num': '01. Observer',
    'pillar1.titre': 'Voir qui fait quoi en direct',
    'pillar1.text': 'Chaque collaborateur a son poste de travail identifié par l\'emblème pixel art de son outil. Voyez en un coup d\'œil qui tape, qui attend une confirmation, qui prend une pause de quota ou qui prépare son dossier.',

    'pillar2.num': '02. Coordonner',
    'pillar2.titre': 'Diriger avec méthode et calme',
    'pillar2.text': 'Le chef d\'équipe s\'assoit au bureau Direction. Dès qu\'une délégation intervient dans son journal, il se lève pour apporter le dossier au collaborateur. Une file d\'attente intelligente et une salle de crise sécurisent chaque envoi.',

    'pillar3.num': '03. Vérité',
    'pillar3.titre': 'Ne rien inventer, tout prouver',
    'pillar3.text': 'Zéro pourcentage inventé, zéro humeur fictive. Tout provient exclusivement des faits mesurés : processus Herdr réels, fichiers sur votre disque, journaux locaux et horloge de votre machine.',

    // Grille des fonctionnalités
    'features.badge': 'Capacités réelles',
    'features.titre': 'Un bureau complet, sans compromis',
    'features.desc': 'Chaque fonction est testée et s\'appuie exclusivement sur des faits observés sur votre machine.',

    'feat.scene.title': 'Scène vivante et ambiance lumineuse',
    'feat.scene.desc': 'Vue panoramique calée sur votre horloge système : lever de soleil à 6 h 30, coucher à 19 h 30, éclairage chaleureux des lampes de bureau en soirée.',

    'feat.postes.title': 'Poste individuel et terminal en direct',
    'feat.postes.desc': 'Lecture du terminal sans pollution : surlignage des erreurs et des succès, défilement fluide, recherche textuelle instantanée et saut aux résultats.',

    'feat.direction.title': 'Bureau Direction et délégations',
    'feat.direction.desc': 'Le chef d\'équipe coordonne les agents. Sur chaque délégation observée, il quitte son bureau pour remettre physiquement le dossier à son collègue.',

    'feat.relais.title': 'Relais d\'écoute du chef',
    'feat.relais.desc': 'Alerte discrète et neutre mise en file pour le chef dès qu\'un collaborateur termine sa tâche, l\'invitant à relire son panneau avant de lui confier la suite.',

    'feat.mosaique.title': 'Mosaïque multi-terminaux',
    'feat.mosaique.desc': 'Basculez de la scène à une grille de 2 à 4 terminaux en direct avec recherche simultanée, consigne rapide et agrandissement à la demande.',

    'feat.reponses.title': 'Réponses lisibles en Markdown',
    'feat.reponses.desc': 'Extraction des réponses réelles de l\'agent, filtrées de tout contenu privé ou raisonnement brut, avec copie en un clic et fil de discussion complet.',

    'feat.fichiers.title': 'Fichiers joints et suivi des faits',
    'feat.fichiers.desc': 'Associez des documents de travail en toute sécurité. Le bureau observe les créations et modifications réelles sur disque sans jamais rien écraser.',

    'feat.taches.title': 'Suivi factuel des tâches',
    'feat.taches.desc': 'Centralisation en temps réel des cases cochées dans TODO.md et des plans d\'action publiés par les agents eux-mêmes, sans pourcentage artificiel.',

    'feat.crise.title': 'Salle de crise sous clapet',
    'feat.crise.desc': 'Bouton protégé (Ctrl+Maj+C) pour geler immédiatement les départs de consignes en cas d\'urgence et demander un arrêt poli par la touche Échap.',

    'feat.kit.title': 'Kit d\'équipe et collaboration',
    'feat.kit.desc': 'Règles communes (AGENTS.md), consignes du chef (CHEF.md) et mémoire collective des leçons (LESSONS.md) prêtes à être déployées dans vos projets.',

    'feat.bilingue.title': 'Interface 100% bilingue FR / EN',
    'feat.bilingue.desc': 'Basculez à tout moment entre le français et l\'anglais d\'un simple clic, avec détection de la langue du navigateur et mémorisation locale.',

    'feat.securite.title': 'Sécurité et souveraineté locale',
    'feat.securite.desc': 'Écoute strictement restreinte à 127.0.0.1, jeton aléatoire de session, zéro appel sortant, zéro dépendance npm, zéro secret intercepté.',

    // Galerie
    'gallery.badge': 'Interface',
    'gallery.titre': 'L\'atelier sous tous les angles',
    'gallery.desc': 'Cliquez sur une capture pour l\'agrandir en haute définition.',
    'gallery.scene.title': 'Scène principale de jour',
    'gallery.scene.desc': 'Le chef au bureau Direction, les postes de travail et la salle de réflexion vitrée.',
    'gallery.soir.title': 'Ambiance de soirée',
    'gallery.soir.desc': 'Éclairage tamisé automatique dès 19 h 00 avec suspensions et lampes de bureau allumées.',
    'gallery.poste.title': 'Onglet Poste de travail',
    'gallery.poste.desc': 'Terminal interactif en direct avec filtres de couleurs et zone de consigne rapide.',
    'gallery.equipe.title': 'Onglet Équipe et file d\'attente',
    'gallery.equipe.desc': 'Supervision de l\'effectif, attribution du rôle de chef et file d\'attente prioritaire.',
    'gallery.mosaique.title': 'Mode Mosaïque multi-terminaux',
    'gallery.mosaique.desc': 'Surveillance simultanée de plusieurs agents au travail avec recherche réactive.',
    'gallery.crise.title': 'Salle de crise active',
    'gallery.crise.desc': 'Verrouillage de sécurité des envois et interruption polie sans destruction de processus.',
    'gallery.emblemes.title': 'Planche des 24 emblèmes d\'outils',
    'gallery.emblemes.desc': 'Représentations pixel art 16x16 pour identifier chaque IA compatible Herdr.',

    // Installation
    'install.badge': 'Démarrage immédiat',
    'install.titre': 'Installation en trois gestes',
    'install.desc': 'Aucun outil de compilation requis. Node.js (>= 22) et Herdr suffisent.',
    
    'step1.badge': 'Geste 1',
    'step1.title': 'Télécharger l\'archive',
    'step1.desc': 'Récupérez le fichier ZIP de la dernière version stable sur GitHub et décompressez-le dans le dossier de votre choix.',
    'step1.snippet': 'MyTeam-v0.4.0.zip (sans dépendance externe)',

    'step2.badge': 'Geste 2',
    'step2.title': 'Lancer l\'installation',
    'step2.desc': 'Sous Windows, double-cliquez sur Installer MyTeam.bat. L\'installeur animé démarre directement, vérifie les prérequis et prépare la grille Herdr 2x2.',
    'step2.snippet': 'Installer MyTeam.bat (ou bash scripts/installer.sh)',

    'step3.badge': 'Geste 3',
    'step3.title': 'Ouvrir le bureau',
    'step3.desc': 'Double-cliquez sur le raccourci « Herdr et bureau » créé sur votre Bureau, ou lancez node server.mjs et ouvrez votre navigateur.',
    'step3.snippet': 'http://127.0.0.1:4317',

    'smartscreen.title': 'Note de confiance sur l\'avertissement Windows SmartScreen',
    'smartscreen.desc': 'Comme tout script .bat téléchargé depuis Internet sans certificat commercial payant, Windows SmartScreen peut afficher un écran bleu préventif (« Windows a protégé votre ordinateur »). Le projet est entièrement auditable et à code ouvert : cliquez sur Informations complémentaires puis Exécuter quand même, ou faites un clic droit sur le fichier .bat > Propriétés > Débloquer.',

    'alt.macos.title': 'Sous macOS et Linux',
    'alt.macos.desc': 'Ouvrez un terminal dans le dossier et lancez le script bash interactif :',
    'alt.git.title': 'Pour les développeurs (via Git)',
    'alt.git.desc': 'Clonez directement le dépôt public et démarrez :',

    // Compatibilité
    'tools.badge': 'Écosystème',
    'tools.titre': 'Compatible avec les 24 outils Herdr',
    'tools.desc': 'MyTeam reconnaît automatiquement l\'ensemble des 24 outils d\'IA gérés par Herdr.',
    'tools.info.title': 'Détection automatique et emblèmes dédiés',
    'tools.info.p1': 'Lors de la préparation de votre grille Herdr 2x2, l\'installeur teste dans votre environnement la présence de chacun des 24 outils compatibles et vous propose de les lancer panneau par panneau.',
    'tools.info.p2': 'Chaque outil possède son propre emblème 16x16 sur le bureau. Claude, Codex et OpenCode bénéficient en plus d\'un lecteur de journaux locaux extrayant les réponses réelles, les jetons consommés et l\'historique.',
    'tools.list.legend': 'Outils à télémétrie enrichie :',

    // Contribuer
    'contrib.badge': 'Communauté',
    'contrib.titre': 'Participer au projet',
    'contrib.desc': 'MyTeam est un projet libre et indépendant sous licence MIT. Les contributions sont les bienvenues.',
    'contrib.card1.title': 'Signaler un défaut',
    'contrib.card1.desc': 'Vous avez constaté un écart avec la vérité des faits ou une anomalie d\'affichage ? Ouvrez un rapport précis.',
    'contrib.card1.link': 'Créer une issue sur GitHub',
    'contrib.card2.title': 'Proposer un outil ou une idée',
    'contrib.card2.desc': 'Vous souhaitez intégrer un nouvel outil dans Herdr ou proposer une amélioration ergonomique ?',
    'contrib.card2.link': 'Rejoindre les discussions',
    'contrib.card3.title': 'Consulter le guide de contribution',
    'contrib.card3.desc': 'Architecture du code, zéro dépendance, validation par tests : découvrez nos règles de développement.',
    'contrib.card3.link': 'Lire CONTRIBUTING.md',

    // Footer
    'footer.brand-desc': 'Le tableau de bord vivant en pixel art pour superviser vos équipes d\'agents d\'intelligence artificielle autonomes.',
    'footer.col-doc': 'Documentation',
    'footer.col-repo': 'Dépôt GitHub',
    'footer.col-legal': 'Projet',
    'footer.link-install': 'Guide d\'installation',
    'footer.link-aide': 'Mode d\'emploi',
    'footer.link-kit': 'Kit d\'équipe',
    'footer.link-releases': 'Dernières releases',
    'footer.link-issues': 'Tickets & bogues',
    'footer.link-discussions': 'Espace discussions',
    'footer.link-conduct': 'Code de conduite',
    'footer.link-security': 'Sécurité',
    'footer.link-notice': 'Marques tierces',
    'footer.credit': 'Réalisé avec l\'aide de l\'IA (Claude, Codex, Antigravity, OpenCode). Auteur et contributeur : DrSmoke (BlackAngel242).',
    'footer.license': 'Distribué sous licence libre MIT.',
    'footer.top': 'Haut de page'
  },

  en: {
    // Navigation
    'nav.marque': 'MyTeam',
    'nav.sous-titre': 'The Agent Office',
    'nav.presentation': 'Overview',
    'nav.fonctions': 'Features',
    'nav.captures': 'Screenshots',
    'nav.installation': 'Installation',
    'nav.compatibilite': 'Compatibility',
    'nav.contribuer': 'Contribute',
    'nav.telecharger': 'Download',
    'nav.code': 'Source Code',
    'nav.langue.aria': 'Switch language (FR / EN)',

    // Hero
    'hero.badge': '100% Local · Zero npm Dependencies · Factual Truth',
    'hero.titre': 'Monitor, inspect, and direct your AI agent teams in a living pixel art workshop',
    'hero.description': 'An immersive local dashboard to orchestrate your autonomous agent teams running in Herdr. No more blind consoles: every agent has their own desk, tool emblem, and visible dossiers.',
    'hero.btn-telecharger': 'Download release v0.4.0',
    'hero.btn-github': 'View project on GitHub',
    'hero.preview-caption': 'Live workshop scene: lead at the Direction desk, status board, team workstations, and glass reflection room.',

    // Piliers (3 idées)
    'pillars.badge': 'Philosophy',
    'pillars.titre': 'Three Core Principles',
    'pillars.desc': 'Designed to regain full visual awareness over agent activity without illusions or fabricated data.',
    
    'pillar1.num': '01. Observe',
    'pillar1.titre': 'See who is doing what live',
    'pillar1.text': 'Every teammate has a dedicated workstation identified by their tool\'s 16x16 pixel art emblem. Spot at a single glance who is typing, awaiting confirmation, taking a quota break, or completing tasks.',

    'pillar2.num': '02. Coordinate',
    'pillar2.titre': 'Lead with calm and structure',
    'pillar2.text': 'The team lead sits at the Direction desk. When delegating in their log, they physically walk across the room to hand over the folder. A smart queue and a crisis room safeguard outgoing prompts.',

    'pillar3.num': '03. Truth',
    'pillar3.titre': 'Never invent, always prove',
    'pillar3.text': 'Zero invented progress percentages, zero fake moods. Every indicator comes exclusively from measured facts: live Herdr processes, local disk files, tool logs, and system clock.',

    // Grille des fonctionnalités
    'features.badge': 'Real Features',
    'features.titre': 'A Complete Office, No Compromise',
    'features.desc': 'Every feature is thoroughly tested and grounded in facts observed on your machine.',

    'feat.scene.title': 'Living scene and day-night lighting',
    'feat.scene.desc': 'Panoramic window synced with your local system clock: sunrise at 6:30 AM, sunset at 7:30 PM, and cozy ceiling and desk lamps in the evening.',

    'feat.postes.title': 'Workstation tab and live terminal',
    'feat.postes.desc': 'Clean terminal reading without noise: color highlights for errors and success, smooth scrolling, instant text search, and jump to matches.',

    'feat.direction.title': 'Direction desk and embodied rounds',
    'feat.direction.desc': 'The lead coordinates teammates. Whenever a delegation is observed, they leave their desk to physically deliver the titled folder to their colleague.',

    'feat.relais.title': 'Lead notification relay',
    'feat.relais.desc': 'A discreet and neutral queued reminder for the lead whenever a teammate finishes work, prompting them to review the terminal before delegating next.',

    'feat.mosaique.title': 'Multi-terminal mosaic mode',
    'feat.mosaique.desc': 'Switch from the scene to a live grid of 2 to 4 terminal tiles with unified text search, quick prompt dispatch, and single-tile expansion.',

    'feat.reponses.title': 'Readable Markdown answers',
    'feat.reponses.desc': 'Extraction of clean final responses, filtered from internal reasoning or private paths, with one-click copy and full thread history.',

    'feat.fichiers.title': 'Attached files and task tracking',
    'feat.fichiers.desc': 'Attach project documents securely. The office monitors actual disk modifications and creations without overwriting existing files.',

    'feat.taches.title': 'Factual task tracking',
    'feat.taches.desc': 'Real-time monitoring of checked boxes in TODO.md and action plans published by agents themselves, with zero simulated percentages.',

    'feat.crise.title': 'Flip-covered crisis room',
    'feat.crise.desc': 'Protected button (Ctrl+Shift+C) to instantly freeze outgoing instructions and order a polite interruption (Escape key) without killing processes.',

    'feat.kit.title': 'Team kit and collaboration',
    'feat.kit.desc': 'Common rules (AGENTS.md), lead guidelines (CHEF.md), and shared lessons memory (LESSONS.md) ready to deploy into your repositories.',

    'feat.bilingue.title': '100% Bilingual FR / EN Interface',
    'feat.bilingue.desc': 'Switch between English and French at any time with a single click, with automatic browser language detection and local persistence.',

    'feat.securite.title': 'Local security and sovereignty',
    'feat.securite.desc': 'Strictly bound to 127.0.0.1, random session token, zero external calls, zero npm dependencies, zero intercepted credentials.',

    // Galerie
    'gallery.badge': 'Interface',
    'gallery.titre': 'The Workshop in Pictures',
    'gallery.desc': 'Click any screenshot to view it in full high-definition resolution.',
    'gallery.scene.title': 'Daytime scene overview',
    'gallery.scene.desc': 'Lead agent at the Direction desk, workstations, and glass reflection room.',
    'gallery.soir.title': 'Evening atmosphere',
    'gallery.soir.desc': 'Automatic cozy illumination starting at 7:00 PM with ceiling pendants and desk lamps.',
    'gallery.poste.title': 'Workstation tab',
    'gallery.poste.desc': 'Live interactive terminal with error highlighting and quick prompt dispatch.',
    'gallery.equipe.title': 'Team tab and priority queue',
    'gallery.equipe.desc': 'Headcount monitoring, lead assignment, and persistent priority dispatch queue.',
    'gallery.mosaique.title': 'Mosaic multi-terminal view',
    'gallery.mosaique.desc': 'Simultaneous surveillance of active working agents with reactive search.',
    'gallery.crise.title': 'Active Crisis Room',
    'gallery.crise.desc': 'Safety lockout of outgoing instructions and polite task interruption.',
    'gallery.emblemes.title': '24 Herdr tool emblems sheet',
    'gallery.emblemes.desc': 'Dedicated 16x16 pixel art emblems to distinguish each supported AI tool.',

    // Installation
    'install.badge': 'Quick Start',
    'install.titre': 'Installation in Three Simple Steps',
    'install.desc': 'No compiler or build tool required. Only Node.js (>= 22) and Herdr are needed.',
    
    'step1.badge': 'Step 1',
    'step1.title': 'Download release archive',
    'step1.desc': 'Download the latest ZIP release archive from GitHub and extract all files into your preferred directory.',
    'step1.snippet': 'MyTeam-v0.4.0.zip (zero external dependencies)',

    'step2.badge': 'Step 2',
    'step2.title': 'Run the installer',
    'step2.desc': 'On Windows, double-click Installer MyTeam.bat. The animated installer starts immediately, verifies requirements, and configures the 2x2 Herdr grid.',
    'step2.snippet': 'Installer MyTeam.bat (or bash scripts/installer.sh)',

    'step3.badge': 'Step 3',
    'step3.title': 'Open the office',
    'step3.desc': 'Double-click the "Herdr and desktop" shortcut created on your Desktop, or run node server.mjs and open your browser.',
    'step3.snippet': 'http://127.0.0.1:4317',

    'smartscreen.title': 'Trust note on Windows SmartScreen warning',
    'smartscreen.desc': 'Like any .bat script downloaded from the web without an expensive commercial code-signing certificate, Windows SmartScreen may show a protective blue dialog ("Windows protected your PC"). MyTeam is fully open source and auditable: click More info then Run anyway, or right-click the .bat file > Properties > Unblock.',

    'alt.macos.title': 'On macOS and Linux',
    'alt.macos.desc': 'Open a terminal in the extracted folder and run the interactive bash script:',
    'alt.git.title': 'For developers (via Git)',
    'alt.git.desc': 'Clone the public repository directly and start up:',

    // Compatibilité
    'tools.badge': 'Ecosystem',
    'tools.titre': 'Compatible with all 24 Herdr Tools',
    'tools.desc': 'MyTeam automatically detects and displays all 24 AI CLI agents supported by Herdr.',
    'tools.info.title': 'Automatic detection and dedicated pixel emblems',
    'tools.info.p1': 'During the 2x2 Herdr grid setup, the installer inspects your environment for each of the 24 compatible tools and offers pane-by-pane launch.',
    'tools.info.p2': 'Each tool displays its custom 16x16 pixel emblem on the desk. Claude, Codex, and OpenCode additionally feature a local log parser extracting final answers, token counts, and turn history.',
    'tools.list.legend': 'Tools with deep telemetry:',

    // Contribuer
    'contrib.badge': 'Community',
    'contrib.titre': 'Contribute to MyTeam',
    'contrib.desc': 'MyTeam is an independent, free and open source project licensed under MIT. Contributions are welcome.',
    'contrib.card1.title': 'Report an issue',
    'contrib.card1.desc': 'Spotted a discrepancy with factual truth or a UI glitch? Submit a detailed reproducible report.',
    'contrib.card1.link': 'Open an issue on GitHub',
    'contrib.card2.title': 'Suggest a tool or idea',
    'contrib.card2.desc': 'Want to integrate a new tool in Herdr or propose an ergonomic enhancement?',
    'contrib.card2.link': 'Join GitHub Discussions',
    'contrib.card3.title': 'Read contribution guidelines',
    'contrib.card3.desc': 'Code architecture, zero dependencies, test verification: explore our development rules.',
    'contrib.card3.link': 'Read CONTRIBUTING.md',

    // Footer
    'footer.brand-desc': 'The living pixel art dashboard to oversee and orchestrate autonomous AI agent teams.',
    'footer.col-doc': 'Documentation',
    'footer.col-repo': 'GitHub Repository',
    'footer.col-legal': 'Project',
    'footer.link-install': 'Installation Guide',
    'footer.link-aide': 'User Guide',
    'footer.link-kit': 'Team Kit',
    'footer.link-releases': 'Latest Releases',
    'footer.link-issues': 'Issues & Bugs',
    'footer.link-discussions': 'Discussions Area',
    'footer.link-conduct': 'Code of Conduct',
    'footer.link-security': 'Security Policy',
    'footer.link-notice': 'Third-party Trademarks',
    'footer.credit': 'Built with the help of AI (Claude, Codex, Antigravity, OpenCode). Author and contributor: DrSmoke (BlackAngel242).',
    'footer.license': 'Released under the MIT License.',
    'footer.top': 'Back to top'
  }
};

function t(key, lang = 'fr') {
  return I18N[lang]?.[key] ?? I18N.fr[key] ?? key;
}

function getStoredLanguage() {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('myteam.site.lang');
    if (stored === 'fr' || stored === 'en') return stored;
  }
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    return nav.startsWith('fr') ? 'fr' : 'en';
  }
  return 'fr';
}

function applyLanguage(lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('myteam.site.lang', lang);
  }

  // Mettre à jour le bouton de bascule
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
    langBtn.textContent = lang === 'fr' ? 'EN' : 'FR';
    langBtn.setAttribute('title', lang === 'fr' ? 'Switch to English' : 'Passer en français');
  }

  // Éléments data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key, lang);
    if (val) el.textContent = val;
  });

  // Éléments data-i18n-attr (format: "attr1:key1,attr2:key2")
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const specs = el.getAttribute('data-i18n-attr').split(',');
    for (const spec of specs) {
      const [attr, key] = spec.split(':');
      if (attr && key) {
        const val = t(key.trim(), lang);
        if (val) el.setAttribute(attr.trim(), val);
      }
    }
  });
}

function setupLightbox() {
  if (typeof document === 'undefined') return;
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCaption = document.getElementById('lightbox-caption');
  const lbClose = document.getElementById('lightbox-close');

  if (!lightbox || !lbImg || !lbClose) return;

  function open(src, caption) {
    lbImg.src = src;
    lbCaption.textContent = caption || '';
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    lbClose.focus();
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    lbImg.src = '';
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-lightbox]').forEach(item => {
    item.addEventListener('click', () => {
      const src = item.getAttribute('data-lightbox');
      const caption = item.getAttribute('data-caption') || item.querySelector('.gallery-title')?.textContent || '';
      open(src, caption);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
  });

  lbClose.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      close();
    }
  });
}

function setupNavToggle() {
  if (typeof document === 'undefined') return;
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !expanded);
    menu.classList.toggle('active');
  });

  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const currentLang = getStoredLanguage();
    applyLanguage(currentLang);

    const langBtn = document.getElementById('btn-lang');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        const nextLang = document.documentElement.lang === 'fr' ? 'en' : 'fr';
        applyLanguage(nextLang);
      });
    }

    setupLightbox();
    setupNavToggle();
  });
}

// Export pour les tests automatisés Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N, t };
}
