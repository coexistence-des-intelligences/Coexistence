const base = process.env.BASE_URL;
if (!base) {
  console.error('Usage: BASE_URL=https://... npm run smoke');
  process.exit(2);
}
async function check(path) {
  const r = await fetch(base.replace(/\/$/,'') + path);
  const text = await r.text();
  console.log(r.status, path, text.slice(0,180).replace(/\n/g,' '));
  if (!r.ok) process.exitCode = 1;
}
await check('/.well-known/coexistence.json');
await check('/api/public/overview');
await check('/api/public/events');
