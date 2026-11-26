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
    L.innerHTML = '<div class="lv-phone"><div class="lv-head"><a href="#/" class="btn soft lv-home" id="lv-home">← ' + (store.get('tok') ? 'Home' : 'Sign in') + '</a><a href="#/" class="lv-logolink" id="lv-logo" aria-label="STAR Library home"><img src="img/logo.webp" alt="STAR Library" class="lv-logo"></a></div>' +
      '<form class="lv-card" id="lv-join" novalidate><h1 class="lv-h1">Join training</h1>' +
      '<label class="lv-fld">Session code<input id="lv-code" class="lv-codein" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="123 456" value="' + esc(code) + '"></label>' +
      '<label class="lv-fld">Your name<input id="lv-name" autocomplete="name" maxlength="40" placeholder="e.g. Siti Rahma" value="' + esc(last.n || '') + '"></label>' +
      '<label class="lv-fld">Centre <span class="lv-opt">(optional, e.g. BDG)</span><input id="lv-ce" autocomplete="off" maxlength="10" value="' + esc(last.c || '') + '"></label>' +
      '<fieldset class="lv-fld lv-avs"><legend>Pick your avatar <span class="lv-opt">(optional)</span></legend><div class="lv-avgrid">' +
      AVATARS.map((a) => '<button type="button" class="lv-avbtn" data-a="' + a + '" aria-pressed="' + (a === pick) + '" aria-label="' + a.replace('-', ' ') + '"><img src="img/av/' + a + '-happy.webp" alt="" width="48" height="48"></button>').join('') +
      '</div></fieldset><p class="gerr" id="lv-err" role="alert"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p>' +
      '<button class="btn lv-big" id="lv-go">Join</button></form>' +
      '<p class="lv-small">No sign-in needed. Your name is used for attendance and the tests.</p></div>';
    const home = (ev) => { ev.preventDefault(); stop(); if (!store.get('tok')) { L.hidden = true; location.replace('./'); return; } close(); location.hash = '#/'; };
    $('lv-home').onclick = home; $('lv-logo').onclick = home;
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

  /** Which test should be on the screen now (the facilitator picks the slide for each in the Editor). */
  function due() {
    if (!R || !R.pre) return '';
    if (R.postDue && !R.me.post) return 'post';
    if (R.preDue && !R.me.pre && !store.get('live-skip-' + P.code)) return 'pre';
    return '';
  }
  function afterJoin(r) {
    R = r; VER = r.v; offset = r.now - Date.now();
    if (r.ph === 'ended') return done();
    const d = due();
    if (d) return test(d);
    if (r.ph === 'post') return done();
    follow();
  }
  function next() {           // after a test: back to the session, or the end
    const d = due();
    if (d) return test(d);
    if (R.ph === 'live') return follow();
    done();
  }
  const follow = () => (R && R.on ? waitView() : liveView());

  /** Online sessions (tests only): nothing to follow, so the phone waits here and checks in now and then. */
  function waitView() {
    stop(); const my = gen; SCREEN = 'wait';
    liveView.draw = null; liveView.show = null;
    const did = R.me.pre;
    L.innerHTML = '<div class="lv-phone">' + meBar(R.t + ' · ' + R.tt) + '<div class="lv-card lv-center lv-waitc">' +
      avatar(Object.assign({}, R.me, { x: did ? now() + 20000 : 0 }), 72, '') +
      '<b class="lv-h2">' + (did ? 'Pre-test done ✓' : 'You\'re in!') + '</b>' +
      '<p>' + (did ? 'Your answers are saved. You\'ll see your score after the post-test.' : 'The pre-test is closed now.') + '</p>' +
      '<p class="lv-muted">Wait for the trainer to open the <b>post-test</b>. Keep this page open; it opens by itself.</p>' +
      '<p class="lv-net" id="lv-net" hidden></p></div></div>';
    poll(my);
  }

  // ---------------------------------------------------------------- pre / post test
  async function test(which) {
    stop(); const my = gen; SCREEN = which;
    L.innerHTML = '<div class="lv-phone"><p class="lv-wait">Opening the ' + which + '-test…</p></div>';
    let t;
    try { t = await pcall('liveTest', [which]); } catch (e) { if (which === 'pre') store.set('live-skip-' + P.code, '1'); else R.me.post = R.me.post || { s: 0, t: 0 }; return R.ph === 'live' ? follow() : done(String(e.message) === 'NOT_AVAILABLE'); }
    if (my !== gen) return;
    if (t.done) { R.me[which] = t.done; return next(); }
    if (!t.qs.length) { if (which === 'pre') store.set('live-skip-' + P.code, '1'); else R.me.post = { s: 0, t: 0 }; return next(); }
    const ans = {}; let i = 0;
    const draw = () => {
      const q = t.qs[i], last = i === t.qs.length - 1;
      L.innerHTML = '<div class="lv-phone">' + meBar(which === 'pre' ? 'Pre-test' : 'Post-test') +
        '<div class="lv-card"><div class="lv-row"><span class="lv-pill ' + (which === 'pre' ? 'dark' : 'lime') + '">' + (which === 'pre' ? 'PRE-TEST' : 'POST-TEST') + '</span>' +
        '<span class="lv-muted">Question ' + (i + 1) + ' of ' + t.qs.length + '</span></div>' +
        '<div class="lv-prog"><i style="width:' + Math.round(100 * (i + 1) / t.qs.length) + '%"></i></div>' +
        '<h2 class="lv-q">' + esc(q.q) + '</h2><div class="lv-opts" role="radiogroup" aria-label="Answers">' +
        q.o.map((o, k) => o ? '<button type="button" class="opt" role="radio" data-k="' + 'ABCD'[k] + '" aria-checked="' + (ans[q.id] === 'ABCD'[k]) + '"><b>' + 'ABCD'[k] + '</b><span>' + esc(o) + '</span></button>' : '').join('') +
        '</div><p class="gerr" id="lv-err" role="alert" hidden></p><div class="tqnav">' +
        (i ? '<button type="button" class="btn soft" id="lv-back">← Back</button>' : '<span></span>') +
        '<button type="button" class="btn" id="lv-next"' + (ans[q.id] ? '' : ' disabled') + '>' + (last ? 'Finish' : 'Next') + '</button></div>' +
        (which === 'pre' && i === 0 && !R.on ? '<button type="button" class="lv-link" id="lv-skip">Skip the pre-test</button>' : '') + '</div>' +
        (which === 'pre' ? '<p class="lv-note">This checks what you know now. You\'ll answer the same questions later to see how much you\'ve grown.' +
          (R.on ? ' You\'ll see your score after the post-test.' : '') + ' Scores are only seen by you and L&amp;D.</p>' : '') + '</div>';
      L.querySelectorAll('.opt').forEach((b) => { b.onclick = () => { ans[q.id] = b.dataset.k; draw(); }; });
      if ($('lv-back')) $('lv-back').onclick = () => { i--; draw(); };
      if ($('lv-skip')) $('lv-skip').onclick = () => { store.set('live-skip-' + P.code, '1'); pcall('liveSkip').catch(() => {}); next(); };
      $('lv-next').onclick = async () => {
        if (!last) { i++; return draw(); }
        const B = $('lv-next'); B.disabled = true; B.textContent = 'Checking…';
        try {
          const r = await pcall('liveSubmit', [which, ans]);
          if (r.done) { R.me[which] = { d: 1 }; return next(); }          // online pre-test: score shown after the post-test
          R.me[which] = { s: r.s, t: r.t }; if (r.pre) R.me.pre = r.pre;
          if (which === 'post' && R.ph !== 'live') return done();
          result(which, r);
        } catch (e) {
          if (/already did/.test(String(e.message))) { R.me[which] = R.me[which] || { s: 0, t: 0 }; return next(); }
          if (String(e.message) === 'NOT_AVAILABLE') return which === 'pre' ? (store.set('live-skip-' + P.code, '1'), next()) : done(true);
          $('lv-err').textContent = why(e); $('lv-err').hidden = false; B.disabled = false; B.textContent = 'Finish';
        }
      };
    };
    draw();
  }
  function result(which, r) {
    L.innerHTML = '<div class="lv-phone">' + meBar(which === 'pre' ? 'Pre-test done' : 'Post-test done') + '<div class="lv-card lv-center">' +
      (which === 'post' && R.me.pre ? '<div class="lv-scores">' + scbox(R.me.pre, 'Pre-test', '') + scbox(r, 'Post-test', 'up') + '</div>' : '<span class="lv-score">' + r.s + '/' + r.t + '</span>') +
      '<p>' + (which === 'pre' ? 'Thanks! Let\'s see how this changes during the session.' : 'Well done! The session goes on.') + '</p><button type="button" class="btn lv-big" id="lv-go">Back to the session</button></div></div>';
    $('lv-go').onclick = next;
  }
  const scbox = (x, label, cls) => '<div class="lv-scbox ' + cls + '"><small>' + label + '</small><b>' + (x && x.t ? x.s + '/' + x.t : '–') + '</b></div>';
  function meBar(sub) {
    const me = (R && R.me) || {};
    return '<div class="lv-me">' + avatar(me, 44) + '<span><b>' + esc(me.n || '') + '</b><small>' + esc((me.c ? me.c + ' · ' : '') + sub) + '</small></span></div>';
  }

  /** The box the slide picture really fills inside its frame (pictures keep their shape). */
  function fitBox(frame, img) {
    const W = frame.clientWidth, Hh = frame.clientHeight, iw = (img && img.naturalWidth) || 16, ih = (img && img.naturalHeight) || 9;
    const k = Math.min(W / iw, Hh / ih), w = iw * k, h = ih * k;
    return { left: (W - w) / 2, top: (Hh - h) / 2, width: w, height: h };
  }
  function placeOver(el, frame, img) { const b = fitBox(frame, img); Object.assign(el.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' }); }

  // ---------------------------------------------------------------- phone: following the session
  let ACT = null;                                       // the activity on the slide being viewed
  const DRAWN = {};                                     // strokes per drawing activity, kept while the session is open
  function liveView() {
    stop(); const my = gen; SCREEN = 'live'; FOLLOW = true; VIEW = R.s; ACT = null;
    const ANS = store.json('live-ans-' + P.code) || {};
    L.innerHTML = '<div class="lv-phone lv-livep">' +
      '<div class="lv-top"><span class="lv-pill dark"><i class="lv-dot"></i>LIVE</span><span class="lv-tt">' + esc(R.t + ' · ' + R.tt) + '</span><span id="lv-meav"></span></div>' +
      '<div class="lv-timer" id="lv-timer" hidden><span id="lv-tl"></span><b id="lv-tv"></b></div>' +
      '<div class="lv-net" id="lv-net" hidden></div>' +
      '<div class="lv-slide" id="lv-slide"><img id="lv-img" alt="" hidden><span class="lv-wait" id="lv-sw">Loading slide…</span><div class="lv-ov" id="lv-ov" hidden></div></div>' +
      '<div class="lv-nav"><button type="button" class="lv-round" id="lv-prev" aria-label="Previous slide">◀</button><span id="lv-pos"></span>' +
      '<button type="button" class="lv-round" id="lv-nxt" aria-label="Next slide">▶</button></div>' +
      '<div id="lv-act"></div>' +
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
    $('lv-img').onload = () => { if (ACT && $('lv-ov') && !$('lv-ov').hidden) placeOver($('lv-ov'), $('lv-slide'), $('lv-img')); };
    addEventListener('resize', onResize);
    function onResize() { if (SCREEN !== 'live') return removeEventListener('resize', onResize); if (ACT && !$('lv-ov').hidden) placeOver($('lv-ov'), $('lv-slide'), $('lv-img')); }
    function go(n) { n = Math.max(1, Math.min(R.max, n)); FOLLOW = n === R.s; VIEW = n; draw(true); }
    draw();
    tickT = setInterval(timer, 500);
    liveView.draw = draw;
    liveView.show = show;
    poll(my);

    function draw(fetch) {
      if (SCREEN !== 'live') return;
      if (FOLLOW) VIEW = R.s;
      $('lv-meav').innerHTML = avatar(R.me, 36, 'You');
      $('lv-pos').innerHTML = '<b>Slide ' + VIEW + ' of ' + R.n + '</b> · ' + (FOLLOW ? '<span class="lv-ok">following live</span>' : '<button type="button" class="lv-link" id="lv-back2">Back to live</button>');
      if ($('lv-back2')) $('lv-back2').onclick = () => { FOLLOW = true; draw(true); };
      $('lv-prev').disabled = VIEW <= 1; $('lv-nxt').disabled = VIEW >= R.max;
      const ppl = R.people || [];
      $('lv-hn').textContent = 'Here now · ' + ppl.length;
      $('lv-strip').innerHTML = ppl.slice().sort((a, b) => (b.h ? 1 : 0) - (a.h ? 1 : 0)).slice(0, 24).map((p) => avatar(p, 38)).join('') + (ppl.length > 24 ? '<span class="lv-more">+' + (ppl.length - 24) + '</span>' : '');
      $('lv-hand').textContent = R.me.h ? '✋ Lower hand' : '✋ Raise hand';
      $('lv-hand').classList.toggle('soft', !!R.me.h);
      if (document.activeElement !== $('lv-note')) $('lv-note').value = notes[VIEW] || '';
      timer(); show(VIEW, fetch); activity();
    }
    async function show(n, fetch) {
      const k = R.t + ':' + n;
      if (!IMG[k] && fetch) await pics([k], (ks) => pcall('liveSlides', [ks]));
      if (SCREEN !== 'live' || VIEW !== n) return;
      const img = $('lv-img');
      if (IMG[k]) { if (img.getAttribute('src') !== IMG[k]) img.src = IMG[k]; img.hidden = false; img.alt = 'Slide ' + n; $('lv-sw').hidden = true; }
      else { img.hidden = true; $('lv-sw').hidden = false; $('lv-sw').textContent = 'Slide ' + n + ' is loading…'; }
    }
    function timer() {
      const T = $('lv-timer'); if (!T) return;
      const left = R.tm ? R.tm.e - now() : 0;
      T.hidden = !R.tm || left < -5000;
      if (!T.hidden) { $('lv-tl').textContent = R.tm.l; $('lv-tv').textContent = left > 0 ? mmss(left) : 'Time!'; T.classList.toggle('over', left <= 0); }
    }

    // ------------------------------------------------ the activity on this slide
    function activity() {
      const a = (R.acts || []).filter((x) => x.s === VIEW)[0] || null;
      if (a && ACT && a.i === ACT.i) return;                      // already on screen: keep what the teacher is doing
      ACT = a;
      const box = $('lv-act'), ov = $('lv-ov');
      ov.hidden = true; ov.innerHTML = ''; ov.className = 'lv-ov'; ov.onpointerdown = ov.onpointermove = ov.onpointerup = ov.onpointercancel = null;
      if (!a) { box.innerHTML = ''; return; }
      const mine = ANS[a.i];
      const sent = (on) => '<p class="lv-sent" id="lv-sent"' + (on ? '' : ' hidden') + '>✓ Sent. You can change your answer.</p>';
      const head = '<div class="lv-row"><span class="lv-pill lime">' + { poll: 'POLL', text: 'YOUR ANSWER', drag: 'DRAG THE DOT', draw: 'DRAW' }[a.ty] + '</span></div><h2 class="lv-q">' + esc(a.p) + '</h2>';
      const send = async (v, B) => {
        if (B) B.disabled = true;
        try { await pcall('liveAnswer', [a.i, v]); ANS[a.i] = a.ty === 'draw' ? 1 : v; store.setJson('live-ans-' + P.code, ANS); if ($('lv-sent')) $('lv-sent').hidden = false; }
        catch (e) { toast(why(e)); }
        if (B) B.disabled = false;
      };
      if (a.ty === 'poll') {
        box.innerHTML = '<div class="lv-card">' + head + '<div class="lv-opts" role="radiogroup" aria-label="Options">' +
          a.o.map((o, k) => '<button type="button" class="opt" role="radio" data-k="' + k + '" aria-checked="' + (mine === k) + '"><b>' + 'ABCDEF'[k] + '</b><span>' + esc(o) + '</span></button>').join('') + '</div>' + sent(mine != null) + '</div>';
        box.querySelectorAll('.opt').forEach((b) => { b.onclick = () => { box.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-checked', String(x === b))); send(+b.dataset.k); }; });
      } else if (a.ty === 'text') {
        box.innerHTML = '<form class="lv-card" id="lv-tf">' + head + '<label class="lv-fld"><span class="sr">Your answer</span><textarea id="lv-tx" maxlength="280" rows="3">' + esc(mine || '') + '</textarea></label>' +
          '<button class="btn" id="lv-txs">Send</button>' + sent(!!mine) + '</form>';
        $('lv-tf').onsubmit = (ev) => { ev.preventDefault(); const v = $('lv-tx').value.trim(); if (!v) return toast('Write your answer first.'); send(v, $('lv-txs')); };
      } else if (a.ty === 'drag') {
        let pos = mine || [0.5, 0.5];
        box.innerHTML = '<div class="lv-card">' + head + '<p class="lv-muted">Tap or drag on the slide to move your dot, then send.</p><button type="button" class="btn" id="lv-dgs">Send my dot</button>' + sent(!!mine) + '</div>';
        ov.hidden = false; ov.classList.add('drag'); ov.innerHTML = '<span class="lv-dotme" id="lv-dm">' + (R.me.a ? '<img src="' + face(R.me.a) + '" alt="">' : '') + '</span>';
        placeOver(ov, $('lv-slide'), $('lv-img'));
        const put = () => { Object.assign($('lv-dm').style, { left: (pos[0] * 100) + '%', top: (pos[1] * 100) + '%' }); };
        const at = (e) => { const b = ov.getBoundingClientRect(); pos = [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; put(); if ($('lv-sent')) $('lv-sent').hidden = true; };
        let down = false;
        ov.onpointerdown = (e) => { down = true; ov.setPointerCapture(e.pointerId); at(e); };
        ov.onpointermove = (e) => { if (down) at(e); };
        ov.onpointerup = ov.onpointercancel = () => { down = false; };
        put();
        $('lv-dgs').onclick = () => send(pos, $('lv-dgs'));
      } else if (a.ty === 'draw') {
        const strokes = DRAWN[a.i] = DRAWN[a.i] || [];
        let colour = '#141414', erase = false;
        box.innerHTML = '<div class="lv-card">' + head + '<p class="lv-muted">Draw on the slide with your finger, then send.</p>' +
          '<div class="lv-tools" role="toolbar" aria-label="Drawing tools">' + [['#141414', 'Black'], ['#D92D20', 'Red'], ['#2E6B3A', 'Green']].map((c, k) => '<button type="button" class="lv-sw' + (k ? '' : ' on') + '" data-c="' + c[0] + '" aria-label="' + c[1] + '" style="background:' + c[0] + '"></button>').join('') +
          '<button type="button" class="lv-chip" id="lv-er">Eraser</button><button type="button" class="lv-chip" id="lv-un">Undo</button><button type="button" class="lv-chip" id="lv-cl">Clear</button></div>' +
          '<button type="button" class="btn" id="lv-dws">Send my drawing</button>' + sent(!!mine) + '</div>';
        ov.hidden = false; ov.classList.add('draw'); ov.innerHTML = '<canvas id="lv-cv" width="640" height="360"></canvas>';
        placeOver(ov, $('lv-slide'), $('lv-img'));
        const cv = $('lv-cv'), g = cv.getContext('2d');
        const paint = () => {
          g.clearRect(0, 0, cv.width, cv.height); g.lineCap = g.lineJoin = 'round';
          strokes.forEach((s) => {
            g.globalCompositeOperation = s.e ? 'destination-out' : 'source-over'; g.strokeStyle = s.c; g.lineWidth = s.e ? 26 : 5;
            g.beginPath(); s.p.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); if (s.p.length === 1) g.lineTo(s.p[0][0] + 0.1, s.p[0][1]); g.stroke();
          });
          g.globalCompositeOperation = 'source-over';
        };
        const pt = (e) => { const b = cv.getBoundingClientRect(); return [Math.round((e.clientX - b.left) / b.width * cv.width), Math.round((e.clientY - b.top) / b.height * cv.height)]; };
        let cur = null;
        cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); cur = { c: colour, e: erase, p: [pt(e)] }; strokes.push(cur); paint(); if ($('lv-sent')) $('lv-sent').hidden = true; };
        cv.onpointermove = (e) => { if (cur) { cur.p.push(pt(e)); paint(); } };
        cv.onpointerup = cv.onpointercancel = () => { cur = null; };
        box.querySelectorAll('.lv-sw').forEach((b) => { b.onclick = () => { colour = b.dataset.c; erase = false; box.querySelectorAll('.lv-sw,#lv-er').forEach((x) => x.classList.toggle('on', x === b)); }; });
        $('lv-er').onclick = () => { erase = true; box.querySelectorAll('.lv-sw,#lv-er').forEach((x) => x.classList.toggle('on', x.id === 'lv-er')); };
        $('lv-un').onclick = () => { strokes.pop(); paint(); };
        $('lv-cl').onclick = () => { strokes.length = 0; paint(); };
        paint();
        $('lv-dws').onclick = () => {
          if (!strokes.length) return toast('Draw something first.');
          let d = cv.toDataURL('image/png');
          if (d.length > 90000) { const c2 = document.createElement('canvas'); c2.width = 400; c2.height = 225; c2.getContext('2d').drawImage(cv, 0, 0, 400, 225); d = c2.toDataURL('image/png'); }
          if (d.length > 90000) return toast('This drawing is too big. Try fewer lines.');
          send(d, $('lv-dws'));
        };
      }
    }
  }

  async function poll(my) {
    if (my !== gen || !P) return;
    const beat = Date.now() - BEAT > 20000;
    // slide pictures come with the answer: the slide on screen, the live one, and the next one (ready before it is shown)
    const want = R && !R.on ? [VIEW, R.s, R.s + 1].filter((n, i, a) => n >= 1 && n <= R.n && n <= R.max + 1 && a.indexOf(n) === i && !IMG[R.t + ':' + n]) : [];
    try {
      const r = await pcall('livePoll', [VER, beat ? 1 : 0, want]);
      if (my !== gen) return;
      if (beat) BEAT = Date.now();
      if ($('lv-net')) $('lv-net').hidden = true;
      offset = r.now - Date.now();
      if (r.pics) Object.assign(IMG, r.pics);
      if (!r.same) {
        R = Object.assign(r, { me: Object.assign({}, R.me, r.me, { pre: r.me.pre || R.me.pre, post: r.me.post || R.me.post }) }); VER = r.v;
        if (r.ph === 'ended') return done();
        const d = due();
        if (d) return test(d);
        if (r.ph === 'post') return done();
        if (liveView.draw) liveView.draw();
      } else if (r.pics && liveView.show) liveView.show(VIEW);
    } catch (e) {
      if (my !== gen) return;
      if (String(e.message) === 'NOT_AVAILABLE') return done(true);
      if ($('lv-net')) { $('lv-net').textContent = why(e); $('lv-net').hidden = false; }
    }
    // online: every 12–18 s, a different moment on each phone, so 100+ phones don't arrive together
    pollT = setTimeout(() => poll(my), R && R.on ? 12000 + Math.random() * 6000 : document.hidden ? 10000 : 2000);
  }

  function done(gone) {
    stop(); SCREEN = 'done';
    const me = (R && R.me) || {}, notes = store.json(notesKey()) || {};
    const ns = Object.keys(notes).map(Number).sort((a, b) => a - b);
    const sc = scbox;
    L.innerHTML = '<div class="lv-phone"><div class="lv-done">' + avatar(Object.assign({}, me, { x: now() + 20000 }), 64, '') +
      '<span><b>' + (gone ? 'This session has ended' : 'Session finished') + '</b><small>Thank you' + (me.n ? ', ' + esc(me.n.split(' ')[0]) : '') + '! Your attendance is saved.</small></span></div>' +
      ((me.pre && me.pre.t) || (me.post && me.post.t) ? '<div class="lv-card"><b>Your tests</b><div class="lv-scores">' + sc(me.pre, 'Pre-test', '') + sc(me.post, 'Post-test', 'up') + '</div></div>' : '') +
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
  let H = null, HVER = 0, NOTES = [], panelNotes = false, joinBig = true, endArmed = 0, BIGD = '';
  const DRAWS = {};                                   // drawings received per activity: { id: {img, n, a} }
  const hcall = (fn, args) => call(fn, [store.get('tok'), H ? H.c : ''].concat(args || []));
  const TYN = { poll: 'Poll', text: 'Text', drag: 'Draggable', draw: 'Draw' };

  /** Go live: in the room (slides and activities on phones) or online (tests only, for big Zoom/Meet sessions). Resolves false if cancelled. */
  function start(trainingId) {
    return new Promise((resolve) => {
      stop(); open(); SCREEN = 'choose';
      const opt = (m, t, d) => '<button type="button" class="lv-mode" data-m="' + m + '"><b>' + t + '</b><span>' + d + '</span></button>';
      L.innerHTML = '<div class="lv-phone"><div class="lv-card"><h1 class="lv-h1">How will you run this session?</h1>' +
        opt('room', 'In the room', 'Slides on phones, with polls, text, drag and draw, raised hands and questions. Up to 80 teachers.') +
        opt('online', 'Online (tests only)', 'For Zoom or Meet. Teachers only do the pre-test and post-test on their phones. For 100+ teachers.') +
        '<p class="gerr" id="lv-err" role="alert" hidden></p><button type="button" class="btn soft lv-big" id="lv-cx">Cancel</button></div></div>';
      $('lv-cx').onclick = () => { close(); resolve(false); };
      L.querySelectorAll('.lv-mode').forEach((b) => {
        b.onclick = async () => {
          L.querySelectorAll('.lv-mode').forEach((x) => { x.disabled = true; });
          b.querySelector('b').textContent = 'Starting…';
          try {
            const r = await call('liveStart', [store.get('tok'), trainingId, b.dataset.m]);
            resolve(true); location.hash = '#/live/' + r.code;
          } catch (e) {
            $('lv-err').textContent = why(e); $('lv-err').hidden = false;
            L.querySelectorAll('.lv-mode').forEach((x) => { x.disabled = false; });
            b.querySelector('b').textContent = b.dataset.m === 'room' ? 'In the room' : 'Online (tests only)';
          }
        };
      });
    });
  }

  async function present(code) {
    stop(); open(); const my = gen; code = code6(code); SCREEN = 'present';
    L.innerHTML = '<div class="lv-pres"><p class="lv-wait">Opening session ' + esc(code) + '…</p></div>';
    let r;
    try { r = await call('liveHost', [store.get('tok'), code, 0]); }
    catch (e) { L.innerHTML = '<div class="lv-pres"><div class="lv-card lv-center"><p>' + esc(why(e)) + '</p><button type="button" class="btn" id="lv-x">Back</button></div></div>'; $('lv-x').onclick = () => close('#/'); return; }
    if (my !== gen) return;
    H = r; HVER = r.v; offset = r.now - Date.now(); panelNotes = false; joinBig = r.ph === 'live' && r.people.length < 3; endArmed = 0; BIGD = '';
    if (H.on) return presentOnline(my);
    call('material', [store.get('tok'), H.t]).then((m) => { NOTES = m.notes || []; if (SCREEN === 'present') drawP(); }, () => { NOTES = []; });
    // get every slide picture ready on the server while people join, so phones get them fast
    (async () => { let from = 1; while (from && my === gen) { try { from = (await hcall('liveWarm', [from])).next; } catch (e) { break; } } })();
    const url = location.origin + location.pathname.replace(/index\.html$/, '') + '#/join/' + H.c;
    let qr = '';
    try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: 'QR code to join' }); } catch (e) {}
    L.innerHTML = '<div class="lv-pres">' +
      '<div class="lv-ptop"><img src="img/logo.webp" alt="STAR Library" class="lv-plogo"><span class="lv-ptt"><small>' + esc(H.t) + '</small><b>' + esc(H.tt) + '</b></span>' +
      '<span class="lv-pill lime" id="lv-ph"></span><button type="button" class="lv-icon" id="lv-fs" aria-label="Full screen">⛶</button><button type="button" class="lv-icon" id="lv-out" aria-label="Leave present screen">✕</button></div>' +
      '<div class="lv-pbody"><div class="lv-pmain"><div class="lv-pslide" id="lv-ps"><span class="lv-wait">Loading slide…</span><div class="lv-res" id="lv-res" hidden></div>' +
      '<div class="lv-ptimer" id="lv-pt" hidden><small id="lv-ptl"></small><b id="lv-ptv"></b></div></div>' +
      '<div class="lv-actbar" id="lv-ab" hidden></div>' +
      '<div class="lv-pnotes" id="lv-pn" hidden></div>' +
      '<div class="lv-pbar"><button type="button" class="lv-round" id="lv-pprev" aria-label="Previous slide">◀</button><b id="lv-ppos"></b><button type="button" class="lv-round" id="lv-pnext" aria-label="Next slide">▶</button>' +
      '<span class="lv-grow"></span><span class="lv-tbtns" id="lv-tb"></span>' +
      '<button type="button" class="btn soft" id="lv-pnt">Notes</button><button type="button" class="btn soft" id="lv-pjc">Join code</button><button type="button" class="btn" id="lv-pend"></button></div></div>' +
      '<aside class="lv-pside"><div class="lv-joincard" id="lv-jc"><span class="lv-qr">' + qr + '</span><span><small>Join on your phone</small><b>' + H.c.slice(0, 3) + ' ' + H.c.slice(3) + '</b><small>Scan, or open STAR Library › Join</small></span></div>' +
      '<div class="lv-card" id="lv-hands"></div><div class="lv-card" id="lv-qs"></div><div class="lv-card lv-grow" id="lv-ppl"></div></aside></div>' +
      '<div class="lv-bigjoin" id="lv-bj" hidden><div><span class="lv-qr">' + qr + '</span><p>Join on your phone</p><b>' + H.c.slice(0, 3) + ' ' + H.c.slice(3) + '</b>' +
      '<small>' + esc(url.replace(/^https?:\/\//, '').replace(/#.*$/, '')) + ' › Join</small><button type="button" class="btn" id="lv-bjx">Start</button></div></div></div>';
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
      if (e.key === 'Escape' && BIGD) { BIGD = ''; return results(); }
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); slideTo(H.s + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); slideTo(H.s - 1); }
    };
    addEventListener('keydown', keyFn);
    addEventListener('resize', pResize);
    drawP();
    tickT = setInterval(ptimer, 500);
    hpoll(my);
  }
  function pResize() { if (SCREEN !== 'present') return removeEventListener('resize', pResize); results(); }

  async function ctl(action, arg) {
    try { await hcall('liveCtl', [action, arg]); HVER = 0; } catch (e) { toast(why(e)); }
  }
  function slideTo(n) {
    if (!H || H.ph !== 'live') return;
    n = Math.max(1, Math.min(H.n, n));
    if (n === H.s) return;
    H.s = n; H.act = null; BIGD = ''; drawP(); ctl('slide', n);
  }
  const needPost = () => H.pre && !H.postAt;          // post-test at the end (not on a slide)
  function endClick() {
    const armed = Date.now() - endArmed < 4000;
    if (!armed) { endArmed = Date.now(); drawP(); setTimeout(drawP, 4100); return; }
    endArmed = 0;
    if (H.ph === 'live' && needPost()) { H.ph = 'post'; drawP(); ctl('post'); return; }
    H.ph = 'ended'; $('lv-pend').disabled = true; ctl('end').then(summary);
  }

  function drawP() {
    if (SCREEN !== 'present' || !H) return;
    const armed = Date.now() - endArmed < 4000;
    $('lv-ph').innerHTML = H.ph === 'live' ? '<i class="lv-dot red"></i>LIVE · ' + mmss(now() - H.st).replace(/:\d\d$/, '') + ' min' : 'POST-TEST';
    $('lv-ppos').textContent = H.s + ' / ' + H.n;
    $('lv-pprev').disabled = H.ph !== 'live' || H.s <= 1; $('lv-pnext').disabled = H.ph !== 'live' || H.s >= H.n;
    $('lv-pend').textContent = armed ? (H.ph === 'live' && needPost() ? 'Tap again to end' : 'Tap again to close') : H.ph === 'live' ? (needPost() ? 'End → Post-test' : 'End session') : 'Close session';
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
    // people, or test progress while a test is open
    const postOn = H.pre && (H.ph === 'post' || (H.postAt && H.s >= H.postAt)), preOn = H.pre && !postOn && H.s === (H.preAt || 1) && H.ph === 'live';
    const fin = (p) => (postOn ? p.post : preOn ? p.pre || p.sk : 0);
    $('lv-ppl').innerHTML = '<b>' + (postOn ? 'Post-test · ' + ppl.filter((p) => p.post).length + ' of ' + ppl.length + ' done' : preOn ? 'Pre-test · ' + ppl.filter((p) => p.pre || p.sk).length + ' of ' + ppl.length + ' done' : 'Here now · ' + (H.here != null ? H.here : ppl.length)) + '</b><div class="lv-grid">' +
      ppl.map((p) => '<span class="lv-gp' + (p.on ? '' : ' away') + (fin(p) ? ' fin' : '') + '">' + avatar(p, 44, p.n + (p.c ? ' · ' + p.c : '')) + '<small>' + esc(p.n.split(' ')[0]) + '</small></span>').join('') + '</div>';
    ptimer(); pslide(); actBar();
  }

  // ---------------------------------------------------------------- the activity on the current slide
  function actBar() {
    const a = (H.acts || []).filter((x) => x.s === H.s)[0], A = $('lv-ab');
    if (!a || H.ph !== 'live') { A.hidden = true; $('lv-res').hidden = true; return; }
    const r = H.act && H.act.i === a.i ? H.act : { k: 0, of: (H.people || []).length };
    const shown = !!(H.show || {})[a.i];
    A.hidden = false;
    A.innerHTML = '<span class="lv-pill lime">' + TYN[a.ty].toUpperCase() + '</span><b class="lv-ap">' + esc(a.p) + '</b><span class="lv-ak">' + r.k + ' of ' + r.of + ' answered</span>' +
      '<label class="lv-switch"><input type="checkbox" id="lv-nm"' + (H.names ? ' checked' : '') + '> Show names</label>' +
      '<button type="button" class="btn' + (shown ? ' soft' : '') + '" id="lv-show">' + (shown ? 'Hide results' : 'Show results') + '</button>';
    $('lv-show').onclick = () => { H.show = Object.assign({}, H.show); H.show[a.i] = !shown; BIGD = ''; drawP(); ctl('show', { id: a.i, on: !shown }); };
    $('lv-nm').onchange = () => { H.names = $('lv-nm').checked; if (DRAWS[a.i]) delete DRAWS[a.i]; drawP(); ctl('names', H.names); };
    results();
  }
  function results() {
    if (SCREEN !== 'present' || !H) return;
    const a = (H.acts || []).filter((x) => x.s === H.s)[0], R2 = $('lv-res');
    if (!a || !(H.show || {})[a.i] || H.ph !== 'live') { R2.hidden = true; R2.innerHTML = ''; return; }
    const r = H.act && H.act.i === a.i ? H.act : null;
    R2.hidden = false; R2.className = 'lv-res ' + a.ty + (a.ty === 'draw' && BIGD ? ' big' : '');
    const label = (x) => (x.n ? '<small>' + esc(x.n) + '</small>' : '');
    if (a.ty === 'poll') {
      const c = (r && r.c) || a.o.map(() => 0), tot = c.reduce((x, y) => x + y, 0) || 1, top = Math.max.apply(null, c);
      R2.innerHTML = '<div class="lv-rbox"><h3>' + esc(a.p) + '</h3>' + a.o.map((o, k) => '<div class="lv-bar' + (c[k] && c[k] === top ? ' top' : '') + '"><span>' + esc(o) + '</span><i style="width:' + Math.round(100 * c[k] / tot) + '%"></i><b>' + c[k] + '</b></div>').join('') + '</div>';
    } else if (a.ty === 'text') {
      const list = (r && r.r) || [];
      R2.innerHTML = '<div class="lv-rbox"><h3>' + esc(a.p) + '</h3><div class="lv-wall">' + (list.length ? list.map((x) => '<div class="lv-sticky"><p>' + esc(x.tx) + '</p>' + label(x) + '</div>').join('') : '<p class="lv-muted">No answers yet.</p>') + '</div></div>';
    } else if (a.ty === 'drag') {
      R2.innerHTML = '<div class="lv-dots" id="lv-dots">' + ((r && r.r) || []).map((x) => '<span class="lv-pdot" style="left:' + (x.x * 100) + '%;top:' + (x.y * 100) + '%">' + (x.a ? '<img src="' + face(x.a) + '" alt="">' : '') + (x.n ? '<small>' + esc(x.n.split(' ')[0]) + '</small>' : '') + '</span>').join('') + '</div>';
      const img = $('lv-ps').querySelector('img.lv-simg');
      placeOver($('lv-dots'), $('lv-ps'), img);
    } else if (a.ty === 'draw') {
      const got = DRAWS[a.i] = DRAWS[a.i] || {}, ids = Object.keys(got), slide = IMG[H.t + ':' + H.s] || '';
      if (BIGD && got[BIGD]) {
        R2.innerHTML = '<div class="lv-dbig" id="lv-dbig"><img src="' + got[BIGD].img + '" alt="Drawing">' + (got[BIGD].n ? '<small>' + esc(got[BIGD].n) + '</small>' : '') + '<button type="button" class="btn soft" id="lv-dback">Back to all drawings</button></div>';
        placeOver($('lv-dbig'), $('lv-ps'), $('lv-ps').querySelector('img.lv-simg'));
        $('lv-dback').onclick = () => { BIGD = ''; results(); };
      } else {
        R2.innerHTML = '<div class="lv-rbox"><h3>' + esc(a.p) + ' · ' + ids.length + ' drawing' + (ids.length === 1 ? '' : 's') + '</h3><div class="lv-gal">' +
          ids.map((id) => '<button type="button" class="lv-dt" data-d="' + id + '" style="background-image:url(\'' + slide + '\')"><img src="' + got[id].img + '" alt="Drawing' + (got[id].n ? ' by ' + esc(got[id].n) : '') + '">' + (got[id].n ? '<small>' + esc(got[id].n) + '</small>' : '') + '</button>').join('') +
          (ids.length ? '' : '<p class="lv-muted">Drawings appear here as they arrive.</p>') + '</div></div>';
        R2.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { BIGD = b.dataset.d; results(); }; });
      }
      if (r && r.k > ids.length && !results.busy) {
        results.busy = true;
        hcall('liveDraws', [a.i, ids]).then((list) => { list.forEach((d) => { got[d.id] = d; }); }, () => {}).then(() => { results.busy = false; if (list2changed()) results(); });
      }
      function list2changed() { return Object.keys(got).length !== ids.length; }
    }
  }
  async function pslide() {
    const n = H.s, keys = [n, n + 1, n + 2].filter((x) => x <= H.n).map((x) => H.t + ':' + x);
    const [src] = await pics(keys, (ks) => call('slides', [store.get('tok'), ks]));
    if (SCREEN !== 'present' || H.s !== n) return;
    const img = $('lv-ps').querySelector('img.lv-simg');
    if (src) {
      if (img) { if (img.getAttribute('src') !== src) img.src = src; }
      else { $('lv-ps').insertAdjacentHTML('afterbegin', '<img class="lv-simg" src="' + src + '" alt="Slide ' + n + '">'); $('lv-ps').querySelector('img.lv-simg').onload = results; }
      const w = $('lv-ps').querySelector('.lv-wait'); if (w) w.remove();
    }
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
      const actKey = (x) => JSON.stringify(x || null);
      if (r.same) {
        const changed = H.here !== r.here || actKey(H.act) !== actKey(r.act);
        H.here = r.here; H.act = r.act;
        if (changed) drawP();
      } else { H = r; HVER = r.v; if (H.ph === 'ended') return summary(); draw(); }
    } catch (e) { if (my !== gen) return; if (String(e.message) === 'NOT_AVAILABLE') return summary(); }
    pollT = setTimeout(() => hpoll(my), H && H.on ? 4000 : 2000);
    function draw() { if (H.on) drawO(); else drawP(); }
  }

  // ---------------------------------------------------------------- online session (tests only): join card and progress
  let postArmed = 0;
  function presentOnline(my) {
    SCREEN = 'present'; postArmed = 0;
    const url = location.origin + location.pathname.replace(/index\.html$/, '') + '#/join/' + H.c;
    let qr = '';
    try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true, alt: 'QR code to join' }); } catch (e) {}
    L.innerHTML = '<div class="lv-pres">' +
      '<div class="lv-ptop"><img src="img/logo.webp" alt="STAR Library" class="lv-plogo"><span class="lv-ptt"><small>' + esc(H.t) + '</small><b>' + esc(H.tt) + '</b></span>' +
      '<span class="lv-pill lime" id="lv-ph"></span><button type="button" class="lv-icon" id="lv-out" aria-label="Leave present screen">✕</button></div>' +
      '<div class="lv-obody"><div class="lv-ojoin"><span class="lv-qr">' + qr + '</span><div><p>Join on your phone</p><b>' + H.c.slice(0, 3) + ' ' + H.c.slice(3) + '</b>' +
      '<small>' + esc(url.replace(/^https?:\/\//, '').replace(/#.*$/, '')) + ' › Join training</small><small>Or share this link in the chat:</small>' +
      '<button type="button" class="btn soft" id="lv-copyl">Copy join link</button></div></div>' +
      '<aside class="lv-oside"><div class="lv-scores" id="lv-ost"></div><div class="lv-obtns" id="lv-ob"></div><div class="lv-card lv-grow" id="lv-ppl"></div></aside></div></div>';
    $('lv-out').onclick = () => close('#/');
    $('lv-copyl').onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Join link copied. Paste it in the Zoom or Meet chat.'), () => toast(url));
    drawO();
    hpoll(my);
  }
  function drawO() {
    if (SCREEN !== 'present' || !H) return;
    const ppl = H.people || [], post = H.ph === 'post';
    const pre = ppl.filter((p) => p.pre).length, pst = ppl.filter((p) => p.post).length;
    $('lv-ph').textContent = post ? 'ONLINE · POST-TEST' : 'ONLINE · PRE-TEST';
    $('lv-ost').innerHTML = '<div class="lv-scbox"><small>Joined</small><b>' + ppl.length + '</b></div>' +
      '<div class="lv-scbox"><small>Pre-test done</small><b>' + pre + '</b></div><div class="lv-scbox up"><small>Post-test done</small><b>' + (post ? pst : '–') + '</b></div>';
    const pa = Date.now() - postArmed < 4000, ea = Date.now() - endArmed < 4000;
    $('lv-ob').innerHTML = (post ? '<span class="lv-pill dark">Post-test is open</span>' : '<button type="button" class="btn" id="lv-opost">' + (pa ? 'Tap again to open' : 'Open post-test') + '</button>') +
      '<button type="button" class="btn' + (post ? '' : ' soft') + '" id="lv-oend">' + (ea ? 'Tap again to close' : 'End session') + '</button>';
    if ($('lv-opost')) $('lv-opost').onclick = () => {
      if (Date.now() - postArmed >= 4000) { postArmed = Date.now(); drawO(); setTimeout(drawO, 4100); return; }
      postArmed = 0; H.ph = 'post'; drawO(); ctl('post');
    };
    $('lv-oend').onclick = () => {
      if (Date.now() - endArmed >= 4000) { endArmed = Date.now(); drawO(); setTimeout(drawO, 4100); return; }
      endArmed = 0; H.ph = 'ended'; $('lv-oend').disabled = true; ctl('end').then(summary);
    };
    const fin = (p) => (post ? p.post : p.pre);
    $('lv-ppl').innerHTML = '<b>' + (post ? 'Post-test · ' + pst : 'Pre-test · ' + pre) + ' of ' + ppl.length + ' done</b>' +
      '<div class="lv-olist">' + ppl.slice().sort((a, b) => (fin(a) ? 1 : 0) - (fin(b) ? 1 : 0)).map((p) => '<span class="lv-oname' + (fin(p) ? ' fin' : '') + '">' + (fin(p) ? '✓ ' : '') + esc(p.n) + (p.c ? ' <small>' + esc(p.c) + '</small>' : '') + '</span>').join('') +
      (ppl.length ? '' : '<p class="lv-muted">Names show here as teachers join.</p>') + '</div>';
  }
  function summary() {
    stop(); SCREEN = 'summary';
    const ppl = (H && H.people) || [];
    const avg = (k) => { const xs = ppl.map((p) => p[k]).filter((x) => x && x.t); return xs.length ? Math.round(100 * xs.reduce((a, x) => a + x.s / x.t, 0) / xs.length) + '%' : '–'; };
    L.innerHTML = '<div class="lv-pres"><div class="lv-sumcard"><h1 class="lv-h1">Session closed</h1><p class="lv-muted">' + esc((H ? H.t + ' · ' + H.tt : '')) + '</p>' +
      '<div class="lv-scores"><div class="lv-scbox"><small>Teachers</small><b>' + ppl.length + '</b></div><div class="lv-scbox"><small>Pre-test average</small><b>' + avg('pre') + '</b></div><div class="lv-scbox up"><small>Post-test average</small><b>' + avg('post') + '</b></div></div>' +
      '<div class="lv-sumlist">' + ppl.map((p) => '<div class="lv-person">' + avatar(p, 32) + '<span><b>' + esc(p.n) + '</b>' + (p.c ? ' · ' + esc(p.c) : '') + '</span><small>' +
        (p.pre && p.pre.t ? 'Pre ' + p.pre.s + '/' + p.pre.t : '') + (p.post && p.post.t ? ' · Post ' + p.post.s + '/' + p.post.t : '') + '</small></div>').join('') + '</div>' +
      '<p class="lv-muted">Attendance, answers, test scores and questions are saved. L&amp;D sees them in Editor › Sessions.</p><button type="button" class="btn lv-big" id="lv-sx">Back to STAR Library</button></div></div>';
    $('lv-sx').onclick = () => close('#/');
  }

  window.STAR_LIVE = { join, present, start, close, active: () => !L.hidden };
})();
