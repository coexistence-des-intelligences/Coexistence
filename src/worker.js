import { CHAT_PROMPT, SUMMARY_PROMPT } from './prompts.js';
import { openAIText, summarizeConversation } from './openai.js';
import { countRows, insert, sb } from './supabase.js';
import { enforceRateLimit, publicSecurityHeaders } from './security.js';
import { processContribution, retryPending, runCollectiveSynthesis, syncFederationPeers } from './collective.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: publicSecurityHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  });
}

async function bodyJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw Object.assign(new Error('JSON requis'), { status: 415 });
  return request.json();
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-30).map(m => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').slice(0, 12000)
  })).filter(m => m.content.trim());
}

function pid(prefix) {
  return `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

async function handleChat(request, env) {
  await enforceRateLimit(request, env, 'chat', 30, 600);
  const { messages } = await bodyJson(request);
  const cleaned = cleanMessages(messages);
  if (!cleaned.length) return json({ error: 'Conversation vide.' }, 400);
  const reply = await openAIText(env, { instructions: CHAT_PROMPT, messages: cleaned });
  return json({ reply });
}

async function handleSummary(request, env) {
  await enforceRateLimit(request, env, 'summary', 12, 900);
  const { messages } = await bodyJson(request);
  const cleaned = cleanMessages(messages);
  if (!cleaned.some(m => m.role === 'user')) return json({ error: 'Aucun message du contributeur.' }, 400);
  return json(await summarizeConversation(env, SUMMARY_PROMPT, cleaned));
}

async function handleContribution(request, env, ctx) {
  await enforceRateLimit(request, env, 'contribution', 8, 3600);
  const p = await bodyJson(request);
  if (p?.confirmed !== true) return json({ error: 'Validation explicite requise.' }, 400);
  const title = String(p.title || '').trim().slice(0, 180);
  const summary = String(p.summary || '').trim().slice(0, 12000);
  if (!title || !summary) return json({ error: 'Titre et synthèse requis.' }, 400);
  const publicId = pid('C');
  const row = (await insert(env, 'contributions', {
    public_id: publicId,
    instance_id: env.INSTANCE_ID || 'local',
    title,
    summary,
    nature: Array.isArray(p.nature) ? p.nature.slice(0, 12) : [],
    open_question: String(p.openQuestion || '').slice(0, 2000),
    conversation: p.includeConversation ? cleanMessages(p.messages || []) : null,
    status: 'pending_analysis',
    consent_version: '0.1'
  }))?.[0];
  if (!row) return json({ error: 'Enregistrement impossible.' }, 500);
  ctx.waitUntil(processContribution(env, row).catch(() => {}));
  return json({ ok: true, public_id: publicId, status: 'pending_analysis' }, 202);
}

async function overview(env) {
  const [contributions, themes, disagreements, risks, questions, proposals] = await Promise.all([
    countRows(env, 'contributions', 'status=eq.published'),
    countRows(env, 'themes'),
    countRows(env, 'disagreements', 'status=eq.open'),
    countRows(env, 'risks', 'status=eq.open'),
    countRows(env, 'questions', 'status=eq.open'),
    countRows(env, 'proposals', 'status=eq.open')
  ]);
  const [recentThemes, recentEvents, synthesis] = await Promise.all([
    sb(env, 'themes?select=canonical_key,label,description,updated_at&order=updated_at.desc&limit=8'),
    sb(env, 'events?visibility=eq.public&select=public_id,event_type,public_summary,created_at&order=created_at.desc&limit=8'),
    sb(env, 'collective_syntheses?select=public_id,content,created_at&order=created_at.desc&limit=1')
  ]);
  return { counts: { contributions, themes, disagreements, risks, questions, proposals }, recent_themes: recentThemes || [], recent_events: recentEvents || [], latest_synthesis: synthesis?.[0] || null };
}

async function publicList(env, table, select, query = '') {
  return sb(env, `${table}?select=${select}${query ? `&${query}` : ''}`);
}

async function contributionDetail(env, id) {
  const rows = await sb(env, `contributions?public_id=eq.${encodeURIComponent(id)}&status=eq.published&select=id,public_id,title,summary,nature,open_question,created_at&limit=1`);
  const c = rows?.[0];
  if (!c) return null;
  const analyses = await sb(env, `analyses?contribution_id=eq.${c.id}&status=eq.active&select=public_id,model,protocol_version,content,created_at&order=created_at.desc&limit=5`);
  delete c.id;
  return { contribution: c, analyses: analyses || [] };
}

async function federationMeta(request, env) {
  const base = env.PUBLIC_BASE_URL || new URL(request.url).origin;
  return {
    protocol: 'coexistence-federation',
    protocol_version: '0.1-draft',
    instance_id: env.INSTANCE_ID || 'local',
    instance_name: env.INSTANCE_NAME || 'Coexistence des intelligences',
    base_url: base,
    public_events: `${base}/api/federation/events`,
    note: 'Les événements distants sont considérés comme non vérifiés tant qu’un mécanisme de signature inter-instance n’est pas activé.'
  };
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname;

  if (request.method === 'POST' && p === '/api/chat') return handleChat(request, env);
  if (request.method === 'POST' && p === '/api/summarize') return handleSummary(request, env);
  if (request.method === 'POST' && p === '/api/contributions') return handleContribution(request, env, ctx);

  if (request.method === 'GET' && p === '/api/public/overview') return json(await overview(env));
  if (request.method === 'GET' && p === '/api/public/contributions') return json(await publicList(env, 'contributions', 'public_id,title,summary,nature,open_question,created_at', 'status=eq.published&order=created_at.desc&limit=30'));
  if (request.method === 'GET' && p.startsWith('/api/public/contributions/')) {
    const id = decodeURIComponent(p.split('/').pop());
    const detail = await contributionDetail(env, id);
    return detail ? json(detail) : json({ error: 'Introuvable ou non public.' }, 404);
  }
  if (request.method === 'GET' && p === '/api/public/disagreements') return json(await publicList(env, 'disagreements', 'public_id,title,summary,positions,evidence_ids,status,updated_at', 'status=eq.open&order=updated_at.desc&limit=50'));
  if (request.method === 'GET' && p === '/api/public/risks') return json(await publicList(env, 'risks', 'public_id,title,summary,evidence_ids,status,updated_at', 'status=eq.open&order=updated_at.desc&limit=50'));
  if (request.method === 'GET' && p === '/api/public/questions') return json(await publicList(env, 'questions', 'public_id,question,evidence_ids,status,updated_at', 'status=eq.open&order=updated_at.desc&limit=50'));
  if (request.method === 'GET' && p === '/api/public/proposals') return json(await publicList(env, 'proposals', 'public_id,proposal_type,title,summary,counterargument,evidence_ids,payload,status,source,updated_at', 'status=eq.open&order=updated_at.desc&limit=50'));
  if (request.method === 'GET' && p === '/api/public/events') return json(await publicList(env, 'events', 'public_id,event_type,public_summary,details,created_at', 'visibility=eq.public&order=created_at.desc&limit=100'));
  if (request.method === 'GET' && p === '/api/public/federation') return json(await publicList(env, 'federated_instances', 'instance_id,base_url,protocol_version,trust_status,last_seen_at', 'order=last_seen_at.desc&limit=50'));

  if (request.method === 'GET' && p === '/.well-known/coexistence.json') return json(await federationMeta(request, env));
  if (request.method === 'GET' && p === '/api/federation/events') {
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
    const events = await publicList(env, 'events', 'public_id,event_type,public_summary,details,created_at', `visibility=eq.public&order=created_at.desc&limit=${limit}`);
    return json({ instance: await federationMeta(request, env), events: events || [] });
  }

  if (p.startsWith('/api/') || p.startsWith('/.well-known/')) return json({ error: 'Route inconnue.' }, 404);

  const asset = await env.ASSETS.fetch(request);
  const h = new Headers(asset.headers);
  for (const [k, v] of Object.entries(publicSecurityHeaders())) h.set(k, v);
  return new Response(asset.body, { status: asset.status, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    try { return await route(request, env, ctx); }
    catch (err) {
      const status = Number(err.status || 500);
      return json({ error: status === 500 ? 'Erreur interne.' : String(err.message || err) }, status);
    }
  },
  async scheduled(controller, env, ctx) {
    if (controller.cron === '*/15 * * * *') {
      ctx.waitUntil(Promise.allSettled([retryPending(env), syncFederationPeers(env)]));
      return;
    }
    if (controller.cron === '17 */6 * * *') {
      ctx.waitUntil(runCollectiveSynthesis(env));
    }
  }
};
