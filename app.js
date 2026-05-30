const APP_VERSION = '1.1.1';
const STORE_KEY = 'life-meter-v1';
const THEME_KEY = 'life-meter-theme';
const LAST_EXPORT_KEY = 'life-meter-last-export';

const meterConfig = [
  { domain:'Communication', emoji:'💬', types:['Text','Call','In-person','Email','Planning','Conflict','Repair','Other'] },
  { domain:'Movement', emoji:'🏃', types:['Walk','Run','Strength','Stretch','Swim','Basketball','Yard Work','Dog Walk','Other'] },
  { domain:'Nutrition', emoji:'🥗', types:['Breakfast','Lunch','Dinner','Snack','Hydration','Supplements','Alcohol','Other'] },
  { domain:'Sleep', emoji:'🌙', types:['Sleep Session','Nap','Wake Window','Sleep Prep','Other'] },
  { domain:'Supplements', emoji:'💊', types:['Vitamin D3','Omega-3','Methylfolate','CoQ10','Magnesium','Other'] },
  { domain:'Sex', emoji:'🫂', types:['Partner','Solo','Fertility-focused','Physical intimacy','Attempted','Other'] },
  { domain:'Learning', emoji:'📚', types:['Duolingo','Reading','Audio','Course','Language','Other'] },
  { domain:'Work', emoji:'💼', types:['Focus Session','Meeting','Deliverable','Admin','Message','Other'] },
  { domain:'Dog Care', emoji:'🐶', types:['Walk','Park','Feeding','Medication','Training','Grooming','Other'] },
  { domain:'Mood / Energy', emoji:'⚡', types:['Mood Check','Energy Check','Stress','Recovery','Win','Other'] },
  { domain:'Sunlight', emoji:'☀️', types:['Morning light','Outdoor time','Golden hour','Shade break','Other'] }
];

