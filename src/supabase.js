function baseHeaders(env, prefer) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const h = {
    'apikey': key,
    'Content-Type': 'application/json'
  };
  // Les nouvelles clés sb_secret_ Supabase ne sont pas des JWT.
  // Le header Authorization n'est ajouté que pour l'ancien service_role JWT.
  if (key && !String(key).startsWith('sb_secret_')) h['Authorization'] = `Bearer ${key}`;
  if (prefer) h['Prefer'] = prefer;
  return h;
}

export async function sb(env, path, { method = 'GET', body, prefer, headers = {} } = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...baseHeaders(env, prefer), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status} ${path}: ${text.slice(0, 900)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function insert(env, table, body, returning = true) {
  return sb(env, table, { method: 'POST', body, prefer: returning ? 'return=representation' : 'return=minimal' });
}

export function update(env, table, query, body, returning = false) {
  return sb(env, `${table}?${query}`, { method: 'PATCH', body, prefer: returning ? 'return=representation' : 'return=minimal' });
}

export function upsert(env, table, onConflict, body) {
  return sb(env, `${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    body,
    prefer: 'resolution=merge-duplicates,return=representation'
  });
}

export function rpc(env, name, body) {
  return sb(env, `rpc/${name}`, { method: 'POST', body });
}

export async function countRows(env, table, query = '') {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?select=id${query ? `&${query}` : ''}`;
  const res = await fetch(url, {
    method: 'HEAD',
    headers: {
      ...baseHeaders(env),
      'Prefer': 'count=exact'
    }
  });
  if (!res.ok) throw new Error(`Count ${table}: ${res.status}`);
  const range = res.headers.get('content-range') || '*/0';
  return Number(range.split('/')[1] || 0);
}

export function vectorLiteral(v) {
  return `[${(v || []).map(x => Number(x).toFixed(8)).join(',')}]`;
}
