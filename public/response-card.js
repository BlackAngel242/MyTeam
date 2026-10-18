/**
 * Module ResponseCard (public/response-card.js)
 *
 * Composant de lecture securise des reponses structurees des agents,
 * avec analyseur Markdown restreint sans innerHTML, copie fidele et export local.
 *
 * --- CONTRAT D'UTILISATION (pour integration dans app.js) ---
 *
 * 1. Initialisation / Rendu complet :
 *    window.ResponseCard.render(container, state, options)
 *
 *    Arguments :
 *    - container : HTMLElement hote (ex: conteneur dans l'onglet Poste ou Equipe).
 *    - state : {
 *        agent: "Claude",             // Nom de l'agent affiche
 *        agentId: "w5:p1@...",        // Identifiant d'agent
 *        found: true,                 // true si le journal existe
 *        complete: true,              // false si la lecture n'a couvert que la fin du journal
 *        responses: [                 // Format issu de src/responses.mjs
 *          {
 *            key: "c1a2b3...",        // Cle publique stable opaque
 *            startedAt: "2026-10-18T...", // Horodatage ISO de debut
 *            endedAt: "2026-10-18T...",   // Horodatage ISO de fin ou null
 *            state: "terminee",       // "terminee" | "interrompue" | "fin non determinee" | "en cours"
 *            blocks: [{ text: "# Titre..." }], // Blocs de texte de l'agent
 *            // Formats alternatifs acceptes :
 *            id: "resp_001",
 *            status: "terminee",
 *            text: "# Titre...",
 *            source: "journal"
 *          }
 *        ]
 *      }
 *    - options : (facultatif)
 *      {
 *        onCopy: (text) => void,
 *        onExport: (filename, text) => void
 *      }
 *
 * 2. Rendu unitaire de Markdown sur dans un element :
 *    window.ResponseCard.renderMarkdown(text, targetElement, copyFn)
 *
 * 3. Export unitaire :
 *    window.ResponseCard.exportResponse(response)
 *
 * 4. Export de session :
 *    window.ResponseCard.exportSession(agentName, responses)
 *
 * 5. Copie securisee avec repli presse-papiers :
 *    window.ResponseCard.copyText(text, rootElement)
 *
 * Securite et fidelite :
 * - Zero innerHTML. Seuls document.createElement et textContent sont utilises.
 * - Aucune image distante chargee (syntaxe ![alt](url) traitee en texte pur).
 * - Protocoles d'URL controles (uniquement https:, http: et ancres #).
 * - Code source non altere lors de la copie ou de l'export (lecture de l'objet, jamais innerText).
 * - Mises a jour incrementales basees sur les cles stables key / id sans casser la selection ni le defilement.
 */
