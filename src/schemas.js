export const summarySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    nature: {
      type: "array",
      items: { type: "string", enum: ["experience", "intuition", "hypothesis", "opinion", "value", "objection", "proposal"] }
    },
    open_question: { type: "string" }
  },
  required: ["title", "summary", "nature", "open_question"],
  additionalProperties: false
};

export const analysisSchema = {
  type: "object",
  properties: {
    understanding: { type: "string" },
    factual_claims: { type: "array", items: { type: "string" } },
    hypotheses: { type: "array", items: { type: "string" } },
    values: { type: "array", items: { type: "string" } },
    opinions: { type: "array", items: { type: "string" } },
    novel_ideas: { type: "array", items: { type: "string" } },
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["key", "label", "confidence"],
        additionalProperties: false
      }
    },
    tensions: { type: "array", items: { type: "string" } },
    best_counterargument: { type: "string" },
    related_contributions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          public_id: { type: "string" },
          relation: { type: "string", enum: ["supports", "contradicts", "extends", "similar", "different_frame"] },
          explanation: { type: "string" }
        },
        required: ["public_id", "relation", "explanation"],
        additionalProperties: false
      }
    },
    disagreement_candidate: {
      type: "object",
      properties: {
        key: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        positions: { type: "array", items: { type: "string" } }
      },
      required: ["key", "title", "summary", "positions"],
      additionalProperties: false
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: { key: { type: "string" }, title: { type: "string" }, summary: { type: "string" } },
        required: ["key", "title", "summary"], additionalProperties: false
      }
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { key: { type: "string" }, question: { type: "string" } },
        required: ["key", "question"], additionalProperties: false
      }
    },
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          type: { type: "string", enum: ["methodology", "charter", "technical", "governance", "other"] },
          title: { type: "string" },
          summary: { type: "string" }
        },
        required: ["key", "type", "title", "summary"], additionalProperties: false
      }
    },
    publication_risk: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["none", "review"] },
        reasons: { type: "array", items: { type: "string", enum: ["privacy", "targeted_threat", "targeted_harassment", "manifest_illegal_content", "probable_automated_spam", "uncertain"] } }
      },
      required: ["level", "reasons"], additionalProperties: false
    },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  },
  required: ["understanding", "factual_claims", "hypotheses", "values", "opinions", "novel_ideas", "themes", "tensions", "best_counterargument", "related_contributions", "disagreement_candidate", "risks", "questions", "proposals", "publication_risk", "confidence"],
  additionalProperties: false
};

export const collectiveSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    emergent_topics: {
      type: "array", items: {
        type: "object",
        properties: { key: { type: "string" }, label: { type: "string" }, synthesis: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } } },
        required: ["key", "label", "synthesis", "evidence_ids"], additionalProperties: false
      }
    },
    disagreements: {
      type: "array", items: {
        type: "object",
        properties: { key: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, positions: { type: "array", items: { type: "string" } }, evidence_ids: { type: "array", items: { type: "string" } } },
        required: ["key", "title", "summary", "positions", "evidence_ids"], additionalProperties: false
      }
    },
    risks: {
      type: "array", items: {
        type: "object",
        properties: { key: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } } },
        required: ["key", "title", "summary", "evidence_ids"], additionalProperties: false
      }
    },
    questions: {
      type: "array", items: {
        type: "object",
        properties: { key: { type: "string" }, question: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } } },
        required: ["key", "question", "evidence_ids"], additionalProperties: false
      }
    },
    proposals: {
      type: "array", items: {
        type: "object",
        properties: { key: { type: "string" }, type: { type: "string", enum: ["methodology", "charter", "technical", "governance", "other"] }, title: { type: "string" }, summary: { type: "string" }, counterargument: { type: "string" }, evidence_ids: { type: "array", items: { type: "string" } } },
        required: ["key", "type", "title", "summary", "counterargument", "evidence_ids"], additionalProperties: false
      }
    },
    version_candidate: {
      type: "object",
      properties: {
        justified: { type: "boolean" },
        label: { type: "string" },
        reason: { type: "string" },
        proposed_changes: { type: "array", items: { type: "string" } },
        unresolved_objections: { type: "array", items: { type: "string" } },
        evidence_ids: { type: "array", items: { type: "string" } }
      },
      required: ["justified", "label", "reason", "proposed_changes", "unresolved_objections", "evidence_ids"], additionalProperties: false
    }
  },
  required: ["headline", "emergent_topics", "disagreements", "risks", "questions", "proposals", "version_candidate"],
  additionalProperties: false
};
