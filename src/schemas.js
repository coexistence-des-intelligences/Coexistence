export const summarySchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    nature: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'experience',
          'intuition',
          'hypothesis',
          'opinion',
          'value',
          'objection',
          'proposal'
        ]
      }
    },
    open_question: { type: 'string' }
  },
  required: ['title', 'summary', 'nature', 'open_question'],
  additionalProperties: false
};

export const analysisSchema = {
  type: 'object',
  properties: {
    understanding: { type: 'string' },
    factual_claims: { type: 'array', items: { type: 'string' } },
    hypotheses: { type: 'array', items: { type: 'string' } },
    values: { type: 'array', items: { type: 'string' } },
    opinions: { type: 'array', items: { type: 'string' } },
    novel_ideas: { type: 'array', items: { type: 'string' } },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['key', 'label', 'confidence'],
        additionalProperties: false
      }
    },
    tensions: { type: 'array', items: { type: 'string' } },
    best_counterargument: { type: 'string' },
    related_contributions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          public_id: { type: 'string' },
          relation: {
            type: 'string',
            enum: ['supports', 'contradicts', 'extends', 'similar', 'different_frame']
          },
          explanation: { type: 'string' }
        },
        required: ['public_id', 'relation', 'explanation'],
        additionalProperties: false
      }
    },
    disagreement_candidate: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        positions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              statement: { type: 'string' },
              grounding: {
                type: 'string',
                enum: ['explicit', 'inferred', 'ai_counterargument']
              },
              source_contribution_ids: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['statement', 'grounding', 'source_contribution_ids'],
            additionalProperties: false
          }
        },
        eligible_for_corpus: { type: 'boolean' },
        rejection_reason: { type: 'string' }
      },
      required: [
        'key',
        'title',
        'summary',
        'positions',
        'eligible_for_corpus',
        'rejection_reason'
      ],
      additionalProperties: false
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          grounding: { type: 'string', enum: ['explicit', 'inferred'] },
          source_contribution_ids: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['key', 'title', 'summary', 'grounding', 'source_contribution_ids'],
        additionalProperties: false
      }
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          question: { type: 'string' },
          grounding: { type: 'string', enum: ['explicit', 'inferred'] },
          source_contribution_ids: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['key', 'question', 'grounding', 'source_contribution_ids'],
        additionalProperties: false
      }
    },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          type: {
            type: 'string',
            enum: ['methodology', 'charter', 'technical', 'governance', 'other']
          },
          title: { type: 'string' },
          summary: { type: 'string' },
          grounding: { type: 'string', enum: ['explicit', 'inferred'] },
          source_contribution_ids: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: [
          'key',
          'type',
          'title',
          'summary',
          'grounding',
          'source_contribution_ids'
        ],
        additionalProperties: false
      }
    },
    publication_risk: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['none', 'review'] },
        reasons: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'privacy',
              'targeted_threat',
              'targeted_harassment',
              'manifest_illegal_content',
              'probable_automated_spam',
              'uncertain'
            ]
          }
        }
      },
      required: ['level', 'reasons'],
      additionalProperties: false
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: [
    'understanding',
    'factual_claims',
    'hypotheses',
    'values',
    'opinions',
    'novel_ideas',
    'themes',
    'tensions',
    'best_counterargument',
    'related_contributions',
    'disagreement_candidate',
    'risks',
    'questions',
    'proposals',
    'publication_risk',
    'confidence'
  ],
  additionalProperties: false
};

export const collectiveSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },

    emergent_topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          synthesis: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } }
        },
        required: ['key', 'label', 'synthesis', 'evidence_ids'],
        additionalProperties: false
      }
    },

    single_contribution_observations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          summary: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } }
        },
        required: ['key', 'label', 'summary', 'evidence_ids'],
        additionalProperties: false
      }
    },

    disagreements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          positions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                statement: { type: 'string' },
                grounding: {
                  type: 'string',
                  enum: ['explicit', 'inferred', 'ai_counterargument']
                },
                evidence_ids: { type: 'array', items: { type: 'string' } }
              },
              required: ['statement', 'grounding', 'evidence_ids'],
              additionalProperties: false
            }
          },
          evidence_ids: { type: 'array', items: { type: 'string' } }
        },
        required: ['key', 'title', 'summary', 'positions', 'evidence_ids'],
        additionalProperties: false
      }
    },

    non_disagreement_tensions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
          reason_not_disagreement: { type: 'string' }
        },
        required: [
          'key',
          'title',
          'summary',
          'evidence_ids',
          'reason_not_disagreement'
        ],
        additionalProperties: false
      }
    },

    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
          grounding: {
            type: 'string',
            enum: ['explicit_in_corpus', 'inferred_by_ai', 'mixed']
          }
        },
        required: ['key', 'title', 'summary', 'evidence_ids', 'grounding'],
        additionalProperties: false
      }
    },

    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          question: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
          grounding: {
            type: 'string',
            enum: ['explicit_in_corpus', 'inferred_by_ai', 'mixed']
          }
        },
        required: ['key', 'question', 'evidence_ids', 'grounding'],
        additionalProperties: false
      }
    },

    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          type: {
            type: 'string',
            enum: ['methodology', 'charter', 'technical', 'governance', 'other']
          },
          title: { type: 'string' },
          summary: { type: 'string' },
          counterargument: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
          grounding: {
            type: 'string',
            enum: ['explicit_in_corpus', 'inferred_by_ai', 'mixed']
          }
        },
        required: [
          'key',
          'type',
          'title',
          'summary',
          'counterargument',
          'evidence_ids',
          'grounding'
        ],
        additionalProperties: false
      }
    },

    structural_signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          signal_type: {
            type: 'string',
            enum: ['methodology', 'governance', 'technical', 'charter', 'safety', 'other']
          },
          title: { type: 'string' },
          summary: { type: 'string' },
          why_structural: { type: 'string' },
          strongest_counterargument: { type: 'string' },
          unresolved_uncertainties: { type: 'array', items: { type: 'string' } },
          evidence_ids: { type: 'array', items: { type: 'string' } }
        },
        required: [
          'key',
          'signal_type',
          'title',
          'summary',
          'why_structural',
          'strongest_counterargument',
          'unresolved_uncertainties',
          'evidence_ids'
        ],
        additionalProperties: false
      }
    }
  },
  required: [
    'headline',
    'emergent_topics',
    'single_contribution_observations',
    'disagreements',
    'non_disagreement_tensions',
    'risks',
    'questions',
    'proposals',
    'structural_signals'
  ],
  additionalProperties: false
};
