/* STAR Library slide viewer: page flip, swipe, jump, all slides, notes, questions, links, full screen, Well done page. */
(function () {
  'use strict';
  const { call, store } = window.STAR;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const DK = $('deck');

  // ---------- slide pictures: small batches, 2 requests at a time, the slide on screen first, 10 ahead ----------
  const IMG = {}, WAIT = {}, BATCH = 6, MAXFLY = 2, AHEAD = 10;
  let queue = [], flying = 0, pt = 0;
  function slide(key, urgent) {
    if (IMG[key]) return Promise.resolve(IMG[key]);
    let w = WAIT[key];
    if (!w) { let ok, no; const p = new Promise((a, b) => { ok = a; no = b; }); w = WAIT[key] = { p, ok, no, sent: false }; queue.push(key); }
    if (urgent && !w.sent) { queue = queue.filter((k) => k !== key); queue.unshift(key); }
    clearTimeout(pt); pt = setTimeout(pump, 0);
    return w.p;
  }
  function pump() {
    while (flying < MAXFLY && queue.length) {
      const ks = queue.splice(0, BATCH); ks.forEach((k) => { if (WAIT[k]) WAIT[k].sent = true; }); flying++;
      const done = (m) => { flying--; ks.forEach((k) => { const w = WAIT[k]; delete WAIT[k]; if (!w) return; if (m && m[k]) { IMG[k] = m[k]; w.ok(m[k]); } else w.no(); }); pump(); };
      call('slides', [store.get('tok'), ks]).then(done, () => done(null));
    }
  }
  function prune(keep) { queue = queue.filter((k) => { if (keep(k)) return true; const w = WAIT[k]; delete WAIT[k]; if (w) w.no(); return false; }); }
  const key = (id, n) => id + ':' + n;
  function ahead(id, total, n) {
    prune((k) => { const p = k.split(':'); return p[0] !== id || (+p[1] >= n - 2 && +p[1] <= n + AHEAD + 2); });
    for (let i = n + 1; i <= Math.min(total, n + AHEAD); i++) slide(key(id, i)).catch(() => {});
    if (n > 1) slide(key(id, n - 1)).catch(() => {});
  }

  // ---------- icons ----------
  const I = {
    bm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
    bmOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/></svg>',
    book: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="6" width="44" height="54" rx="6" fill="#2E6B3A"/><rect x="16" y="12" width="32" height="42" rx="3" fill="#D6EB97"/><path d="M32 20l3.5 8 8.5 1-6.5 6 2 8.5L32 39l-7.5 4.5 2-8.5-6.5-6 8.5-1z" fill="#1F3D2B"/></svg>'
  };

  // ---------- state ----------
  const DEV = (() => { let v = store.get('dev'); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('dev', v); } return v; })();
  let cur = null, ctx = null, pg = 1, panel = '', QS = [], showTok = 0, lastFocus = null;

  function open(t, c) {
    if (cur && cur.t.i === t.i && !DK.hidden) return;
    ctx = c; cur = { t, n: t.k === 'slides' ? t.n : 0, notes: [], vid: {}, links: {} }; pg = 1; panel = ''; QS = [];
    if (DK.hidden) lastFocus = document.activeElement;
    const m = c.module;
    DK.innerHTML = '<div class="dk">' +
      '<div class="dk-top"><div class="dk-head"><small>' + esc(t.i) + '</small><h2 id="dk-title">' + esc(c.title) + '</h2>' + (m ? '<p>' + esc(t.t) + '</p>' : '') + '</div>' +
      '<div class="dk-acts" id="dk-acts"></div><div class="dk-mine"><button type="button" class="dk-lk" id="dk-bm"></button></div>' +
      '<button type="button" class="dk-x" id="dk-x" aria-label="Close">✕</button></div>' +
      '<div class="dk-body" id="dk-body"><div class="dk-stage" id="dk-stage"></div><aside class="dk-panel" id="dk-panel" hidden></aside></div>' +
      '<div class="dk-grid" id="dk-grid" hidden></div><div class="dk-bar" id="dk-bar"></div>' +
      '<button type="button" class="dk-fsx" id="dk-fsx" aria-label="Exit full screen">✕</button></div>';
    DK.hidden = false; document.body.classList.add('modal');
    $('dk-x').onclick = () => leave(); $('dk-fsx').onclick = full;
    bm(); bar();
    if (cur.n) {
      show(1);
      const id = t.i;
      ctx.api('material', [id]).then((m2) => { if (!cur || cur.t.i !== id) return; cur.notes = m2.notes || []; cur.vid = m2.vid || {}; cur.links = m2.links || {}; acts(); if (panel === 'notes') renderPanel(); }, () => {});
    } else if (t.st === 'L' && (t.k === 'pdf' || t.k === 'file')) fileView();
    else emptyView();
    $('dk-x').focus();
    loadQA();
  }

  /** Close button: go back to where the teacher came from (the URL changes, so the phone's back button works too). */
  function leave() {
    if (ctx && ctx.fromApp) history.back();
    else location.hash = (ctx && ctx.back) || '#/';
  }
  function close(silent) {
    if (DK.hidden) return;
    if (cur) prune((k) => k.split(':')[0] !== cur.t.i);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    DK.classList.remove('max'); DK.hidden = true; DK.innerHTML = ''; document.body.classList.remove('modal');
    showTok++; cur = null; QS = [];
    if (!silent && lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function bm() {
    const b = $('dk-bm'), on = ctx.lib.inShelf(cur.t.i);
    b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Saved to My shelf. Tap to remove' : 'Save to My shelf');
    b.innerHTML = on ? I.bmOn : I.bm;
    b.onclick = () => { const now = ctx.lib.toggleShelf(cur.t.i); bm(); ctx.toast(now ? 'Saved to My shelf' : 'Removed from My shelf'); };
  }

  function bar() {
    const n = cur.n;
    $('dk-bar').innerHTML = (n ? '<label class="dk-jump"><span class="tx">Slide</span> <input id="b-go" type="number" min="1" max="' + n + '" value="1" inputmode="numeric" aria-label="Go to slide number"> of ' + n + '</label>' +
      '<button type="button" class="dk-btn" id="b-all" aria-pressed="false" aria-label="All slides">▦<span class="tx"> All slides</span></button>' : '') +
      '<span class="sp"></span><button type="button" class="dk-btn" id="b-done" hidden></button>' +
      (n ? '<button type="button" class="dk-btn" id="b-notes" aria-pressed="false" aria-label="Notes">✎<span class="tx"> Notes</span></button>' : '') +
      '<button type="button" class="dk-btn" id="b-q" aria-pressed="false" aria-label="Questions">?<span class="tx"> Questions</span> <span id="q-count"></span></button>' +
      (n ? '<button type="button" class="dk-btn" id="b-full" aria-pressed="false" aria-label="Full screen">⛶<span class="tx"> Full screen</span></button>' : '');
    if (n) {
      $('b-all').onclick = grid; $('b-full').onclick = full; $('b-notes').onclick = () => toggle('notes');
      $('b-go').onchange = (e) => { const v = Math.round(+e.target.value); if (v >= 1 && v <= n) show(v); else e.target.value = pg; };
    }
    $('b-q').onclick = () => toggle('q');
    $('b-done').onclick = () => { const on = !ctx.lib.isDone(cur.t.i); ctx.lib.setDone(cur.t.i, on); doneUI(); ctx.toast(on ? 'Marked as done' : 'Marked as not done'); };
  }
  function doneUI() {
    const b = $('b-done'); if (!b || !cur) return;
    const can = cur.n ? pg >= cur.n : (cur.t.st === 'L' && (cur.t.k === 'pdf' || cur.t.k === 'file' || !!cur.t.r));
    b.hidden = !can; if (!can) return;
    const on = ctx.lib.isDone(cur.t.i);
    b.setAttribute('aria-pressed', on); b.classList.toggle('done-off', !on);
    b.innerHTML = on ? '✓<span class="tx"> Done</span>' : '☐<span class="tx"> Mark as done</span>';
    b.setAttribute('aria-label', on ? 'Done. Tap to undo' : 'Mark as done');
  }

  function acts() {
    const A = $('dk-acts'); if (!A) return;
    if (!cur.n || !$('dk-stage').querySelector('.base')) { A.innerHTML = ''; return; }
    const v = cur.vid[pg], L = cur.links[pg] || [], k = (v ? 1 : 0) + L.length;
    if (!k) { A.innerHTML = ''; return; }
    A.innerHTML = '<button type="button" class="dk-lk" id="lk" aria-expanded="false" aria-controls="lk-pop" aria-label="Video and links for this slide (' + k + ')">' + I.link + '<i>' + k + '</i></button>' +
      '<div class="dk-pop" id="lk-pop" hidden>' + (v ? '<a class="dk-vid" href="https://youtu.be/' + encodeURIComponent(v) + '" target="_blank" rel="noopener">▶ Watch video</a>' : '') +
      L.map((l) => '<a class="dk-lnk" href="' + esc(l[1]) + '" target="_blank" rel="noopener">↗ ' + esc(l[0]) + '</a>').join('') + '</div>';
    $('lk').onclick = (e) => { e.stopPropagation(); const p = $('lk-pop'), on = p.hidden; p.hidden = !on; $('lk').setAttribute('aria-expanded', on); };
  }
  document.addEventListener('click', (e) => { const p = $('lk-pop'); if (p && !p.hidden && !e.target.closest('.dk-acts')) { p.hidden = true; $('lk').setAttribute('aria-expanded', 'false'); } });

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  function show(n, flip) {
    if (!cur || !cur.n || n < 1 || n > cur.n) return;
    const id = cur.t.i, from = pg; pg = n;
    $('dk-grid').hidden = true; $('dk-body').hidden = false; const ba = $('b-all'); if (ba) ba.setAttribute('aria-pressed', 'false');
    const S = $('dk-stage'); let base = S.querySelector('.base');
    if (!base) {
      S.innerHTML = '<button type="button" class="dk-arrow l" aria-label="Previous slide">‹</button><img class="base" alt=""><button type="button" class="dk-arrow r" aria-label="Next slide">›</button>';
      base = S.querySelector('.base');
      S.querySelector('.l').onclick = () => show(pg - 1, true);
      S.querySelector('.r').onclick = () => (pg >= cur.n ? finish() : show(pg + 1, true));
      flip = false; swipe(S);
    }
    S.querySelector('.l').disabled = n <= 1;
    S.querySelector('.r').setAttribute('aria-label', n >= cur.n ? 'Finish' : 'Next slide');
    acts(); doneUI(); const go = $('b-go'); if (go) go.value = n;
    if (panel === 'notes' || panel === 'q') renderPanel();
    const tok = ++showTok; S.classList.add('wait'); S.classList.remove('bad');
    slide(key(id, n), true).then((url) => {
      if (tok !== showTok || !cur || cur.t.i !== id) return;
      S.classList.remove('wait');
      S.querySelectorAll('.turn').forEach((x) => x.remove());
      if (flip && from !== n && !calm.matches && base.complete && base.naturalWidth) {
        const fwd = n > from, box = 'left:' + base.offsetLeft + 'px;top:' + base.offsetTop + 'px;width:' + base.offsetWidth + 'px;height:' + base.offsetHeight + 'px';
        const t = document.createElement('div'), ti = document.createElement('img');
        t.className = 'turn' + (fwd ? '' : ' back'); t.style.cssText = box; ti.alt = ''; ti.src = fwd ? base.src : url; t.appendChild(ti); S.appendChild(t);
        if (fwd) base.src = url;
        t.addEventListener('animationend', (e) => { if (e.target !== t) return; if (!fwd && pg === n) base.src = url; t.remove(); });
      } else base.src = url;
      base.alt = 'Slide ' + n + ' of ' + cur.n;
    }, () => { if (tok === showTok) { S.classList.remove('wait'); S.classList.add('bad'); } });
    ahead(id, cur.n, n);
  }
  function swipe(S) {
    let x0 = null, y0 = 0;
    S.addEventListener('touchstart', (e) => { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    S.addEventListener('touchend', (e) => {
      if (x0 === null || !cur || !cur.n || !S.querySelector('.base')) return;
      let dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (turned()) { const t = dx; dx = dy; dy = -t; }
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) (pg >= cur.n ? finish() : show(pg + 1, true)); else show(pg - 1, true);
    }, { passive: true });
  }
  const turned = () => (DK.classList.contains('max') || !!document.fullscreenElement) && matchMedia('(orientation: portrait) and (max-width: 760px)').matches;

  function recCard(t) {
    return '<a class="mini" href="#/t/' + encodeURIComponent(t.i) + '"><span class="code">' + esc(t.i) + '</span><b>' + esc(t.t) + '</b></a>';
  }
  const recLink = (t) => (t.r ? '<p style="margin:0 0 14px"><a class="dk-vid" href="' + esc(t.r) + '" target="_blank" rel="noopener">▶ Watch the training recording</a></p>' : '');
  function finish() {
    if (panel) toggle(panel);
    const S = $('dk-stage'), R = ctx.recFor(cur.t.i); $('dk-acts').innerHTML = ''; showTok++; S.classList.remove('wait', 'bad');
    S.innerHTML = '<button type="button" class="dk-arrow l" aria-label="Back to the last slide">‹</button><div class="dk-end" role="status"><div class="yay">★</div><h3>Well done!</h3>' +
      '<p>You finished “' + esc(cur.t.t) + '”. Try one idea in your next class.</p>' + recLink(cur.t) +
      (R.length ? '<h4>Recommended next</h4><div class="recs">' + R.map(recCard).join('') + '</div>' : '') +
      '<div class="row2"><button type="button" class="dk-btn" id="e-again">↺ Start again</button><button type="button" class="dk-btn" id="e-home">Back to library</button></div></div>';
    S.querySelector('.l').onclick = () => { S.innerHTML = ''; show(cur.n); };
    $('e-again').onclick = () => { S.innerHTML = ''; show(1); };
    $('e-home').onclick = leave;
    S.querySelectorAll('.recs a').forEach((a) => a.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); DK.classList.remove('max'); }));
    pg = cur.n; doneUI(); $('e-again').focus();
  }
  function grid() {
    const g = $('dk-grid'), on = g.hidden; g.hidden = !on; $('dk-body').hidden = on; $('b-all').setAttribute('aria-pressed', on);
    if (!on) return;
    const id = cur.t.i;
    g.innerHTML = Array.from({ length: cur.n }, (_, i) => '<button type="button" data-n="' + (i + 1) + '" aria-label="Go to slide ' + (i + 1) + '"' + (i + 1 === pg ? ' aria-current="true"' : '') + '><img alt="" data-k="' + esc(key(id, i + 1)) + '"><span>' + (i + 1) + '</span></button>').join('');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; io.unobserve(e.target); slide(e.target.dataset.k).then((u) => { e.target.src = u; }, () => {}); }), { root: g, rootMargin: '200px' });
    g.querySelectorAll('img').forEach((im) => io.observe(im));
    g.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (!$('dk-stage').querySelector('.base')) $('dk-stage').innerHTML = ''; show(+b.dataset.n); }; });
    (g.querySelector('[aria-current]') || g.firstChild).focus();
  }
  function full() {
    const b = $('b-full'); const lp = $('lk-pop'); if (lp) lp.hidden = true;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (DK.classList.contains('max')) { DK.classList.remove('max'); fsLabel(false); return; }
    let p; try { p = DK.requestFullscreen ? DK.requestFullscreen() : Promise.reject(); } catch (e) { p = Promise.reject(); }
    p.then(() => fsLabel(true), () => { DK.classList.add('max'); fsLabel(true); });
  }
  document.addEventListener('fullscreenchange', () => fsLabel(!!document.fullscreenElement || DK.classList.contains('max')));
  function fsLabel(on) { const b = $('b-full'); if (!b) return; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); b.innerHTML = '⛶<span class="tx"> ' + (on ? 'Exit full screen' : 'Full screen') + '</span>'; }

  function emptyView() {
    const t = cur.t, title = t.r ? 'Training recording' : 'Coming soon';
    $('dk-stage').innerHTML = '<div class="dk-empty"><div class="big">' + I.book + '</div><h3>' + title + '</h3><p>' +
      esc(t.d || (t.r ? 'Watch the full session recording.' : 'L&D is preparing this training. You can still ask a question.')) + '</p>' + recLink(t) + '</div>';
    doneUI();
  }
  function fileView() {
    const t = cur.t, pdf = t.k === 'pdf', label = pdf ? 'Open PDF' : 'Save file';
    $('dk-stage').innerHTML = '<div class="dk-empty"><div class="big">' + I.book + '</div><h3>' + esc(t.t) + '</h3><p>' + esc(t.d || (pdf ? 'Read this guide on your phone.' : 'Save this file to your phone.')) + '</p>' +
      '<button type="button" class="btn" id="f-get">' + label + '</button><p class="err" id="f-err" hidden></p>' + recLink(t) + '</div>';
    doneUI();
    $('f-get').onclick = async () => {
      const b = $('f-get'), id = t.i; b.disabled = true; b.textContent = 'Getting it ready…';
      try {
        const f = await ctx.api('download', [id]);
        const bin = atob(f.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], { type: f.mime })), a = document.createElement('a');
        a.href = url; a.download = f.name; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) { const E = $('f-err'); if (E) { E.textContent = 'It did not load. Please try again.'; E.hidden = false; } }
      b.disabled = false; b.textContent = label;
    };
  }

  function toggle(p) {
    panel = panel === p ? '' : p;
    ['notes', 'q'].forEach((k) => { const b = $('b-' + k); if (b) b.setAttribute('aria-pressed', panel === k); });
    $('dk-panel').hidden = !panel; if (panel) renderPanel(); if (panel === 'q') loadQA();
  }
  function renderPanel() {
    const P = $('dk-panel'); if (!P || !cur) return;
    if (panel === 'notes') { const t = cur.notes[pg - 1]; P.innerHTML = '<h3>Notes · slide ' + pg + '</h3>' + (t ? '<p class="note">' + esc(t) + '</p>' : '<p class="hint">No notes on this slide.</p>'); return; }
    if (panel !== 'q') return;
    const list = QS.map((q) => '<div class="qa"><div class="meta">' + (q.slide ? 'Slide ' + q.slide + ' · ' : '') + (q.at ? new Date(q.at).toLocaleDateString() : '') + (q.mine ? ' · You' : '') + '</div><div>' + esc(q.text) + '</div>' +
      (q.answer ? '<div class="ans"><b>L&amp;D answer</b><br>' + esc(q.answer) + '</div>' : '<div class="wait">Waiting for L&amp;D…</div>') + '</div>').join('');
    P.innerHTML = '<h3>Questions</h3><p class="hint">Ask L&amp;D about this training. Everyone can see the answers.</p>' +
      '<div class="ask"><label for="q-text" style="font-weight:600">Your question</label><textarea id="q-text" maxlength="1000" placeholder="What do I do if…"></textarea>' +
      (cur.n ? '<div class="row2"><label><input type="checkbox" id="q-slide" checked> About slide ' + pg + '</label></div>' : '') +
      '<div class="row2"><button type="button" class="btn" id="q-send">Send question</button></div><p class="err" id="q-err" hidden></p></div>' +
      '<div style="margin-top:12px">' + (list || '<p class="hint">No questions yet. Be the first!</p>') + '</div>';
    $('q-text').oninput = () => { $('q-err').hidden = true; };
    $('q-send').onclick = async () => {
      const t = $('q-text').value.trim(), E = $('q-err'), B = $('q-send');
      if (!t) { E.textContent = 'Write your question first.'; E.hidden = false; return; }
      B.disabled = true; B.textContent = 'Sending…'; const id = cur.t.i;
      try {
        await ctx.api('ask', [id, cur.n && $('q-slide') && $('q-slide').checked ? pg : 0, t, DEV]);
        if (!cur || cur.t.i !== id) return; $('q-text').value = ''; loadQA(true);
      } catch (e) { E.textContent = String(e.message) === 'TOO_MANY' ? 'Too many questions right now. Please try again later.' : 'Your question was not sent. Please try again.'; E.hidden = false; }
      if ($('q-send')) { B.disabled = false; B.textContent = 'Send question'; }
    };
  }
  function loadQA(force) {
    if (!cur) return; const id = cur.t.i;
    ctx.api('questions', [id, DEV]).then((r) => {
      if (!cur || cur.t.i !== id) return; QS = r || [];
      const c = $('q-count'); if (c) c.textContent = QS.length ? '(' + QS.length + ')' : '';
      const a = document.activeElement, typing = a && a.tagName === 'TEXTAREA' && a.value.trim();
      if (panel === 'q' && (force || !typing)) renderPanel();
    }, () => {});
  }

  addEventListener('keydown', (e) => {
    if (DK.hidden || !cur) return;
    if (e.key === 'Escape') { const lp = $('lk-pop'); if (lp && !lp.hidden) { lp.hidden = true; return; } if (document.fullscreenElement) return; if (DK.classList.contains('max')) return full(); leave(); return; }
    const t = e.target.tagName; if (t === 'TEXTAREA' || t === 'INPUT') return;
    if (cur.n && $('dk-stage').querySelector('.base')) { if (e.key === 'ArrowRight') (pg >= cur.n ? finish() : show(pg + 1, true)); if (e.key === 'ArrowLeft') show(pg - 1, true); }
    if (e.key === 'Tab') {
      const f = [...DK.querySelectorAll('button:not([disabled]),a[href],input,textarea')].filter((x) => x.offsetParent);
      if (!f.length) return; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  DK.addEventListener('click', (e) => { if (e.target === DK) leave(); });

  window.STAR_VIEW = { open, close, slide };
})();
