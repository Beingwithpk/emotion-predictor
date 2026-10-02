const EMOTIONS = {
  sadness:  { emoji: '😢', color: '#4f7cff' },
  joy:      { emoji: '😄', color: '#f2a916' },
  love:     { emoji: '❤️', color: '#ee4f8a' },
  anger:    { emoji: '😠', color: '#e5483b' },
  fear:     { emoji: '😨', color: '#7a5cf0' },
  surprise: { emoji: '😲', color: '#16b5a3' },
};
const ORDER = ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise'];
const EXAMPLES = [
  ['joy', "I just got the internship and I can't stop smiling"],
  ['sadness', 'The house feels so empty since she left'],
  ['anger', 'They lied to me again and I am done'],
  ['fear', 'I heard footsteps behind me in the dark'],
  ['love', 'Every little thing about you makes me feel at home'],
  ['surprise', 'Wait, you drove all the way here just for me?'],
];

const $ = (id) => document.getElementById(id);
const el = {
  text: $('text'), go: $('go'), count: $('count'), chips: $('chips'),
  result: $('result'), face: $('face'), name: $('name'), conf: $('conf'),
  rows: $('rows'), error: $('error'), status: $('status'),
  history: $('history'), hist: $('hist'), burst: $('burst'),
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const history = [];
let busy = false;

/* ---------- setup ---------- */
EXAMPLES.forEach(([emo, sentence]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.setProperty('--e', EMOTIONS[emo].color);
  b.textContent = EMOTIONS[emo].emoji + ' ' + sentence.split(' ').slice(0, 4).join(' ') + '…';
  b.title = sentence;
  b.addEventListener('click', () => { el.text.value = sentence; sync(); analyze(); });
  el.chips.appendChild(b);
});

ORDER.forEach((emo) => {
  const li = document.createElement('li');
  li.dataset.emo = emo;
  li.style.setProperty('--e', EMOTIONS[emo].color);
  li.innerHTML = `<span class="nm"><span>${EMOTIONS[emo].emoji}</span>${emo}</span>
    <span class="track"><span class="fill"></span></span><span class="pc">0%</span>`;
  el.rows.appendChild(li);
});

function sync() {
  el.count.textContent = el.text.value.length;
  el.go.disabled = busy || !el.text.value.trim();
  el.text.style.height = 'auto';
  el.text.style.height = Math.min(el.text.scrollHeight, innerHeight * 0.4) + 'px';
}
el.text.addEventListener('input', sync);
el.text.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); analyze(); }
});
el.go.addEventListener('click', analyze);

/* ---------- server health (Render free tier sleeps, so poll until awake) ---------- */
function setStatus(kind, msg) {
  el.status.className = 'status ' + kind;
  el.status.lastElementChild.textContent = msg;
}
async function checkHealth(attempt = 0) {
  try {
    const r = await fetch('/health');
    const d = await r.json();
    if (d.model_loaded) { setStatus('ok', 'Model ready'); return; }
    setStatus('', 'Model is loading…');
  } catch {
    setStatus(attempt > 8 ? 'down' : '', attempt > 8 ? 'Server unreachable' : 'Waking up the server…');
  }
  if (attempt < 40) setTimeout(() => checkHealth(attempt + 1), 3000);
}
checkHealth();

/* ---------- analyze ---------- */
async function analyze() {
  const text = el.text.value.trim();
  if (!text || busy) return;
  busy = true;
  el.error.hidden = true;
  el.go.classList.add('loading');
  document.body.classList.add('thinking');
  sync();

  try {
    const res = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.status === 503) throw new Error('The model is still loading. Give it a few seconds and try again.');
    if (res.status === 422) throw new Error('That text could not be read. Try a different sentence.');
    if (!res.ok) throw new Error('Something went wrong on the server. Try again.');
    const data = await res.json();
    show(data);
    remember(data);
    setStatus('ok', 'Model ready');
  } catch (err) {
    el.error.textContent = err instanceof TypeError
      ? 'Could not reach the server. Check your connection and try again.'
      : err.message;
    el.error.hidden = false;
  } finally {
    busy = false;
    el.go.classList.remove('loading');
    document.body.classList.remove('thinking');
    sync();
  }
}

function show(data) {
  const emo = data.predicted_emotion;
  const info = EMOTIONS[emo];
  const probs = data.all_probabilites; // spelled as in the backend

  document.body.style.setProperty('--c', info.color);

  const first = el.result.hidden;
  el.result.hidden = false;
  if (first) el.result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

  el.face.textContent = info.emoji;
  el.face.classList.remove('swap'); void el.face.offsetWidth; el.face.classList.add('swap');

  el.name.innerHTML = '';
  [...emo].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.animationDelay = i * 40 + 'ms';
    el.name.appendChild(s);
  });

  countUp(el.conf, data.confidence * 100);

  el.rows.querySelectorAll('li').forEach((li) => {
    const p = (probs[li.dataset.emo] || 0) * 100;
    li.classList.toggle('top', li.dataset.emo === emo);
    li.querySelector('.fill').style.width = Math.max(p, 0.6) + '%';
    countUp(li.querySelector('.pc'), p, '%');
  });

  burst(info.emoji);
}

function countUp(node, to, suffix = '') {
  if (reduceMotion) { node.textContent = to.toFixed(1) + suffix; return; }
  const start = performance.now(), dur = 900;
  (function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    node.textContent = (to * (1 - Math.pow(1 - t, 3))).toFixed(1) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function burst(emoji) {
  if (reduceMotion) return;
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.textContent = emoji;
    s.style.left = 10 + Math.random() * 80 + '%';
    s.style.fontSize = 1.2 + Math.random() * 1.8 + 'rem';
    s.style.setProperty('--x', (Math.random() * 120 - 60) + 'px');
    s.style.setProperty('--r', (Math.random() * 80 - 40) + 'deg');
    s.style.setProperty('--d', 1.8 + Math.random() * 1.6 + 's');
    s.style.animationDelay = Math.random() * 0.35 + 's';
    el.burst.appendChild(s);
    setTimeout(() => s.remove(), 4200);
  }
}

/* ---------- session history ---------- */
function remember(data) {
  history.unshift({ text: data.text, emo: data.predicted_emotion });
  history.length = Math.min(history.length, 6);
  el.hist.innerHTML = '';
  history.slice(1).forEach((h) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span></span><span class="t"></span><span class="e"></span>';
    b.children[0].textContent = EMOTIONS[h.emo].emoji;
    b.children[1].textContent = h.text;
    b.children[2].textContent = h.emo;
    b.addEventListener('click', () => { el.text.value = h.text; sync(); el.text.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    li.appendChild(b);
    el.hist.appendChild(li);
  });
  el.history.hidden = history.length < 2;
}

sync();
