(() => {
  'use strict';

  function clean(text) {
    return String(text ?? '')
      .replace(/(?:\x1b\]|\x9d)[\s\S]*?(?:\x07|\x1b\\|\x9c|$)/g, '')
      .replace(/\x1b[P^_X][\s\S]*?(?:\x1b\\|\x9c|$)/g, '')
      .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]/g, '')
      .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*$/g, '')
      .replace(/\x1b[ -/]*[0-~]/g, '')
      .replace(/\x1b/g, '');
  }

  const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  function classify(line) {
    const text = fold(clean(line));
    if (/\b(?:errors?|erreurs?|failed|echecs?|exceptions?|denied|refuse\w*)\b/.test(text)) return 't-err';
    if (/\?\s*$|\(y\/n\)|\[y\/n\]|\b(?:press\s+enter|appuie\w*|confirm\w*|approve\w*|autoris\w*)\b/.test(text)) return 't-wait';
    if (/\b(?:pass(?:ed|es|ing)?|reussi\w*|ok|done|termine\w*)\b/.test(text)) return 't-ok';
    return '';
  }

  function foldedRanges(text) {
    const chunks = [];
    const starts = [];
    const ends = [];
    let offset = 0;
    for (const character of text) {
      const normalized = fold(character);
      chunks.push(normalized);
      for (let i = 0; i < normalized.length; i++) {
        starts.push(offset);
        ends.push(offset + character.length);
      }
      // Un accent separe doit rester dans le meme surlignage que sa lettre.
      if (!normalized && ends.length) ends[ends.length - 1] = offset + character.length;
      offset += character.length;
    }
    return { text: chunks.join(''), starts, ends };
  }

  // Les segments conservent le texte original, sans les commandes ANSI.
  function split(text, query = '') {
    text = clean(text);
    const needle = fold(clean(query));
    if (!needle) return [{ text, hit: false }];
    const normalized = foldedRanges(text);
    const parts = [];
    let cursor = 0;
    let searchFrom = 0;
    for (let index = normalized.text.indexOf(needle, searchFrom); index !== -1; index = normalized.text.indexOf(needle, searchFrom)) {
      const start = normalized.starts[index];
      const end = normalized.ends[index + needle.length - 1];
      if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
      if (start >= cursor) parts.push({ text: text.slice(start, end), hit: true });
      cursor = Math.max(cursor, end);
      searchFrom = index + needle.length;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
    return parts.length ? parts : [{ text, hit: false }];
  }

  function render(pre, text, { query = '', frozen = false } = {}) {
    const top = pre.scrollTop;
    const left = pre.scrollLeft;
    const wasAtBottom = pre.scrollHeight - pre.clientHeight - top <= 2;
    const document = pre.ownerDocument;
    const fragment = document.createDocumentFragment();
    const parts = split(text, query);
    const lines = parts.map(part => part.text).join('').match(/[^\n]*\n|[^\n]+$/g) || [];
    let partIndex = 0;
    let partOffset = 0;
    for (const line of lines) {
      const row = document.createElement('span');
      row.className = classify(line);
      let remaining = line.length;
      while (remaining > 0) {
        const part = parts[partIndex];
        const length = Math.min(remaining, part.text.length - partOffset);
        const node = document.createTextNode(part.text.slice(partOffset, partOffset + length));
        if (part.hit) {
          const mark = document.createElement('mark');
          mark.className = 't-hit';
          mark.appendChild(node);
          row.appendChild(mark);
        } else row.appendChild(node);
        remaining -= length;
        partOffset += length;
        if (partOffset === part.text.length) { partIndex++; partOffset = 0; }
      }
      fragment.appendChild(row);
    }
    pre.replaceChildren(fragment);
    pre.scrollTop = !frozen && wasAtBottom ? pre.scrollHeight : top;
    pre.scrollLeft = left;
    return { matches: parts.filter(part => part.hit).length };
  }

  window.TerminalView = { render, classify, split };
})();
