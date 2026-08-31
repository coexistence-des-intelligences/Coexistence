import { summarySchema, analysisSchema, collectiveSchema } from './schemas.js';

function extractText(data) {
  if (
    typeof data?.output_text === 'string' &&
    data.output_text.length > 0
  ) {
    return data.output_text;
  }

  const chunks = [];

  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;

    for (const content of item.content || []) {
      if (
        content?.type === 'output_text' &&
        typeof content.text === 'string'
      ) {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join('');

  if (text.length > 0) {
    return text;
  }

  throw new Error(
    'Aucun texte exploitable dans la réponse OpenAI.'
  );
}

async function requestOpenAI(env, body) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...body, store: false })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 800)}`);
  }
  return res.json();
}

export async function openAIText(env, { instructions, messages, model }) {
  const input = (messages || []).slice(-24).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 12000)
  }));
  const data = await requestOpenAI(env, {
    model: model || env.OPENAI_CHAT_MODEL || 'gpt-5-mini',
    instructions,
    input,
    max_output_tokens: 700
  });
  return extractText(data);
}

async function openAIJson(env, { instructions, input, schema, name, model, maxOutputTokens = 1800 }) {
  const data = await requestOpenAI(env, {
    model: model || env.OPENAI_ANALYSIS_MODEL || 'gpt-5-mini',
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: 'json_schema',
        name,
        strict: true,
        schema
      }
    }
  });
 if (data?.status === 'incomplete') {
  throw new Error(
    `Réponse OpenAI incomplète : ${data?.incomplete_details?.reason || 'raison inconnue'}`
  );
}

if (data?.status && data.status !== 'completed') {
  throw new Error(
    `Réponse OpenAI non terminée : statut ${data.status}`
  );
}

const text = extractText(data);

try {
  return JSON.parse(text);
} catch (err) {
  throw new Error(
    `JSON OpenAI invalide : ${err.message}. Longueur reçue : ${text.length} caractères.`
  );
}
}

export function summarizeConversation(env, instructions, messages) {
  return openAIJson(env, {
    instructions,
    input: (messages || []).slice(-30).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 12000) })),
    schema: summarySchema,
    name: 'contribution_summary',
    maxOutputTokens: 3000
  });
}

export function analyzeContributionAI(env, instructions, payload) {
  return openAIJson(env, {
    instructions,
    input: JSON.stringify(payload),
    schema: analysisSchema,
    name: 'contribution_analysis',
    maxOutputTokens: 6000
  });
}

export function analyzeCollectiveAI(env, instructions, payload) {
  return openAIJson(env, {
    instructions,
    input: JSON.stringify(payload),
    schema: collectiveSchema,
    name: 'collective_synthesis',
    maxOutputTokens: 7000
  });
}

export async function createEmbedding(env, text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: String(text || '').slice(0, 12000),
      encoding_format: 'float'
    })
  });
  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`Embeddings ${res.status}: ${textBody.slice(0, 600)}`);
  }
  const data = await res.json();
  return data.data?.[0]?.embedding || null;
}
