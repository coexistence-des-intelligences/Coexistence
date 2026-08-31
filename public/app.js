const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { messages: [], summary: null, busy: false };

const firstMessage = "Qu’aimeriez-vous nous dire ? Cela peut être une expérience, une inquiétude, une idée, un désaccord… ou simplement quelque chose qui, selon vous, pourrait être amélioré.";

function esc(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function fmtDate(v){ try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return '';} }

async function api(path, options={}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers||{}) } });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

function setNotice(html='', warn=false){ $('#notice').innerHTML = html ? `<div class="notice ${warn?'warn':''}">${html}</div>` : ''; }
function setBusy(v, label=''){ state.busy=v; $('#send').disabled=v; $('#summarize').disabled=v; if(label){state.messages.push({role:'assistant',content:`__thinking__${label}`}); renderChat();}else{state.messages=state.messages.filter(m=>!m.content.startsWith('__thinking__')); renderChat();} }
function renderChat(){
  const box=$('#chat'); box.innerHTML='';
  state.messages.forEach(m=>{const row=document.createElement('div');row.className=`msg ${m.role==='user'?'user':'assistant'}`;const b=document.createElement('div');b.className='bubble';if(m.content.startsWith('__thinking__'))b.innerHTML=`<span class="spinner"></span>${esc(m.content.replace('__thinking__',''))}`;else b.textContent=m.content;row.appendChild(b);box.appendChild(row);});
  box.scrollTop=box.scrollHeight;
}
function resetConversation(){state.messages=[{role:'assistant',content:firstMessage}];state.summary=null;$('#summary-panel').classList.add('hidden');setNotice('');renderChat();$('#message').value='';}

async function sendMessage(){
  if(state.busy)return; const text=$('#message').value.trim(); if(!text)return; $('#message').value=''; state.messages.push({role:'user',content:text}); renderChat(); setBusy(true,'Je vous écoute…');
  try{const clean=state.messages.filter(m=>!m.content.startsWith('__thinking__'));const data=await api('/api/chat',{method:'POST',body:JSON.stringify({messages:clean})});setBusy(false);state.messages.push({role:'assistant',content:data.reply});renderChat();}
  catch(e){setBusy(false);setNotice(`<strong>Un problème est survenu.</strong> ${esc(e.message)}`,true);}
}

async function summarize(){
  if(state.busy)return; if(!state.messages.some(m=>m.role==='user')){setNotice('Dites d’abord quelque chose, même une seule phrase.');return;}
  setBusy(true,'Je prépare une synthèse fidèle…');
  try{const data=await api('/api/summarize',{method:'POST',body:JSON.stringify({messages:state.messages.filter(m=>!m.content.startsWith('__thinking__'))})});setBusy(false);state.summary=data;$('#summary-title').value=data.title||'Contribution';$('#summary-text').value=data.summary||'';$('#nature-tags').innerHTML=(data.nature||[]).map(n=>`<span class="tag">${esc(n)}</span>`).join('');if(data.open_question){$('#open-question').textContent=data.open_question;$('#open-question-box').classList.remove('hidden');}else $('#open-question-box').classList.add('hidden');$('#confirm-share').checked=false;$('#include-conversation').checked=false;$('#summary-panel').classList.remove('hidden');$('#summary-panel').scrollIntoView({behavior:'smooth',block:'start'});}
  catch(e){setBusy(false);setNotice(`<strong>Synthèse impossible.</strong> ${esc(e.message)}`,true);}
}

async function publishContribution(){
  if(!$('#confirm-share').checked){setNotice('Cochez d’abord la case confirmant que vous souhaitez réellement partager cette synthèse.');return;}
  const btn=$('#publish');btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Enregistrement…';
  try{const data=await api('/api/contributions',{method:'POST',body:JSON.stringify({confirmed:true,title:$('#summary-title').value.trim(),summary:$('#summary-text').value.trim(),nature:state.summary?.nature||[],openQuestion:state.summary?.open_question||'',includeConversation:$('#include-conversation').checked,messages:state.messages.filter(m=>!m.content.startsWith('__thinking__'))})});$('#summary-panel').classList.add('hidden');setNotice(`<strong>Merci.</strong> Votre contribution <span class="public-id">${esc(data.public_id)}</span> est enregistrée. Elle est maintenant analysée avant publication afin de protéger la confidentialité et l’intégrité du corpus.`);}
  catch(e){setNotice(`<strong>Enregistrement impossible.</strong> ${esc(e.message)}`,true);}finally{btn.disabled=false;btn.textContent='Valider ma contribution';}
}

