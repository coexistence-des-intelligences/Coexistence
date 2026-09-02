import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const [html, app, css, startHere, projectState, handover] =
  await Promise.all([
    readFile(path.join(root, 'public/index.html'), 'utf8'),
    readFile(path.join(root, 'public/app.js'), 'utf8'),
    readFile(path.join(root, 'public/styles.css'), 'utf8'),
    readFile(path.join(root, 'docs/understanding/START_HERE.md'), 'utf8'),
    readFile(path.join(root, 'docs/understanding/PROJECT_STATE.md'), 'utf8'),
    readFile(path.join(root, 'docs/understanding/HANDOVER.md'), 'utf8')
  ]);

function matches(source, pattern) {
  return [...source.matchAll(pattern)].map(match => match[1]);
}

const ids = matches(html, /\sid="([^"]+)"/g);
const duplicateIds = ids.filter(
  (id, index) => ids.indexOf(id) !== index
);

assert.deepEqual(
  duplicateIds,
  [],
  `Identifiants HTML dupliqués : ${duplicateIds.join(', ')}`
);

const htmlWithoutComments =
  html.replace(/<!--[\s\S]*?-->/g, '');

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

const openElements = [];

for (const tag of htmlWithoutComments.matchAll(/<(\/)?([a-z][\w-]*)\b[^>]*>/gi)) {
  const closing = Boolean(tag[1]);
  const name = tag[2].toLowerCase();

  if (closing) {
    assert.equal(
      openElements.pop(),
      name,
      `Fermeture HTML inattendue : </${name}>.`
    );
  } else if (!voidElements.has(name) && !tag[0].endsWith('/>')) {
    openElements.push(name);
  }
}

assert.deepEqual(
  openElements,
  [],
  `Éléments HTML non fermés : ${openElements.join(', ')}`
);

for (const reference of matches(
  html,
  /(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g
)) {
  for (const referencedId of reference.split(/\s+/)) {
    assert(
      ids.includes(referencedId),
      `La référence accessible ${referencedId} ne correspond à aucun identifiant.`
    );
  }
}

const routes = [...new Set(matches(html, /data-nav="([^"]+)"/g))];

assert.deepEqual(
  routes.sort(),
  [
    'disagreements',
    'evolution',
    'home',
    'journal',
    'project',
    'understand'
  ],
  'La navigation publique ne correspond pas au contrat attendu.'
);

for (const route of routes) {
  assert(
    ids.includes(`view-${route}`),
    `La route ${route} ne possède pas de vue correspondante.`
  );
}

const primaryNavigation = html.match(
  /<nav aria-label="Navigation principale">([\s\S]*?)<\/nav>/
)?.[1] || '';

assert.equal(
  matches(primaryNavigation, /data-nav="([^"]+)"/g).length,
  3,
  'La navigation principale doit conserver exactement trois entrées.'
);

assert.match(
  html,
  /id="comprehension-depth"[\s\S]*?type="range"[\s\S]*?min="1"[\s\S]*?max="4"/,
  'Le curseur de compréhension doit couvrir les niveaux 1 à 4.'
);

assert.deepEqual(
  matches(html, /class="depth-section" data-depth="([1-4])"/g),
  ['1', '2', '3', '4'],
  'Les quatre niveaux cumulatifs doivent être présents dans l’ordre.'
);

assert.match(
  app,
  /function setComprehensionDepth\(value\)/,
  'Le comportement du curseur doit être défini.'
);

assert.match(
  app,
  /'project'/,
  'La page de compréhension doit être reconnue par le routeur.'
);

assert.match(
  css,
  /@media\(max-width:620px\)[\s\S]*?\.side-note\{display:block\}/,
  'Les explications essentielles ne doivent plus disparaître sur mobile.'
);

assert.match(
  css,
  /@media\(max-width:620px\)[\s\S]*?\.trust-grid\{display:flex;overflow-x:auto;scroll-snap-type:x proximity/,
  'Les garanties doivent rester accessibles sans repousser la conversation sur mobile.'
);

for (const externalLink of html.matchAll(
  /<a\b[^>]*target="_blank"[^>]*>/g
)) {
  assert.match(
    externalLink[0],
    /rel="noreferrer"/,
    'Tout lien ouvrant un nouvel onglet doit protéger la provenance de navigation.'
  );
}

assert.match(
  html,
  /Une véritable contribution privée est une[\s\S]*?fonction future/,
  'La limite relative aux contributions privées doit être visible.'
);

assert.match(
  html,
  /elle n’est pas affichée dans la contribution publique/,
  'La conservation facultative de la conversation doit être distinguée de sa visibilité publique.'
);

assert.doesNotMatch(
  startHere,
  /choisir séparément la visibilité de la contribution/,
  'START_HERE ne doit pas promettre une visibilité privée inexistante.'
);

assert.doesNotMatch(
  startHere,
  /Rien n’est partagé sans validation explicite/,
  'START_HERE doit distinguer publication et transmission technique.'
);

assert.match(
  projectState,
  /interface publique à quatre niveaux de compréhension progressive/,
  'PROJECT_STATE doit mentionner la nouvelle interface.'
);

assert.match(
  handover,
  /## Maintenir la compréhension publique/,
  'HANDOVER doit expliquer comment maintenir la page vivante.'
);

const sourcePaths = matches(
  html,
  /href="https:\/\/github\.com\/coexistence-des-intelligences\/Coexistence\/blob\/main\/([^"]+)"/g
);

assert.equal(
  sourcePaths.length,
  8,
  'La page doit relier les huit documents de compréhension.'
);

for (const sourcePath of sourcePaths) {
  await access(path.join(root, sourcePath));
}

console.log(
  'Interface contract OK: navigation, depth, accessibility copy and living sources.'
);
