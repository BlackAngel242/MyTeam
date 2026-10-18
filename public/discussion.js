/**
 * Module Discussion (public/discussion.js)
 *
 * Composant du fil de discussion de la salle de controle,
 * affichant les extraits des dernieres reponses lisibles de l'equipe.
 *
 * Contrat :
 * window.Discussion.render(container, data)
 * - container : HTMLElement hote
 * - data : {
 *     bulles: [{ agent, id, key, at, state, extrait }],
 *     sources: [{ agent, id, etat }] // etat: 'lu' | 'non rattaché' | 'non exposé'
 *   }
 *
 * Securite :
 * - Zero innerHTML. Uniquement createElement et textContent/createTextNode.
 * - Reconcilie la liste par cle stable sans reconstruire le DOM.
 */
(() => {
  'use strict';

  // Passerelle vers le runtime i18n du bureau : public/i18n.js expose
  // window.t(clé, valeurs) et window.getLangue().
  const t = (cle, valeurs) =>
    typeof window !== 'undefined' && typeof window.t === 'function' ? window.t(cle, valeurs) : cle;

  function formatTime(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (!isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    } catch {}
    return '';
  }

  function getStatusClass(status) {
    const norm = String(status || '').toLowerCase().trim();
    if (norm === 'terminee' || norm === 'terminée' || norm === 'done') {
      return 'disc-status disc-status-done';
    }
    if (norm === 'en cours' || norm === 'running' || norm === 'travail') {
      return 'disc-status disc-status-running';
    }
    if (norm === 'interrompue' || norm === 'interrupted' || norm === 'erreur') {
      return 'disc-status disc-status-interrupted';
    }
    return 'disc-status disc-status-unknown';
  }

  // Libellé d'état traduit ; si le serveur envoie un état inconnu, il reste affiché tel quel.
  function statusLabel(status) {
    const norm = String(status || '').toLowerCase().trim();
    if (norm === 'terminee' || norm === 'terminée' || norm === 'done') return t('discussion.etat-terminee');
    if (norm === 'en cours' || norm === 'running' || norm === 'travail') return t('discussion.etat-en-cours');
    if (norm === 'interrompue' || norm === 'interrupted' || norm === 'erreur') return t('discussion.etat-interrompue');
    if (norm === 'fin non determinee' || norm === 'fin non déterminée') return t('discussion.etat-fin-indeterminee');
    return String(status ?? '');
  }

  function escapeAttr(val) {
    return String(val ?? '').replace(/["\\]/g, '\\$&');
  }

  // La langue fait partie de l'empreinte : un changement de langue rafraîchit les textes.
  function langueCourante() {
    return typeof window !== 'undefined' && typeof window.getLangue === 'function'
      ? String(window.getLangue())
      : '';
  }

  function computeSignature(bulle) {
    if (!bulle) return '';
    const key = bulle.key || bulle.id || '';
    const state = bulle.state || '';
    const at = bulle.at || '';
    const text = bulle.extrait || '';
    return `${langueCourante()}|${key}|${state}|${at}|${text}`;
  }

  function buildBubbleElement(bulle, doc) {
    const card = doc.createElement('article');
    card.className = 'disc-bubble';

    const head = doc.createElement('header');
    head.className = 'disc-head';

    const meta = doc.createElement('div');
    meta.className = 'disc-meta';

    const agentSpan = doc.createElement('span');
    agentSpan.className = 'disc-agent';
    agentSpan.textContent = bulle.agent || 'Agent';
    meta.appendChild(agentSpan);

    const timeSpan = doc.createElement('span');
    timeSpan.className = 'disc-time';
    timeSpan.textContent = formatTime(bulle.at);
    meta.appendChild(timeSpan);

    head.appendChild(meta);

    const statusStr = bulle.state || 'terminée';
    const statusBadge = doc.createElement('span');
    statusBadge.className = getStatusClass(statusStr);
    statusBadge.textContent = statusLabel(statusStr);
    head.appendChild(statusBadge);

    card.appendChild(head);

    const body = doc.createElement('div');
    body.className = 'disc-body';
    body.textContent = bulle.extrait || '';
    card.appendChild(body);

    return card;
  }

  function updateBubbleElement(card, bulle) {
    const meta = card.querySelector('.disc-meta');
    if (meta) {
      const agentSpan = meta.querySelector('.disc-agent');
      if (agentSpan) agentSpan.textContent = bulle.agent || 'Agent';

      const timeSpan = meta.querySelector('.disc-time');
      if (timeSpan) timeSpan.textContent = formatTime(bulle.at);
    }

    const statusBadge = card.querySelector('.disc-status');
    if (statusBadge) {
      const statusStr = bulle.state || 'terminée';
      statusBadge.className = getStatusClass(statusStr);
      statusBadge.textContent = statusLabel(statusStr);
    }

    const body = card.querySelector('.disc-body');
    if (body) {
      body.textContent = bulle.extrait || '';
    }
  }

  function formatSourceReason(source) {
    const name = source.agent || 'Agent';
    if (source.etat === 'non exposé') {
      return t('discussion.source-non-expose', { agent: name });
    }
    if (source.etat === 'non rattaché') {
      return t('discussion.source-non-rattache', { agent: name });
    }
    return t('discussion.source-etat', { agent: name, etat: source.etat });
  }

  function render(container, data = {}) {
    if (!container) return null;
    const doc = container.ownerDocument || document;

    const payload = Array.isArray(data) ? { bulles: data, sources: [] } : (data || {});
    const bulles = Array.isArray(payload.bulles) ? payload.bulles : [];
    const sources = Array.isArray(payload.sources) ? payload.sources : [];

    let root = container.querySelector('.disc-container');
    if (!root) {
      root = doc.createElement('div');
      root.className = 'disc-container';
      container.appendChild(root);
    }

    // Gestion du cas vide (aucune bulle)
    if (bulles.length === 0) {
      root.replaceChildren();
      const empty = doc.createElement('div');
      empty.className = 'disc-empty';
      empty.textContent = t('discussion.aucun-message');
      root.appendChild(empty);

      // Affichage des sources non lues même si le fil est vide
      renderSources(root, sources, doc);
      return root;
    }

    const emptyEl = root.querySelector('.disc-empty');
    if (emptyEl) emptyEl.remove();

    // Barre d'en-tête du fil
    let bar = root.querySelector('.disc-bar');
    if (!bar) {
      bar = doc.createElement('div');
      bar.className = 'disc-bar';

      const title = doc.createElement('span');
      title.className = 'disc-title';
      // Le libellé se termine par un espace qui sépare le compteur.
      title.textContent = t('discussion.titre');

      const count = doc.createElement('span');
      count.className = 'disc-count';
      title.appendChild(count);
      bar.appendChild(title);

      root.prepend(bar);
    }

    const countSpan = bar.querySelector('.disc-count');
    if (countSpan) countSpan.textContent = String(bulles.length);

    // Liste des bulles
    let list = root.querySelector('.disc-list');
    if (!list) {
      list = doc.createElement('div');
      list.className = 'disc-list';
      // Inséré après la barre d'en-tête
      if (bar.nextSibling) {
        root.insertBefore(list, bar.nextSibling);
      } else {
        root.appendChild(list);
      }
    }

    const validKeys = new Set();

    // Tri du plus récent au plus ancien
    const sorted = [...bulles].sort((a, b) => {
      const ta = Date.parse(a?.at || 0) || 0;
      const tb = Date.parse(b?.at || 0) || 0;
      return tb - ta;
    });

    sorted.forEach((bulle, idx) => {
      const key = String(bulle.key || bulle.id || `b_${idx}`);
      validKeys.add(key);

      const existingCard = list.querySelector(`.disc-bubble[data-id="${escapeAttr(key)}"]`);
      const sig = computeSignature(bulle);

      if (!existingCard) {
        const newCard = buildBubbleElement(bulle, doc);
        newCard.dataset.id = key;
        newCard._signature = sig;
        list.appendChild(newCard);
      } else {
        if (existingCard._signature !== sig) {
          updateBubbleElement(existingCard, bulle);
          existingCard._signature = sig;
        }
      }
    });

    // Nettoyage des cartes orphelines
    Array.from(list.children).forEach((child) => {
      if (child.dataset?.id && !validKeys.has(child.dataset.id)) {
        child.remove();
      }
    });

    // Affichage des sources non lues sous la liste
    renderSources(root, sources, doc);

    return root;
  }

  function renderSources(root, sources, doc) {
    const nonLus = sources.filter(s => s && s.etat !== 'lu');

    let sourcesBox = root.querySelector('.disc-sources');
    if (nonLus.length === 0) {
      if (sourcesBox) sourcesBox.remove();
      return;
    }

    if (!sourcesBox) {
      sourcesBox = doc.createElement('div');
      sourcesBox.className = 'disc-sources';
      root.appendChild(sourcesBox);
    } else {
      sourcesBox.replaceChildren();
    }

    const title = doc.createElement('div');
    title.className = 'disc-sources-title';
    title.textContent = t('discussion.autres-agents');
    sourcesBox.appendChild(title);

    for (const source of nonLus) {
      const item = doc.createElement('div');
      item.className = 'disc-untracked-item';
      item.textContent = formatSourceReason(source);
      sourcesBox.appendChild(item);
    }
  }

  const Discussion = {
    render,
  };

  if (typeof window !== 'undefined') {
    window.Discussion = Discussion;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Discussion, render };
  }
})();