function nav(name){$$('.view').forEach(v=>v.classList.remove('active'));$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));$(`#view-${name}`).classList.add('active');history.replaceState(null,'',`#${name}`);if(name!=='home')loadPublic(name);window.scrollTo({top:0,behavior:'smooth'});}

function itemHtml({id,title,summary,meta='',positions=[]},detail=false){return `<div class="item"><div class="meta"><span class="public-id">${esc(id||'')}</span>${meta}</div><h3>${esc(title||'')}</h3>${summary?`<p>${esc(summary)}</p>`:''}${positions?.length?`<ul class="positions">${positions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${detail?`<button class="link-btn detail" data-id="${esc(id)}">Voir contribution et analyse →</button>`:''}</div>`;}

async function loadOverview(){
  const d=await api('/api/public/overview');const c=d.counts||{};$('#stats').innerHTML=[['Contributions',c.contributions],['Thèmes',c.themes],['Désaccords',c.disagreements],['Risques',c.risks],['Questions',c.questions],['Propositions',c.proposals]].map(([l,n])=>`<div class="stat"><b>${Number(n||0)}</b><span>${l}</span></div>`).join('');
  $('#themes').innerHTML=(d.recent_themes||[]).length?(d.recent_themes||[]).map(t=>itemHtml({id:t.canonical_key,title:t.label,summary:t.description||'Thème émergent',meta:fmtDate(t.updated_at)})).join(''):'<p class="hint">Les premiers thèmes apparaîtront avec les contributions.</p>';
  const s=d.latest_synthesis?.content;$('#latest-synthesis').innerHTML=s?`<div class="item"><h3>${esc(s.headline||'Synthèse collective')}</h3><p>${esc((s.emergent_topics||[]).map(x=>x.synthesis).slice(0,3).join(' '))}</p><div class="meta">${fmtDate(d.latest_synthesis.created_at)}</div></div>`:'<p class="hint">Une synthèse apparaîtra lorsque suffisamment de matière aura été publiée.</p>';
  const cs=await api('/api/public/contributions');$('#contributions').innerHTML=cs.length?cs.map(x=>itemHtml({id:x.public_id,title:x.title,summary:x.summary,meta:fmtDate(x.created_at)},true)).join(''):'<p class="hint">Le corpus public est encore vide.</p>';bindDetails();
}

async function loadDisagreements(){const rows=await api('/api/public/disagreements');$('#disagreement-list').innerHTML=rows.length?rows.map(x=>`<section class="card">${itemHtml({id:x.public_id,title:x.title,summary:x.summary,meta:`mis à jour ${fmtDate(x.updated_at)}`,positions:x.positions||[]})}</section>`).join(''):'<div class="card"><p class="hint">Aucun désaccord structuré pour le moment.</p></div>';}
async function loadEvolution(){const [ps,rs,qs]=await Promise.all([api('/api/public/proposals'),api('/api/public/risks'),api('/api/public/questions')]);$('#proposal-list').innerHTML=ps.length?ps.map(p=>`<section class="card">${itemHtml({id:p.public_id,title:p.title,summary:p.summary,meta:`${esc(p.proposal_type)} · ${fmtDate(p.updated_at)}`})}${p.counterargument?`<div class="open-question"><strong>Meilleure objection / réserve connue</strong><p>${esc(p.counterargument)}</p></div>`:''}</section>`).join(''):'<div class="card"><p class="hint">Aucune évolution proposée pour le moment.</p></div>';$('#risk-list').innerHTML=rs.length?rs.map(r=>itemHtml({id:r.public_id,title:r.title,summary:r.summary,meta:fmtDate(r.updated_at)})).join(''):'<p class="hint">Aucun risque structuré.</p>';$('#question-list').innerHTML=qs.length?qs.map(q=>itemHtml({id:q.public_id,title:q.question,summary:'',meta:fmtDate(q.updated_at)})).join(''):'<p class="hint">Aucune question structurée.</p>';}
async function loadJournal(){const [ev,fi]=await Promise.all([api('/api/public/events'),api('/api/public/federation')]);$('#event-list').innerHTML=ev.length?ev.map(e=>`<div class="event"><div class="meta"><span class="public-id">${esc(e.public_id)}</span>${fmtDate(e.created_at)} · ${esc(e.event_type)}</div><p>${esc(e.public_summary)}</p></div>`).join(''):'<p class="hint">Le journal commencera à se remplir avec l’activité du système.</p>';$('#federation-list').innerHTML=fi.length?fi.map(x=>itemHtml({id:x.instance_id,title:x.base_url,summary:`Statut : ${x.trust_status}`,meta:fmtDate(x.last_seen_at)})).join(''):'<p class="hint">Aucune instance homologue observée pour l’instant.</p>';}
async function loadPublic(name){try{if(name==='understand')await loadOverview();if(name==='disagreements')await loadDisagreements();if(name==='evolution')await loadEvolution();if(name==='journal')await loadJournal();}catch(e){console.error(e);}}
function bindDetails(){$$('.detail').forEach(b=>b.onclick=()=>openDetail(b.dataset.id));}
async function openDetail(id){try{const d=await api(`/api/public/contributions/${encodeURIComponent(id)}`);const c=d.contribution;const analyses=d.analyses||[];$('#detail-content').innerHTML=`<div class="eyebrow">CONTRIBUTION VALIDÉE</div><h2>${esc(c.title)}</h2><div class="meta"><span class="public-id">${esc(c.public_id)}</span>${fmtDate(c.created_at)}</div><p>${esc(c.summary)}</p>${analyses.map(a=>{const x=a.content||{};return `<div class="analysis-box"><div class="eyebrow">INTERPRÉTATION IA · CONTESTABLE</div><div class="meta"><span class="public-id">${esc(a.public_id)}</span>${esc(a.model)} · protocole ${esc(a.protocol_version)}</div><p><strong>Compréhension :</strong> ${esc(x.understanding||'')}</p><p><strong>Meilleur contre-argument :</strong> ${esc(x.best_counterargument||'')}</p><p><strong>Tensions :</strong> ${esc((x.tensions||[]).join(' · '))}</p><p class="hint">Cette analyse est une interprétation de l’IA, pas la parole originale du contributeur ni une vérité institutionnelle.</p></div>`}).join('')}<button class="btn secondary contest" data-id="${esc(c.public_id)}">Contester cette analyse</button>`;$('#detail-dialog').showModal();$('.contest').onclick=()=>{const cid=$('.contest').dataset.id;$('#detail-dialog').close();nav('home');$('#message').value=`Je souhaite contester ou compléter l’analyse de ${cid}. `;$('#message').focus();};}catch(e){setNotice(esc(e.message),true);}}

$$('.nav').forEach(n=>n.onclick=()=>nav(n.dataset.nav));$$('.refresh').forEach(b=>b.onclick=()=>loadPublic($('.view.active').id.replace('view-','')));$('#send').onclick=sendMessage;$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});$('#summarize').onclick=summarize;$('#reset').onclick=()=>{if(confirm('Effacer cette conversation locale et recommencer ?'))resetConversation();};$('#publish').onclick=publishContribution;$('#continue').onclick=()=>{$('#summary-panel').classList.add('hidden');$('#message').focus();};$('#discard').onclick=()=>{$('#summary-panel').classList.add('hidden');setNotice('Rien n’a été partagé. Vous pouvez continuer à discuter ou fermer la page.');};$('#close-dialog').onclick=()=>$('#detail-dialog').close();


const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const mic = $('#mic');
  mic.classList.remove('hidden');
  const rec = new SpeechRecognition();
  rec.lang = 'fr-FR';
  rec.interimResults = false;
  rec.continuous = false;
  rec.onresult = (e) => {
    const t = e.results?.[0]?.[0]?.transcript || '';
    $('#message').value = `${$('#message').value} ${t}`.trim();
    $('#message').focus();
  };
  rec.onerror = () => setNotice('La dictée vocale n’est pas disponible pour le moment.', true);
  mic.onclick = () => rec.start();
}

resetConversation();const initial=(location.hash||'#home').slice(1);nav(['home','understand','disagreements','evolution','journal'].includes(initial)?initial:'home');
