/**
 * STAR Library: Live sessions.
 *  - Present screen (#/live/CODE): the facilitator, signed in (L&D or a centre account), on the projector.
 *  - Phone view (#/join or #/join/CODE): teachers in the room, no sign-in. Name, centre, avatar.
 * Phones and the present screen ask the server for changes every few seconds; an unchanged room is one cheap call.
 */
(function () {
  'use strict';
  const { call, store } = window.STAR;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const L = $('live');
  const ANIMALS = ['monkey', 'elephant', 'bird', 'penguin'];
  const AVATARS = [1, 2, 3].flatMap((v) => ANIMALS.map((a) => a + '-' + v));
  const MSG = {
    NOT_AVAILABLE: 'This session has ended, or the code is wrong.',
    OFFLINE: 'No connection. Trying again…',
    SLOW: 'The server is slow. Trying again…',
    BUSY: 'Busy for a moment. Please try again.',
    NOT_ALLOWED: 'Only L&D and centre accounts can run a live session.',
    EMPTY_QUESTION: 'Write your question first.',
    SIGNED_OUT: 'Please sign in again.'
  };
  const why = (e) => { const m = String(e && e.message || e); return m.indexOf('MSG:') === 0 ? m.slice(4) : (MSG[m] || 'Something went wrong. Please try again.'); };
  const code6 = (s) => String(s || '').replace(/\D/g, '').slice(0, 6);
  let offset = 0;                                     // server clock minus this phone's clock (for timers)
  const now = () => Date.now() + offset;
  let pollT = 0, tickT = 0, keyFn = null, gen = 0;    // gen: a newer screen stops older loops

  function face(a, h, x) {
    if (!a) return '';
    const animal = a.split('-')[0];
    return 'img/av/' + (h ? animal + '-talking' : x && x > now() ? a + '-excited' : a + '-happy') + '.webp';
  }
  function avatar(p, size, title) {
    const s = size || 40, src = face(p.a, p.h, p.x);
    const t = esc(title == null ? p.n : title);
    if (src) return '<img class="lv-av" src="' + src + '" alt="' + t + '" title="' + t + '" width="' + s + '" height="' + s + '">';
    const ini = String(p.n || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return '<span class="lv-av lv-ini" style="width:' + s + 'px;height:' + s + 'px" title="' + t + '">' + esc(ini) + '</span>';
  }
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function stop() { clearTimeout(pollT); clearInterval(tickT); if (keyFn) removeEventListener('keydown', keyFn); keyFn = null; gen++; }
  function open() { L.hidden = false; document.body.classList.add('live-on'); scrollTo(0, 0); }
  function close(to) {
    stop(); L.hidden = true; L.innerHTML = ''; document.body.classList.remove('live-on');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (to != null) location.hash = to;
  }

  // ---------------------------------------------------------------- slide pictures
  const IMG = {};
  async function pics(keys, getter) {
    const want = keys.filter((k) => !IMG[k]);
    if (want.length) { try { Object.assign(IMG, await getter(want)); } catch (e) {} }
    return keys.map((k) => IMG[k] || '');
  }

  // ================================================================ PHONE (no sign-in)
  let P = null, R = null, VIEW = 0, FOLLOW = true, VER = 0, BEAT = 0, SCREEN = '';
  const saveP = () => store.setJson('live', P);
  const pcall = (fn, args) => call(fn, [P.code, P.pid].concat(args || []));
  const notesKey = () => 'live-notes-' + (P && P.code);

  async function join(code) {
    stop(); open(); SCREEN = 'join';
    const saved = store.json('live');
    code = code6(code);
    if (saved && saved.pid && (!code || saved.code === code)) {
      P = saved;
      L.innerHTML = '<div class="lv-phone"><p class="lv-wait">Reconnecting to session ' + esc(P.code) + '…</p></div>';
      try { const r = await pcall('livePoll', [0, 1]); return afterJoin(r); }
      catch (e) { if (String(e.message) !== 'NOT_AVAILABLE') return joinForm(code || saved.code, why(e)); store.set('live', ''); P = null; }
    }
    joinForm(code);
  }

  function joinForm(code, err) {
    SCREEN = 'join';
    const last = store.json('live-me') || {};
    let pick = last.a || '';
    L.innerHTML = '<div class="lv-phone"><div class="lv-head"><img src="img/logo.webp" alt="STAR Library" class="lv-logo"></div>' +
      '<form class="lv-card" id="lv-join" novalidate><h1 class="lv-h1">Join live session</h1>' +
      '<label class="lv-fld">Session code<input id="lv-code" class="lv-codein" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="123 456" value="' + esc(code) + '"></label>' +
      '<label class="lv-fld">Your name<input id="lv-name" autocomplete="name" maxlength="40" placeholder="e.g. Siti Rahma" value="' + esc(last.n || '') + '"></label>' +
      '<label class="lv-fld">Centre <span class="lv-opt">(optional, e.g. BDG)</span><input id="lv-ce" autocomplete="off" maxlength="10" value="' + esc(last.c || '') + '"></label>' +
      '<fieldset class="lv-fld lv-avs"><legend>Pick your avatar <span class="lv-opt">(optional)</span></legend><div class="lv-avgrid">' +
      AVATARS.map((a) => '<button type="button" class="lv-avbtn" data-a="' + a + '" aria-pressed="' + (a === pick) + '" aria-label="' + a.replace('-', ' ') + '"><img src="img/av/' + a + '-happy.webp" alt="" width="48" height="48"></button>').join('') +
      '</div></fieldset><p class="gerr" id="lv-err" role="alert"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p>' +
      '<button class="btn lv-big" id="lv-go">Join</button></form>' +
      '<p class="lv-small">No sign-in needed. Your name is used for attendance and the tests.</p></div>';
    L.querySelectorAll('.lv-avbtn').forEach((b) => { b.onclick = () => { pick = pick === b.dataset.a ? '' : b.dataset.a; L.querySelectorAll('.lv-avbtn').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.a === pick))); }; });
    $(code ? 'lv-name' : 'lv-code').focus();
    $('lv-join').onsubmit = async (ev) => {
      ev.preventDefault();
      const c = code6($('lv-code').value), n = $('lv-name').value.trim(), ce = $('lv-ce').value.trim().toUpperCase(), E = $('lv-err'), B = $('lv-go');
      E.hidden = true;
      if (c.length !== 6) { E.textContent = 'Type the 6-digit code from the screen.'; E.hidden = false; return; }
      if (!n) { E.textContent = 'Type your name.'; E.hidden = false; return; }
      B.disabled = true; B.textContent = 'Joining…';
      try {
        const r = await call('liveJoin', [c, n, ce, pick]);
        P = { code: c, pid: r.pid }; saveP(); store.setJson('live-me', { n, c: ce, a: pick });
        if (location.hash !== '#/join/' + c) history.replaceState(null, '', '#/join/' + c);
        afterJoin(r.room);
      } catch (e) { E.textContent = why(e); E.hidden = false; B.disabled = false; B.textContent = 'Join'; }
    };
  }

  function afterJoin(r) {
    R = r; VER = r.v; offset = r.now - Date.now();
    if (r.ph === 'ended') return done();
    if (r.ph === 'post') return r.me.post || !r.pre ? done() : test('post');
    if (r.pre && !r.me.pre && !store.get('live-skip-' + P.code)) return test('pre');
    liveView();
  }

  // ---------------------------------------------------------------- pre / post test
  async function test(which) {
    stop(); const my = gen; SCREEN = which;
    L.innerHTML = '<div class="lv-phone"><p class="lv-wait">Opening the ' + (which === 'pre' ? 'pre' : 'post') + '-test…</p></div>';
    let t;
    try { t = await pcall('liveTest', [which]); } catch (e) { return which === 'post' ? done() : liveView(); }
    if (my !== gen) return;
    if (!t.qs.length) return which === 'post' ? done() : liveView();
    const ans = {}; let i = 0;
    const draw = () => {
      const q = t.qs[i], last = i === t.qs.length - 1;
      L.innerHTML = '<div class="lv-phone">' + meBar(which === 'pre' ? 'Before we start' : 'Session finished') +
        '<div class="lv-card"><div class="lv-row"><span class="lv-pill ' + (which === 'pre' ? 'dark' : 'lime') + '">' + (which === 'pre' ? 'PRE-TEST' : 'POST-TEST') + '</span>' +
        '<span class="lv-muted">Question ' + (i + 1) + ' of ' + t.qs.length + '</span></div>' +
        '<div class="lv-prog"><i style="width:' + Math.round(100 * (i + 1) / t.qs.length) + '%"></i></div>' +
        '<h2 class="lv-q">' + esc(q.q) + '</h2><div class="lv-opts" role="radiogroup" aria-label="Answers">' +
        q.o.map((o, k) => o ? '<button type="button" class="opt" role="radio" data-k="' + 'ABCD'[k] + '" aria-checked="' + (ans[q.id] === 'ABCD'[k]) + '"><b>' + 'ABCD'[k] + '</b><span>' + esc(o) + '</span></button>' : '').join('') +
        '</div><p class="gerr" id="lv-err" role="alert" hidden></p><div class="tqnav">' +
        (i ? '<button type="button" class="btn soft" id="lv-back">← Back</button>' : '<span></span>') +
        '<button type="button" class="btn" id="lv-next"' + (ans[q.id] ? '' : ' disabled') + '>' + (last ? 'Finish' : 'Next') + '</button></div>' +
        (which === 'pre' && i === 0 ? '<button type="button" class="lv-link" id="lv-skip">Skip the pre-test</button>' : '') + '</div>' +
        (which === 'pre' ? '<p class="lv-note">This checks what you know now. You\'ll answer the same questions after the session to see how much you\'ve grown. Scores are only seen by you and L&amp;D.</p>' : '') + '</div>';
      L.querySelectorAll('.opt').forEach((b) => { b.onclick = () => { ans[q.id] = b.dataset.k; draw(); }; });
      if ($('lv-back')) $('lv-back').onclick = () => { i--; draw(); };
      if ($('lv-skip')) $('lv-skip').onclick = () => { store.set('live-skip-' + P.code, '1'); liveView(); };
      $('lv-next').onclick = async () => {
        if (!last) { i++; return draw(); }
        const B = $('lv-next'); B.disabled = true; B.textContent = 'Checking…';
        try {
          const r = await pcall('liveSubmit', [which, ans]);
          if (which === 'pre') { R.me.pre = { s: r.s, t: r.t }; result(which, r); } else { R.me.post = { s: r.s, t: r.t }; R.me.pre = r.pre || R.me.pre; done(); }
        } catch (e) {
          if (/already did/.test(String(e.message))) return which === 'pre' ? liveView() : done();
          if (String(e.message) === 'NOT_AVAILABLE') return which === 'pre' ? liveView() : done(true);
          $('lv-err').textContent = why(e); $('lv-err').hidden = false; B.disabled = false; B.textContent = 'Finish';
        }
      };
    };
    draw();
  }
  function result(which, r) {
    L.innerHTML = '<div class="lv-phone">' + meBar('Pre-test done') + '<div class="lv-card lv-center"><span class="lv-score">' + r.s + '/' + r.t + '</span>' +
      '<p>Thanks! Let\'s see how this changes after the session.</p><button type="button" class="btn lv-big" id="lv-go">Go to the session</button></div></div>';
    $('lv-go').onclick = liveView;
  }
  function meBar(sub) {
    const me = (R && R.me) || {};
    return '<div class="lv-me">' + avatar(me, 44) + '<span><b>' + esc(me.n || '') + '</b><small>' + esc((me.c ? me.c + ' · ' : '') + sub) + '</small></span></div>';
  }

  // ---------------------------------------------------------------- phone: following the session
  function liveView() {
    stop(); const my = gen; SCREEN = 'live'; FOLLOW = true; VIEW = R.s;
    L.innerHTML = '<div class="lv-phone lv-livep">' +
      '<div class="lv-top"><span class="lv-pill dark"><i class="lv-dot"></i>LIVE</span><span class="lv-tt">' + esc(R.t + ' · ' + R.tt) + '</span><span id="lv-meav"></span></div>' +
      '<div class="lv-timer" id="lv-timer" hidden><span id="lv-tl"></span><b id="lv-tv"></b></div>' +
      '<div class="lv-net" id="lv-net" hidden></div>' +
      '<div class="lv-slide" id="lv-slide"><span class="lv-wait">Loading slide…</span></div>' +
      '<div class="lv-nav"><button type="button" class="lv-round" id="lv-prev" aria-label="Previous slide">◀</button><span id="lv-pos"></span>' +
      '<button type="button" class="lv-round" id="lv-nxt" aria-label="Next slide">▶</button></div>' +
      '<div class="lv-card lv-here"><b id="lv-hn"></b><div class="lv-strip" id="lv-strip"></div></div>' +
      '<div class="lv-acts"><button type="button" class="btn lv-big" id="lv-hand">✋ Raise hand</button><button type="button" class="btn soft lv-big" id="lv-ask">Ask a question</button></div>' +
      '<form class="lv-card" id="lv-askf" hidden><label class="lv-fld">Your question<textarea id="lv-askt" maxlength="300" rows="3"></textarea></label>' +
      '<div class="tqnav"><button type="button" class="btn soft" id="lv-askx">Cancel</button><button class="btn" id="lv-asks">Send</button></div></form>' +
      '<label class="lv-fld lv-mynote">My note on this slide <span class="lv-opt">Only on this phone. You can copy all your notes at the end.</span><textarea id="lv-note" rows="3"></textarea></label>' +
      '</div>';
    $('lv-prev').onclick = () => go(VIEW - 1);
    $('lv-nxt').onclick = () => go(VIEW + 1);
    $('lv-hand').onclick = async () => {
      const B = $('lv-hand'); B.disabled = true;
      try { const r = await pcall('liveAct', ['hand']); R.me.h = r.h; draw(); } catch (e) { toast(why(e)); }
      B.disabled = false;
    };
    $('lv-ask').onclick = () => { $('lv-askf').hidden = false; $('lv-askt').focus(); };
    $('lv-askx').onclick = () => { $('lv-askf').hidden = true; };
    $('lv-askf').onsubmit = async (ev) => {
      ev.preventDefault();
      const B = $('lv-asks'); B.disabled = true;
      try { await pcall('liveAct', ['ask', $('lv-askt').value]); $('lv-askt').value = ''; $('lv-askf').hidden = true; toast('Sent to the facilitator.'); }
      catch (e) { toast(why(e)); }
      B.disabled = false;
    };
    const notes = store.json(notesKey()) || {};
    $('lv-note').oninput = () => { const v = $('lv-note').value; if (v.trim()) notes[VIEW] = v; else delete notes[VIEW]; store.setJson(notesKey(), notes); };
    function go(n) { n = Math.max(1, Math.min(R.max, n)); FOLLOW = n === R.s; VIEW = n; draw(); }
    draw();
    tickT = setInterval(timer, 500);
    poll(my);

    function draw() {
      if (SCREEN !== 'live') return;
      if (FOLLOW) VIEW = R.s;
      $('lv-meav').innerHTML = avatar(R.me, 36, 'You');
      $('lv-pos').innerHTML = '<b>Slide ' + VIEW + ' of ' + R.n + '</b> · ' + (FOLLOW ? '<span class="lv-ok">following live</span>' : '<button type="button" class="lv-link" id="lv-back2">Back to live</button>');
      if ($('lv-back2')) $('lv-back2').onclick = () => { FOLLOW = true; draw(); };
      $('lv-prev').disabled = VIEW <= 1; $('lv-nxt').disabled = VIEW >= R.max;
      const ppl = R.people || [];
      $('lv-hn').textContent = 'Here now · ' + ppl.length;
      $('lv-strip').innerHTML = ppl.slice().sort((a, b) => (b.h ? 1 : 0) - (a.h ? 1 : 0)).slice(0, 24).map((p) => avatar(p, 38)).join('') + (ppl.length > 24 ? '<span class="lv-more">+' + (ppl.length - 24) + '</span>' : '');
      $('lv-hand').textContent = R.me.h ? '✋ Lower hand' : '✋ Raise hand';
      $('lv-hand').classList.toggle('soft', !!R.me.h);
      if (document.activeElement !== $('lv-note')) $('lv-note').value = notes[VIEW] || '';
      timer(); show(VIEW);
    }
    async function show(n) {
      const k = R.t + ':' + n;
      const [src] = await pics([k], (ks) => pcall('liveSlides', [ks]));
      if (SCREEN !== 'live' || VIEW !== n) return;
      $('lv-slide').innerHTML = src ? '<img src="' + src + '" alt="Slide ' + n + '">' : '<span class="lv-wait">Slide ' + n + ' is loading…</span>';
      if (!src) setTimeout(() => { if (VIEW === n && SCREEN === 'live') show(n); }, 3000);
    }
    function timer() {
      const T = $('lv-timer'); if (!T) return;
      const left = R.tm ? R.tm.e - now() : 0;
      T.hidden = !R.tm || left < -5000;
      if (!T.hidden) { $('lv-tl').textContent = R.tm.l; $('lv-tv').textContent = left > 0 ? mmss(left) : 'Time!'; T.classList.toggle('over', left <= 0); }
    }
    liveView.draw = draw;
  }

  async function poll(my) {
    if (my !== gen || !P) return;
    const beat = Date.now() - BEAT > 20000;
    try {
      const r = await pcall('livePoll', [VER, beat ? 1 : 0]);
      if (my !== gen) return;
      if (beat) BEAT = Date.now();
      if ($('lv-net')) $('lv-net').hidden = true;
      offset = r.now - Date.now();
      if (!r.same) {
        R = r; VER = r.v;
        if (r.ph === 'post') return r.pre && !r.me.post ? test('post') : done();
        if (r.ph === 'ended') return done();
        if (liveView.draw) liveView.draw();
      }
    } catch (e) {
      if (my !== gen) return;
      if (String(e.message) === 'NOT_AVAILABLE') return done(true);
      if ($('lv-net')) { $('lv-net').textContent = why(e); $('lv-net').hidden = false; }
    }
    pollT = setTimeout(() => poll(my), document.hidden ? 10000 : 3000);
  }

  function done(gone) {
    stop(); SCREEN = 'done';
    const me = (R && R.me) || {}, notes = store.json(notesKey()) || {};
    const ns = Object.keys(notes).map(Number).sort((a, b) => a - b);
    const sc = (x, label, cls) => '<div class="lv-scbox ' + cls + '"><small>' + label + '</small><b>' + (x ? x.s + '/' + x.t : '–') + '</b></div>';
    L.innerHTML = '<div class="lv-phone"><div class="lv-done">' + avatar(Object.assign({}, me, { x: now() + 20000 }), 64, '') +
      '<span><b>' + (gone ? 'This session has ended' : 'Session finished') + '</b><small>Thank you' + (me.n ? ', ' + esc(me.n.split(' ')[0]) : '') + '! Your attendance is saved.</small></span></div>' +
      (me.pre || me.post ? '<div class="lv-card"><b>Your tests</b><div class="lv-scores">' + sc(me.pre, 'Pre-test', '') + sc(me.post, 'Post-test', 'up') + '</div></div>' : '') +
      (ns.length ? '<div class="lv-card"><b>My notes</b><div class="lv-notes">' + ns.map((n) => '<p><small>Slide ' + n + '</small>' + esc(notes[n]) + '</p>').join('') + '</div>' +
        '<button type="button" class="btn soft" id="lv-copy">Copy my notes</button></div>' : '') +
      '<button type="button" class="btn lv-big" id="lv-close">Close</button></div>';
    if ($('lv-copy')) $('lv-copy').onclick = () => {
      const txt = (R ? R.t + ' · ' + R.tt + '\n\n' : '') + ns.map((n) => 'Slide ' + n + ': ' + notes[n]).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Notes copied.'), () => toast('Could not copy. Select the text instead.'));
    };
    $('lv-close').onclick = () => { store.set('live', ''); P = null; leaveToApp(); };
  }
  function leaveToApp() {
    close();
    if (store.get('tok')) { location.hash = '#/'; if (window.STAR_APP) window.STAR_APP.boot(); }
    else location.replace(location.pathname);
  }
  function toast(t) { if (window.STAR_APP && window.STAR_APP.toast) window.STAR_APP.toast(t); }

  // ================================================================ PRESENT SCREEN (facilitator)
  let H = null, HVER = 0, NOTES = [], panelNotes = false, joinBig = true, endArmed = 0;
  const hcall = (fn, args) => call(fn, [store.get('tok'), H ? H.c : ''].concat(args || []));

  async function start(trainingId) {
    const r = await call('liveStart', [store.get('tok'), trainingId]);
    location.hash = '#/live/' + r.code;
  }

  async function present(code) {
    stop(); open(); const my = gen; code = code6(code); SCREEN = 'present';
    L.innerHTML = '<div class="lv-pres"><p class="lv-wait">Opening session ' + esc(code) + '…</p></div>';
    let r;
    try { r = await call('liveHost', [store.get('tok'), code, 0]); }
    catch (e) { L.innerHTML = '<div class="lv-pres"><div class="lv-card lv-center"><p>' + esc(why(e)) + '</p><button type="button" class="btn" id="lv-x">Back</button></div></div>'; $('lv-x').onclick = () => close('#/'); return; }
    if (my !== gen) return;
    H = r; HVER = r.v; offset = r.now - Date.now(); panelNotes = false; joinBig = r.ph === 'live' && r.people.length < 3; endArmed = 0;
    call('material', [store.get('tok'), H.t]).then((m) => { NOTES = m.notes || []; if (SCREEN === 'present') drawP(); }, () => { NOTES = []; });
    const url = location.origin + location.pathname + '#/join/' + H.c;
    let qr = '';
    try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'QR code to join' }); } catch (e) {}
    L.innerHTML = '<div class="lv-pres">' +
      '<div class="lv-ptop"><img src="img/logo.webp" alt="STAR Library" class="lv-plogo"><span class="lv-ptt"><small>' + esc(H.t) + '</small><b>' + esc(H.tt) + '</b></span>' +
      '<span class="lv-pill lime" id="lv-ph"></span><button type="button" class="lv-icon" id="lv-fs" aria-label="Full screen">⛶</button><button type="button" class="lv-icon" id="lv-out" aria-label="Leave present screen">✕</button></div>' +
      '<div class="lv-pbody"><div class="lv-pmain"><div class="lv-pslide" id="lv-ps"><span class="lv-wait">Loading slide…</span><div class="lv-ptimer" id="lv-pt" hidden><small id="lv-ptl"></small><b id="lv-ptv"></b></div></div>' +
      '<div class="lv-pnotes" id="lv-pn" hidden></div>' +
      '<div class="lv-pbar"><button type="button" class="lv-round" id="lv-pprev" aria-label="Previous slide">◀</button><b id="lv-ppos"></b><button type="button" class="lv-round" id="lv-pnext" aria-label="Next slide">▶</button>' +
      '<span class="lv-grow"></span><span class="lv-tbtns" id="lv-tb"></span>' +
      '<button type="button" class="btn soft" id="lv-pnt">Notes</button><button type="button" class="btn soft" id="lv-pjc">Join code</button><button type="button" class="btn" id="lv-pend"></button></div></div>' +
      '<aside class="lv-pside"><div class="lv-joincard" id="lv-jc"><span class="lv-qr">' + qr + '</span><span><small>Join on your phone</small><b>' + H.c.slice(0, 3) + ' ' + H.c.slice(3) + '</b><small>Scan, or open STAR Library › Join</small></span></div>' +
      '<div class="lv-card" id="lv-hands"></div><div class="lv-card" id="lv-qs"></div><div class="lv-card lv-grow" id="lv-ppl"></div></aside></div>' +
      '<div class="lv-bigjoin" id="lv-bj" hidden><div><span class="lv-qr">' + qr + '</span><p>Join on your phone</p><b>' + H.c.slice(0, 3) + ' ' + H.c.slice(3) + '</b>' +
      '<small>' + esc(url.replace(/^https?:\/\//, '').replace(/#.*$/, '')) + ' › Join</small><button type="button" class="btn" id="lv-bjx">Start</button></div></div>' +
      '<div class="lv-sum" id="lv-sum" hidden></div></div>';
    $('lv-pprev').onclick = () => slideTo(H.s - 1);
    $('lv-pnext').onclick = () => slideTo(H.s + 1);
    $('lv-pnt').onclick = () => { panelNotes = !panelNotes; drawP(); };
    $('lv-pjc').onclick = () => { joinBig = true; drawP(); };
    $('lv-bjx').onclick = () => { joinBig = false; drawP(); };
    $('lv-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (L.requestFullscreen) L.requestFullscreen().catch(() => {}); };
    $('lv-out').onclick = () => close('#/');
    $('lv-pend').onclick = endClick;
    keyFn = (e) => {
      if (SCREEN !== 'present' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); slideTo(H.s + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); slideTo(H.s - 1); }
    };
    addEventListener('keydown', keyFn);
    drawP();
    tickT = setInterval(ptimer, 500);
    hpoll(my);
  }

  async function ctl(action, arg) {
    try { await hcall('liveCtl', [action, arg]); HVER = 0; } catch (e) { toast(why(e)); }
  }
  function slideTo(n) {
    if (!H || H.ph !== 'live') return;
    n = Math.max(1, Math.min(H.n, n));
    if (n === H.s) return;
    H.s = n; drawP(); ctl('slide', n);
  }
  function endClick() {
    if (H.ph === 'live') {
      if (Date.now() - endArmed > 4000) { endArmed = Date.now(); $('lv-pend').textContent = 'Tap again to end'; setTimeout(drawP, 4100); return; }
      endArmed = 0; H.ph = 'post'; drawP(); ctl('post');
    } else if (H.ph === 'post') {
      if (Date.now() - endArmed > 4000) { endArmed = Date.now(); $('lv-pend').textContent = 'Tap again to close'; setTimeout(drawP, 4100); return; }
      endArmed = 0; H.ph = 'ended'; $('lv-pend').disabled = true; ctl('end').then(summary);
    }
  }

  function drawP() {
    if (SCREEN !== 'present' || !H) return;
    $('lv-ph').innerHTML = H.ph === 'live' ? '<i class="lv-dot red"></i>LIVE · ' + mmss(now() - H.st).replace(/:\d\d$/, '') + ' min' : 'POST-TEST';
    $('lv-ppos').textContent = H.s + ' / ' + H.n;
    $('lv-pprev').disabled = H.ph !== 'live' || H.s <= 1; $('lv-pnext').disabled = H.ph !== 'live' || H.s >= H.n;
    const armed = Date.now() - endArmed < 4000;
    $('lv-pend').textContent = H.ph === 'live' ? (armed ? 'Tap again to end' : H.pre ? 'End → Post-test' : 'End session') : (armed ? 'Tap again to close' : 'Close session');
    $('lv-tb').innerHTML = H.ph !== 'live' ? '' : H.tm ? '<button type="button" class="btn soft" id="lv-tstop">Stop timer</button>'
      : '<span class="lv-tlbl">Timer</span>' + [1, 3, 5, 10].map((m) => '<button type="button" class="lv-chip" data-m="' + m + '">' + m + '′</button>').join('');
    L.querySelectorAll('#lv-tb .lv-chip').forEach((b) => { b.onclick = () => { H.tm = { l: 'Timer', e: now() + b.dataset.m * 60000 }; drawP(); ctl('timer', { sec: b.dataset.m * 60, label: 'Timer' }); }; });
    if ($('lv-tstop')) $('lv-tstop').onclick = () => { H.tm = null; drawP(); ctl('timer', { sec: 0 }); };
    $('lv-pn').hidden = !panelNotes;
    if (panelNotes) $('lv-pn').innerHTML = '<b>Notes · slide ' + H.s + ' (only you)</b><p>' + esc(NOTES[H.s - 1] || 'No notes on this slide.') + '</p>';
    $('lv-bj').hidden = !joinBig || H.ph !== 'live';
    const ppl = H.people || [], hands = ppl.filter((p) => p.h).sort((a, b) => a.h - b.h);
    $('lv-hands').innerHTML = '<div class="lv-row"><b>✋ Hands up · ' + hands.length + '</b>' + (hands.length > 1 ? '<button type="button" class="lv-link" id="lv-lowall">Lower all</button>' : '') + '</div>' +
      (hands.length ? hands.map((p) => '<div class="lv-person">' + avatar(p, 36) + '<span><b>' + esc(p.n) + '</b>' + (p.c ? ' · ' + esc(p.c) : '') + '</span><button type="button" class="lv-chip" data-low="' + p.i + '">Done</button></div>').join('') : '<p class="lv-muted">No hands up.</p>');
    L.querySelectorAll('[data-low]').forEach((b) => { b.onclick = () => { const p = ppl.find((x) => x.i === b.dataset.low); if (p) p.h = 0; drawP(); ctl('lower', b.dataset.low); }; });
    if ($('lv-lowall')) $('lv-lowall').onclick = () => { ppl.forEach((p) => { p.h = 0; }); drawP(); ctl('lower', '*'); };
    const qs = H.q || [];
    $('lv-qs').innerHTML = '<b>Questions · ' + qs.length + '</b>' + (qs.length ? qs.slice(-3).reverse().map((q) => '<div class="lv-qitem"><p>"' + esc(q.tx) + '"</p><small>' + esc(q.n + (q.c ? ' · ' + q.c : '') + ' · slide ' + q.s) + '</small><button type="button" class="lv-chip" data-cq="' + q.i + '">Done</button></div>').join('') : '<p class="lv-muted">Questions from phones show here.</p>');
    L.querySelectorAll('[data-cq]').forEach((b) => { b.onclick = () => { H.q = H.q.filter((x) => x.i !== b.dataset.cq); drawP(); ctl('clearq', b.dataset.cq); }; });
    const done = H.ph === 'post' ? ppl.filter((p) => p.post).length : 0;
    $('lv-ppl').innerHTML = '<b>' + (H.ph === 'post' ? 'Post-test · ' + done + ' of ' + ppl.length + ' done' : 'Here now · ' + (H.here != null ? H.here : ppl.length)) + '</b><div class="lv-grid">' +
      ppl.map((p) => '<span class="lv-gp' + (p.on ? '' : ' away') + (H.ph === 'post' && p.post ? ' fin' : '') + '">' + avatar(p, 44, p.n + (p.c ? ' · ' + p.c : '')) + '<small>' + esc(p.n.split(' ')[0]) + '</small></span>').join('') + '</div>';
    ptimer(); pslide();
  }
  async function pslide() {
    const n = H.s, keys = [n, n + 1, n + 2].filter((x) => x <= H.n).map((x) => H.t + ':' + x);
    const [src] = await pics(keys, (ks) => call('slides', [store.get('tok'), ks]));
    if (SCREEN !== 'present' || H.s !== n) return;
    const img = $('lv-ps').querySelector('img');
    if (src) { if (img) img.src = src; else $('lv-ps').insertAdjacentHTML('afterbegin', '<img src="' + src + '" alt="Slide ' + n + '">'); const w = $('lv-ps').querySelector('.lv-wait'); if (w) w.remove(); }
  }
  function ptimer() {
    const T = $('lv-pt'); if (!T || !H) return;
    const left = H.tm ? H.tm.e - now() : 0;
    T.hidden = !H.tm;
    if (H.tm) { $('lv-ptl').textContent = H.tm.l; $('lv-ptv').textContent = left > 0 ? mmss(left) : 'Time!'; T.classList.toggle('over', left <= 0); }
  }
  async function hpoll(my) {
    if (my !== gen || SCREEN !== 'present') return;
    try {
      const r = await hcall('liveHost', [HVER]);
      if (my !== gen) return;
      offset = r.now - Date.now();
      if (r.same) { if (H.here !== r.here) { H.here = r.here; drawP(); } }
      else { H = r; HVER = r.v; if (H.ph === 'ended') return summary(); drawP(); }
    } catch (e) { if (my !== gen) return; if (String(e.message) === 'NOT_AVAILABLE') return summary(); }
    pollT = setTimeout(() => hpoll(my), 2500);
  }
  function summary() {
    stop(); SCREEN = 'summary';
    const ppl = (H && H.people) || [];
    const avg = (k) => { const xs = ppl.map((p) => p[k]).filter(Boolean); return xs.length ? Math.round(100 * xs.reduce((a, x) => a + x.s / x.t, 0) / xs.length) + '%' : '–'; };
    L.innerHTML = '<div class="lv-pres"><div class="lv-sumcard"><h1 class="lv-h1">Session closed</h1><p class="lv-muted">' + esc((H ? H.t + ' · ' + H.tt : '')) + '</p>' +
      '<div class="lv-scores"><div class="lv-scbox"><small>Teachers</small><b>' + ppl.length + '</b></div><div class="lv-scbox"><small>Pre-test average</small><b>' + avg('pre') + '</b></div><div class="lv-scbox up"><small>Post-test average</small><b>' + avg('post') + '</b></div></div>' +
      '<div class="lv-sumlist">' + ppl.map((p) => '<div class="lv-person">' + avatar(p, 32) + '<span><b>' + esc(p.n) + '</b>' + (p.c ? ' · ' + esc(p.c) : '') + '</span><small>' +
        (p.pre ? 'Pre ' + p.pre.s + '/' + p.pre.t : '') + (p.post ? ' · Post ' + p.post.s + '/' + p.post.t : '') + '</small></div>').join('') + '</div>' +
      '<p class="lv-muted">Attendance, test scores and questions are saved. L&amp;D sees them in Editor › Sessions.</p><button type="button" class="btn lv-big" id="lv-sx">Back to STAR Library</button></div></div>';
    $('lv-sx').onclick = () => close('#/');
  }

  window.STAR_LIVE = { join, present, start, close, active: () => !L.hidden };
})();
