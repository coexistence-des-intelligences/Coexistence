import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const [html, app] = await Promise.all([
  readFile(path.join(root, 'public/index.html'), 'utf8'),
  readFile(path.join(root, 'public/app.js'), 'utf8')
]);

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(...names) {
    names.forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === undefined) {
      force = !this.values.has(name);
    }

    if (force) {
      this.values.add(name);
    } else {
      this.values.delete(name);
    }

    return force;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor({ id = '', classes = [], dataset = {} } = {}) {
    this.id = id;
    this.dataset = dataset;
    this.classList = new FakeClassList(classes);
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.hidden = false;
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.scrollHeight = 0;
    this.scrollTop = 0;
    this.onclick = null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  focus() {}
  scrollIntoView() {}
  showModal() {}
  close() {}
}

const ids = [
  ...html.matchAll(/\sid="([^"]+)"/g)
].map(match => match[1]);

const elements = new Map(
  ids.map(id => [id, new FakeElement({ id })])
);

const viewNames = [
  'home',
  'project',
  'understand',
  'disagreements',
  'evolution',
  'journal'
];

const views = viewNames.map(name => {
  const element = elements.get(`view-${name}`);
  element.classList.add('view');

  if (name === 'home') {
    element.classList.add('active');
  }

  return element;
});

elements.get('explore-nav').classList.add('hidden');

const primaryNavigation = [
  'home',
  'understand',
  'project'
].map(name => new FakeElement({
  classes: ['nav'],
  dataset: { nav: name }
}));

primaryNavigation[0].classList.add('active');

const sectionNavigation = [
  'understand',
  'disagreements',
  'evolution',
  'journal'
].map(name => new FakeElement({
  classes: ['section-nav-button'],
  dataset: { nav: name }
}));

const additionalNavigation = [
  new FakeElement({ dataset: { nav: 'home' } }),
  new FakeElement({ dataset: { nav: 'project' } }),
  new FakeElement({ dataset: { nav: 'project' } }),
  new FakeElement({ dataset: { nav: 'project' } })
];

const depthSections = [1, 2, 3, 4].map(depth =>
  new FakeElement({
    classes: ['depth-section'],
    dataset: { depth: String(depth) }
  })
);

const depthButtons = [1, 2, 3, 4].map(depth =>
  new FakeElement({
    dataset: { depthSelect: String(depth) }
  })
);

const refreshButtons = [1, 2, 3, 4].map(() =>
  new FakeElement({ classes: ['refresh'] })
);

const generic = new FakeElement();

const document = {
  createElement: () => new FakeElement(),
  querySelector(selector) {
    if (selector.startsWith('#')) {
      return elements.get(selector.slice(1)) || generic;
    }

    if (selector === '.view.active') {
      return views.find(view => view.classList.contains('active')) || null;
    }

    return generic;
  },
  querySelectorAll(selector) {
    const collections = {
      '.view': views,
      '.nav': primaryNavigation,
      '.section-nav-button': sectionNavigation,
      '[data-nav]': [
        ...primaryNavigation,
        ...sectionNavigation,
        ...additionalNavigation
      ],
      '[data-depth-select]': depthButtons,
      '.depth-section': depthSections,
      '.refresh': refreshButtons,
      '.detail': []
    };

    return collections[selector] || [];
  }
};

const windowListeners = new Map();
const location = { hash: '' };
const historyEntries = [];

const context = vm.createContext({
  console: {
    error() {},
    log() {}
  },
  confirm: () => true,
  document,
  fetch: async () => ({
    ok: true,
    status: 200,
    json: async () => []
  }),
  history: {
    pushState(_state, _title, hash) {
      location.hash = hash;
      historyEntries.push(['push', hash]);
    },
    replaceState(_state, _title, hash) {
      location.hash = hash;
      historyEntries.push(['replace', hash]);
    }
  },
  Intl,
  location,
  setTimeout,
  clearTimeout,
  window: {
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    scrollTo() {},
    SpeechRecognition: undefined,
    webkitSpeechRecognition: undefined
  }
});

vm.runInContext(app, context);

assert(
  elements.get('view-home').classList.contains('active'),
  'La vue Parler doit être active au démarrage.'
);

assert.equal(
  location.hash,
  '#home',
  'L’adresse initiale doit refléter la vue Parler.'
);

const projectButton = primaryNavigation.find(
  button => button.dataset.nav === 'project'
);

projectButton.onclick({ preventDefault() {} });

assert(
  elements.get('view-project').classList.contains('active'),
  'Le bouton Le projet doit afficher la page de compréhension.'
);

assert(
  elements.get('explore-nav').classList.contains('hidden'),
  'La navigation du corpus doit rester cachée sur la page Le projet.'
);

vm.runInContext('setComprehensionDepth(4)', context);

assert.equal(elements.get('depth-number').textContent, 'Niveau 4');
assert.equal(elements.get('depth-name').textContent, 'Les sources');
assert(depthSections.every(section => section.hidden === false));
assert(depthButtons[3].classList.contains('active'));

vm.runInContext("nav('disagreements')", context);

assert(
  elements.get('view-disagreements').classList.contains('active'),
  'La sous-navigation doit ouvrir la vue Désaccords.'
);

assert(
  !elements.get('explore-nav').classList.contains('hidden'),
  'La navigation du corpus doit apparaître dans les vues publiques.'
);

assert(
  primaryNavigation.find(button => button.dataset.nav === 'understand')
    .classList.contains('active'),
  'Explorer doit rester actif pour toutes les rubriques du corpus.'
);

assert(
  historyEntries.some(([mode, hash]) =>
    mode === 'push' && hash === '#disagreements'
  ),
  'La navigation doit créer un historique utilisable par le bouton retour.'
);

location.hash = '#project';
windowListeners.get('popstate')();

assert(
  elements.get('view-project').classList.contains('active'),
  'Le bouton retour du navigateur doit restaurer la vue indiquée dans l’adresse.'
);

console.log(
  'Interface runtime OK: routing, history, explorer grouping and cumulative depth.'
);
