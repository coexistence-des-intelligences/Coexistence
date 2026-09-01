const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  messages: [],
  summary: null,
  busy: false
};

const firstMessage =
  "Qu’aimeriez-vous nous dire ? Cela peut être une expérience, une inquiétude, une idée, un désaccord, quelque chose que vous aimeriez préserver… ou simplement quelque chose qui vous semble important.";


/* ============================================================
   OUTILS
   ============================================================ */

function esc(s = '') {
  return String(s).replace(
    /[&<>'"]/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;'
    })[c]
  );
}


function fmtDate(v) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(v));
  } catch {
    return '';
  }
}


function groundingLabel(value) {
  const labels = {
    explicit:
      'explicite dans la contribution',

    inferred:
      'inféré par l’IA',

    ai_counterargument:
      'contre-argument construit par l’IA',

    explicit_in_corpus:
      'explicite dans le corpus',

    inferred_by_ai:
      'inféré par l’IA',

    mixed:
      'origine mixte'
  };

  return labels[value] || value || '';
}


function provenanceMeta(row = {}) {
  const protocol =
    row.origin_protocol_version ||
    row.protocol_version;

  const provider =
    row.origin_provider ||
    row.provider;

  const model =
    row.origin_model ||
    row.model;

  const origin = [
    protocol
      ? `protocole ${protocol}`
      : '',

    provider,
    model
  ]
    .filter(Boolean)
    .join(' / ');

  return [
    groundingLabel(row.grounding),
    origin
  ]
    .filter(Boolean)
    .map(esc)
    .join(' · ');
}


async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error || `Erreur ${res.status}`
    );
  }

  return data;
}


function setNotice(
  html = '',
  warn = false
) {
  $('#notice').innerHTML =
    html
      ? `<div class="notice ${warn ? 'warn' : ''}">${html}</div>`
      : '';
}


function setBusy(
  value,
  label = ''
) {
  state.busy = value;

  $('#send').disabled = value;
  $('#summarize').disabled = value;

  if (label) {
    state.messages.push({
      role: 'assistant',
      content: `__thinking__${label}`
    });
  } else {
    state.messages =
      state.messages.filter(
        m =>
          !m.content.startsWith(
            '__thinking__'
          )
      );
  }

  renderChat();
}


/* ============================================================
   CONVERSATION
   ============================================================ */

function renderChat() {
  const box = $('#chat');

  box.innerHTML = '';

  state.messages.forEach(m => {
    const row =
      document.createElement('div');

    row.className =
      `msg ${
        m.role === 'user'
          ? 'user'
          : 'assistant'
      }`;

    const bubble =
      document.createElement('div');

    bubble.className = 'bubble';

    if (
      m.content.startsWith(
        '__thinking__'
      )
    ) {
      bubble.innerHTML =
        `<span class="spinner"></span>` +
        esc(
          m.content.replace(
            '__thinking__',
            ''
          )
        );
    } else {
      bubble.textContent =
        m.content;
    }

    row.appendChild(bubble);
    box.appendChild(row);
  });

  box.scrollTop =
    box.scrollHeight;
}


function resetConversation() {
  state.messages = [
    {
      role: 'assistant',
      content: firstMessage
    }
  ];

  state.summary = null;

  $('#summary-panel')
    .classList.add('hidden');

  $('#message').value = '';

  setNotice('');
  renderChat();
}


async function sendMessage() {
  if (state.busy) {
    return;
  }

  const text =
    $('#message').value.trim();

  if (!text) {
    return;
  }

  $('#message').value = '';

  state.messages.push({
    role: 'user',
    content: text
  });

  renderChat();

  setBusy(
    true,
    'Je vous écoute…'
  );

  try {
    const cleanMessages =
      state.messages.filter(
        m =>
          !m.content.startsWith(
            '__thinking__'
          )
      );

    const data =
      await api(
        '/api/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            messages:
              cleanMessages
          })
        }
      );

    setBusy(false);

    state.messages.push({
      role: 'assistant',
      content: data.reply
    });

    renderChat();

  } catch (e) {
    setBusy(false);

    setNotice(
      `<strong>Un problème est survenu.</strong> ${esc(e.message)}`,
      true
    );
  }
}


