import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createBureauServer } from '../server.mjs';

const source = await readFile(new URL('../public/terminal.js', import.meta.url), 'utf8');
const window = {};
runInNewContext(source, { window });
const { render, classify, split } = window.TerminalView;
const plain = value => JSON.parse(JSON.stringify(value));

class Node {
  constructor(tagName, ownerDocument, text = '') {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.data = text;
    this.className = '';
    this.children = [];
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientHeight = 100;
    this.scrollHeight = 500;
  }
  get textContent() { return this.tagName === '#text' ? this.data : this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('innerHTML interdit'); }
  appendChild(child) {
    if (child.tagName === '#fragment') this.children.push(...child.children);
    else this.children.push(child);
    return child;
  }
  replaceChildren(...children) {
    this.children = [];
    for (const child of children) this.appendChild(child);
    this.scrollHeight = 700;
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }
}

function pre() {
  const document = {
    createElement: tag => new Node(tag, document),
    createTextNode: text => new Node('#text', document, text),
    createDocumentFragment: () => new Node('#fragment', document),
  };
  return document.createElement('pre');
}

function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }

test('classe les erreurs sans tenir compte de la casse ou des accents', () => {
  for (const signal of ['ERROR', 'Erreur', 'failed', 'ÉCHEC', 'Exception', 'denied', 'refusé', 'erreurs', 'refused']) {
    assert.equal(classify(`Sortie : ${signal}`), 't-err', signal);
  }
});

test('classe les demandes de saisie et donne priorite a une erreur', () => {
  for (const signal of ['Continuer ?  ', '(y/n)', '[Y/n]', 'PRESS ENTER', 'Appuie sur Entrée', 'CONFIRM', 'approve', 'Autorisation requise']) {
    assert.equal(classify(signal), 't-wait', signal);
  }
  assert.equal(classify('error : confirm ?'), 't-err');
  assert.equal(classify('done : confirm ?'), 't-wait');
});

test('classe les reussites sans colorer les mots qui contiennent seulement ok ou pass', () => {
  for (const signal of ['pass', 'passed', 'RÉUSSI', 'OK', 'done', 'terminé']) assert.equal(classify(signal), 't-ok', signal);
  for (const line of ['compass', 'token', 'book', 'passage', 'texte ordinaire', 'URL https://exemple.test/?id=2']) assert.equal(classify(line), '', line);
});

test('split recherche des occurrences litterales sans casse ni accents', () => {
  const parts = plain(split('Échec puis e\u0301chec et ÉCHEC.', 'échec'));
  assert.deepEqual(parts, [
    { text: 'Échec', hit: true }, { text: ' puis ', hit: false },
    { text: 'e\u0301chec', hit: true }, { text: ' et ', hit: false },
    { text: 'ÉCHEC', hit: true }, { text: '.', hit: false },
  ]);
  assert.equal(split('[x] [x]', '[x]').filter(part => part.hit).length, 2);
  assert.equal(split('aaaa', 'aa').filter(part => part.hit).length, 2);
  assert.deepEqual(plain(split('Texte', '')), [{ text: 'Texte', hit: false }]);
  assert.deepEqual(plain(split('Texte', 'absent')), [{ text: 'Texte', hit: false }]);
});

test('retire ANSI, OSC et controles de curseur en conservant le texte reel', () => {
  const text = '\x1b[31mÉchec\x1b[0m\n\x1b]0;Titre prive\x07ok\n\x1b]8;;https://secret.invalid\x1b\\lien\x1b]8;;\x1b\\\n\x1b[2Kdone\x9b0m';
  const output = split(text, '').map(part => part.text).join('');
  assert.equal(output, 'Échec\nok\nlien\ndone');
  assert.equal(classify('\x1b[31mÉCHEC\x1b[0m'), 't-err');
  assert.equal(split('texte\x1b[31', '').map(part => part.text).join(''), 'texte');
});

test('render conserve le texte HTML comme texte et utilise uniquement span, mark et noeuds texte', () => {
  const element = pre();
  const text = '<script>alert("x")</script>\nÉchec <img src=x onerror=alert(1)>\nOK\n';
  assert.deepEqual(plain(render(element, text, { query: '<' })), { matches: 3 });
  assert.equal(element.textContent, text);
  const nodes = descendants(element);
  assert.ok(nodes.every(node => ['span', 'mark', '#text'].includes(node.tagName)));
  assert.equal(nodes.filter(node => node.tagName === 'mark' && node.className === 't-hit').length, 3);
  assert.equal(element.children[1].className, 't-err');
  assert.equal(element.children[2].className, 't-ok');
});

test('render compte une recherche couvrant plusieurs lignes sans perdre les sauts de ligne', () => {
  const element = pre();
  assert.equal(render(element, 'un\ndeux\nun\ndeux', { query: 'un\ndeux' }).matches, 2);
  assert.equal(element.textContent, 'un\ndeux\nun\ndeux');
});

test('render retire les anciens resultats et accepte un terminal vide', () => {
  const element = pre();
  render(element, 'error error', { query: 'error' });
  assert.equal(render(element, '').matches, 0);
  assert.equal(element.textContent, '');
  assert.equal(descendants(element).filter(node => node.className === 't-hit').length, 0);
});

test('render suit le bas uniquement si le lecteur y etait et conserve le defilement horizontal', () => {
  const element = pre();
  element.scrollTop = 400;
  element.scrollLeft = 12;
  render(element, 'nouvelle sortie');
  assert.equal(element.scrollTop, 700);
  assert.equal(element.scrollLeft, 12);
  element.scrollTop = 120;
  render(element, 'autre sortie');
  assert.equal(element.scrollTop, 120);
});

test('frozen conserve la position meme si le lecteur etait en bas', () => {
  const element = pre();
  element.scrollTop = 400;
  element.scrollLeft = 25;
  render(element, 'nouvelle sortie', { frozen: true });
  assert.equal(element.scrollTop, 400);
  assert.equal(element.scrollLeft, 25);
});

test('/terminal.js est servi comme script classique avec les protections du serveur', async t => {
  const server = createBureauServer({ bridge: { list: async () => [] } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/terminal.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), source);
});
