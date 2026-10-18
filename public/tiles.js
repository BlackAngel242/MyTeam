/**
 * Module Tiles (public/tiles.js)
 *
 * Composant de vue en mosaique (tuiles de terminaux d'agents).
 * Permet de surveiller et piloter 2 a 4 agents simultanement.
 *
 * --- CONTRAT D'UTILISATION (pour integration dans app.js par le chef) ---
 *
 * 1. Montage du composant :
 *    window.Tiles.mount(container, api)
 *
 *    Arguments :
 *    - container : HTMLElement hote accueillant la mosaique.
 *    - api : {
 *        agents: () => [{ id, name, kind, status, paneId, paused }],
 *        // statuts Herdr : 'working' | 'idle' | 'blocked' | 'done' | 'unknown'
 *        read: (id) => Promise<{ text: string }>,
 *        send: (id, message) => Promise<void>, // peut rejeter avec Error('message lisible')
 *        canSend: (agent) => boolean,
 *        onExpand: (id) => void, // ouvre le poste complet
 *        onClose: () => void     // revient a la vue scene
 *      }
 *
 * 2. Demontage du composant :
 *    window.Tiles.unmount()
 *    - Arrete les timers de rafraichissement
 *    - Nettoie les ecouteurs et libere le conteneur
 *
 * Securite et robustesse :
 * - Sécurité DOM absolue : uniquement createElement, createTextNode et textContent, aucune injection de chaîne.
 * - Rafraichissement borne aux tuiles visibles (toutes les 3 s, pause si l'onglet est masque).
 * - Une lecture a la fois par tuile (garde contre les requetes superposees).
 * - Aucune relecture si le texte est identique.
 * - Preservation active de la selection de texte de l'utilisateur.
 * - Tout accessible au clavier avec roles ARIA explicites.
 */