/* ============================================================
   SYNTHÈSE AVANT CONTRIBUTION
   ============================================================ */

async function summarize() {
  if (state.busy) {
    return;
  }

  if (
    !state.messages.some(
      m => m.role === 'user'
    )
  ) {
    setNotice(
      'Dites d’abord quelque chose, même une seule phrase.'
    );

    return;
  }

  setBusy(
    true,
    'Je prépare une synthèse fidèle…'
  );

  try {
    const data =
      await api(
        '/api/summarize',
        {
          method: 'POST',
          body: JSON.stringify({
            messages:
              state.messages.filter(
                m =>
                  !m.content.startsWith(
                    '__thinking__'
                  )
              )
          })
        }
      );

    setBusy(false);

    state.summary = data;

    // Une réussite efface une ancienne erreur.
    setNotice('');

    $('#summary-title').value =
      data.title ||
      'Contribution';

    $('#summary-text').value =
      data.summary || '';

    /*
     * Les catégories méthodologiques restent
     * disponibles pour l'analyse interne,
     * mais ne sont pas imposées visuellement.
     */
    $('#nature-tags').innerHTML = '';

    if (data.open_question) {
      $('#open-question')
        .textContent =
          data.open_question;

      $('#open-question-box')
        .classList.remove(
          'hidden'
        );
    } else {
      $('#open-question-box')
        .classList.add(
          'hidden'
        );
    }

    $('#confirm-share').checked =
      false;

    $('#include-conversation').checked =
      false;

    $('#summary-panel')
      .classList.remove(
        'hidden'
      );

    $('#summary-panel')
      .scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

  } catch (e) {
    setBusy(false);

    setNotice(
      `<strong>Synthèse impossible.</strong> ${esc(e.message)}`,
      true
    );
  }
}


/* ============================================================
   PUBLICATION
   ============================================================ */