let state = loadState();
let activeDate = localDate();
let domainFilter = null;
let deferredPrompt = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function localTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function displayTime(value){
  if(!value) return '';
  const raw = String(value).trim();
  if(/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if(match){
    let h = parseInt(match[1],10);
    const m = match[2];
    const ap = match[3].toUpperCase();
    if(ap === 'PM' && h !== 12) h += 12;
    if(ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${m}`;
  }
  return raw.replace(/\s?(AM|PM)$/i,'');
}
function uid(prefix='lm') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function nowISO() { return new Date().toISOString(); }

function defaultState(){ return { app:'Life Meter', version:APP_VERSION, meters:[], episodes:[], narratives:[] }; }
function loadState(){
  try { return {...defaultState(), ...(JSON.parse(localStorage.getItem(STORE_KEY)) || {})}; }
  catch { return defaultState(); }
}
function saveState(){ localStorage.setItem(STORE_KEY, JSON.stringify({...state, version:APP_VERSION, updatedAt:nowISO()})); }

function applyTheme(theme){
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  const btn = $('#themeToggle');
  if(btn){
    btn.textContent = next === 'light' ? '☀️ Light' : '🌙 Dark';
    btn.setAttribute('aria-label', `Current theme: ${next}. Tap to toggle.`);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', next === 'light' ? '#f4f8fb' : '#07111f');
}
function initTheme(){ applyTheme(localStorage.getItem(THEME_KEY) || 'dark'); }
function toggleTheme(){ applyTheme((localStorage.getItem(THEME_KEY) || 'dark') === 'dark' ? 'light' : 'dark'); }
function updateLastExportDisplay(){
  const el = $('#lastExportLabel');
  if(!el) return;
  const stamp = localStorage.getItem(LAST_EXPORT_KEY);
  el.textContent = stamp ? `Last export: ${stamp}` : 'Last export: not yet exported.';
}

function init(){
  initTheme();
  $('#todayLabel').textContent = new Date().toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'});
  $('#activeDate').value = activeDate;
  $('#activeDate').addEventListener('change', e => { activeDate = e.target.value || localDate(); domainFilter = null; render(); });
  $$('.tab').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $('#clearFiltersBtn').addEventListener('click', () => { domainFilter = null; render(); });
  $('#quickForm').addEventListener('submit', saveQuickEntry);
  $('#episodeForm').addEventListener('submit', saveEpisode);
  $('#narrativeForm').addEventListener('submit', saveNarrative);
  $('#exportBtn').addEventListener('click', exportData);
  $('#themeToggle')?.addEventListener('click', toggleTheme);
  updateLastExportDisplay();
  $('#appVersion') && ($('#appVersion').textContent = `Life Meter v${APP_VERSION}`);
  $('#importFile').addEventListener('change', importData);
  $('#resetBtn').addEventListener('click', resetData);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => { if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; $('#installBtn').hidden = true; } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  render();
}

function setView(view){
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === view));
  render();
}

function entriesForDate(date = activeDate){ return state.meters.filter(e => e.date === date); }
function narrativesForDate(date = activeDate){ return state.narratives.filter(e => e.date === date); }
function countByDomain(date = activeDate){
  const counts = Object.fromEntries(meterConfig.map(m => [m.domain,0]));
  entriesForDate(date).forEach(e => counts[e.domain] = (counts[e.domain] || 0) + 1);
  return counts;
}

function render(){ renderMeters(); renderEntries(); renderEpisodes(); renderNarratives(); renderContext(); }

function renderMeters(){
  const counts = countByDomain();
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  $('#summaryLine').textContent = total ? `${total} meter entr${total===1?'y':'ies'} captured today.` : 'No entries yet.';
  $('#meterGrid').innerHTML = meterConfig.map(m => `
    <article class="meter-card">
      <div>
        <h3>${m.emoji} ${m.domain}</h3>
        <div class="count">${counts[m.domain] || 0}</div>
      </div>
      <div class="meter-actions">
        <button class="small" onclick="openQuick('${m.domain}')">Add</button>
        <button class="ghost small" onclick="filterDomain('${m.domain}')">View</button>
      </div>
    </article>
  `).join('');
}
window.openQuick = function(domain){
  const config = meterConfig.find(m => m.domain === domain);
  $('#quickDomain').textContent = domain;
  $('#quickTitle').textContent = `Add ${domain}`;
  $('#quickForm').domain.value = domain;
  $('#quickType').innerHTML = config.types.map(t => `<option>${t}</option>`).join('');
  $('#quickForm').quantity.value = '';
  $('#quickForm').unit.value = 'count';
  $('#quickForm').score.value = '';
  $('#quickForm').context.value = '';
  $('#quickForm').note.value = '';
  $('#quickDialog').showModal();
}
window.filterDomain = function(domain){ domainFilter = domain; renderEntries(); }

function saveQuickEntry(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const entry = {
    id: uid('meter'), kind:'meter', date: activeDate, time: localTime(), createdAt: nowISO(),
    domain: f.get('domain'), type: f.get('type'), quantity: f.get('quantity') || '', unit: f.get('unit') || 'count',
    score: f.get('score') || '', context: f.get('context') || '', note: f.get('note') || ''
  };
  state.meters.unshift(entry); saveState(); $('#quickDialog').close(); render();
}

function renderEntries(){
  let rows = entriesForDate();
  if (domainFilter) rows = rows.filter(e => e.domain === domainFilter);
  const el = $('#entryList');
  if (!rows.length) { el.className = 'entry-list empty-state'; el.textContent = domainFilter ? `No ${domainFilter} entries for this date.` : 'No meter entries for this date.'; return; }
  el.className = 'entry-list';
  el.innerHTML = rows.map(e => `
    <article class="entry">
      <div class="entry-top">
        <div><div class="entry-title">${escapeHTML(e.domain)} · ${escapeHTML(e.type)}</div><div class="entry-meta"><span class="date-wrap">${escapeHTML(e.date)}</span> <span class="time-wrap">${escapeHTML(displayTime(e.time))}</span> ${e.quantity ? '· '+escapeHTML(e.quantity)+' '+escapeHTML(e.unit) : ''} ${e.score ? '· score '+escapeHTML(e.score) : ''}</div></div>
        <button onclick="deleteRecord('meters','${e.id}')">Delete</button>
      </div>
      ${e.context ? `<p class="entry-meta">Context: ${escapeHTML(e.context)}</p>` : ''}
      ${e.note ? `<p>${escapeHTML(e.note)}</p>` : ''}
    </article>`).join('');
}

function saveEpisode(e){
  e.preventDefault(); const f = new FormData(e.target);
  state.episodes.unshift({ id:uid('episode'), kind:'episode', createdAt:nowISO(), title:f.get('title'), startDate:f.get('startDate'), endDate:f.get('endDate') || f.get('startDate'), category:f.get('category'), people:(f.get('people')||'').split(',').map(x=>x.trim()).filter(Boolean), location:f.get('location')||'', notes:f.get('notes')||'' });
  saveState(); e.target.reset(); e.target.startDate.value = activeDate; renderEpisodes();
}
function renderEpisodes(){
  const el = $('#episodeList');
  if(!state.episodes.length){ el.className='entry-list empty-state'; el.textContent='No episodes yet.'; return; }
  el.className='entry-list';
  el.innerHTML = state.episodes.map(ep => `<article class="entry"><div class="entry-top"><div><div class="entry-title">${escapeHTML(ep.title)}</div><div class="entry-meta">${escapeHTML(ep.category)} · ${escapeHTML(ep.startDate)}${ep.endDate && ep.endDate!==ep.startDate?'–'+escapeHTML(ep.endDate):''}${ep.location?' · '+escapeHTML(ep.location):''}</div></div><button onclick="deleteRecord('episodes','${ep.id}')">Delete</button></div>${ep.people?.length?`<p class="entry-meta">People: ${ep.people.map(escapeHTML).join(', ')}</p>`:''}${ep.notes?`<p>${escapeHTML(ep.notes)}</p>`:''}</article>`).join('');
}

function saveNarrative(e){
  e.preventDefault(); const f = new FormData(e.target);
  state.narratives.unshift({ id:uid('narrative'), kind:'narrative', date:activeDate, time:localTime(), createdAt:nowISO(), title:f.get('title')||'Untitled narrative', body:f.get('body') });
  saveState(); e.target.reset(); renderNarratives();
}
function renderNarratives(){
  const el = $('#narrativeList');
  if(!state.narratives.length){ el.className='entry-list empty-state'; el.textContent='No narratives yet.'; return; }
  el.className='entry-list';
  el.innerHTML = state.narratives.map(n => `<article class="entry"><div class="entry-top"><div><div class="entry-title">${escapeHTML(n.title)}</div><div class="entry-meta"><span class="date-wrap">${escapeHTML(n.date)}</span> <span class="time-wrap">${escapeHTML(displayTime(n.time))}</span></div></div><button onclick="deleteRecord('narratives','${n.id}')">Delete</button></div><p>${escapeHTML(n.body)}</p></article>`).join('');
}
function renderContext(){
  const counts = countByDomain();
  $('#contextStrip').innerHTML = meterConfig.map(m => `<span class="chip">${m.emoji} ${m.domain}: ${counts[m.domain] || 0}</span>`).join('');
}

window.deleteRecord = function(collection,id){
  if(!confirm('Delete this record?')) return;
  state[collection] = state[collection].filter(x => x.id !== id); saveState(); render();
}
function exportData(){
  const payload = { ...state, app:'Life Meter', version:APP_VERSION, exportedAt:nowISO(), localExportDate:localDate() };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `life-meter-export-${localDate()}.json`; a.click(); URL.revokeObjectURL(url);
  const exportedLabel = `${localDate()} ${localTime()}`;
  localStorage.setItem(LAST_EXPORT_KEY, exportedLabel);
  updateLastExportDisplay();
  $('#dataStatus').textContent = `Exported ${state.meters.length} meters, ${state.episodes.length} episodes, ${state.narratives.length} narratives.`;
}
async function importData(e){
  const file = e.target.files?.[0]; if(!file) return;
  try{
    const imported = JSON.parse(await file.text());
    const before = {meters:state.meters.length, episodes:state.episodes.length, narratives:state.narratives.length};
    ['meters','episodes','narratives'].forEach(collection => {
      const existing = new Set(state[collection].map(x=>x.id));
      (imported[collection] || []).forEach(item => { if(item.id && !existing.has(item.id)){ state[collection].push(item); existing.add(item.id); } });
    });
    saveState(); render();
    const after = {meters:state.meters.length, episodes:state.episodes.length, narratives:state.narratives.length};
    $('#dataStatus').textContent = `Import complete. Added meters: ${after.meters-before.meters}; episodes: ${after.episodes-before.episodes}; narratives: ${after.narratives-before.narratives}.`;
  }catch(err){ $('#dataStatus').textContent = `Import failed: ${err.message}`; }
  e.target.value = '';
}
function resetData(){
  if(!confirm('Delete all local Life Meter data on this device? Export first if needed.')) return;
  state = defaultState(); saveState(); render(); $('#dataStatus').textContent = 'Local data reset.';
}
function escapeHTML(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

document.addEventListener('DOMContentLoaded', init);