(() => {
  'use strict';

  // Passerelle vers le runtime i18n du bureau : public/i18n.js expose
  // window.t(clé, valeurs) et window.tServeur(message).
  const t = (cle, valeurs) =>
    typeof window !== 'undefined' && typeof window.t === 'function' ? window.t(cle, valeurs) : cle;
  const tServeur = (message) =>
    typeof window !== 'undefined' && typeof window.tServeur === 'function' ? window.tServeur(message) : message;

  function getText(resp) {
    if (!resp) return '';
    if (typeof resp.text === 'string') return resp.text;
    if (Array.isArray(resp.blocks)) {
      return resp.blocks.map(b => (typeof b === 'string' ? b : b?.text || '')).join('\n\n');
    }
    return '';
  }

  function getKey(resp, idx) {
    return String(resp?.key || resp?.id || `resp_${idx}`);
  }

  function getStatus(resp) {
    return String(resp?.state || resp?.status || (resp?.partial ? 'en cours' : 'terminee'));
  }

  function getTimestamp(resp) {
    return resp?.startedAt || resp?.createdAt || resp?.endedAt || resp?.completedAt || '';
  }

  function safeUrl(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.startsWith('#')) return trimmed;
    try {
      const url = new URL(trimmed, 'https://localhost');
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return url.href;
      }
    } catch {}
    return null;
  }

  function slugify(name) {
    return String(name || 'agent')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'agent';
  }

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

  function formatIsoDate(isoString) {
    if (!isoString) return new Date().toLocaleString('fr-FR');
    try {
      const d = new Date(isoString);
      if (!isNaN(d.getTime())) return d.toLocaleString('fr-FR');
    } catch {}
    return String(isoString);
  }

  function getStatusClass(status) {
    const norm = String(status || '').toLowerCase().trim();
    if (norm === 'terminee' || norm === 'terminée' || norm === 'done') {
      return 'rc-status rc-status-done';
    }
    if (norm === 'en cours' || norm === 'running' || norm === 'travail') {
      return 'rc-status rc-status-running';
    }
    if (norm === 'interrompue' || norm === 'interrupted' || norm === 'erreur') {
      return 'rc-status rc-status-interrupted';
    }
    return 'rc-status rc-status-unknown';
  }

  // Libellé d'état traduit ; si le serveur envoie un état inconnu, il reste affiché tel quel.
  function statusLabel(status) {
    const norm = String(status || '').toLowerCase().trim();
    if (norm === 'terminee' || norm === 'terminée' || norm === 'done') return t('carte.etat-terminee');
    if (norm === 'en cours' || norm === 'running' || norm === 'travail') return t('carte.etat-en-cours');
    if (norm === 'interrompue' || norm === 'interrupted' || norm === 'erreur') return t('carte.etat-interrompue');
    if (norm === 'fin non determinee' || norm === 'fin non déterminée') return t('carte.etat-fin-indeterminee');
    return String(status ?? '');
  }

  function parseInlineToFragment(text, doc) {
    const fragment = doc.createDocumentFragment();
    if (!text) return fragment;

    // Detection du code en ligne `...`, du gras **...** ou __...__, et des liens [label](url)
    const regex = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[([^\]\n]+)\]\(([^)\s]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }

      if (match[1]) {
        // Code en ligne
        const code = doc.createElement('code');
        code.className = 'rc-inline-code';
        code.textContent = match[1].slice(1, -1);
        fragment.appendChild(code);
      } else if (match[2]) {
        // Gras
        const strong = doc.createElement('strong');
        strong.className = 'rc-bold';
        strong.textContent = match[2].slice(2, -2);
        fragment.appendChild(strong);
      } else if (match[3]) {
        // Lien controle ou texte si image
        const isImage = match.index > 0 && text[match.index - 1] === '!';
        const label = match[4];
        const rawUrl = match[5];
        const validUrl = safeUrl(rawUrl);

        if (!isImage && validUrl) {
          const a = doc.createElement('a');
          a.className = 'rc-link';
          a.href = validUrl;
          a.textContent = label;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          fragment.appendChild(a);
        } else {
          // Les images distantes ou protocoles non autorises restent en texte pur
          fragment.appendChild(doc.createTextNode(match[3]));
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    return fragment;
  }

  function createCodeBlockNode(codeText, lang, doc, copyFn) {
    const block = doc.createElement('div');
    block.className = 'rc-code-block';

    const header = doc.createElement('div');
    header.className = 'rc-code-header';

    const langSpan = doc.createElement('span');
    langSpan.className = 'rc-code-lang';
    langSpan.textContent = lang || 'code';
    header.appendChild(langSpan);

    const copyBtn = doc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'rc-btn rc-btn-code-copy';
    copyBtn.textContent = t('carte.copier-le-code');
    copyBtn.setAttribute('aria-label', lang ? t('carte.copier-le-code-langue', { langue: lang }) : t('carte.copier-le-code'));

    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await copyFn(codeText, block);
      if (ok) {
        const prev = copyBtn.textContent;
        copyBtn.textContent = t('carte.copie');
        copyBtn.classList.add('rc-copied');
        setTimeout(() => {
          copyBtn.textContent = prev;
          copyBtn.classList.remove('rc-copied');
        }, 1800);
      }
    });

    header.appendChild(copyBtn);
    block.appendChild(header);

    const pre = doc.createElement('pre');
    pre.className = 'rc-code-pre';
    pre.tabIndex = 0;

    const code = doc.createElement('code');
    code.className = 'rc-code-content';
    code.textContent = codeText;
    pre.appendChild(code);
    block.appendChild(pre);

    return block;
  }

  function parseMarkdownToFragment(markdownText, doc, copyFn) {
    const fragment = doc.createDocumentFragment();
    if (typeof markdownText !== 'string' || !markdownText.trim()) {
      return fragment;
    }

    const lines = markdownText.replace(/\r\n/g, '\n').split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Ligne vide
      if (!line.trim()) {
        i++;
        continue;
      }

      // Blocs de code delimites (``` ou ~~~)
      const codeMatch = line.match(/^(\s*)(```|~~~)(.*)$/);
      if (codeMatch) {
        const fence = codeMatch[2];
        const lang = codeMatch[3].trim().toLowerCase();
        const codeLines = [];
        i++;
        while (i < lines.length) {
          if (lines[i].trim().startsWith(fence)) {
            i++;
            break;
          }
          codeLines.push(lines[i]);
          i++;
        }
        fragment.appendChild(createCodeBlockNode(codeLines.join('\n'), lang, doc, copyFn));
        continue;
      }

      // Titres (# a ######)
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        const h = doc.createElement(`h${level}`);
        h.className = `rc-h${level}`;
        h.appendChild(parseInlineToFragment(headingText, doc));
        fragment.appendChild(h);
        i++;
        continue;
      }

      // Citations (> ...)
      if (line.match(/^>\s?/)) {
        const quoteLines = [];
        while (i < lines.length && lines[i].match(/^>\s?/)) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        const blockquote = doc.createElement('blockquote');
        blockquote.className = 'rc-quote';
        blockquote.appendChild(parseMarkdownToFragment(quoteLines.join('\n'), doc, copyFn));
        fragment.appendChild(blockquote);
        continue;
      }

      // Listes non ordonnees (- , * , + )
      if (line.match(/^(\s*)([-*+])\s+(.*)$/)) {
        const ul = doc.createElement('ul');
        ul.className = 'rc-ul';
        while (i < lines.length) {
          const itemMatch = lines[i].match(/^(\s*)([-*+])\s+(.*)$/);
          if (!itemMatch) break;
          const li = doc.createElement('li');
          li.className = 'rc-li';
          li.appendChild(parseInlineToFragment(itemMatch[3], doc));
          ul.appendChild(li);
          i++;
        }
        fragment.appendChild(ul);
        continue;
      }

      // Listes ordonnees (1. , 2. ...)
      if (line.match(/^(\s*)(\d+)\.\s+(.*)$/)) {
        const ol = doc.createElement('ol');
        ol.className = 'rc-ol';
        while (i < lines.length) {
          const itemMatch = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
          if (!itemMatch) break;
          const li = doc.createElement('li');
          li.className = 'rc-li';
          li.appendChild(parseInlineToFragment(itemMatch[3], doc));
          ol.appendChild(li);
          i++;
        }
        fragment.appendChild(ol);
        continue;
      }

      // Paragraphes
      const paragraphLines = [];
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) break;
        if (
          cur.match(/^(```|~~~)/) ||
          cur.match(/^#{1,6}\s+/) ||
          cur.match(/^>\s?/) ||
          cur.match(/^(\s*)([-*+]|\d+\.)\s+/)
        ) {
          break;
        }
        paragraphLines.push(cur);
        i++;
      }

      if (paragraphLines.length > 0) {
        const p = doc.createElement('p');
        p.className = 'rc-p';
        for (let k = 0; k < paragraphLines.length; k++) {
          if (k > 0) p.appendChild(doc.createElement('br'));
          p.appendChild(parseInlineToFragment(paragraphLines[k], doc));
        }
        fragment.appendChild(p);
      }
    }

    return fragment;
  }

  function downloadBlob(content, filename) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 120);
  }

  function exportResponse(response) {
    if (!response) return;
    const agent = response.agent || 'Agent';
    const status = getStatus(response);
    const isPartial = status === 'en cours' || status === 'fin non déterminée' || status === 'fin non determinee' || Boolean(response.partial);
    const dateStr = formatIsoDate(getTimestamp(response) || new Date().toISOString());
    const statusStr = statusLabel(status) || (isPartial ? t('carte.etat-en-cours') : t('carte.etat-terminee'));
    const text = getText(response);

    let markdown = '';
    if (isPartial) {
      markdown += t('carte.export-titre-partiel', { agent }) + '\n\n';
      markdown += t('carte.export-ligne-partielle', { date: dateStr, statut: statusStr }) + '\n\n';
    } else {
      markdown += t('carte.export-titre', { agent }) + '\n\n';
      markdown += t('carte.export-ligne', { date: dateStr, statut: statusStr, source: response.source || 'journal' }) + '\n\n';
    }
    markdown += text.trim() + '\n';

    const safeId = String(response.key || response.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `reponse-${slugify(agent)}-${safeId}${isPartial ? '-partiel' : ''}.md`;
    downloadBlob(markdown, filename);
  }

  function exportSession(agentName, responses) {
    const agent = agentName || 'Agent';
    const list = Array.isArray(responses) ? responses : [];
    const nowStr = new Date().toLocaleString('fr-FR');

    let markdown = t('carte.export-session-titre', { agent }) + '\n\n';
    markdown += t('carte.export-session-ligne', { date: nowStr, n: list.length }) + '\n\n';

    if (list.length === 0) {
      markdown += t('carte.export-aucune-reponse') + '\n';
    } else {
      list.forEach((resp, idx) => {
        const num = idx + 1;
        const status = getStatus(resp);
        const isPartial = status === 'en cours' || status === 'fin non déterminée' || status === 'fin non determinee' || Boolean(resp.partial);
        const dateStr = formatIsoDate(getTimestamp(resp));
        const text = getText(resp);
        markdown += '---\n\n' + t('carte.export-reponse-num', { num, statut: statusLabel(status), date: dateStr }) + '\n\n';
        if (isPartial) {
          markdown += t('carte.export-note-cours') + '\n\n';
        }
        markdown += text.trim() + '\n\n';
      });
    }

    const filename = `session-${slugify(agent)}-${Date.now()}.md`;
    downloadBlob(markdown, filename);
  }

  function showFallbackModal(text, rootElement) {
    const doc = rootElement.ownerDocument || document;
    const existing = doc.getElementById('rc-fallback-modal');
    if (existing) existing.remove();

    const backdrop = doc.createElement('div');
    backdrop.id = 'rc-fallback-modal';
    backdrop.className = 'rc-fallback-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'rc-fallback-title');

    const box = doc.createElement('div');
    box.className = 'rc-fallback-box';

    const head = doc.createElement('div');
    head.className = 'rc-fallback-head';

    const title = doc.createElement('h3');
    title.id = 'rc-fallback-title';
    title.textContent = t('carte.copier-le-texte');
    head.appendChild(title);

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'rc-btn rc-fallback-close';
    closeBtn.textContent = t('carte.fermer');
    closeBtn.setAttribute('aria-label', t('carte.fermer-boite-copie'));
    head.appendChild(closeBtn);
    box.appendChild(head);

    const intro = doc.createElement('p');
    intro.className = 'rc-fallback-intro';
    intro.textContent = t('carte.repli-intro');
    box.appendChild(intro);

    const textarea = doc.createElement('textarea');
    textarea.readOnly = true;
    textarea.className = 'rc-fallback-textarea';
    textarea.value = text;
    textarea.setAttribute('aria-label', t('carte.texte-a-copier'));
    box.appendChild(textarea);

    const actions = doc.createElement('div');
    actions.className = 'rc-fallback-actions';

    const selectBtn = doc.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'rc-btn rc-fallback-select';
    selectBtn.textContent = t('carte.tout-selectionner');
    selectBtn.addEventListener('click', () => {
      textarea.focus();
      textarea.select();
    });
    actions.appendChild(selectBtn);

    const doneBtn = doc.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'rc-btn';
    doneBtn.textContent = t('carte.termine');
    actions.appendChild(doneBtn);

    box.appendChild(actions);
    backdrop.appendChild(box);

    const previousActive = doc.activeElement;
    const close = () => {
      backdrop.remove();
      doc.removeEventListener('keydown', onKeyDown);
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus({ preventScroll: true });
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };

    closeBtn.addEventListener('click', close);
    doneBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    doc.addEventListener('keydown', onKeyDown);

    doc.body.appendChild(backdrop);
    textarea.focus();
    textarea.select();
  }

  async function copyText(text, rootElement) {
    if (typeof text !== 'string') text = String(text ?? '');
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // En cas d'erreur ou d'interdiction, passage au repli accessible
      }
    }
    showFallbackModal(text, rootElement || (typeof document !== 'undefined' ? document.body : null));
    return false;
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

  // La langue fait partie de l'empreinte : un changement de langue rafraîchit les textes.
  function langueCourante() {
    return typeof window !== 'undefined' && typeof window.getLangue === 'function'
      ? String(window.getLangue())
      : '';
  }

  function computeSignature(resp) {
    if (!resp) return '';
    const text = getText(resp);
    const key = resp.key || resp.id || '';
    const status = getStatus(resp);
    const time = getTimestamp(resp);
    return `${langueCourante()}|${key}|${status}|${time}|${text.length}|${text.slice(0, 32)}|${text.slice(-32)}`;
  }

  function buildCardElement(resp, defaultAgent, doc, copyFn) {
    const card = doc.createElement('article');
    card.className = 'rc-card';

    const header = doc.createElement('header');
    header.className = 'rc-card-header';

    const meta = doc.createElement('div');
    meta.className = 'rc-card-meta';

    const agentSpan = doc.createElement('span');
    agentSpan.className = 'rc-agent-name';
    agentSpan.textContent = resp.agent || defaultAgent || 'Agent';
    meta.appendChild(agentSpan);

    const timeSpan = doc.createElement('span');
    timeSpan.className = 'rc-time';
    timeSpan.textContent = formatTime(getTimestamp(resp));
    meta.appendChild(timeSpan);

    if (resp.source) {
      const sourceSpan = doc.createElement('span');
      sourceSpan.className = 'rc-source';
      sourceSpan.textContent = `· ${resp.source}`;
      meta.appendChild(sourceSpan);
    }

    const statusStr = getStatus(resp);
    const statusBadge = doc.createElement('span');
    statusBadge.className = getStatusClass(statusStr);
    statusBadge.textContent = statusLabel(statusStr);
    meta.appendChild(statusBadge);

    header.appendChild(meta);

    const actions = doc.createElement('div');
    actions.className = 'rc-card-actions';

    const copyBtn = doc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'rc-btn rc-btn-copy';
    copyBtn.textContent = t('carte.copier-reponse');
    copyBtn.setAttribute('aria-label', t('carte.copier-reponse-de', { agent: agentSpan.textContent }));

    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const textToCopy = getText(resp);
      const ok = await copyFn(textToCopy);
      if (ok) {
        const prev = copyBtn.textContent;
        copyBtn.textContent = t('carte.copie');
        copyBtn.classList.add('rc-copied');
        setTimeout(() => {
          copyBtn.textContent = prev;
          copyBtn.classList.remove('rc-copied');
        }, 1800);
      }
    });
    actions.appendChild(copyBtn);

    const exportBtn = doc.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'rc-btn rc-btn-export';
    exportBtn.textContent = t('carte.exporter');
    exportBtn.setAttribute('aria-label', t('carte.exporter-reponse-de', { agent: agentSpan.textContent }));
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportResponse(resp);
    });
    actions.appendChild(exportBtn);

    header.appendChild(actions);
    card.appendChild(header);

    const body = doc.createElement('div');
    body.className = 'rc-card-body';
    body.appendChild(parseMarkdownToFragment(getText(resp), doc, copyFn));
    card.appendChild(body);

    return card;
  }

  function updateCardElement(card, resp, defaultAgent, doc, copyFn) {
    const meta = card.querySelector('.rc-card-meta');
    if (meta) {
      const agentSpan = meta.querySelector('.rc-agent-name');
      if (agentSpan) agentSpan.textContent = resp.agent || defaultAgent || 'Agent';

      const timeSpan = meta.querySelector('.rc-time');
      if (timeSpan) timeSpan.textContent = formatTime(getTimestamp(resp));

      const statusBadge = meta.querySelector('.rc-status');
      if (statusBadge) {
        const statusStr = getStatus(resp);
        statusBadge.className = getStatusClass(statusStr);
        statusBadge.textContent = statusLabel(statusStr);
      }
    }

    // Mise a jour du corps si l'utilisateur n'est pas en train d'y selectionner du texte
    const body = card.querySelector('.rc-card-body');
    if (body && !isSelectionInside(card)) {
      body.replaceChildren(parseMarkdownToFragment(getText(resp), doc, copyFn));
    }
  }

  function escapeAttr(val) {
    return String(val ?? '').replace(/["\\]/g, '\\$&');
  }

  function render(container, state = {}, options = {}) {
    if (!container) return null;
    const doc = container.ownerDocument || document;
    const agent = state.agent || options.agent || 'Claude';

    let root = container.querySelector('.rc-container');
    if (!root) {
      root = doc.createElement('div');
      root.className = 'rc-container';
      container.appendChild(root);
    }

    // Cas 1 : outil non pris en charge
    if (state.supported === false) {
      root.replaceChildren();
      const empty = doc.createElement('div');
      empty.className = 'rc-empty';
      empty.textContent = state.reason ? tServeur(state.reason) : t('carte.raison-non-soutenu');
      root.appendChild(empty);
      return root;
    }

    // Cas 2 : journal introuvable
    if (state.found === false) {
      root.replaceChildren();
      const empty = doc.createElement('div');
      empty.className = 'rc-empty';
      empty.textContent = t('carte.aucun-journal');
      root.appendChild(empty);
      return root;
    }

    const responses = Array.isArray(state.responses) ? state.responses : [];

    // Cas 3 : aucune réponse dans le journal
    if (responses.length === 0) {
      root.replaceChildren();
      const empty = doc.createElement('div');
      empty.className = 'rc-empty';
      empty.textContent = t('carte.aucune-reponse');
      root.appendChild(empty);
      return root;
    }

    // Retrait d'un etat vide eventuel
    const emptyEl = root.querySelector('.rc-empty');
    if (emptyEl) emptyEl.remove();

    // Barre d'export de session
    let sessionBar = root.querySelector('.rc-session-bar');
    if (!sessionBar) {
      sessionBar = doc.createElement('div');
      sessionBar.className = 'rc-session-bar';

      const title = doc.createElement('span');
      title.className = 'rc-session-title';

      const label = doc.createElement('span');
      label.className = 'rc-session-label';
      title.appendChild(label);

      const count = doc.createElement('span');
      count.className = 'rc-session-count';
      title.appendChild(count);
      sessionBar.appendChild(title);

      const exportSessionBtn = doc.createElement('button');
      exportSessionBtn.type = 'button';
      exportSessionBtn.className = 'rc-btn rc-btn-export-session';
      exportSessionBtn.textContent = t('carte.exporter-session');
      sessionBar.appendChild(exportSessionBtn);

      root.prepend(sessionBar);
    }

    // Le libellé se termine par un espace qui sépare le compteur.
    const labelSpan = sessionBar.querySelector('.rc-session-label');
    if (labelSpan) labelSpan.textContent = t('carte.reponses-de', { agent });

    const countSpan = sessionBar.querySelector('.rc-session-count');
    if (countSpan) {
      countSpan.textContent = state.complete === false
        ? t('carte.compte-recents', { n: responses.length })
        : String(responses.length);
    }

    const exportSessionBtn = sessionBar.querySelector('.rc-btn-export-session');
    if (exportSessionBtn) {
      exportSessionBtn.onclick = (e) => {
        e.stopPropagation();
        exportSession(agent, responses);
      };
    }

    let list = root.querySelector('.rc-list');
    if (!list) {
      list = doc.createElement('div');
      list.className = 'rc-list';
      root.appendChild(list);
    }

    const validKeys = new Set();
    const copyFn = (txt, el) => copyText(txt, el || root);

    // Réconciliation par clés stables
    responses.forEach((resp, idx) => {
      const key = getKey(resp, idx);
      validKeys.add(key);

      const existingCard = list.querySelector(`.rc-card[data-id="${escapeAttr(key)}"]`);
      const sig = computeSignature(resp);

      if (!existingCard) {
        const newCard = buildCardElement(resp, agent, doc, copyFn);
        newCard.dataset.id = key;
        newCard._signature = sig;
        newCard._response = resp;
        list.appendChild(newCard);
      } else {
        if (existingCard._signature !== sig) {
          updateCardElement(existingCard, resp, agent, doc, copyFn);
          existingCard._signature = sig;
          existingCard._response = resp;
        }
      }
    });

    // Nettoyage des cartes orphelines
    Array.from(list.children).forEach((child) => {
      if (child.dataset?.id && !validKeys.has(child.dataset.id)) {
        child.remove();
      }
    });

    return root;
  }

  function renderResponses(first, second, options = {}) {
    let targetContainer;
    let payload;

    // Détection souple : (liste, conteneur) ou (conteneur, liste)
    if (first && (first.nodeType === 1 || typeof first.appendChild === 'function')) {
      targetContainer = first;
      payload = second;
    } else if (second && (second.nodeType === 1 || typeof second.appendChild === 'function')) {
      targetContainer = second;
      payload = first;
    } else if (typeof first === 'string' && (Array.isArray(second) || (second && typeof second === 'object'))) {
      targetContainer = (typeof document !== 'undefined') ? document.querySelector(first) : null;
      payload = second;
    } else if (typeof second === 'string' && (Array.isArray(first) || (first && typeof first === 'object'))) {
      targetContainer = (typeof document !== 'undefined') ? document.querySelector(second) : null;
      payload = first;
    } else {
      targetContainer = first;
      payload = second;
    }

    if (!targetContainer) return null;

    let state;
    if (Array.isArray(payload)) {
      state = { supported: true, found: true, complete: true, responses: payload };
    } else if (payload && typeof payload === 'object') {
      state = Object.assign({}, payload);
    } else {
      state = { supported: true, found: true, complete: true, responses: [] };
    }

    if (options && typeof options === 'object') {
      if (options.agent && !state.agent) state.agent = options.agent;
    }

    return render(targetContainer, state, options);
  }

  const ResponseCard = {
    render: renderResponses,
    renderResponses,
    renderMarkdown: (text, container, copyFn) => {
      if (!container) return;
      const doc = container.ownerDocument || document;
      const fn = copyFn || ((txt) => copyText(txt, container));
      container.replaceChildren(parseMarkdownToFragment(text, doc, fn));
    },
    parseMarkdownToFragment,
    parseInlineToFragment,
    exportResponse,
    exportSession,
    copyText,
    showFallbackModal,
  };

  if (typeof window !== 'undefined') {
    window.ResponseCard = ResponseCard;
    window.renderResponses = renderResponses;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ResponseCard,
      renderResponses,
      render: renderResponses,
      parseMarkdownToFragment,
      parseInlineToFragment,
      exportResponse,
      exportSession,
      copyText,
    };
  }
})();