async function publishContribution() {
  if (
    !$('#confirm-share').checked
  ) {
    setNotice(
      'Cochez d’abord la case confirmant que vous souhaitez réellement partager cette synthèse.'
    );

    return;
  }

  const btn = $('#publish');

  btn.disabled = true;

  btn.innerHTML =
    '<span class="spinner"></span>Enregistrement…';

  try {
    const data =
      await api(
        '/api/contributions',
        {
          method: 'POST',

          body: JSON.stringify({
            confirmed: true,

            title:
              $('#summary-title')
                .value
                .trim(),

            summary:
              $('#summary-text')
                .value
                .trim(),

            nature:
              state.summary
                ?.nature ||
              [],

            openQuestion:
              state.summary
                ?.open_question ||
              '',

            includeConversation:
              $('#include-conversation')
                .checked,

            messages:
              state.messages.filter(
                m =>
                  !m.content.startsWith(
                    '__thinking__'
                  )
              )
          })
        }
      );

    $('#summary-panel')
      .classList.add(
        'hidden'
      );

    setNotice(
      `<strong>Merci.</strong> Votre contribution ` +
      `<span class="public-id">${esc(data.public_id)}</span> ` +
      `est enregistrée. Elle est maintenant analysée avant publication ` +
      `afin de protéger la confidentialité et l’intégrité du corpus.`
    );

  } catch (e) {
    setNotice(
      `<strong>Enregistrement impossible.</strong> ${esc(e.message)}`,
      true
    );

  } finally {
    btn.disabled = false;

    btn.textContent =
      'Valider ma contribution';
  }
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function nav(name) {
  $$('.view').forEach(
    v =>
      v.classList.remove(
        'active'
      )
  );

  $$('.nav').forEach(
    n =>
      n.classList.toggle(
        'active',
        n.dataset.nav === name
      )
  );

  $(`#view-${name}`)
    .classList.add(
      'active'
    );

  history.replaceState(
    null,
    '',
    `#${name}`
  );

  if (name !== 'home') {
    loadPublic(name);
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* ============================================================
   AFFICHAGE DES OBJETS PUBLICS
   ============================================================ */

function itemHtml(
  {
    id = '',
    title,
    summary,
    meta = '',
    positions = []
  },
  detail = false
) {
  const idHtml =
    id
      ? `<span class="public-id">${esc(id)}</span>`
      : '';

  const metaHtml =
    idHtml || meta
      ? `<div class="meta">${idHtml}${meta}</div>`
      : '';

  return `
    <div class="item">

      ${metaHtml}

      <h3>
        ${esc(title || '')}
      </h3>

      ${
        summary
          ? `<p>${esc(summary)}</p>`
          : ''
      }

      ${
        positions?.length
          ? `
            <ul class="positions">
              ${
                positions
                  .map(
                    x => {
                      if (
                        typeof x !==
                        'object'
                      ) {
                        return `<li>${esc(x)}</li>`;
                      }

                      const positionMeta = [
                        groundingLabel(
                          x.grounding
                        ),

                        (x.evidence_ids || [])
                          .length
                          ? `preuves : ${
                              x.evidence_ids
                                .join(', ')
                            }`
                          : ''
                      ]
                        .filter(Boolean)
                        .map(esc)
                        .join(' · ');

                      return `
                        <li>
                          ${esc(x.statement || '')}
                          ${
                            positionMeta
                              ? `<div class="meta">${positionMeta}</div>`
                              : ''
                          }
                        </li>
                      `;
                    }
                  )
                  .join('')
              }
            </ul>
          `
          : ''
      }

      ${
        detail
          ? `
            <button
              class="link-btn detail"
              data-id="${esc(id)}"
            >
              Voir contribution et analyse →
            </button>
          `
          : ''
      }

    </div>
  `;
}


/* ============================================================
   LIBELLÉS DU JOURNAL
   ============================================================ */

function eventLabel(type) {
  const labels = {
    contribution_published:
      'Contribution publiée',

    contribution_quarantined:
      'Contribution mise en attente',

    collective_synthesis:
      'Nouvelle synthèse inter-contributions',

    methodology_adjustment:
      'Méthode du projet modifiée',

    governance_transparency_created:
      'Transparence de gouvernance ajoutée',

    processing_error:
      'Erreur de traitement',

    federation_sync:
      'Échange avec une autre instance',

    version_candidate:
      'Nouvelle version proposée'
  };

  return (
    labels[type] ||
    type.replaceAll('_', ' ')
  );
}


/* ============================================================
   COMPRENDRE
   ============================================================ */

async function loadOverview() {
  const d =
    await api(
      '/api/public/overview'
    );

  const c =
    d.counts || {};

  $('#stats').innerHTML = [
    [
      'Contributions',
      c.contributions
    ],

    [
      'Thèmes multi-contributions',
      c.themes
    ],

    [
      'Désaccords entre contributions',
      c.disagreements
    ],

    [
      'Risques signalés',
      c.risks
    ],

    [
      'Questions du corpus',
      c.questions
    ],

    [
      'Propositions à examiner',
      c.proposals
    ]
  ]
    .map(
      ([label, number]) => `
        <div class="stat">

          <b>
            ${Number(number || 0)}
          </b>

          <span>
            ${label}
          </span>

        </div>
      `
    )
    .join('');


  /* ----------------------------------------------------------
     PISTES THÉMATIQUES
     ---------------------------------------------------------- */

  const themes =
    d.recent_themes || [];

  $('#themes').innerHTML =
    themes.length
      ? themes
          .map(
            t =>
              itemHtml({
                /*
                 * La clé technique reste dans la base
                 * mais n'est pas affichée.
                 */
                id: '',

                title:
                  t.label,

                summary:
                  t.description ||
                  'Piste thématique issue du corpus',

                meta:
                  [
                    fmtDate(
                      t.updated_at
                    ),

                    provenanceMeta({
                      protocol_version:
                        t.description_protocol_version,

                      provider:
                        t.description_provider,

                      model:
                        t.description_model
                    })
                  ]
                    .filter(Boolean)
                    .join(' · ')
              })
          )
          .join('')

      : `
        <p class="hint">
          Les premières pistes thématiques apparaîtront avec les contributions.
        </p>
      `;


  /* ----------------------------------------------------------
     SYNTHÈSE INTER-CONTRIBUTIONS
     ---------------------------------------------------------- */

  const synthesis =
    d.latest_synthesis
      ?.content;


  if (synthesis) {
    const synthesisSection = (
      title,
      items,
      textField,
      emptyText = ''
    ) => {
      const visible =
        (items || [])
          .filter(
            x => x?.[textField]
          );

      if (!visible.length) {
        return emptyText
          ? `
            <div class="open-question">
              <strong>${esc(title)}</strong>
              <p class="hint">${esc(emptyText)}</p>
            </div>
          `
          : '';
      }

      return `
        <div class="open-question">
          <strong>${esc(title)}</strong>
          <ul class="positions">
            ${
              visible
                .map(
                  x => `
                    <li>
                      ${esc(x[textField])}
                      ${
                        (x.evidence_ids || [])
                          .length
                          ? `
                            <div class="meta">
                              preuves : ${esc(x.evidence_ids.join(', '))}
                            </div>
                          `
                          : ''
                      }
                    </li>
                  `
                )
                .join('')
            }
          </ul>
        </div>
      `;
    };

    const tensionSection =
      (synthesis.non_disagreement_tensions || [])
        .length
        ? `
          <div class="open-question">
            <strong>
              Tensions analytiques — pas des désaccords du corpus
            </strong>
            ${
              synthesis.non_disagreement_tensions
                .map(
                  tension => `
                    <h4>${esc(tension.title || '')}</h4>
                    <p>${esc(tension.summary || '')}</p>
                    <p class="hint">
                      ${esc(tension.reason_not_disagreement || '')}
                    </p>
                    <ul class="positions">
                      ${
                        (tension.positions || [])
                          .map(
                            position => `
                              <li>
                                ${esc(position.statement || '')}
                                <div class="meta">
                                  ${esc(groundingLabel(position.grounding))}
                                  ${
                                    (position.evidence_ids || []).length
                                      ? ` · preuves : ${esc(position.evidence_ids.join(', '))}`
                                      : ''
                                  }
                                </div>
                              </li>
                            `
                          )
                          .join('')
                      }
                    </ul>
                  `
                )
                .join('')
            }
          </div>
        `
        : '';


    $('#latest-synthesis')
      .innerHTML = `
        <div class="item">

          <h3>
            ${
              esc(
                synthesis.headline ||
                'Synthèse inter-contributions'
              )
            }
          </h3>

          ${
            synthesisSection(
              'Thèmes présents dans plusieurs contributions',
              synthesis.emergent_topics,
              'synthesis',
              'Aucun thème multi-contributions suffisamment étayé.'
            )
          }

          ${
            synthesisSection(
              'Observations issues d’une seule contribution',
              synthesis.single_contribution_observations,
              'summary'
            )
          }

          ${tensionSection}

          ${
            synthesisSection(
              'Signaux structurels à examiner — non décisionnels',
              synthesis.structural_signals,
              'summary'
            )
          }

          <div class="meta">
            ${
              [
                fmtDate(
                  d.latest_synthesis
                    .created_at
                ),

                provenanceMeta(
                  d.latest_synthesis
                )
              ]
                .filter(Boolean)
                .join(' · ')
            }
          </div>

          <div class="open-question">

            <strong>
              Limite méthodologique
            </strong>

            <p>
              Cette synthèse relie plusieurs contributions anonymes.
              Le système ne sait pas actuellement combien de personnes
              distinctes en sont à l’origine.
              Plusieurs contributions ne constituent donc pas une preuve
              de pluralité des contributeurs.
            </p>

          </div>

        </div>
      `;

  } else {
    $('#latest-synthesis')
      .innerHTML = `
        <p class="hint">
          Une synthèse inter-contributions apparaîtra lorsque suffisamment
          de contributions auront été analysées ensemble.
          Le nombre de contributions ne permet pas de connaître
          le nombre de personnes distinctes représentées.
        </p>
      `;
  }


  /* ----------------------------------------------------------
     CONTRIBUTIONS PUBLIQUES
     ---------------------------------------------------------- */

  const contributions =
    await api(
      '/api/public/contributions'
    );


  $('#contributions').innerHTML =
    contributions.length
      ? contributions
          .map(
            x =>
              itemHtml(
                {
                  id:
                    x.public_id,

                  title:
                    x.title,

                  summary:
                    x.summary,

                  meta:
                    fmtDate(
                      x.created_at
                    )
                },
                true
              )
          )
          .join('')

      : `
        <p class="hint">
          Le corpus public est encore vide.
        </p>
      `;


  bindDetails();
}


/* ============================================================
   DÉSACCORDS
   ============================================================ */

async function loadDisagreements() {
  const rows =
    await api(
      '/api/public/disagreements'
    );


  $('#disagreement-list')
    .innerHTML =
      rows.length
        ? rows
            .map(
              x => `
                <section class="card">

                  ${
                    itemHtml({
                      id:
                        x.public_id,

                      title:
                        x.title,

                      summary:
                        x.summary,

                      meta:
                        [
                          `mis à jour ${
                            fmtDate(
                              x.updated_at
                            )
                          }`,

                          provenanceMeta(x)
                        ]
                          .filter(Boolean)
                          .join(' · '),

                      positions:
                        x.position_provenance
                          ?.length
                          ? x.position_provenance
                          : x.positions || []
                    })
                  }

                </section>
              `
            )
            .join('')

        : `
          <div class="card">

            <p class="hint">
              Aucun désaccord entre contributions suffisamment structuré pour le moment.
            </p>

          </div>
        `;
}


/* ============================================================
   ÉVOLUTION
   ============================================================ */

async function loadEvolution() {
  const [
    proposals,
    risks,
    questions
  ] =
    await Promise.all([
      api(
        '/api/public/proposals'
      ),

      api(
        '/api/public/risks'
      ),

      api(
        '/api/public/questions'
      )
    ]);


  /* ----------------------------------------------------------
     PROPOSITIONS
     ---------------------------------------------------------- */

  $('#proposal-list')
    .innerHTML =
      proposals.length
        ? proposals
            .map(
              p => `
                <section class="card">

                  ${
                    itemHtml({
                      id:
                        p.public_id,

                      title:
                        p.title,

                      summary:
                        p.summary,

                      meta:
                        [
                          esc(
                            p.proposal_type ||
                            ''
                          ),

                          fmtDate(
                            p.updated_at
                          ),

                          provenanceMeta(p)
                        ]
                          .filter(Boolean)
                          .join(' · ')
                    })
                  }

                  ${
                    p.counterargument
                      ? `
                        <div class="open-question">

                          <strong>
                            Objection ou réserve connue
                          </strong>

                          <p>
                            ${
                              esc(
                                p.counterargument
                              )
                            }
                          </p>

                        </div>
                      `
                      : ''
                  }

                </section>
              `
            )
            .join('')

        : `
          <div class="card">

            <p class="hint">
              Aucune proposition issue du corpus suffisamment étayée pour le moment.
            </p>

          </div>
        `;


  /* ----------------------------------------------------------
     RISQUES
     ---------------------------------------------------------- */

  $('#risk-list')
    .innerHTML =
      risks.length
        ? risks
            .map(
              r =>
                itemHtml({
                  id:
                    r.public_id,

                  title:
                    r.title,

                  summary:
                    r.summary,

                  meta:
                    [
                      fmtDate(
                        r.updated_at
                      ),

                      provenanceMeta(r)
                    ]
                      .filter(Boolean)
                      .join(' · ')
                })
            )
            .join('')

        : `
          <p class="hint">
            Aucun risque structuré issu du corpus pour le moment.
          </p>
        `;


  /* ----------------------------------------------------------
     QUESTIONS
     ---------------------------------------------------------- */

  $('#question-list')
    .innerHTML =
      questions.length
        ? questions
            .map(
              q =>
                itemHtml({
                  id:
                    q.public_id,

                  title:
                    q.question,

                  summary: '',

                  meta:
                    [
                      fmtDate(
                        q.updated_at
                      ),

                      provenanceMeta(q)
                    ]
                      .filter(Boolean)
                      .join(' · ')
                })
            )
            .join('')

        : `
          <p class="hint">
            Aucune question structurée issue du corpus pour le moment.
          </p>
        `;
}


/* ============================================================
   JOURNAL
   ============================================================ */

async function loadJournal() {
  const [
    events,
    federation
  ] =
    await Promise.all([
      api(
        '/api/public/events'
      ),

      api(
        '/api/public/federation'
      )
    ]);


  $('#event-list')
    .innerHTML =
      events.length
        ? events
            .map(
              e => `
                <div class="event">

                  <div class="meta">

                    <span class="public-id">
                      ${esc(e.public_id)}
                    </span>

                    ${fmtDate(e.created_at)}

                    ·

                    ${
                      esc(
                        eventLabel(
                          e.event_type
                        )
                      )
                    }

                  </div>

                  <p>
                    ${esc(e.public_summary)}
                  </p>

                </div>
              `
            )
            .join('')

        : `
          <p class="hint">
            Le journal commencera à se remplir avec
            les transformations significatives du système.
          </p>
        `;


  $('#federation-list')
    .innerHTML =
      federation.length
        ? federation
            .map(
              x =>
                itemHtml({
                  id:
                    x.instance_id,

                  title:
                    x.base_url,

                  summary:
                    `Statut : ${
                      x.trust_status ===
                      'unverified'
                        ? 'non vérifiée'
                        : x.trust_status
                    }`,

                  meta:
                    fmtDate(
                      x.last_seen_at
                    )
                })
            )
            .join('')

        : `
          <p class="hint">
            Aucune autre instance du projet observée pour l’instant.
          </p>
        `;
}


/* ============================================================
   CHARGEMENT DES VUES PUBLIQUES
   ============================================================ */

async function loadPublic(name) {
  try {
    if (
      name === 'understand'
    ) {
      await loadOverview();
    }

    if (
      name === 'disagreements'
    ) {
      await loadDisagreements();
    }

    if (
      name === 'evolution'
    ) {
      await loadEvolution();
    }

    if (
      name === 'journal'
    ) {
      await loadJournal();
    }

  } catch (e) {
    console.error(e);
  }
}


/* ============================================================
   DÉTAIL D'UNE CONTRIBUTION
   ============================================================ */

function bindDetails() {
  $$('.detail')
    .forEach(
      button => {
        button.onclick =
          () =>
            openDetail(
              button.dataset.id
            );
      }
    );
}


async function openDetail(id) {
  try {
    const d =
      await api(
        `/api/public/contributions/${encodeURIComponent(id)}`
      );

    const contribution =
      d.contribution;

    const analyses =
      d.analyses || [];


    $('#detail-content')
      .innerHTML = `

        <div class="eyebrow">
          CONTRIBUTION VALIDÉE
        </div>

        <h2>
          ${esc(contribution.title)}
        </h2>

        <div class="meta">

          <span class="public-id">
            ${esc(contribution.public_id)}
          </span>

          ${fmtDate(contribution.created_at)}

        </div>

        <p>
          ${esc(contribution.summary)}
        </p>

        ${
          analyses
            .map(
              a => {
                const x =
                  a.content || {};

                return `

                  <div class="analysis-box">

                    <div class="eyebrow">
                      INTERPRÉTATION IA · CONTESTABLE
                    </div>

                    <div class="meta">

                      <span class="public-id">
                        ${esc(a.public_id)}
                      </span>

                      ${esc(a.model)}

                      · protocole

                      ${esc(a.protocol_version)}

                    </div>

                    <p>

                      <strong>
                        Ce que l’IA pense avoir compris :
                      </strong>

                      ${
                        esc(
                          x.understanding ||
                          ''
                        )
                      }

                    </p>

                    ${
                      x.best_counterargument
                        ? `
                          <p>

                            <strong>
                              Meilleur contre-argument identifié :
                            </strong>

                            ${
                              esc(
                                x.best_counterargument
                              )
                            }

                          </p>
                        `
                        : ''
                    }

                    ${
                      (
                        x.tensions ||
                        []
                      ).length
                        ? `
                          <p>

                            <strong>
                              Tensions possibles :
                            </strong>

                            ${
                              esc(
                                (
                                  x.tensions ||
                                  []
                                ).join(
                                  ' · '
                                )
                              )
                            }

                          </p>
                        `
                        : ''
                    }

                    <p class="hint">
                      Cette analyse est une interprétation de l’IA.
                      Elle n’est ni la parole originale du contributeur,
                      ni une vérité institutionnelle.
                    </p>

                  </div>
                `;
              }
            )
            .join('')
        }

        <button
          class="btn secondary contest"
          data-id="${esc(contribution.public_id)}"
        >
          Contester ou compléter cette analyse
        </button>
      `;


    $('#detail-dialog')
      .showModal();


    $('.contest').onclick =
      () => {
        const contributionId =
          $('.contest')
            .dataset.id;

        $('#detail-dialog')
          .close();

        nav('home');

        $('#message').value =
          `Je souhaite contester ou compléter l’analyse de ${contributionId}. `;

        $('#message').focus();
      };

  } catch (e) {
    setNotice(
      esc(e.message),
      true
    );
  }
}


/* ============================================================
   ÉVÉNEMENTS DE NAVIGATION
   ============================================================ */

$$('.nav')
  .forEach(
    n => {
      n.onclick =
        () =>
          nav(
            n.dataset.nav
          );
    }
  );


$$('.refresh')
  .forEach(
    button => {
      button.onclick =
        () => {
          const activeView =
            $('.view.active')
              .id
              .replace(
                'view-',
                ''
              );

          loadPublic(
            activeView
          );
        };
    }
  );


/* ============================================================
   ÉVÉNEMENTS DE CONVERSATION
   ============================================================ */

$('#send').onclick =
  sendMessage;


$('#message')
  .addEventListener(
    'keydown',
    e => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey
      ) {
        e.preventDefault();

        sendMessage();
      }
    }
  );


$('#summarize').onclick =
  summarize;


$('#reset').onclick =
  () => {
    if (
      confirm(
        'Effacer cette conversation locale et recommencer ?'
      )
    ) {
      resetConversation();
    }
  };


$('#publish').onclick =
  publishContribution;


$('#continue').onclick =
  () => {
    $('#summary-panel')
      .classList.add(
        'hidden'
      );

    $('#message').focus();
  };


$('#discard').onclick =
  () => {
    $('#summary-panel')
      .classList.add(
        'hidden'
      );

    setNotice(
      'Rien n’a été partagé. Vous pouvez continuer à discuter ou fermer la page.'
    );
  };


$('#close-dialog').onclick =
  () =>
    $('#detail-dialog')
      .close();


/* ============================================================
   DICTÉE VOCALE
   ============================================================ */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


if (SpeechRecognition) {
  const mic = $('#mic');

  mic.classList.remove(
    'hidden'
  );

  const recognition =
    new SpeechRecognition();

  recognition.lang =
    'fr-FR';

  recognition.interimResults =
    false;

  recognition.continuous =
    false;


  recognition.onresult =
    e => {
      const text =
        e.results?.[0]?.[0]
          ?.transcript ||
        '';

      $('#message').value =
        `${
          $('#message').value
        } ${text}`.trim();

      $('#message').focus();
    };


  recognition.onerror =
    () =>
      setNotice(
        'La dictée vocale n’est pas disponible pour le moment.',
        true
      );


  mic.onclick =
    () =>
      recognition.start();
}


/* ============================================================
   INITIALISATION
   ============================================================ */

resetConversation();


const initial =
  (
    location.hash ||
    '#home'
  ).slice(1);


nav(
  [
    'home',
    'understand',
    'disagreements',
    'evolution',
    'journal'
  ].includes(initial)
    ? initial
    : 'home'
);
