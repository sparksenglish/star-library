/* STAR Library app: sign-in, Home, Curriculum (stage → folder → module books), module page, search, My page. */
(function () {
  'use strict';
  const { call, store, cfg } = window.STAR;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let TOK = store.get('tok'), ME = null, LIB = { shelf: [], journeys: [], done: [] }, CAT = null;

  // ---------------------------------------------------------------- messages
  const MSG = {
    SLOW: 'The server is taking too long. Please try again.',
    BUSY: 'Someone else is saving right now. Please click again in a few seconds.',
    NOT_REGISTERED: "This email isn't registered yet. Ask your Teacher Leader to add you to STAR Library, then try again.",
    TOO_MANY: 'Too many tries. Please wait 15 minutes, then try again.',
    WRONG_CODE: "That code isn't right. Check the email and try again.",
    CODE_EXPIRED: 'This code has expired. Tap "Send a new code".',
    BAD_EMAIL: 'Enter a valid email address.',
    WRONG_PASSWORD: 'That password isn\'t right. Try again, or tap "Forgot password?".',
    LOCKED: 'Too many wrong passwords. Wait 15 minutes, or tap "Forgot password?".',
    NO_PASSWORD: 'You haven\'t created a password yet. Tap "Email me a sign-in code" below.',
    WEAK_PASSWORD: 'Use at least 8 characters.',
    SETUP_EXPIRED: 'That took too long. Please start again.',
    OFFLINE: "You're offline. Check your connection and try again.",
    NO_API: 'STAR Library is not set up yet (no server address).'
  };
  const why = (e) => { const m = String(e && e.message || e); return m.indexOf('MSG:') === 0 ? m.slice(4) : MSG[m] || 'Something went wrong. Check your connection and try again.'; };
  const isOut = (e) => String(e && e.message || e) === 'SIGNED_OUT';
  let toastT = 0;
  function toast(t) { const T = $('toast'); T.textContent = t; T.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { T.hidden = true; }, 2800); }

  /** Signed-in calls: the token goes first. If the session has ended, back to sign-in. */
  async function api(fn, args) {
    try { return await call(fn, [TOK].concat(args || [])); }
    catch (e) { if (isOut(e)) signedOut(); throw e; }
  }

  // ---------------------------------------------------------------- sign-in
  let EM = '', MODE = 'new', SETUP = '';
  const STEPS = ['g1', 'g2', 'g3'];
  function step(id) { STEPS.forEach((k) => { $(k).hidden = k !== id; }); ['g-e1', 'g-e2', 'g-e3', 'g-ok'].forEach((k) => { $(k).hidden = true; }); }
  function oops(id, e) { const E = $(id); E.textContent = typeof e === 'string' ? e : why(e); E.hidden = false; }
  function busy(B, on, t) { B.disabled = on; if (on) { B.dataset.t = B.textContent; B.textContent = t; } else if (B.dataset.t) B.textContent = B.dataset.t; }
  const okEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function gate(note) {
    document.body.classList.remove('signed');
    $('boot').hidden = true; $('view').hidden = true; $('nav').hidden = true; $('me').hidden = true; $('gate').hidden = false;
    step('g1'); if (note) oops('g-e1', note);
    EM = ''; SETUP = '';
    ['g-pw', 'g-code', 'g-new', 'g-new2'].forEach((k) => { $(k).value = ''; });
    $('g-email').value = store.get('email');
    setTimeout(() => $($('g-email').value ? 'g-pw' : 'g-email').focus(), 50);
  }
  function signedOut() {
    if (!$('gate').hidden) return;
    store.set('tok', ''); store.set('boot', ''); TOK = ''; MORE.forget();
    if (window.STAR_VIEW) window.STAR_VIEW.close(true);
    gate('Please sign in again.');
  }
  function codeStep() {
    step('g2'); $('g-to').textContent = EM;
    $('g2-why').textContent = MODE === 'new' ? "First time here? To check it's you, we sent a code to" : 'To reset your password, we sent a code to';
    $('g-code').value = ''; $('g-code').focus();
  }
  async function signedIn(tok, B, eid) {
    TOK = tok; store.set('tok', TOK);
    try { const r = await call('boot', [TOK]); busy(B, false); enter(r); }
    catch (e) { busy(B, false); oops(eid, e); }
  }
  async function getCode(mode, B) {
    const v = $('g-email').value.trim().toLowerCase(); $('g-e1').hidden = true;
    if (!v) { oops('g-e1', 'Enter your email first.'); $('g-email').focus(); return; }
    if (!okEmail(v)) return oops('g-e1', MSG.BAD_EMAIL);
    busy(B, true, 'Sending…');
    try { await call('requestCode', [v]); busy(B, false); EM = v; store.set('email', v); MODE = mode; codeStep(); }
    catch (e) { busy(B, false); oops('g-e1', e); }
  }
  $('g1').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = $('g-email').value.trim().toLowerCase(), pw = $('g-pw').value, B = $('g-in'); $('g-e1').hidden = true;
    if (!v) { oops('g-e1', 'Enter your email first.'); $('g-email').focus(); return; }
    if (!okEmail(v)) return oops('g-e1', MSG.BAD_EMAIL);
    if (!pw) { oops('g-e1', 'Enter your password. First time here? Tap "Email me a sign-in code".'); $('g-pw').focus(); return; }
    busy(B, true, 'Signing in…');
    try { const r = await call('signInPassword', [v, pw]); EM = v; store.set('email', v); signedIn(r.token, B, 'g-e1'); }
    catch (err) { busy(B, false); oops('g-e1', err); $('g-pw').select(); }
  });
  $('g-forgot').onclick = () => getCode('reset', $('g-forgot'));
  $('g-send').onclick = () => getCode('new', $('g-send'));
  $('g-again').onclick = async () => {
    const B = $('g-again'); $('g-e2').hidden = true; $('g-ok').hidden = true; busy(B, true, 'Sending…');
    try { await call('requestCode', [EM]); busy(B, false); $('g-code').value = ''; const O = $('g-ok'); O.textContent = 'New code sent. Use the newest email.'; O.hidden = false; $('g-code').focus(); }
    catch (err) { busy(B, false); oops('g-e2', err); }
  };
  $('g-back').onclick = () => gate();
  $('g-email').oninput = $('g-pw').oninput = () => { $('g-e1').hidden = true; };
  $('g-new').oninput = $('g-new2').oninput = () => { $('g-e3').hidden = true; };
  $('g-show').onchange = (e) => { $('g-pw').type = e.target.checked ? 'text' : 'password'; };
  $('g3-show').onchange = (e) => { $('g-new').type = $('g-new2').type = e.target.checked ? 'text' : 'password'; };
  $('g-code').oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); $('g-e2').hidden = true; $('g-ok').hidden = true; };
  $('g2').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = $('g-code').value.trim(), B = $('g-go'); $('g-e2').hidden = true; $('g-ok').hidden = true;
    if (!/^\d{6}$/.test(c)) return oops('g-e2', 'Enter the 6-digit code from your email.');
    busy(B, true, 'Checking…');
    try {
      const r = await call('verifyCode', [EM, c]); busy(B, false); SETUP = r.setup; step('g3');
      $('g3-h').textContent = MODE === 'new' ? 'Create your password' : 'Set a new password';
      $('g3-user').value = EM; $('g3-show').checked = false; $('g-new').type = $('g-new2').type = 'password'; $('g-new').focus();
    } catch (err) { busy(B, false); oops('g-e2', err); if (String(err.message) === 'CODE_EXPIRED') $('g-code').value = ''; }
  });
  $('g3').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('g-new').value, b = $('g-new2').value, B = $('g-save'); $('g-e3').hidden = true;
    if (a.length < 8) return oops('g-e3', 'Use at least 8 characters.');
    if (a !== b) return oops('g-e3', "The two passwords don't match.");
    busy(B, true, 'Saving…');
    try { const r = await call('setPassword', [SETUP, a]); SETUP = ''; signedIn(r.token, B, 'g-e3'); }
    catch (err) { busy(B, false); if (String(err.message) === 'SETUP_EXPIRED') gate(MSG.SETUP_EXPIRED); else oops('g-e3', err); }
  });

  // ---------------------------------------------------------------- account menu, themes, install
  const THEMES = ['light', 'forest', 'sage'];
  function applyTheme(th, save) {
    if (THEMES.indexOf(th) < 0) th = 'light';
    document.documentElement.setAttribute('data-theme', th); store.set('theme', th === 'light' ? '' : th);
    document.querySelectorAll('.thm button').forEach((b) => b.setAttribute('aria-checked', b.dataset.t === th));
    if (save) api('theme', [th]).catch((e) => { if (!isOut(e)) toast("Couldn't save your theme. Check your connection."); });
  }
  document.querySelectorAll('.thm button').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); applyTheme(b.dataset.t, true); }; });
  $('av').onclick = (e) => { e.stopPropagation(); const p = $('me-pop'), on = p.hidden; p.hidden = !on; $('av').setAttribute('aria-expanded', on); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.me')) { $('me-pop').hidden = true; $('av').setAttribute('aria-expanded', 'false'); } });
  $('signout').onclick = () => {
    const t = TOK; call('signOut', [t]).catch(() => {});
    store.set('tok', ''); store.set('boot', ''); TOK = ''; MORE.forget(); ME = null; CAT = null; LIB = { shelf: [], journeys: [], done: [] };
    if (window.STAR_VIEW) window.STAR_VIEW.close(true);
    gate();
  };
  let installEv = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEv = e; $('install-btn').hidden = false; });
  $('install-btn').onclick = async () => { if (!installEv) return; installEv.prompt(); await installEv.userChoice.catch(() => {}); installEv = null; $('install-btn').hidden = true; };
  function online() { $('offline').hidden = navigator.onLine !== false; }
  addEventListener('online', online); addEventListener('offline', online);

  // ---------------------------------------------------------------- start
  async function boot() {
    online();
    const jm = /^#\/join(?:\/(\d{6}))?/.exec(location.hash);
    if (jm) { $('boot').hidden = true; window.STAR_LIVE.join(jm[1] || ''); if (!TOK) return; }   // phones in a live session: no sign-in needed
    if (!TOK) return gate();
    const saved = store.json('boot');
    if (saved) enter(saved, true);          // show the last catalogue at once, then refresh it
    try { enter(await call('boot', [TOK])); }
    catch (e) {
      if (isOut(e)) { store.set('tok', ''); store.set('boot', ''); TOK = ''; MORE.forget(); gate(); return; }
      if (!saved) { $('boot').textContent = why(e); $('boot').insertAdjacentHTML('beforeend', '<br><br><button class="btn" type="button" id="retry">Try again</button>'); $('retry').onclick = () => { $('boot').textContent = 'Opening STAR Library…'; boot(); }; }
    }
  }
  function enter(r, fromCache) {
    ME = r.me; CAT = r.cat; if (!fromCache || !LIB.shelf.length) LIB = r.lib || LIB;
    if (!fromCache) store.setJson('boot', r);
    index();
    applyTheme(ME.theme || 'light');
    $('boot').hidden = true; $('gate').hidden = true; $('view').hidden = false; $('nav').hidden = false; $('me').hidden = false;
    document.body.classList.add('signed');
    const n = (ME.name || '').trim(), w = n.replace(/^SE-\s*/i, '').split(/\s+/).filter(Boolean);
    $('av').textContent = ME.initials || ((w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || ME.email || '?').slice(0, 2)).toUpperCase());
    $('me-name').textContent = n || 'Signed in'; $('me-email').textContent = ME.email || '';
    document.querySelector('.nav a[data-nav="team"]').hidden = !ME.role || ME.role === 'Teacher';
    document.querySelector('.nav a[data-nav="edit"]').hidden = ME.role !== 'L&D';
    route();
    if (!fromCache) MORE.prefetch(ME.role);
  }

  // ---------------------------------------------------------------- catalogue helpers
  const STAGES = [
    { s: 'S0', n: 'Find Your Sparks', w: 'Bootcamp · 3 days', groups: [] },
    { s: 'S1', n: 'Onboarding', w: 'Weeks 1–2', groups: [] },
    { s: 'S2', n: 'Core Readiness', w: 'Weeks 3–10 · about 85 h', groups: ['Know', 'Plan', 'Teach', 'Assess', 'Professional practice'] },
    { s: 'S3', n: 'Programme & Parents', w: 'Weeks 11–16', groups: ['Parent-facing', 'Little Sparks', 'Sparks Kid', 'Sparks Teen', 'Sparks Teen+', 'SLSA'] },
    { s: 'S4', n: 'Development', w: 'Months 5–12', groups: [] },
    { s: 'OTHER', n: 'Other trainings', w: 'Soft skills and more', groups: [] }
  ];
  const GROUP_NOTE = { Know: 'Understand the concept', Plan: 'Design the learning', Teach: 'Deliver and manage', Assess: 'Evaluate and respond',
    'Professional practice': 'Reflect and revisit', 'Parent-facing': 'Trials, checkpoints, PTM', 'Little Sparks': 'Ages 3–6', 'Sparks Kid': 'Ages 7–9',
    'Sparks Teen': 'Ages 10–14', 'Sparks Teen+': 'Ages 15–18', SLSA: 'Leadership and speech' };
  let MOD = {}, TR = {}, BYMOD = {}, OTHER = [], REFRESH = [];
  function index() {
    MOD = {}; TR = {}; BYMOD = {}; OTHER = []; REFRESH = [];
    (CAT.modules || []).forEach((m) => { MOD[m.c] = m; });
    (CAT.trainings || []).forEach((t) => {
      TR[t.i] = t;
      if (t.m && MOD[t.m]) { (BYMOD[t.m] = BYMOD[t.m] || []).push(t); if (t.rf) REFRESH.push(t); } else OTHER.push(t);
    });
  }
  const ready = (t) => t.st === 'L' && !!(t.k || t.r);
  const readyIn = (code) => (BYMOD[code] || []).filter(ready).length;
  const stageOf = (s) => STAGES.find((x) => x.s === s);
  const stageNo = (s) => (s === 'OTHER' ? 'Other' : /^S\d$/.test(s) ? 'Stage ' + s.slice(1) : s);   // S2 -> Stage 2
  const modsIn = (s, g) => (CAT.modules || []).filter((m) => m.s === s && (g == null || m.g === g));
  const coverKey = (t) => (t && t.k === 'slides' ? t.i + ':' + (t.cv || 1) : '');
  const trTitle = (t) => (t.m && MOD[t.m] ? MOD[t.m].t : t.t);

  const GLYPH = {
    S0: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z" fill="#C9A227"/></svg>',
    S1: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="8" width="40" height="50" rx="6" fill="#2E5A2C"/><rect x="17" y="17" width="30" height="36" rx="3" fill="#fff"/><path d="M22 34l6 6 12-13" stroke="#2E5A2C" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
    S2: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="30" width="24" height="24" rx="4" fill="#2E6B3A"/><rect x="34" y="30" width="24" height="24" rx="4" fill="#C9A227"/><rect x="20" y="6" width="24" height="24" rx="4" fill="#12260F"/></svg>',
    S3: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="20" cy="26" r="8" fill="#2E6B3A"/><path d="M6 54c0-10 6-16 14-16s14 6 14 16z" fill="#2E6B3A"/><circle cx="44" cy="30" r="7" fill="#C9A227"/><path d="M32 56c0-9 5-14 12-14s12 5 12 14z" fill="#C9A227"/></svg>',
    S4: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6a18 18 0 00-11 32c3 2.5 4 5 4 8h14c0-3 1-5.5 4-8A18 18 0 0032 6z" fill="#C9A227"/><rect x="25" y="47" width="14" height="5" rx="2" fill="#2E6B3A"/><rect x="27" y="53" width="10" height="5" rx="2" fill="#2E6B3A"/></svg>',
    OTHER: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10h30a5 5 0 015 5v14a5 5 0 01-5 5H22l-8 7v-7H8a5 5 0 01-5-5V15a5 5 0 015-5z" fill="#2E6B3A"/><path d="M28 30h26a5 5 0 015 5v12a5 5 0 01-5 5h-4v7l-8-7H28a5 5 0 01-5-5V35a5 5 0 015-5z" fill="#C9A227"/></svg>'
  };
  const glyph = (s) => GLYPH[s] || GLYPH.OTHER;
  const ICON_SEARCH = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
  const FOLDER_BACK = '<svg class="f" viewBox="0 0 200 112" preserveAspectRatio="none" aria-hidden="true"><path d="M16 6H72Q80 6 85 13L90 20H184Q196 20 196 32V100Q196 110 184 110H16Q4 110 4 100V18Q4 6 16 6Z" style="fill:var(--fd2)"/></svg>';
  const FOLDER_FRONT = '<svg class="f" viewBox="0 0 200 112" preserveAspectRatio="none" aria-hidden="true"><path d="M4 52Q4 44 16 44H102Q110 44 115 39L121 34Q125 30 133 30H184Q196 30 196 42V100Q196 110 184 110H16Q4 110 4 100Z" style="fill:var(--fd)"/></svg>';

  const stageBook = (st) => {
    const ms = st.s === 'OTHER' ? [] : modsIn(st.s);
    const sub = st.s === 'OTHER' ? OTHER.concat(REFRESH).filter(ready).length + ' ready' : ms.length + ' modules';
    return '<a class="book" href="#/s/' + st.s + '" aria-label="' + esc((st.s === 'OTHER' ? '' : stageNo(st.s) + ': ') + st.n + ', ' + sub) + '"><span class="bk"></span><span class="pg"></span><span class="cv">' +
      '<span class="win">' + glyph(st.s) + '</span>' + (st.s === 'OTHER' ? '' : '<span class="bcode">' + stageNo(st.s) + '</span>') + '<span class="tt">' + esc(st.n) + '</span><span class="sub">' + esc(sub) + '</span></span></a>';
  };
  const moduleBook = (m) => {
    const n = readyIn(m.c);
    return '<a class="book' + (n ? '' : ' soon') + '" href="#/m/' + encodeURIComponent(m.c) + '" aria-label="' + esc(m.c + ' ' + m.t + ', ' + (n ? n + ' ready' : 'coming soon')) + '"><span class="bk"></span><span class="pg"></span><span class="cv">' +
      '<span class="bcode">' + esc(m.c) + '</span><span class="tt">' + esc(m.t) + '</span><span class="st">' + (n ? n + (n === 1 ? ' training' : ' trainings') : 'Coming soon') + '</span></span></a>';
  };
  const trainingBook = (t) => {
    const r = ready(t), cv = coverKey(t);
    return '<a class="book' + (r ? '' : ' soon') + '" href="#/t/' + encodeURIComponent(t.i) + '" aria-label="' + esc(t.i + ' ' + t.t + ', ' + (r ? 'open' : 'coming soon')) + '"><span class="bk"></span><span class="pg"></span><span class="cv">' +
      (t.rf ? '<span class="rfb">Refresher</span>' : '') + '<span class="win">' + (cv ? '<img alt="" data-s="' + esc(cv) + '">' : glyph(MOD[t.m] ? MOD[t.m].s : 'OTHER')) + '</span>' +
      '<span class="bcode">' + esc(t.i) + '</span><span class="tt">' + esc(t.t) + '</span><span class="st">' + (r ? (t.k ? 'Open' : 'Watch') + ' →' : 'Coming soon') + '</span></span></a>';
  };
  const folder = (st, g) => {
    const ms = modsIn(st.s, g), n = ms.filter((m) => readyIn(m.c)).length;
    return '<a class="fd" href="#/s/' + st.s + '/' + encodeURIComponent(g) + '" aria-label="' + esc(g + ', ' + ms.length + ' modules, ' + (n ? n + ' ready' : 'coming soon')) + '">' + FOLDER_BACK +
      '<span class="papers"><i></i><i></i><i></i></span>' + FOLDER_FRONT +
      '<span class="lbl2"><b>' + esc(g) + '</b><small>' + ms.length + ' modules · ' + (n ? n + ' ready' : 'coming soon') + '</small></span><span class="go' + (n ? ' act' : '') + '">' + (n ? 'Open ' : '') + '→</span></a>';
  };
  const backBtn = (href, label) => '<a class="btn soft back" href="' + href + '">← ' + esc(label || 'Back') + '</a>';

  // ---------------------------------------------------------------- views
  function view(html, nav) {
    const V = $('view'); V.innerHTML = html;
    document.querySelectorAll('.nav a').forEach((a) => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    hydrate();
  }

  function homeView() {
    const f = TR[CAT.featured];
    const recs = f ? recFor(f.i) : [];
    const recent = (CAT.trainings || []).filter((t) => ready(t) && t.u).sort((a, b) => b.u.localeCompare(a.u)).slice(0, 6);
    const shelf = LIB.shelf.map((id) => TR[id]).filter(Boolean).slice(0, 8);
    const popular = ['S2', 'S1', 'S3'].map((s) => stageOf(s)).filter(Boolean);
    let h = '<section class="sec"><div class="home-top"><div style="display:flex;flex-direction:column;gap:14px">' +
      '<h1 class="big">Grow with <em>L&amp;D</em></h1>' + searchBox() +
      '<div class="chips"><span class="sm muted">Popular:</span>' + popular.map((s) => '<a class="chip" href="#/s/' + s.s + '">' + esc(s.n) + '</a>').join('') + '</div></div>';
    if (f) {
      const cv = coverKey(f);
      h += '<a class="book feat" href="#/t/' + encodeURIComponent(f.i) + '" aria-label="Latest training: ' + esc(trTitle(f) + ', ' + f.t) + '"><span class="bk"></span><span class="pg"></span><span class="cv">' +
        '<span class="ribbon">Latest training</span><span class="win">' + (cv ? '<img alt="" data-s="' + esc(cv) + '">' : glyph(MOD[f.m] ? MOD[f.m].s : 'OTHER')) + '</span>' +
        '<span class="bcode">' + esc(f.i) + '</span><span class="tt">' + esc(trTitle(f)) + '</span>' + (f.m ? '<span class="sub">' + esc(f.t) + '</span>' : '') +
        '<span class="go">' + (f.k ? 'Open' : 'Watch') + ' training →</span></span></a>';
    }
    if (recs.length) h += '<div class="recs"><span class="disp" style="font-weight:700;font-size:16px">Recommended next</span><div class="grid2">' + recs.map(miniCard).join('') + '</div></div>';
    h += '</div></section>';
    h += '<section class="sec" aria-labelledby="cur-h"><h2 class="sec-h u" id="cur-h">The curriculum</h2><div class="shelf stages">' + STAGES.map(stageBook).join('') + '</div></section>';
    if (shelf.length) h += '<section class="sec" aria-labelledby="sh-h"><h2 class="sec-h" id="sh-h">My shelf</h2><div class="shelf">' + shelf.map(trainingBook).join('') + '</div></section>';
    if (recent.length) h += '<section class="sec" aria-labelledby="rc-h"><h2 class="sec-h" id="rc-h">Recently updated</h2><div class="rows">' + recent.map((t) =>
      '<a class="row" href="#/t/' + encodeURIComponent(t.i) + '"><span class="ic">' + esc(t.m || t.i) + '</span><span><b>' + esc(t.t) + '</b><br><span class="sm muted">Updated ' + niceDate(t.u) + '</span></span><span class="st">Ready</span></a>').join('') + '</div></section>';
    view(h, 'home'); wireSearch();
  }
  const niceDate = (d) => { const p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const miniCard = (t) => {
    const cv = coverKey(t);
    return '<a class="mini" href="#/t/' + encodeURIComponent(t.i) + '"><span class="th">' + (cv ? '<img alt="" data-s="' + esc(cv) + '">' : glyph(MOD[t.m] ? MOD[t.m].s : 'OTHER').replace('<svg', '<svg width="34" height="34"')) + '</span>' +
      '<span class="code">' + esc(t.i) + '</span><b>' + esc(trTitle(t)) + '</b><span class="st" style="align-self:flex-start">' + (ready(t) ? 'Ready' : 'Coming soon') + '</span></a>';
  };
  /** Recommended next: the training's own list, then others in the same module, then the next module in the stage. */
  function recFor(id) {
    const t = TR[id], out = [];
    const add = (x) => { if (x && x.i !== id && ready(x) && !out.some((o) => o.i === x.i) && out.length < 2) out.push(x); };
    if (!t) return out;
    (t.rc || []).forEach((r) => add(TR[r]));
    (BYMOD[t.m] || []).forEach(add);
    const m = MOD[t.m];
    if (m) modsIn(m.s, m.g).forEach((x) => (BYMOD[x.c] || []).forEach(add));
    return out;
  }

  function stageView(s, g) {
    const st = stageOf(s) || stageOf('S2');
    store.set('stage', st.s);
    const tabs = '<div class="tabs" role="tablist" aria-label="Stage">' + STAGES.map((x) => '<a role="tab" class="chip' + (x.s === st.s ? ' on' : '') + '" aria-selected="' + (x.s === st.s) + '" href="#/s/' + x.s + '">' + stageNo(x.s) + '</a>').join('') + '</div>';
    let h = '<section class="sec" aria-labelledby="st-h">';
    if (g) {
      h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + backBtn('#/s/' + st.s) + '<nav class="crumbs" aria-label="You are here"><a href="#/">Home</a> › <a href="#/s/' + st.s + '">' + esc(stageNo(st.s)) + '</a> › <b>' + esc(g) + '</b></nav></div>' +
        '<div><h1 class="big" id="st-h" style="font-size:28px">' + esc(g) + '</h1><p class="sm muted" style="margin:3px 0 0">' + esc(GROUP_NOTE[g] || '') + '</p></div>';
      const ms = modsIn(st.s, g);
      h += ms.length ? '<div class="shelf" role="list">' + ms.map(moduleBook).join('') + '</div>' : '<p class="muted">No modules here yet.</p>';
    } else {
      h += tabs + '<div class="vh"><span class="badge" aria-hidden="true">' + glyph(st.s) + '</span><div style="flex:1">' + (st.s === 'OTHER' ? '' : '<span class="sm muted" style="font-weight:700">' + stageNo(st.s) + '</span>') + '<h1 class="big" id="st-h" style="font-size:28px">' + esc(st.n) + '</h1><p class="sm muted" style="margin:3px 0 0">' + esc(st.w) + '</p></div></div>';
      if (st.s === 'OTHER') {
        const groups = {};
        OTHER.forEach((t) => { (groups[t.g || 'Other'] = groups[t.g || 'Other'] || []).push(t); });
        const keys = Object.keys(groups).sort();
        // refreshers stay in their module; here they are also gathered in one place, by module
        const rmods = [...new Set(REFRESH.map((t) => t.m))].sort();
        h += keys.map((k) => '<h2 class="lbl" style="margin-top:6px">' + esc(k) + '</h2><div class="shelf">' + groups[k].map(trainingBook).join('') + '</div>').join('');
        if (rmods.length) h += '<h2 class="sec-h" style="margin-top:10px">Refreshers</h2><p class="sm muted" style="margin:0">Short refreshers for modules you have already done. They are not part of the stage path.</p>' +
          rmods.map((c) => '<h2 class="lbl" style="margin-top:6px"><a href="#/m/' + encodeURIComponent(c) + '" style="color:inherit">' + esc(c + ' · ' + MOD[c].t) + '</a></h2><div class="shelf">' + REFRESH.filter((t) => t.m === c).map(trainingBook).join('') + '</div>').join('');
        if (!keys.length && !rmods.length) h += '<p class="muted">Nothing here yet.</p>';
      } else if (st.groups.length) {
        const gs = st.groups.filter((x) => modsIn(st.s, x).length);
        h += '<div class="folders">' + gs.map((x) => folder(st, x)).join('') + '</div>';
      } else {
        const ms = modsIn(st.s);
        h += ms.length ? '<div class="shelf" role="list">' + ms.map(moduleBook).join('') + '</div>' : '<p class="muted">No modules here yet.</p>';
      }
    }
    h += '</section>';
    view(h, 'curriculum');
  }

  function moduleView(code) {
    const m = MOD[code];
    if (!m) return view('<section class="sec"><h1 class="big">Not found</h1><p class="muted">This module is not in the catalogue.</p>' + backBtn('#/', 'Home') + '</section>', 'curriculum');
    const st = stageOf(m.s) || { s: m.s, n: m.s };
    const all = BYMOD[m.c] || [], trs = all.filter((t) => !t.rf), refs = all.filter((t) => t.rf);
    const back = '#/s/' + m.s + (m.g ? '/' + encodeURIComponent(m.g) : '');
    const sk = m.k.map((id) => [id, CAT.skills[id]]).filter((x) => x[1]);
    const dom = sk.length ? sk[0][1][2] : '';
    let h = '<section class="sec" aria-labelledby="m-h"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + backBtn(back) +
      '<nav class="crumbs" aria-label="You are here">' + esc(stageNo(m.s)) + (m.g ? ' › ' + esc(m.g) : '') + ' › <b>' + esc(m.c) + '</b></nav></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><div class="chips"><span class="tag dark">' + esc(m.c) + '</span>' + (m.y ? '<span class="tag">' + esc(m.y) + '</span>' : '') +
      (sk.length ? '<span class="tag">Depth: ' + esc(sk[0][1][1]) + '</span>' : '') + (m.a ? '<span class="tag">' + (m.a === 'Open' ? 'Open to everyone' : 'Assigned by L&amp;D') + '</span>' : '') + '</div>' +
      '<h1 class="big" id="m-h">' + esc(m.t) + '</h1><p class="sm muted" style="margin:0">' + esc(stageNo(st.s) + ': ' + (st.n || '')) + (m.h ? ' · ' + esc(m.h) + ' h' : '') + (m.o ? ' · owner ' + esc(m.o) : '') + '</p></div>';
    h += '<div class="mgrid"><div class="mmain"><div style="display:flex;flex-direction:column;gap:6px"><h2 class="disp" style="margin:0;font-size:16px;font-weight:700">Trainings on this shelf · ' + trs.length + '</h2>' +
      (trs.length ? '<div class="shelf big" role="list">' + trs.map(trainingBook).join('') + '</div><span class="ledge" aria-hidden="true"></span>' : '<p class="muted" style="margin:0">No trainings yet. L&amp;D is preparing this module.</p>') + '</div>' +
      (refs.length ? '<div style="display:flex;flex-direction:column;gap:6px;margin-top:14px"><h2 class="disp" style="margin:0;font-size:16px;font-weight:700">Refreshers · ' + refs.length + '</h2>' +
        '<p class="sm muted" style="margin:0">Extra sessions to refresh this topic. Not part of the stage path.</p><div class="shelf big" role="list">' + refs.map(trainingBook).join('') + '</div><span class="ledge" aria-hidden="true"></span></div>' : '') +
      '</div><div class="mside">';
    if (m.d) h += '<div class="box"><h2 class="lbl">You\'ll produce</h2><p style="margin:0;line-height:1.5">' + esc(m.d) + '</p></div>';
    if (m.p.length) h += '<div class="box"><h2 class="lbl">Before this module</h2><div class="chips">' + m.p.map((p) => MOD[p] ? '<a class="pre" href="#/m/' + encodeURIComponent(p) + '"><b>' + esc(p) + '</b> ' + esc(MOD[p].t) + '</a>' : '<span class="pre">' + esc(p) + '</span>').join('') + '</div></div>';
    if (sk.length) h += '<div class="box" style="gap:0"><h2 class="lbl" style="margin-bottom:6px">Skills' + (dom ? ' · ' + esc(dom) : '') + '</h2>' +
      sk.map((x) => '<div class="sk"><span class="code">' + esc(x[0]) + '</span><span>' + esc(x[1][0]) + '</span><span class="tag">' + esc(x[1][1]) + '</span></div>').join('') + '</div>';
    else if (m.x) h += '<div class="box"><h2 class="lbl">SETDT coverage</h2><p style="margin:0;font-size:14px;line-height:1.5">' + esc(m.x) + '</p></div>';
    const foCodes = [...new Set((m.fo || []).concat(...all.map((t) => t.fo || [])))].filter((c) => (CAT.fo || {})[c]);
    if (foCodes.length) h += '<div class="box"><h2 class="lbl">Observed in class (FO rubric)</h2>' + foCodes.map((c) => '<div class="sk" style="grid-template-columns:44px 1fr"><span class="code">' + esc(c) + '</span><span>' + esc(CAT.fo[c][2]) + '</span></div>').join('') + '</div>';
    if (m.f || m.m) h += '<div class="box"><h2 class="lbl">Facilitator</h2>' + (m.f ? '<p style="margin:0">' + esc(m.f) + '</p>' : '<p class="muted sm" style="margin:0">To be set by L&amp;D</p>') +
      (m.m ? '<a href="' + esc(m.m) + '" target="_blank" rel="noopener" style="font-weight:700;font-size:14px;min-height:44px;display:inline-flex;align-items:center">Facilitator kit and materials ↗</a>' : '') + '</div>';
    h += '<p class="sm muted" style="margin:0;line-height:1.5">Marking a training done is for your own tracking. Your profile only changes when L&amp;D signs the module off in STAR LMS.</p></div></div></section>';
    view(h, 'curriculum');
  }

  // ---------------------------------------------------------------- search
  const searchBox = () => '<div class="srch" role="search"><label>' + ICON_SEARCH + '<span class="sr">Search</span><input id="q" type="search" placeholder="Search a module, skill or code" autocomplete="off" aria-controls="res" aria-expanded="false"><button type="button" class="clr" id="q-clr" aria-label="Clear search" hidden>✕</button></label><div class="res" id="res" hidden></div></div>';
  function wireSearch() {
    const Q = $('q'), RS = $('res'); if (!Q) return;
    let hits = [], hi = 0;
    const run = () => {
      $('q-clr').hidden = !Q.value;
      const v = Q.value.trim().toLowerCase();
      if (!v) { RS.hidden = true; Q.setAttribute('aria-expanded', 'false'); return; }
      const w = v.split(/\s+/);
      const has = (txt) => w.every((x) => txt.includes(x));
      hits = [];
      (CAT.modules || []).forEach((m) => {
        const skillTxt = m.k.map((id) => id + ' ' + ((CAT.skills[id] || [])[0] || '')).join(' ');
        if (has((m.c + ' ' + m.t + ' ' + m.x + ' ' + m.g + ' ' + skillTxt).toLowerCase())) hits.push({ href: '#/m/' + encodeURIComponent(m.c), code: m.c, t: m.t, sub: stageNo(m.s) + (m.g ? ' › ' + m.g : ''), n: readyIn(m.c) });
      });
      (CAT.trainings || []).forEach((t) => {
        if (has((t.i + ' ' + t.t + ' ' + t.d + ' ' + t.g).toLowerCase())) hits.push({ href: '#/t/' + encodeURIComponent(t.i), code: t.i, t: t.t, sub: t.m ? 'Training in ' + t.m : (t.g || 'Other'), n: ready(t) ? 1 : 0 });
      });
      hits = hits.slice(0, 12); hi = 0;
      RS.innerHTML = hits.length ? hits.map((x, i) => '<a href="' + x.href + '" class="' + (i ? '' : 'on') + '"><span class="code">' + esc(x.code) + '</span><span><b style="font-weight:700;font-size:14px">' + esc(x.t) + '</b><br><span class="sm muted">' + esc(x.sub) + '</span></span><span class="st' + (x.n ? '' : ' soon') + '">' + (x.n ? 'Ready' : 'Soon') + '</span></a>').join('')
        : '<div class="none">Nothing found for “' + esc(Q.value.trim()) + '”. Try a shorter word, a code like S2-22, or a skill like D05 J.</div>';
      RS.hidden = false; Q.setAttribute('aria-expanded', 'true');
    };
    Q.addEventListener('input', run); Q.addEventListener('focus', run);
    $('q-clr').onclick = () => { Q.value = ''; run(); Q.focus(); };
    Q.addEventListener('keydown', (e) => {
      const as = [...RS.querySelectorAll('a')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!as.length) return; hi = (hi + (e.key === 'ArrowDown' ? 1 : as.length - 1)) % as.length; as.forEach((a, i) => a.classList.toggle('on', i === hi)); }
      else if (e.key === 'Enter' && as[hi]) { e.preventDefault(); location.hash = as[hi].getAttribute('href'); }
      else if (e.key === 'Escape') RS.hidden = true;
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.srch') && RS) RS.hidden = true; }, { once: true });
  }

  // ---------------------------------------------------------------- slide covers on books (loaded lazily)
  const IO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; IO.unobserve(e.target);
    window.STAR_VIEW.slide(e.target.dataset.s).then((u) => { e.target.src = u; }, () => {});
  }), { rootMargin: '300px' }) : null;
  function hydrate() { if (IO) document.querySelectorAll('img[data-s]:not([data-o])').forEach((el) => { el.dataset.o = 1; IO.observe(el); }); }

  // ---------------------------------------------------------------- My Library (bookmarks, done) saved on the server
  let saveT = 0;
  function saveLib() {
    store.setJson('boot', Object.assign({}, store.json('boot') || {}, { me: ME, cat: CAT, lib: LIB }));
    clearTimeout(saveT);
    saveT = setTimeout(() => api('library', [LIB]).catch((e) => { if (!isOut(e)) toast("Couldn't save your change. Check your connection."); }), 600);
  }
  const LIBAPI = {
    inShelf: (id) => LIB.shelf.includes(id),
    toggleShelf: (id) => { const i = LIB.shelf.indexOf(id); if (i > -1) LIB.shelf.splice(i, 1); else LIB.shelf.unshift(id); saveLib(); return i < 0; },
    isDone: (id) => LIB.done.includes(id),
    setDone: (id, on) => { const i = LIB.done.indexOf(id); if (on && i < 0) LIB.done.push(id); if (!on && i > -1) LIB.done.splice(i, 1); saveLib(); }
  };

  // ---------------------------------------------------------------- router
  let lastPage = '#/', routed = 0;   // routed = moves inside the app, so Close can use the back button
  function route() {
    if (!CAT) return;
    const h = decodeURIComponent(location.hash || '#/');
    const p = h.replace(/^#\/?/, '').split('/');
    if (p[0] === 't' && p[1]) {
      const t = TR[p[1]];
      if (!t) { location.replace('#/'); return; }
      if (!document.querySelector('#view .sec, #view section')) { if (t.m && MOD[t.m]) moduleView(t.m); else stageView('OTHER'); }
      window.STAR_VIEW.open(t, { module: MOD[t.m] || null, title: trTitle(t), recFor, ready, lib: LIBAPI, api, toast, back: lastPage, fromApp: routed > 0,
        canHost: ME && (ME.role === 'L&D' || ME.role === 'Centre'),
        host: async (B) => { B.disabled = true; try { if (!(await window.STAR_LIVE.start(t.i))) B.disabled = false; } catch (e) { toast(why(e)); B.disabled = false; } } });
      return;
    }
    window.STAR_VIEW.close();
    lastPage = h;
    if (p[0] === 's') stageView(p[1], p[2]);
    else if (p[0] === 'm' && p[1]) moduleView(p[1]);
    else if (p[0] === 'curriculum') stageView(store.get('stage') || 'S2');
    else if (p[0] === 'me') MORE.me();
    else if (p[0] === 'test' && p[1]) MORE.test(p[1]);
    else if (p[0] === 'team') MORE.team();
    else if (p[0] === 'person' && p[1]) MORE.person(p[1]);
    else if (p[0] === 'edit') MORE.editor(p[1], p[2] && p[2].split('?')[0]);
    else if (p[0] === 'live' && p[1]) { homeView(); window.STAR_LIVE.present(p[1]); return; }
    else if (p[0] === 'join') { homeView(); if (!window.STAR_LIVE.active()) window.STAR_LIVE.join(p[1] || ''); return; }
    else homeView();
    if (!/^#\/t\//.test(h)) scrollTo({ top: 0 });
  }
  addEventListener('hashchange', () => {
    routed++;
    if (!/^#\/(live|join)/.test(location.hash) && window.STAR_LIVE.active()) window.STAR_LIVE.close();
    if (!CAT && /^#\/join/.test(location.hash)) { const m = /^#\/join(?:\/(\d{6}))?/.exec(location.hash); window.STAR_LIVE.join((m && m[1]) || ''); return; }
    route();
  });
  document.querySelector('.nav a[data-nav="curriculum"]').addEventListener('click', (e) => { e.preventDefault(); location.hash = '#/s/' + (store.get('stage') || 'S2'); });

  /** Re-read the catalogue after an editor change (the server cache is cleared on save). */
  async function refreshCat() {
    try { const r = await call('boot', [TOK]); CAT = r.cat; index(); store.setJson('boot', Object.assign({}, r, { lib: LIB })); } catch (e) {}
  }
  const MORE = window.STAR_MORE({
    esc, why, toast, api, view, moduleBook, trainingBook, readyIn, refresh: refreshCat,
    ME: () => ME, LIB: () => LIB, TR: () => TR, MOD: () => MOD, CAT: () => CAT
  });
  window.STAR_APP = { boot, toast };
  boot();
})();