(() => {
  'use strict';

  let isMounted = false;
  let currentContainer = null;
  let currentApi = null;
  let refreshTimer = null;
  let visibilityHandler = null;
  let currentLayout = 'grid'; // 'grid' (grille 2x2) ou 'cols' (colonnes)
  let selectedAgentIds = [];
  const lastTexts = new Map();
  const inFlightReads = new Set();
  const searchQueries = new Map();

  function cleanAnsi(text) {
    return String(text ?? '')
      .replace(/(?:\x1b\]|\x9d)[\s\S]*?(?:\x07|\x1b\\|\x9c|$)/g, '')
      .replace(/\x1b[P^_X][\s\S]*?(?:\x1b\\|\x9c|$)/g, '')
      .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]/g, '')
      .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*$/g, '')
      .replace(/\x1b[ -/]*[0-~]/g, '')
      .replace(/\x1b/g, '');
  }

  function getStatusInfo(agent) {
    if (agent?.paused) {
      return { label: 'Pause quota', className: 'tl-status tl-status-paused' };
    }
    const s = String(agent?.status || 'unknown').toLowerCase().trim();
    switch (s) {
      case 'working':
        return { label: 'Au travail', className: 'tl-status tl-status-working' };
      case 'blocked':
        return { label: 'En attente', className: 'tl-status tl-status-blocked' };
      case 'idle':
        return { label: 'Disponible', className: 'tl-status tl-status-idle' };
      case 'done':
        return { label: 'Terminé', className: 'tl-status tl-status-done' };
      default:
        return { label: 'Inconnu', className: 'tl-status tl-status-unknown' };
    }
  }

  function getCantSendReason(agent) {
    if (!agent) return 'Consigne indisponible.';
    if (agent.paused) return 'Agent en pause de limite de quota.';
    if (agent.status === 'working') return 'Agent au travail.';
    if (agent.status === 'blocked') return 'Agent en attente de réponse dans Herdr.';
    return 'Consigne non disponible pour cet agent.';
  }

  function isSelectionInside(element) {
    if (typeof window === 'undefined') return false;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    try {
      const range = sel.getRangeAt(0);
      return element.contains(range.commonAncestorContainer);
    } catch {
      return false;
    }
  }

  function selectDefaultAgents(agents) {
    if (!Array.isArray(agents)) return [];
    // Priorité aux agents au travail, puis les autres
    const sorted = [...agents].sort((a, b) => {
      const aWork = a?.status === 'working' ? 0 : 1;
      const bWork = b?.status === 'working' ? 0 : 1;
      return aWork - bWork;
    });
    return sorted.slice(0, 4).map(a => a.id);
  }

  function renderTerminal(pre, text, query, card) {
    const doc = pre.ownerDocument || document;
    const hitsSpan = card.querySelector('.tl-search-hits');

    if (typeof window !== 'undefined' && window.TerminalView && typeof window.TerminalView.render === 'function') {
      const res = window.TerminalView.render(pre, text, { query, frozen: false });
      if (hitsSpan) {
        hitsSpan.textContent = query ? (res?.matches > 0 ? `${res.matches} trouvée(s)` : '0 résultat') : '';
      }
      return;
    }

    // Repli autonome sans TerminalView
    const cleaned = cleanAnsi(text);
    if (!query) {
      pre.textContent = cleaned;
      if (hitsSpan) hitsSpan.textContent = '';
      return;
    }

    const needle = query.toLowerCase();
    const lower = cleaned.toLowerCase();
    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    let matches = 0;
    let index = lower.indexOf(needle, cursor);

    while (index !== -1) {
      if (index > cursor) {
        fragment.appendChild(doc.createTextNode(cleaned.slice(cursor, index)));
      }
      const mark = doc.createElement('mark');
      mark.className = 't-hit';
      mark.textContent = cleaned.slice(index, index + needle.length);
      fragment.appendChild(mark);
      matches++;
      cursor = index + needle.length;
      index = lower.indexOf(needle, cursor);
    }

    if (cursor < cleaned.length) {
      fragment.appendChild(doc.createTextNode(cleaned.slice(cursor)));
    }

    pre.replaceChildren(fragment);
    if (hitsSpan) {
      hitsSpan.textContent = matches > 0 ? `${matches} trouvée(s)` : '0 résultat';
    }
  }

  function updateCardCanSend(card, agent, api) {
    const textarea = card.querySelector('.tl-prompt-input');
    const submitBtn = card.querySelector('.tl-btn-send');
    const hint = card.querySelector('.tl-prompt-hint');
    const can = typeof api.canSend === 'function' ? api.canSend(agent) : true;

    if (can) {
      if (textarea && textarea.disabled && !card._isSubmitting) {
        textarea.disabled = false;
      }
      if (submitBtn && submitBtn.disabled && !card._isSubmitting) {
        submitBtn.disabled = false;
      }
      if (hint) {
        hint.textContent = '';
        hint.hidden = true;
      }
    } else {
      if (textarea) textarea.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      if (hint) {
        hint.textContent = getCantSendReason(agent);
        hint.hidden = false;
      }
    }
  }

  function updateCardHeader(card, agent, api) {
    const nameEl = card.querySelector('.tl-agent-name');
    if (nameEl) nameEl.textContent = agent.name || 'Agent';

    const kindEl = card.querySelector('.tl-agent-kind');
    if (kindEl && agent.kind) kindEl.textContent = agent.kind;

    const statusEl = card.querySelector('.tl-status');
    if (statusEl) {
      const statusInfo = getStatusInfo(agent);
      statusEl.className = statusInfo.className;
      statusEl.textContent = statusInfo.label;
    }

    updateCardCanSend(card, agent, api);
  }

  function buildCard(agent, doc, api) {
    const card = doc.createElement('article');
    card.className = 'tl-card';
    card.dataset.agentId = agent.id;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', `Poste de ${agent.name || 'l\'agent'}`);

    // En-tête compact
    const header = doc.createElement('header');
    header.className = 'tl-card-header';

    const meta = doc.createElement('div');
    meta.className = 'tl-card-meta';

    const name = doc.createElement('h3');
    name.className = 'tl-agent-name';
    name.textContent = agent.name || 'Agent';
    meta.appendChild(name);

    if (agent.kind) {
      const kind = doc.createElement('span');
      kind.className = 'tl-agent-kind';
      kind.textContent = agent.kind;
      meta.appendChild(kind);
    }

    const statusInfo = getStatusInfo(agent);
    const statusBadge = doc.createElement('span');
    statusBadge.className = statusInfo.className;
    statusBadge.textContent = statusInfo.label;
    meta.appendChild(statusBadge);

    header.appendChild(meta);

    const expandBtn = doc.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'tl-btn tl-btn-expand';
    expandBtn.textContent = 'Agrandir';
    expandBtn.setAttribute('aria-label', `Agrandir le poste de ${agent.name || 'l\'agent'}`);
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof api.onExpand === 'function') {
        api.onExpand(agent.id);
      }
    });
    header.appendChild(expandBtn);
    card.appendChild(header);

    // Barre de recherche légère
    const searchBar = doc.createElement('div');
    searchBar.className = 'tl-search-bar';

    const searchInput = doc.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'tl-search-input';
    searchInput.placeholder = 'Filtrer les sorties…';
    searchInput.setAttribute('aria-label', `Rechercher dans les sorties de ${agent.name || 'l\'agent'}`);
    searchInput.autocomplete = 'off';

    const hitsSpan = doc.createElement('span');
    hitsSpan.className = 'tl-search-hits';
    hitsSpan.setAttribute('aria-live', 'polite');

    searchBar.appendChild(searchInput);
    searchBar.appendChild(hitsSpan);
    card.appendChild(searchBar);

    // Terminal pre
    const termWrap = doc.createElement('div');
    termWrap.className = 'tl-terminal-wrap';

    const pre = doc.createElement('pre');
    pre.className = 'tl-terminal-pre';
    pre.tabIndex = 0;
    pre.setAttribute('role', 'region');
    pre.setAttribute('aria-label', `Sorties du terminal de ${agent.name || 'l\'agent'}`);
    pre.textContent = 'Chargement des sorties…';
    termWrap.appendChild(pre);
    card.appendChild(termWrap);

    // Recherche réactive
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      searchQueries.set(agent.id, q);
      const lastTxt = lastTexts.get(agent.id) || '';
      renderTerminal(pre, lastTxt, q, card);
    });

    // Formulaire de consigne rapide
    const form = doc.createElement('form');
    form.className = 'tl-prompt-form';

    const textarea = doc.createElement('textarea');
    textarea.className = 'tl-prompt-input';
    textarea.rows = 2;
    textarea.maxLength = 12000;
    textarea.placeholder = `Consigne rapide à ${agent.name || 'cet agent'}… (Ctrl+Entrée)`;
    textarea.setAttribute('aria-label', `Consigne rapide à ${agent.name || 'cet agent'}`);
    form.appendChild(textarea);

    const footerRow = doc.createElement('div');
    footerRow.className = 'tl-prompt-row';

    const infoWrap = doc.createElement('div');
    infoWrap.className = 'tl-prompt-info';

    const hint = doc.createElement('span');
    hint.className = 'tl-prompt-hint';
    hint.hidden = true;
    infoWrap.appendChild(hint);

    const feedback = doc.createElement('span');
    feedback.className = 'tl-prompt-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    infoWrap.appendChild(feedback);

    footerRow.appendChild(infoWrap);

    const submitBtn = doc.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'tl-btn tl-btn-send';
    submitBtn.textContent = 'Envoyer';
    submitBtn.setAttribute('aria-label', `Envoyer la consigne à ${agent.name || 'l\'agent'}`);
    footerRow.appendChild(submitBtn);

    form.appendChild(footerRow);
    card.appendChild(form);

    updateCardCanSend(card, agent, api);

    const submitPrompt = async () => {
      const msg = textarea.value.trim();
      if (!msg) return;
      if (typeof api.canSend === 'function' && !api.canSend(agent)) return;

      card._isSubmitting = true;
      textarea.disabled = true;
      submitBtn.disabled = true;
      feedback.textContent = 'Envoi en cours…';
      feedback.className = 'tl-prompt-feedback tl-feedback-pending';

      try {
        await api.send(agent.id, msg);
        textarea.value = '';
        feedback.textContent = 'Consigne envoyée.';
        feedback.className = 'tl-prompt-feedback tl-feedback-ok';
        setTimeout(() => {
          if (feedback.textContent === 'Consigne envoyée.') {
            feedback.textContent = '';
          }
        }, 3000);
      } catch (err) {
        feedback.textContent = (err && err.message) ? err.message : 'Échec de l\'envoi.';
        feedback.className = 'tl-prompt-feedback tl-feedback-err';
      } finally {
        card._isSubmitting = false;
        if (typeof api.canSend === 'function' && api.canSend(agent)) {
          textarea.disabled = false;
          submitBtn.disabled = false;
          textarea.focus();
        }
      }
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!submitBtn.disabled) {
          submitPrompt();
        }
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitPrompt();
    });

    return card;
  }

  function reconcileGrid(grid, selectedIds, agentsMap, doc, api) {
    const existingCards = Array.from(grid.querySelectorAll('.tl-card'));
    const existingMap = new Map();
    for (const card of existingCards) {
      const id = card.dataset.agentId;
      if (id) existingMap.set(id, card);
    }

    for (const [id, card] of existingMap) {
      if (!selectedIds.includes(id)) {
        card.remove();
        existingMap.delete(id);
      }
    }

    for (const id of selectedIds) {
      const agent = agentsMap.get(id);
      if (!agent) continue;
      let card = existingMap.get(id);
      if (!card) {
        card = buildCard(agent, doc, api);
        grid.appendChild(card);
      } else {
        updateCardHeader(card, agent, api);
        grid.appendChild(card);
      }
    }
  }

  function showPickerWarning(pickerEl, text) {
    const doc = pickerEl.ownerDocument || document;
    let warn = pickerEl.querySelector('.tl-picker-warn');
    if (!warn) {
      warn = doc.createElement('span');
      warn.className = 'tl-picker-warn';
      warn.setAttribute('role', 'alert');
      pickerEl.appendChild(warn);
    }
    warn.textContent = text;
    clearTimeout(warn._timeout);
    warn._timeout = setTimeout(() => {
      warn.textContent = '';
    }, 2500);
  }

  function renderPicker(pickerEl, allAgents, doc, onSelectionChange) {
    if (allAgents.length <= 4) {
      pickerEl.hidden = true;
      pickerEl.replaceChildren();
      return;
    }

    pickerEl.hidden = false;
    pickerEl.replaceChildren();

    const title = doc.createElement('span');
    title.className = 'tl-picker-title';
    title.textContent = 'Tuiles affichées :';
    pickerEl.appendChild(title);

    const itemsWrap = doc.createElement('div');
    itemsWrap.className = 'tl-picker-items';

    for (const agent of allAgents) {
      const label = doc.createElement('label');
      label.className = 'tl-picker-item';

      const cb = doc.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'tl-picker-cb';
      cb.value = agent.id;
      cb.checked = selectedAgentIds.includes(agent.id);

      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (selectedAgentIds.length >= 4) {
            cb.checked = false;
            showPickerWarning(pickerEl, '4 tuiles au maximum.');
            return;
          }
          selectedAgentIds.push(agent.id);
        } else {
          if (selectedAgentIds.length <= 1) {
            cb.checked = true;
            showPickerWarning(pickerEl, 'Conservez au moins une tuile.');
            return;
          }
          const idx = selectedAgentIds.indexOf(agent.id);
          if (idx !== -1) selectedAgentIds.splice(idx, 1);
        }
        onSelectionChange();
      });

      label.appendChild(cb);
      const nameSpan = doc.createElement('span');
      nameSpan.textContent = ` ${agent.name || agent.id}`;
      label.appendChild(nameSpan);
      itemsWrap.appendChild(label);
    }

    pickerEl.appendChild(itemsWrap);
  }

  function updateLayout(grid, layout) {
    currentLayout = layout;
    if (layout === 'cols') {
      grid.classList.remove('tl-grid-2x2');
      grid.classList.add('tl-grid-cols');
    } else {
      grid.classList.remove('tl-grid-cols');
      grid.classList.add('tl-grid-2x2');
    }
  }

  async function refreshVisibleTiles(grid, api) {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!isMounted) return;

    const allAgents = typeof api.agents === 'function' ? api.agents() : [];
    const agentsMap = new Map(allAgents.map(a => [a.id, a]));

    const cards = Array.from(grid.querySelectorAll('.tl-card'));
    for (const card of cards) {
      const id = card.dataset.agentId;
      if (!id) continue;
      const agent = agentsMap.get(id);
      if (agent) {
        updateCardHeader(card, agent, api);
      }

      if (inFlightReads.has(id)) continue;

      const pre = card.querySelector('.tl-terminal-pre');
      if (!pre) continue;

      if (isSelectionInside(pre)) continue;

      inFlightReads.add(id);
      try {
        const res = await api.read(id);
        if (!isMounted) return;
        const text = typeof res?.text === 'string'
          ? res.text
          : (typeof res?.terminal === 'string' ? res.terminal : (typeof res === 'string' ? res : ''));
        const prevText = lastTexts.get(id);
        const query = searchQueries.get(id) || '';

        if (text !== prevText || card._queryDirty) {
          card._queryDirty = false;
          lastTexts.set(id, text);
          if (!isSelectionInside(pre)) {
            renderTerminal(pre, text, query, card);
          }
        }
      } catch {
        // En cas d'erreur de lecture, conservation de l'affichage existant
      } finally {
        inFlightReads.delete(id);
      }
    }
  }

  function mount(container, api) {
    if (!container || !api) return;
    if (isMounted) unmount();

    isMounted = true;
    currentContainer = container;
    currentApi = api;
    const doc = container.ownerDocument || document;

    const root = doc.createElement('div');
    root.className = 'tl-container';

    // Barre d'outils supérieure
    const toolbar = doc.createElement('div');
    toolbar.className = 'tl-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Commandes de la mosaïque');

    const left = doc.createElement('div');
    left.className = 'tl-toolbar-left';

    const title = doc.createElement('h2');
    title.className = 'tl-title';
    title.textContent = 'Mosaïque des agents';
    left.appendChild(title);

    const layoutGroup = doc.createElement('div');
    layoutGroup.className = 'tl-layout-toggles';
    layoutGroup.setAttribute('role', 'group');
    layoutGroup.setAttribute('aria-label', 'Disposition des tuiles');

    const btnGrid = doc.createElement('button');
    btnGrid.type = 'button';
    btnGrid.className = 'tl-btn tl-btn-layout';
    btnGrid.dataset.layout = 'grid';
    btnGrid.textContent = 'Grille 2×2';
    btnGrid.setAttribute('aria-pressed', currentLayout === 'grid' ? 'true' : 'false');

    const btnCols = doc.createElement('button');
    btnCols.type = 'button';
    btnCols.className = 'tl-btn tl-btn-layout';
    btnCols.dataset.layout = 'cols';
    btnCols.textContent = 'Colonnes';
    btnCols.setAttribute('aria-pressed', currentLayout === 'cols' ? 'true' : 'false');

    layoutGroup.appendChild(btnGrid);
    layoutGroup.appendChild(btnCols);
    left.appendChild(layoutGroup);
    toolbar.appendChild(left);

    const right = doc.createElement('div');
    right.className = 'tl-toolbar-right';

    const pickerEl = doc.createElement('div');
    pickerEl.className = 'tl-picker';
    pickerEl.setAttribute('role', 'group');
    pickerEl.setAttribute('aria-label', 'Choisir les agents affichés');
    pickerEl.hidden = true;
    right.appendChild(pickerEl);

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tl-btn tl-btn-close';
    closeBtn.textContent = 'Revenir à la scène';
    closeBtn.setAttribute('aria-label', 'Revenir à la vue de la scène');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof api.onClose === 'function') {
        api.onClose();
      }
    });
    right.appendChild(closeBtn);
    toolbar.appendChild(right);

    root.appendChild(toolbar);

    // Grille de tuiles
    const grid = doc.createElement('div');
    grid.className = 'tl-grid tl-grid-2x2';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Mosaïque des postes');
    root.appendChild(grid);

    container.replaceChildren(root);

    // Boutons de bascule de disposition
    btnGrid.addEventListener('click', () => {
      btnGrid.setAttribute('aria-pressed', 'true');
      btnCols.setAttribute('aria-pressed', 'false');
      updateLayout(grid, 'grid');
    });

    btnCols.addEventListener('click', () => {
      btnCols.setAttribute('aria-pressed', 'true');
      btnGrid.setAttribute('aria-pressed', 'false');
      updateLayout(grid, 'cols');
    });

    // Initialisation des agents
    const allAgents = typeof api.agents === 'function' ? api.agents() : [];
    if (allAgents.length === 0) {
      const empty = doc.createElement('p');
      empty.className = 'tl-empty';
      empty.textContent = 'Aucun agent disponible dans Herdr.';
      grid.appendChild(empty);
      return;
    }

    selectedAgentIds = selectDefaultAgents(allAgents);
    const agentsMap = new Map(allAgents.map(a => [a.id, a]));

    const onSelectionChange = () => {
      reconcileGrid(grid, selectedAgentIds, agentsMap, doc, api);
      refreshVisibleTiles(grid, api);
    };

    renderPicker(pickerEl, allAgents, doc, onSelectionChange);
    reconcileGrid(grid, selectedAgentIds, agentsMap, doc, api);

    // Premier chargement immédiat des sorties
    refreshVisibleTiles(grid, api);

    // Rafraîchissement périodique toutes les 3 secondes
    refreshTimer = setInterval(() => {
      refreshVisibleTiles(grid, api);
    }, 3000);

    visibilityHandler = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshVisibleTiles(grid, api);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibilityHandler);
    }
  }

  function unmount() {
    isMounted = false;
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    inFlightReads.clear();
    lastTexts.clear();
    searchQueries.clear();
    selectedAgentIds = [];
    if (currentContainer) {
      currentContainer.replaceChildren();
      currentContainer = null;
    }
    currentApi = null;
  }

  const Tiles = {
    mount,
    unmount,
    cleanAnsi,
    getStatusInfo,
    getCantSendReason,
    selectDefaultAgents,
  };

  if (typeof window !== 'undefined') {
    window.Tiles = Tiles;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.Tiles = Tiles;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      Tiles,
      mount,
      unmount,
      cleanAnsi,
      getStatusInfo,
      getCantSendReason,
      selectDefaultAgents,
    };
  }
})();
