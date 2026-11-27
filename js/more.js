/* STAR Library: My page (profile + profiling test), Team view, a teacher's profile, and the L&D editor.
   Loaded before app.js; app.js calls window.STAR_MORE(ctx) and uses the views it returns. */
window.STAR_MORE = function (X) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = X.esc;
  const LV = { Know: 1, Use: 2, Adapt: 3, Build: 4 };
  const LEVELS = ['Know', 'Use', 'Adapt', 'Build'];
  const ago = (t) => { if (!t) return 'never'; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };
  const day = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const loading = (nav, title) => X.view('<section class="sec"><h1 class="big" style="font-size:28px">' + esc(title) + '</h1><p class="muted">Loading…</p></section>', nav);
  const failed = (nav, e) => X.view('<section class="sec"><h1 class="big" style="font-size:28px">This page did not load</h1><p class="muted">' +
    esc(X.why(e)) + '</p><button type="button" class="btn" onclick="location.reload()">Try again</button></section>', nav);
  // Last copy of a page, kept on this device so it opens at once; fresh data replaces it a moment later.
  const S = window.STAR.store;
  const dec = (h) => { try { return decodeURIComponent(h); } catch (e) { return h; } };
  const here = (h) => dec(location.hash) === dec(h) || (h === '#/me' && (location.hash === '' || location.hash === '#/me'));
  async function fresh(key, fn, args, draw, nav, title, hash) {
    const old = S.json(key);
    if (old) draw(old); else loading(nav, title);
    let d; try { d = await X.api(fn, args); } catch (e) { if (!old) failed(nav, e); return; }
    S.setJson(key, d);
    if (here(hash) && JSON.stringify(d) !== JSON.stringify(old) && !typing()) draw(d);
  }
  // someone is typing in a form: a quiet refresh must not redraw the page under them
  const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'edq'; };
  function prefetch(role) {   // after sign-in: get My page (and Team) ready in the background
    setTimeout(() => {
      X.api('profile', []).then((d) => S.setJson('pg-me', d)).catch(() => {});
      if (role && role !== 'Teacher') X.api('team', []).then((d) => S.setJson('pg-team', d)).catch(() => {});
      if (role === 'L&D') {   // the Editor opens at once
        X.api('edCatalogue', []).then(setCat).catch(() => {});
        setTimeout(() => {
          X.api('edQuestions', []).then((d) => S.setJson('pg-edq', d)).catch(() => {});
          X.api('edSessions', []).then((d) => S.setJson('pg-eds', d)).catch(() => {});
        }, 3000);
      }
    }, 1500);
  }
  const errText = (e) => { const m = String(e && e.message || e); return m.indexOf('MSG:') === 0 ? m.slice(4) : X.why(e); };

  // ------------------------------------------------------------ profile pieces
  function levelRows(domains) {
    return domains.map((d) => {
      const n = LV[d.level] || 0;
      const label = d.level === 'Know' || n ? d.src || 'Tested' : d.level === 'Not yet' ? 'Not yet' : 'No evidence yet';
      return '<div class="dl"><div class="dt"><span>' + esc(d.d + ' ' + d.n) + '</span><span class="ev">' + esc(n ? d.level + ' · ' + label : label) + '</span></div>' +
        '<div class="lvbar" role="img" aria-label="' + esc(d.d + ' ' + (n ? d.level : 'no level yet')) + '">' + LEVELS.map((x, i) => '<i class="' + (i < n ? 'f' : '') + '"></i>').join('') + '</div></div>';
    }).join('');
  }
  const nextBooks = (codes) => codes.map((c) => X.MOD()[c]).filter(Boolean).map(X.moduleBook).join('');

  // ------------------------------------------------------------ My page
  function me() { return fresh('pg-me', 'profile', [], meDraw, 'me', 'My page', '#/me'); }
  function meDraw(p) {
    const info = p.test || [];
    const ME = X.ME(), LIB = X.LIB(), TR = X.TR();
    const shelf = LIB.shelf.map((id) => TR[id]).filter(Boolean);
    const total = info.filter((s) => s.count).length, doneN = info.filter((s) => s.level).length;
    let h = '<section style="display:flex;flex-direction:column;gap:12px"><h1 class="big" style="font-size:28px">My page</h1><div class="mepage">' +
      '<div class="card"><b>' + esc(ME.name || 'Teacher') + '</b><span class="sm muted">' + esc(ME.email || '') + '</span>' +
      '<span class="sm">' + esc(ME.role || 'Teacher') + (ME.centres && ME.centres.length ? ' · ' + esc(ME.centres.join(', ')) : '') + ' · ' + LIB.done.length + ' trainings marked done</span></div>' +
      '<div class="mecols"><div class="mecol"><div class="card"><h2 class="lbl">Profiling test</h2>' +
      (total ? '<p style="margin:0">' + doneN + ' of ' + total + ' sections done. One section per domain, about 10 questions each. It checks what you know, not how you teach.</p>' +
        '<div class="tlist">' + info.filter((s) => s.count).map((s) => '<div class="trow"><span><b>' + esc(s.d) + '</b> ' + esc(s.n) + '<br><span class="sm muted">' +
          (s.level === 'Know' ? 'Done · Know' : s.level ? 'Not yet · try again ' + (s.canTake ? 'now' : 'from ' + day(s.retakeOn)) : s.count + ' questions') + '</span></span>' +
          (s.canTake ? '<a class="btn' + (s.level ? ' line' : '') + '" href="#/test/' + s.d + '">' + (s.level ? 'Try again' : 'Start') + '</a>' : '<span class="st' + (s.level === 'Know' ? '' : ' soon') + '">' + (s.level === 'Know' ? 'Done' : 'Later') + '</span>') + '</div>').join('') + '</div>'
        : '<p class="muted" style="margin:0">L&amp;D is preparing the questions. You\'ll see the test here when it\'s ready.</p>') + '</div>' +
      '<div class="note"><span>You, your Teacher Leader, your centre and L&amp;D can see your levels. They never see your scores. Your profile is for planning your training, not a rating.</span></div></div>' +
      '<div class="mecol"><div class="card"><h2 class="lbl">My levels by domain</h2>' + levelRows(p.domains) +
      '<p class="sm muted" style="margin:6px 0 0">Tested = profiling test (Know level). Demonstrated = a module signed off by L&amp;D.</p></div>' +
      '</div></div>' +
      (p.next.length ? '<div class="card"><h2 class="lbl">Suggested next</h2><div class="shelf">' + nextBooks(p.next) + '</div></div>' : '') +
      '<div class="card"><h2 class="lbl">My shelf</h2>' + (shelf.length ? '<div class="shelf">' + shelf.map(X.trainingBook).join('') + '</div>' : '<p class="muted" style="margin:0">Empty. Open a training and tap the bookmark to save it here.</p>') + '</div>' +
      '</div></section>';
    X.view(h, 'me');
  }

  // ------------------------------------------------------------ profiling test, one question at a time
  let T = null;
  async function test(d) {
    loading('me', 'Profiling test');
    try { const s = await X.api('testSection', [d]); T = { d: s.d, n: s.n, qs: s.questions, i: 0, a: {} }; }
    catch (e) { return X.view('<section class="sec"><h1 class="big" style="font-size:28px">This section isn\'t open</h1><p class="muted">You may have finished it already, or you can try again later.</p><a class="btn" href="#/me">Back to My page</a></section>', 'me'); }
    q();
  }
  function q() {
    const s = T.qs[T.i], n = T.qs.length, last = T.i === n - 1;
    X.view('<section class="sec tq" aria-labelledby="tq-h"><div class="tqtop"><span class="tag dark">' + esc(T.d) + '</span><span class="sm muted">' + esc(T.n) + ' · question ' + (T.i + 1) + ' of ' + n + '</span></div>' +
      '<div class="prog"><i style="width:' + Math.round(T.i / n * 100) + '%"></i></div>' +
      '<h1 class="disp" id="tq-h" style="margin:0;font-size:20px;line-height:1.4;font-weight:700;letter-spacing:0">' + esc(s.q) + '</h1>' +
      '<div class="opts" role="radiogroup" aria-labelledby="tq-h">' + s.o.map((o, k) => o ? '<button type="button" role="radio" class="opt" aria-checked="' + (T.a[s.id] === 'ABCD'[k]) + '" data-k="' + 'ABCD'[k] + '"><b>' + 'ABCD'[k] + '</b><span>' + esc(o) + '</span></button>' : '').join('') + '</div>' +
      '<div class="tqnav"><button type="button" class="btn soft" id="tq-back"' + (T.i ? '' : ' disabled') + '>← Back</button><button type="button" class="btn" id="tq-next"' + (T.a[s.id] ? '' : ' disabled') + '>' + (last ? 'Finish' : 'Next →') + '</button></div>' +
      '<a href="#/me" class="sm muted" style="align-self:center">Leave the test (answers are not saved)</a></section>', 'me');
    document.querySelectorAll('.opt').forEach((b) => { b.onclick = () => { T.a[s.id] = b.dataset.k; document.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-checked', x === b)); $('tq-next').disabled = false; }; });
    $('tq-back').onclick = () => { T.i--; q(); };
    $('tq-next').onclick = async () => {
      if (!last) { T.i++; q(); return; }
      const B = $('tq-next'); B.disabled = true; B.textContent = 'Checking…';
      try {
        const r = await X.api('testSubmit', [T.d, T.a]);
        const pass = r.level === 'Know';
        S.set('pg-me', '');
        X.view('<section class="sec" style="text-align:center;align-items:center"><div class="disp" style="font-size:40px;color:var(--brand)">' + (pass ? '★' : '…') + '</div>' +
          '<h1 class="big" style="font-size:28px">' + (pass ? 'Section done: Know level' : 'Not yet') + '</h1><p style="margin:0">' + r.correct + ' of ' + r.total + ' correct.</p>' +
          '<p class="muted" style="margin:0;max-width:44ch">' + (pass ? 'This shows on your profile as Know (tested).' : 'You can try this section again from ' + day(r.retakeOn) + '. Your suggested trainings will help.') + '</p>' +
          '<a class="btn" href="#/me">Back to My page</a></section>', 'me');
        T = null;
      } catch (e) { B.disabled = false; B.textContent = 'Finish'; X.toast(X.why(e)); }
    };
  }

  // ------------------------------------------------------------ Team
  let TEAM = null, teamCentre = '', teamQ = '';
  function team() { return fresh('pg-team', 'team', [], (d) => { TEAM = d; teamDraw(); }, 'team', 'My team', '#/team'); }
  function teamDraw() {
    const all = TEAM.people, centres = [...new Set(all.flatMap((p) => p.centres))].sort();
    const q = teamQ.toLowerCase();
    const list = all.filter((p) => (!teamCentre || p.centres.includes(teamCentre)) && (!q || (p.name + ' ' + p.email).toLowerCase().includes(q)));
    const gaps = TEAM.domains.map((d, i) => [d, list.filter((p) => p.levels[i] !== 'Know').length]).sort((a, b) => b[1] - a[1]).filter((x) => x[1]).slice(0, 2);
    const title = TEAM.role === 'L&D' ? 'All teachers' : TEAM.role === 'Leader' ? 'My team' : 'My centre';
    let h = '<section style="display:flex;flex-direction:column;gap:12px"><h1 class="big" style="font-size:28px">' + title + '</h1>' +
      '<div class="tfilter">' + (centres.length > 1 ? '<div class="chips"><button type="button" class="chip' + (teamCentre ? '' : ' on') + '" data-c="">All centres</button>' + centres.map((c) => '<button type="button" class="chip' + (teamCentre === c ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' : '') +
      '<label class="srch"><span class="sr">Find a teacher</span><input id="tq" type="search" placeholder="Find a teacher" value="' + esc(teamQ) + '" style="width:100%;min-height:48px;border-radius:99px;border:1.5px solid var(--line);padding:0 18px;background:var(--card)"></label></div>' +
      (gaps.length && list.length ? '<div class="card" style="background:var(--deep);color:var(--deep-t)"><h2 class="lbl" style="color:var(--deep-sub)">Biggest gaps</h2><p class="disp" style="margin:0;font-size:16px;font-weight:700">' +
        gaps.map((g) => esc(g[0][0] + ' ' + g[0][1])).join(' and ') + '</p><p class="sm" style="margin:0;color:var(--deep-sub)">' + gaps[0][1] + ' of ' + list.length + ' teachers are not at Know yet in ' + esc(gaps[0][0][0]) + '.</p></div>' : '') +
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 class="lbl">' + list.length + ' teacher' + (list.length === 1 ? '' : 's') + '</h2><span class="sm muted">D01 → D08</span></div>' +
      (list.length ? '<div class="people">' + list.map((p) => '<a class="person" href="#/person/' + encodeURIComponent(p.email) + '"><span class="pav">' + esc(initials(p.name || p.email)) + '</span>' +
        '<span class="pn"><b>' + esc(p.name || p.email) + '</b><span class="sm muted">' + esc(p.centres.join(', ') || '—') + ' · last visit ' + ago(p.last) + '</span>' +
        '<span class="dots" aria-label="' + p.levels.filter((l) => l === 'Know').length + ' of 8 domains at Know">' + p.levels.map((l) => '<i class="' + (l === 'Know' ? 'k' : l ? 'n' : '') + '"></i>').join('') + '</span></span>' +
        '<span class="st' + (p.levels.some(Boolean) ? '' : ' soon') + '">' + p.levels.filter(Boolean).length + '/8 tested</span></a>').join('') + '</div>'
        : '<p class="muted" style="margin:0">No teachers here yet. L&amp;D sets Role, Centre and Teacher Leader on the Users tab.</p>') +
      '<div class="legend sm muted"><span><i></i>Not tested</span><span><i class="n"></i>Not yet</span><span><i class="k"></i>Know</span></div></div>' +
      '<p class="sm muted" style="margin:0">You see levels and suggested trainings only. Scores stay with L&amp;D.</p></section>';
    X.view(h, 'team');
    document.querySelectorAll('.tfilter .chip').forEach((b) => { b.onclick = () => { teamCentre = b.dataset.c; teamDraw(); }; });
    const I = $('tq'); I.oninput = () => { teamQ = I.value; const pos = I.selectionStart; teamDraw(); const J = $('tq'); J.focus(); J.setSelectionRange(pos, pos); };
  }
  const initials = (n) => { const w = String(n).replace(/^SE-\s*/i, '').split(/[\s@.]+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[1][0] : '')).toUpperCase(); };

  function person(email) { return fresh('pg-p-' + email, 'profile', [email], personDraw, 'team', 'Teacher', '#/person/' + encodeURIComponent(email)); }
  function personDraw(p) {
    X.view('<section style="display:flex;flex-direction:column;gap:12px"><a class="btn soft back" href="#/team">← Back</a><div class="mepage">' +
      '<div class="card"><b style="font-size:20px">' + esc(p.name || p.email) + '</b><span class="sm muted">' + esc(p.email) + '</span><span class="sm">' + esc(p.centres.join(', ') || '—') + ' · last visit ' + ago(p.last) + ' · ' + p.tested + ' of 8 sections tested</span></div>' +
      '<div class="mecols"><div class="mecol"><div class="card"><h2 class="lbl">Levels by domain</h2>' + levelRows(p.domains) + '</div></div>' +
      '<div class="mecol">' + (p.next.length ? '<div class="card"><h2 class="lbl">Suggested next</h2><div class="shelf">' + nextBooks(p.next) + '</div></div>' : '<div class="card"><h2 class="lbl">Suggested next</h2><p class="muted" style="margin:0">Nothing yet. Suggestions appear after the profiling test.</p></div>') + '</div></div>' +
      '</div><p class="sm muted" style="margin:0">Levels only. Scores stay with L&amp;D.</p></section>', 'team');
  }

  // ------------------------------------------------------------ L&D editor
  let ED = null, edAt = 0, edTab = 'trainings', edQ = '', edFilter = '', poll = 0;
  async function useCat(r) { if (r && r.cat) setCat(r.cat); else await edLoad(true); }   // saves send the catalogue back
  function setCat(c) { if (!c || !c.trainings) return; ED = c; edAt = Date.now(); S.setJson('pg-ed', c); }
  async function edLoad(force) { if (!ED) ED = S.json('pg-ed'); if (!ED || force) setCat(await X.api('edCatalogue', [])); return ED; }
  /** Fetch the catalogue in the background; redraw a list page only if something changed and nobody is typing. */
  function refreshCat() {
    const h = location.hash; edAt = Date.now();
    X.api('edCatalogue', []).then((c) => {
      const changed = JSON.stringify(c) !== JSON.stringify(ED);
      setCat(c);
      if (!changed || location.hash !== h || typing()) return;
      if (/^#\/edit(\/trainings)?\/?$/.test(h)) edTrainings();
      else if (/^#\/edit\/modules\/?$/.test(h)) edModules();
    }).catch(() => {});
  }
  const statusPill = (t) => t._building ? '<span class="st soon">Building…</span>' : '<span class="st' + (t.Status === 'Live' ? '' : ' soon') + '">' + esc(t.Status || 'Placeholder') + '</span>';
  const edTabs = () => '<div class="tabs">' + [['trainings', 'Trainings'], ['modules', 'Modules'], ['questions', 'Questions'], ['sessions', 'Sessions']].map((t) => '<a class="chip' + (edTab === t[0] ? ' on' : '') + '" href="#/edit/' + t[0] + '">' + t[1] + '</a>').join('') + '</div>';

  async function editor(tab, id) {
    edTab = tab || 'trainings';
    clearInterval(poll);
    if (!ED) ED = S.json('pg-ed');
    if (!ED) { loading('edit', 'Editor'); try { await edLoad(true); } catch (e) { return failed('edit', e); } }
    else if (Date.now() - edAt > 30000) refreshCat();   // show the saved copy now, fresh data a moment later
    if (edTab === 'trainings' && id) return edTraining(id);
    if (edTab === 'modules' && id) return edModule(id);
    if (edTab === 'questions') return edQuestions();
    if (edTab === 'livetests' && id) { edTab = 'trainings'; const g = (k) => decodeURIComponent((new RegExp('[?&]' + k + '=([^&]+)').exec(location.hash) || [])[1] || ''); return edLive(id, g('s')); }
    if (edTab === 'sessions') return id ? edSession(id) : edSessions();
    if (edTab === 'modules') return edModules();
    edTrainings();
  }
  function edTrainings() {
    const q = edQ.toLowerCase();
    const list = ED.trainings.filter((t) => (!edFilter || (edFilter === 'Building' ? t._building : t.Status === edFilter)) &&
      (!q || (t.ID + ' ' + t.Title + ' ' + t.Module + ' ' + t.Group).toLowerCase().includes(q)));
    X.view('<section class="sec"><div class="edhead"><h1 class="big" style="font-size:28px">Editor</h1><a class="btn" href="#/edit/trainings/new">+ Add training</a></div>' + edTabs() +
      '<div class="chips">' + ['', 'Live', 'Placeholder', 'Retired', 'Building'].map((f) => '<button type="button" class="chip' + (edFilter === f ? ' on' : '') + '" data-f="' + f + '">' + (f || 'All') + '</button>').join('') + '</div>' +
      '<input id="edq" type="search" class="edin" placeholder="Search ID, title or module" value="' + esc(edQ) + '" aria-label="Search trainings">' +
      '<div class="edlist">' + list.map((t) => '<a class="edrow" href="#/edit/trainings/' + encodeURIComponent(t.ID) + '"><span class="code">' + esc(t.ID) + '</span><span><b>' + esc(t.Title) + '</b><br><span class="sm muted">' +
        esc((t.Type === 'Refresher' ? 'Refresher · ' : '') + (t.Module ? t.Module + ' · ' + ((X.MOD()[t.Module] || {}).t || '') : t.Group || 'Other')) + '</span></span>' + statusPill(t) + '</a>').join('') + (list.length ? '' : '<p class="muted">No trainings match.</p>') + '</div></section>', 'edit');
    document.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { edFilter = b.dataset.f; edTrainings(); }; });
    const I = $('edq'); I.oninput = () => { edQ = I.value; const pos = I.selectionStart; edTrainings(); const J = $('edq'); J.focus(); J.setSelectionRange(pos, pos); };
  }
  const fld = (label, html, hint) => '<label class="fld"><span>' + label + '</span>' + html + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
  const inp = (id, v, ph) => '<input id="' + id + '" value="' + esc(v || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>';
  const area = (id, v, rows) => '<textarea id="' + id + '" rows="' + (rows || 3) + '">' + esc(v || '') + '</textarea>';
  const sel = (id, v, opts) => '<select id="' + id + '">' + opts.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(val) + '"' + (val === v ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select>';

  function edTraining(id) {
    const isNew = id === 'new';
    const pre = (location.hash.match(/[?&]m=([^&]+)/) || [])[1];
    const t = isNew ? { ID: '', Module: pre ? decodeURIComponent(pre) : '', Status: 'Placeholder', Format: 'Training Module' } : ED.trainings.find((x) => x.ID === id);
    if (!t) return X.view('<section class="sec"><p>Not found.</p><a class="btn" href="#/edit">Back</a></section>', 'edit');
    const mods = [['', 'Other (no module)']].concat(ED.modules.map((m) => [m.Code, m.Code + ' · ' + m.Title]));
    const foCodes = Object.keys(X.CAT().fo || {});
    let h = '<section class="sec"><div class="edhead"><a class="btn soft back" href="#/edit">← Trainings</a>' + (isNew ? '' : statusPill(t)) + '</div>' +
      '<h1 class="big" style="font-size:28px">' + (isNew ? 'Add a training' : esc(t.ID) + ' · ' + esc(t.Title)) + '</h1>' +
      (isNew ? '' : '<p class="sm muted" style="margin:0">Library copy: ' + (t._building ? 'building now…' : t._ready ? esc(t.Slides || '') + (/^\d+$/.test(t.Slides) ? ' slides' : '') + ' ready' : 'none yet') + (t._liveSoon ? ' · goes Live when the copy is ready' : '') + ' · updated ' + esc(t['Last updated'] || '—') + '</p>') +
      '<div class="edform">' +
      fld('Module', sel('f-Module', t.Module, mods), 'The new ID is the module code plus the next number, e.g. S2-22-5.') +
      fld('Group (Other trainings only)', inp('f-Group', t.Group, 'e.g. Soft skills')) +
      fld('Title', inp('f-Title', t.Title)) +
      fld('Type', sel('f-Type', t.Type === 'Refresher' ? 'Refresher' : 'Core', [['Core', 'Core (part of the module)'], ['Refresher', 'Refresher (extra, not part of the stage path)']]),
        'A refresher stays in its module with a Refresher badge, is also listed in Other trainings, and is never in Suggested next.') +
      fld('Description', area('f-Description', t.Description, 3)) +
      fld('Material file', inp('f-src', '', t['Source file (L&D only)'] ? 'Paste a new Drive link to replace the file' : 'Paste a Google Drive link (Slides, PowerPoint, Doc, PDF…)'),
        t['Source file (L&D only)'] ? 'Current file: <a href="' + esc(t['Source file (L&D only)']) + '" target="_blank" rel="noopener">open ↗</a>. Saving a new link builds a new library copy.' : 'Saving builds the library copy teachers see.') +
      fld('Recording', inp('f-Recording', t.Recording, 'https://…')) +
      fld('Status', sel('f-Status', t.Status || 'Placeholder', ['Placeholder', 'Live', 'Retired']), 'Live needs a library copy or a recording.') +
      fld('Format', inp('f-Format', t.Format)) +
      fld('Cover slide', inp('f-Cover slide', t['Cover slide'], 'e.g. 2')) +
      fld('Featured on Home', '<span class="ck"><input type="checkbox" id="f-Featured"' + (t.Featured === 'Yes' ? ' checked' : '') + '> Latest training (only one at a time)</span>') +
      fld('Recommended next', inp('f-Recommended', t.Recommended, 'Up to 2 IDs, e.g. S2-22-2, S2-23-1')) +
      fld('FO rubric items', inp('f-FO items', t['FO items'], 'e.g. B13, B14'), foCodes.length ? 'Codes from the FO Rubric tab: ' + esc(foCodes.join(', ')) : '') +
      fld('Slide videos', area('f-Slide videos', t['Slide videos'], 2), 'One per line: 8: https://youtu.be/…') +
      fld('Video link (slide 1)', inp('f-Video link', t['Video link'])) +
      fld('Owner', inp('f-Owner', t.Owner)) +
      fld('L&D notes', area('f-Notes', t.Notes, 2)) +
      '</div><p class="gerr" id="ed-err" role="alert" hidden></p><p class="gok" id="ed-ok" role="status" hidden></p>' +
      '<div class="edbtns"><button type="button" class="btn" id="ed-save">' + (isNew ? 'Add training' : 'Save') + '</button>' +
      (isNew ? '' : (t.Status !== 'Live' && t._ready ? '<button type="button" class="btn line" id="ed-live">Make Live</button>' : '') +
        (t['Source file (L&D only)'] ? '<button type="button" class="btn soft" id="ed-build">Rebuild copy</button>' : '') +
        '<a class="btn soft" href="#/edit/livetests/' + encodeURIComponent(t.ID) + '">Live session</a>' +
        (t.Status !== 'Retired' ? '<button type="button" class="btn soft" id="ed-retire" style="color:var(--err)">Retire</button>' : '')) + '</div></section>';
    X.view(h, 'edit');
    const msg = (ok, text) => { $('ed-ok').hidden = !ok; $('ed-err').hidden = ok; $(ok ? 'ed-ok' : 'ed-err').textContent = text; };
    const run = async (B, label, fn) => { B.disabled = true; const t0 = B.textContent; B.textContent = label; try { const r = await fn(); msg(true, r.msg); return r; } catch (e) { msg(false, errText(e)); } finally { B.disabled = false; B.textContent = t0; } };
    $('ed-save').onclick = () => run($('ed-save'), $('f-src').value.trim() ? 'Saving and building slides… this can take a minute' : 'Saving…', async () => {
      const f = { ID: t.ID };
      ['Module', 'Group', 'Title', 'Type', 'Description', 'Recording', 'Status', 'Format', 'Cover slide', 'Recommended', 'FO items', 'Slide videos', 'Video link', 'Owner', 'Notes'].forEach((k) => { f[k] = $('f-' + k).value; });
      f.Featured = $('f-Featured').checked ? 'Yes' : '';
      f.src = $('f-src').value.trim();
      let r;
      try { r = await X.api('edSaveTraining', [f]); }
      catch (e) {
        // the server may have finished after the app stopped waiting: look before showing an error (no double adds)
        if (!/SLOW|OFFLINE|NETWORK/.test(e.message || '')) throw e;
        await edLoad(true);
        const hit = t.ID ? ED.trainings.find((x) => x.ID === t.ID)
          : ED.trainings.find((x) => x.Module === f.Module && x.Title.trim().toLowerCase() === f.Title.trim().toLowerCase());
        if (!hit) throw e;
        r = { id: hit.ID, msg: 'Saved. ' + (hit._building ? 'Slides are still being prepared. This page updates by itself when they are ready.' : 'The server was slow, but everything is in.') };
      }
      await useCat(r);
      X.refresh();
      setTimeout(() => { location.hash = '#/edit/trainings/' + encodeURIComponent(r.id); setTimeout(() => msg(true, r.msg), 50); }, 0);
      return r;
    });
    if ($('ed-live')) $('ed-live').onclick = () => run($('ed-live'), 'Working…', async () => { const r = await X.api('edStatus', [t.ID, 'Live']); await useCat(r); X.refresh(); edTraining(t.ID); msg(true, r.msg); return r; });
    if ($('ed-retire')) $('ed-retire').onclick = () => { if (confirm('Retire ' + t.ID + '? It stops showing in the app. You can set it back to Live later.')) run($('ed-retire'), 'Working…', async () => { const r = await X.api('edStatus', [t.ID, 'Retired']); await useCat(r); X.refresh(); edTraining(t.ID); msg(true, r.msg); return r; }); };
    if ($('ed-build')) $('ed-build').onclick = () => run($('ed-build'), 'Building…', async () => { const r = await X.api('edBuild', [t.ID]); await useCat(r); return r; });
    if (t._building) poll = setInterval(async () => { if (!location.hash.includes('/edit/trainings/' + encodeURIComponent(t.ID))) return clearInterval(poll); await edLoad(true); const n = ED.trainings.find((x) => x.ID === t.ID); if (n && !n._building) { clearInterval(poll); X.refresh(); edTraining(t.ID); X.toast('Library copy ready'); } }, 20000);
  }
  function edModules() {
    const q = edQ.toLowerCase();
    const list = ED.modules.filter((m) => !q || (m.Code + ' ' + m.Title + ' ' + m.Stage).toLowerCase().includes(q));
    X.view('<section class="sec"><div class="edhead"><h1 class="big" style="font-size:28px">Editor</h1><a class="btn" href="#/edit/modules/new">+ New module</a></div>' + edTabs() +
      '<input id="edq" type="search" class="edin" placeholder="Search code or title" value="' + esc(edQ) + '" aria-label="Search modules">' +
      '<div class="edlist">' + list.map((m) => '<a class="edrow" href="#/edit/modules/' + encodeURIComponent(m.Code) + '"><span class="code">' + esc(m.Code) + '</span><span><b>' + esc(m.Title) + '</b><br><span class="sm muted">' +
        esc(String(m.Stage).replace(/^S(\d)$/, 'Stage $1') + ' · ' + (m._topic || m.Type || '—') + ' · ' + (m['Library access'] || 'access not set') + (m.Facilitator ? ' · ' + m.Facilitator : '') + (m._own ? ' · added by L&D' : '')) + '</span></span><span class="st' + (X.readyIn(m.Code) ? '' : ' soon') + '">' + X.readyIn(m.Code) + ' ready</span></a>').join('') + '</div></section>', 'edit');
    const I = $('edq'); I.oninput = () => { edQ = I.value; const pos = I.selectionStart; edModules(); const J = $('edq'); J.focus(); J.setSelectionRange(pos, pos); };
  }
  const TOPICS = { S2: ['Know', 'Plan', 'Teach', 'Assess'], S3: ['Parent-facing', 'Little Sparks', 'Sparks Kid', 'Sparks Teen', 'Sparks Teen+', 'SLSA'] };
  const PREFIX = { S0: 'S0-', S1: 'NH', S2: 'S2-', S4: 'X', 'Parent-facing': 'S3-P', 'Little Sparks': 'LS-', 'Sparks Kid': 'SK-', 'Sparks Teen': 'TN-', 'Sparks Teen+': 'TP-', SLSA: 'SL-' };
  function nextCode(stage, topic) {   // same rule as the server
    const pre = PREFIX[stage === 'S3' ? topic : stage] || stage + '-';
    let max = 0;
    ED.modules.forEach((m) => { const r = m.Code.indexOf(pre) === 0 ? m.Code.slice(pre.length) : ''; if (/^\d+$/.test(r)) max = Math.max(max, +r); });
    return pre + String(max + 1).padStart(stage === 'S2' ? 2 : 1, '0');
  }
  function edNewModule() {
    const stages = [['S0', 'Stage 0 · Find Your Sparks'], ['S1', 'Stage 1 · Onboarding'], ['S2', 'Stage 2 · Core Readiness'], ['S3', 'Stage 3 · Programme & Parents'], ['S4', 'Stage 4 · Development']];
    X.view('<section class="sec"><a class="btn soft back" href="#/edit/modules">← Modules</a><h1 class="big" style="font-size:28px">New module</h1>' +
      '<p class="sm muted" style="margin:0">For a module that is not in the module catalogue. It shows in the Curriculum as "Coming soon" until it has a Live training.</p><div class="edform">' +
      fld('Stage', sel('n-Stage', 'S2', stages)) +
      '<div id="n-topicbox">' + fld('Topic', sel('n-Topic', '', [])) + '</div>' +
      fld('Module name', inp('n-Title', '', 'e.g. Storytelling in class')) +
      fld('Code', inp('n-Code', ''), '<span id="n-codehint"></span>') +
      fld('Hours', inp('n-Hours (as written)', '', 'e.g. 2')) +
      fld('You\'ll produce (deliverable)', area('n-Deliverable', '', 2)) +
      fld('Library access', sel('n-Library access', '', [['', '(not set)'], 'Open', 'Assigned']), 'Open = anyone can self-learn. Assigned = L&amp;D assigns it.') +
      fld('Facilitator', inp('n-Facilitator', '', 'Name')) +
      fld('Facilitator kit / materials link', inp('n-Materials link', '', 'https://drive.google.com/…')) +
      fld('FO rubric items', inp('n-FO items', '', 'e.g. B11, B12')) +
      fld('Tags', inp('n-Tags', '')) +
      '</div><p class="gerr" id="ed-err" role="alert" hidden></p><p class="gok" id="ed-ok" role="status" hidden></p>' +
      '<div class="edbtns"><button type="button" class="btn" id="n-save">Add module</button></div></section>', 'edit');
    const topicSync = () => {
      const st = $('n-Stage').value, ts = TOPICS[st] || [];
      $('n-topicbox').hidden = !ts.length;
      const cur = $('n-Topic').value;
      $('n-Topic').innerHTML = ts.map((x) => '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
      const nc = nextCode(st, $('n-Topic').value);
      $('n-Code').placeholder = nc; $('n-codehint').textContent = 'Leave empty to use ' + nc + '.';
    };
    $('n-Stage').onchange = topicSync; $('n-Topic').onchange = topicSync; topicSync();
    $('n-save').onclick = async () => {
      const B = $('n-save'); B.disabled = true; B.textContent = 'Adding…';
      const f = { Topic: $('n-topicbox').hidden ? '' : $('n-Topic').value };
      ['Stage', 'Title', 'Code', 'Hours (as written)', 'Deliverable', 'Library access', 'Facilitator', 'Materials link', 'FO items', 'Tags'].forEach((k) => { f[k] = $('n-' + k).value; });
      try {
        const r = await X.api('edAddModule', [f]); await useCat(r); X.refresh();
        location.hash = '#/edit/modules/' + encodeURIComponent(r.code); setTimeout(() => { if ($('ed-ok')) { $('ed-ok').textContent = r.msg; $('ed-ok').hidden = false; } }, 80);
      } catch (e) { $('ed-err').textContent = errText(e); $('ed-err').hidden = false; $('ed-ok').hidden = true; B.disabled = false; B.textContent = 'Add module'; }
    };
  }
  function edModule(code) {
    if (code === 'new') return edNewModule();
    const m = ED.modules.find((x) => x.Code === code);

    if (!m) return X.view('<section class="sec"><p>Not found.</p><a class="btn" href="#/edit/modules">Back</a></section>', 'edit');
    const trs = ED.trainings.filter((t) => t.Module === code);
    X.view('<section class="sec"><a class="btn soft back" href="#/edit/modules">← Modules</a><h1 class="big" style="font-size:28px">' + esc(m.Code) + ' · ' + esc(m.Title) + '</h1>' +
      '<p class="sm muted" style="margin:0">' + esc(String(m.Stage).replace(/^S(\d)$/, 'Stage $1') + ' · ' + (m.Type || '')) + (m._own ? '. Added by L&amp;D.' : '. Name, hours, deliverable and skills come from the module catalogue.') + '</p><div class="edform">' +
      (m._own ? fld('Module name', inp('m-Title', m.Title)) + fld('Hours', inp('m-Hours (as written)', m['Hours (as written)'], 'e.g. 2')) + fld('You\'ll produce (deliverable)', area('m-Deliverable', m.Deliverable, 2)) : '') +
      fld('Facilitator', inp('m-Facilitator', m.Facilitator, 'Name')) +
      fld('Facilitator kit / materials link', inp('m-Materials link', m['Materials link'], 'https://drive.google.com/…')) +
      fld('Library access', sel('m-Library access', m['Library access'], [['', '(not set)'], 'Open', 'Assigned']), 'Open = anyone can self-learn. Assigned = L&amp;D assigns it.') +
      fld('FO rubric items', inp('m-FO items', m['FO items'], 'e.g. B11, B12')) +
      fld('Tags', inp('m-Tags', m.Tags)) +
      '</div><p class="gerr" id="ed-err" role="alert" hidden></p><p class="gok" id="ed-ok" role="status" hidden></p>' +
      '<div class="edbtns"><button type="button" class="btn" id="m-save">Save</button><a class="btn soft" href="#/edit/trainings/new?m=' + encodeURIComponent(code) + '">+ Add a training to this module</a></div>' +
      '<h2 class="lbl" style="margin-top:8px">Trainings · ' + trs.length + '</h2><div class="edlist">' + trs.map((t) => '<a class="edrow" href="#/edit/trainings/' + encodeURIComponent(t.ID) + '"><span class="code">' + esc(t.ID) + '</span><span><b>' + esc(t.Title) + '</b>' + (t.Type === 'Refresher' ? ' <span class="sm muted">· Refresher</span>' : '') + '</span>' + statusPill(t) + '</a>').join('') + '</div></section>', 'edit');
    $('m-save').onclick = async () => {
      const B = $('m-save'); B.disabled = true;
      const f = {}; ['Facilitator', 'Materials link', 'Library access', 'FO items', 'Tags'].concat(m._own ? ['Title', 'Hours (as written)', 'Deliverable'] : []).forEach((k) => { f[k] = $('m-' + k).value; });
      try { const r = await X.api('edSaveModule', [code, f]); await useCat(r); X.refresh(); $('ed-ok').textContent = r.msg; $('ed-ok').hidden = false; $('ed-err').hidden = true; }
      catch (e) { $('ed-err').textContent = errText(e); $('ed-err').hidden = false; $('ed-ok').hidden = true; }
      B.disabled = false;
    };
  }
  // ------------------------------------------------------------ live sessions: pre/post test questions, sessions
  // ------------------------------------------------------------ Live session page: slide previews, one activity per slide, test positions, test questions
  const LP = {};   // training id → { slides, acts, preAt, postAt, qs }
  const TYN = { poll: 'Poll', text: 'Text', drag: 'Draggable', draw: 'Draw' };
  const TYH = { poll: 'Teachers tap one option. The projector shows a bar chart.', text: 'Teachers type a short answer. The projector shows the answers as notes.',
    drag: 'Teachers drag one dot on the slide. The projector shows all the dots on the slide.', draw: 'Teachers draw on the slide with a finger. The projector shows a gallery of drawings.' };
  const TYI = {
    poll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h10M7 14h6"/></svg>',
    drag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
    draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11a2.1 2.1 0 00-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></svg>'
  };
  // prompt templates: tap one, then edit (poll templates may bring their options)
  const TPL = {
    poll: [['Teachers, which one is correct?', ''], ['Teachers, how confident are you with this?', 'Very\nA bit\nNot yet'], ['Teachers, which would you try first?', '']],
    text: [['Teachers, type one word about this slide!'], ['Teachers, what\'s one idea you\'ll try in class?'], ['Teachers, what\'s still unclear?']],
    drag: [['Teachers, drag your dot to where you are now!'], ['Teachers, put your dot on the right answer!'], ['Teachers, drag your dot to show how you feel!']],
    draw: [['Teachers, draw on the slide!'], ['Teachers, circle the most important part!'], ['Teachers, draw your board plan!']]
  };
  const isTpl = (v) => !v || Object.keys(TPL).some((k) => TPL[k].some((x) => x[0] === v));
  let EL = { id: '', s: 1, d: null, q: '' };   // open training, chosen slide, unsaved activity draft, question being edited

  function edLive(id, sNum) {
    const t = ED.trainings.find((x) => x.ID === id);
    if (!t) return X.view('<section class="sec"><p>Training not found.</p><a class="btn soft" href="#/edit/trainings">← Trainings</a></section>', 'edit');
    if (EL.id !== id) EL = { id: id, s: 1, d: null, q: '' };
    if (+sNum) EL.s = +sNum;
    const key = 'pg-el-' + id, h0 = location.hash, old = LP[id] || S.json(key);
    if (old) { LP[id] = old; liveDraw(t); } else X.view('<section class="sec"><h1 class="big" style="font-size:28px">Live session</h1><p class="muted">Loading…</p></section>', 'edit');
    X.api('edLivePage', [id]).then((p) => {
      const changed = JSON.stringify(p) !== JSON.stringify(LP[id]);
      LP[id] = p; S.setJson(key, p);
      if (location.hash === h0 && (changed || !old) && !typing()) liveDraw(t);
    }).catch((e) => { if (!old) failed('edit', e); });
  }
  function livePageSet(id, p) { if (!p) return; LP[id] = p; S.setJson('pg-el-' + id, p); }

  function liveDraw(t) {
    const id = t.ID, P = LP[id], n = P.slides || 0;
    if (EL.s > n) EL.s = Math.max(1, n);
    X.view('<section class="sec"><a class="btn soft back" href="#/edit/trainings/' + encodeURIComponent(id) + '">← ' + esc(id) + '</a>' +
      '<h1 class="big" style="font-size:28px">Live session</h1><p class="sm muted" style="margin:0">' + esc(id + ' · ' + t.Title + ' · ' + n + ' slides') +
      '. Tap a slide to add an activity teachers do on their phones, or to place the tests.</p>' +
      (n ? '<div class="elstrip" id="el-strip" role="list"></div><p class="sm" id="el-sum" style="margin:0"></p>' +
        '<div class="elmain"><div class="elprev"><div class="elbig"><span class="elimg" id="el-bigimg"></span><div class="elov" id="el-ov"></div></div>' +
        '<div class="elnav"><button type="button" class="ibtn" id="el-prev" aria-label="Previous slide">‹</button><b id="el-no"></b><button type="button" class="ibtn" id="el-next" aria-label="Next slide">›</button></div></div>' +
        '<aside class="elpanel" id="el-panel"></aside></div>'
        : '<p class="muted">This training has no slides yet. Add a material file first; then you can add activities here.</p>') +
      '<h2 class="sec-h" style="font-size:20px">Pre-test and post-test questions</h2><p class="sm muted" style="margin:0">Teachers answer the same questions twice, so you can see what changed. Answers are checked on the server.</p>' +
      '<div id="el-qs"></div></section>', 'edit');
    if (n) {
      stripDraw(t); bigDraw(t); panelDraw(t);
      $('el-prev').onclick = () => pick(t, EL.s - 1); $('el-next').onclick = () => pick(t, EL.s + 1);
    }
    qsDraw(t);
  }
  const actAt = (P, s) => P.acts.find((a) => +a.Slide === s);
  function stripDraw(t) {
    const id = t.ID, P = LP[id], S0 = $('el-strip'); if (!S0) return;
    let h = '';
    for (let s = 1; s <= P.slides; s++) {
      const a = actAt(P, s);
      h += '<button type="button" role="listitem" class="elth' + (s === EL.s ? ' on' : '') + '" data-s="' + s + '" aria-label="Slide ' + s + (a ? ', ' + TYN[a.Type] : '') + '" aria-current="' + (s === EL.s) + '">' +
        '<span class="elimg" data-k="' + esc(id + ':' + s) + '"></span><span class="elno">' + s + '</span><span class="elbadges">' +
        (P.preAt === s ? '<i class="elb e-pre">PRE-TEST</i>' : '') + (a ? '<i class="elb act">' + TYN[a.Type] + '</i>' : '') + (P.postAt === s ? '<i class="elb e-post">POST-TEST</i>' : '') + '</span></button>';
    }
    S0.innerHTML = h;
    S0.querySelectorAll('.elth').forEach((b) => { b.onclick = () => pick(t, +b.dataset.s); });
    $('el-sum').innerHTML = '<b>Pre-test</b> opens at slide ' + P.preAt + (P.preAt === 1 ? ' (straight after joining)' : '') + ' · <b>Post-test</b> ' + (P.postAt ? 'opens at slide ' + P.postAt : 'opens when you tap End') +
      ' · ' + P.acts.length + ' activit' + (P.acts.length === 1 ? 'y' : 'ies');
    pics(S0);
    const on = S0.querySelector('.elth.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  /** Slide pictures come through the viewer's loader (same cache), the big one first. */
  function pics(root) {
    const get = window.STAR_SLIDE; if (!get) return;
    root.querySelectorAll('.elimg[data-k]').forEach((el) => {
      const k = el.dataset.k;
      get(k, el.id === 'el-bigimg').then((src) => { if (el.dataset.k === k && !el.firstChild) el.innerHTML = '<img src="' + src + '" alt="">'; }).catch(() => {});
    });
  }
  function bigDraw(t) {
    const B = $('el-bigimg'); if (!B) return;
    B.dataset.k = t.ID + ':' + EL.s; B.innerHTML = '';
    $('el-no').textContent = 'Slide ' + EL.s + ' of ' + LP[t.ID].slides;
    $('el-prev').disabled = EL.s <= 1; $('el-next').disabled = EL.s >= LP[t.ID].slides;
    pics(B.parentNode);
  }
  function pick(t, s) {
    const n = LP[t.ID].slides; if (s < 1 || s > n || s === EL.s) return;
    EL.s = s; EL.d = null;
    try { history.replaceState(null, '', '#/edit/livetests/' + encodeURIComponent(t.ID) + '?s=' + s); } catch (e) {}
    document.querySelectorAll('.elth').forEach((b) => { const on = +b.dataset.s === s; b.classList.toggle('on', on); b.setAttribute('aria-current', on); });
    const on = document.querySelector('.elth.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    bigDraw(t); panelDraw(t);
  }
  /** What a teacher's phone shows for this activity (and a hint on the slide preview). */
  function mock(d) {
    const ov = $('el-ov');
    if (ov) ov.innerHTML = d.ty === 'drag' ? '<i class="eldot"></i>' : d.ty === 'draw' ? '<i class="eldraw"></i>' : '';
    const opts = String(d.o || '').split(/\n|\|/).map((x) => x.trim()).filter(Boolean).slice(0, 6);
    return '<div class="elmock"><span class="lv-pill lime" style="align-self:flex-start">' + TYN[d.ty].toUpperCase() + '</span><b>' + esc(d.p || 'Your prompt shows here') + '</b>' +
      (d.ty === 'poll' ? (opts.length ? opts : ['Option 1', 'Option 2']).map((o) => '<span class="o">' + esc(o) + '</span>').join('')
        : d.ty === 'text' ? '<span class="in">Type your answer…</span><span class="btn sm-btn">Send</span>'
        : d.ty === 'drag' ? '<span class="sm muted">Teachers drag their dot on the slide, then tap Send.</span>'
        : '<span class="sm muted">Teachers draw on the slide (black, red, green, eraser, undo), then tap Send.</span>') + '</div>';
  }
  function panelDraw(t) {
    const id = t.ID, P = LP[id], s = EL.s, a = actAt(P, s), A = $('el-panel'); if (!A) return;
    const d = EL.d && EL.d.s === s ? EL.d : (EL.d = a ? { s: s, id: a.ID, ty: a.Type, p: a.Prompt, o: a.Options } : { s: s, id: '', ty: '', p: '', o: '' });
    A.innerHTML = '<h2 class="lbl" style="margin:0">Slide ' + s + (a ? ' · ' + TYN[a.Type] : '') + '</h2>' +
      '<div class="eltypes" role="group" aria-label="Activity type">' + ['poll', 'text', 'drag', 'draw'].map((ty) => '<button type="button" class="eltype' + (d.ty === ty ? ' on' : '') + '" data-ty="' + ty + '" aria-pressed="' + (d.ty === ty) + '">' + TYI[ty] + '<span>' + TYN[ty] + '</span></button>').join('') + '</div>' +
      (d.ty ? '<p class="sm muted" style="margin:0">' + TYH[d.ty] + '</p>' +
        '<div class="eltpl"><span class="sm"><b>Templates</b> (tap one, then edit)</span>' + TPL[d.ty].map((x, i) => '<button type="button" class="chip" data-tp="' + i + '">' + esc(x[0]) + '</button>').join('') + '</div>' +
        fld('Prompt (what teachers see)', area('el-p', d.p, 2)) +
        (d.ty === 'poll' ? fld('Options (one per line, 2 to 6)', area('el-o', d.o, 4)) : '') +
        '<p class="gerr" id="el-err" role="alert" hidden></p>' +
        '<div class="edbtns"><button type="button" class="btn" id="el-save">' + (d.id ? 'Save changes' : 'Add to slide ' + s) + '</button>' +
        (d.id ? '<button type="button" class="btn soft" id="el-rm" style="color:var(--err)">Remove</button>' : '<button type="button" class="btn soft" id="el-cx">Cancel</button>') + '</div>' +
        '<div class="elphone"><small class="sm muted">What teachers see on their phones</small><div id="el-mock">' + mock(d) + '</div></div>'
        : '<p class="muted" style="margin:0">No activity on this slide. Pick one above to add it.</p>') +
      '<h2 class="lbl" style="margin:8px 0 0">Tests</h2><div class="edbtns">' +
      (P.preAt === s ? '<span class="st">Pre-test opens here</span>' : '<button type="button" class="btn soft" id="el-pre">Pre-test opens at this slide</button>') +
      (P.postAt === s ? '<span class="st">Post-test opens here</span><button type="button" class="btn soft" id="el-postend">Move post-test to the end</button>' : '<button type="button" class="btn soft" id="el-post">Post-test opens at this slide</button>') + '</div>';
    if (!d.ty && $('el-ov')) $('el-ov').innerHTML = '';
    // events
    A.querySelectorAll('.eltype').forEach((b) => {
      b.onclick = () => {
        const ty = b.dataset.ty; if (d.ty === ty) return;
        d.ty = ty;
        if (isTpl(d.p)) d.p = TPL[ty][0][0];                 // keep their own words, replace a template
        if (ty === 'poll' && !d.o) d.o = TPL.poll[0][1];
        panelDraw(t); if ($('el-p')) $('el-p').focus();
      };
    });
    A.querySelectorAll('[data-tp]').forEach((b) => {
      b.onclick = () => { const x = TPL[d.ty][+b.dataset.tp]; d.p = x[0]; if (d.ty === 'poll' && x[1]) d.o = x[1]; panelDraw(t); const P2 = $('el-p'); if (P2) { P2.focus(); P2.setSelectionRange(P2.value.length, P2.value.length); } };
    });
    const sync = () => { d.p = $('el-p') ? $('el-p').value : d.p; d.o = $('el-o') ? $('el-o').value : d.o; if ($('el-mock')) $('el-mock').innerHTML = mock(d); };
    if ($('el-p')) $('el-p').oninput = sync;
    if ($('el-o')) $('el-o').oninput = sync;
    const err = (e) => { $('el-err').textContent = errText(e); $('el-err').hidden = false; };
    const after = (r) => { livePageSet(id, r.page); EL.d = null; X.toast(r.msg); stripDraw(t); panelDraw(t); };
    if ($('el-save')) $('el-save').onclick = async () => {
      sync(); const B = $('el-save'); B.disabled = true; B.textContent = 'Saving…';
      try { after(await X.api('edSaveActivity', [{ Training: id, ID: d.id || '', Slide: s, Type: d.ty, Prompt: d.p, Options: d.o }])); }
      catch (e) { err(e); B.disabled = false; B.textContent = d.id ? 'Save changes' : 'Add to slide ' + s; }
    };
    if ($('el-cx')) $('el-cx').onclick = () => { EL.d = { s: s, id: '', ty: '', p: '', o: '' }; panelDraw(t); };
    if ($('el-rm')) $('el-rm').onclick = async () => {
      const B = $('el-rm'); B.disabled = true;
      try { after(await X.api('edHideActivity', [d.id, id])); } catch (e) { err(e); B.disabled = false; }
    };
    const place = async (B, f) => {
      B.disabled = true;
      try { const r = await X.api('edSaveActivity', [Object.assign({ Training: id }, f)]); livePageSet(id, r.page); X.toast(r.msg); stripDraw(t); panelDraw(t); }
      catch (e) { X.toast(errText(e)); B.disabled = false; }
    };
    if ($('el-pre')) $('el-pre').onclick = () => place($('el-pre'), { Type: 'pretest', Slide: s });
    if ($('el-post')) $('el-post').onclick = () => place($('el-post'), { Type: 'posttest', Slide: s });
    if ($('el-postend')) $('el-postend').onclick = () => place($('el-postend'), { Type: 'posttest', Slide: 0 });
  }

  function qsDraw(t) {
    const id = t.ID, P = LP[id], Q = $('el-qs'); if (!Q) return;
    const live = P.qs.filter((q) => q.Active), ed = live.find((q) => q.ID === EL.q) || {};
    const dup = !ed.ID && EL.dup ? live.find((q) => q.ID === EL.dup) : null;   // Duplicate: a copy to change, then Add
    const fv = ed.ID ? ed : dup ? Object.assign({}, dup, { ID: '' }) : {};
    Q.innerHTML = '<div class="edlist">' + (live.length ? live.map((q, i) => '<div class="qcard"><div class="sm muted">' + esc(q.ID) + ' · question ' + (i + 1) + '</div><p style="margin:4px 0"><b>' + esc(q.Question) + '</b></p>' +
        (q.Type === 'essay' ? '<p class="sm muted" style="margin:0 0 8px">Essay · teachers write their own answer (not scored)</p>'
          : '<p class="sm" style="margin:0 0 8px">' + ['A', 'B', 'C', 'D'].filter((k) => q[k]).map((k) => (k === q.Answer ? '<b>✓ ' + k + '. ' + esc(q[k]) + '</b>' : k + '. ' + esc(q[k]))).join('<br>') + '</p>') +
        '<div class="edbtns"><button type="button" class="btn soft" data-eq="' + esc(q.ID) + '">Edit</button><button type="button" class="btn soft" data-dup="' + esc(q.ID) + '">Duplicate</button><button type="button" class="btn soft" style="color:var(--err)" data-rm="' + esc(q.ID) + '">Remove</button></div></div>').join('')
        : '<p class="muted">No questions yet. Without questions, live sessions of this training skip the tests.</p>') + '</div>' +
      tplBox() +
      '<h2 class="lbl" id="lt-h">' + (ed.ID ? 'Edit ' + esc(ed.ID) : dup ? 'Add a copy of ' + esc(dup.ID) + ' (change it, then Add)' : 'Add a test question') + '</h2><div class="edform">' +
      fld('Type', sel('l-Type', fv.Type || '', [['', 'Multiple choice (scored)'], ['essay', 'Essay (teachers write; not scored)']])) +
      fld('Question', area('l-Question', fv.Question || '', 2)) +
      '<div id="l-mc" class="edform" style="grid-column:1/-1;padding:0">' + fld('A', inp('l-A', fv.A || '')) + fld('B', inp('l-B', fv.B || '')) + fld('C', inp('l-C', fv.C || ''), 'Optional') + fld('D', inp('l-D', fv.D || ''), 'Optional') +
      fld('Correct answer', sel('l-Answer', fv.Answer || '', [['', '(pick one)'], 'A', 'B', 'C', 'D'])) + '</div>' +
      '</div><p class="gerr" id="ed-err" role="alert" hidden></p>' +
      '<div class="edbtns"><button type="button" class="btn" id="l-save">' + (ed.ID ? 'Save question' : 'Add question') + '</button>' + (ed.ID || dup ? '<button type="button" class="btn soft" id="l-cx">Cancel</button>' : '') + '</div>';
    const after = (r) => { livePageSet(id, r.page); EL.q = ''; EL.dup = ''; X.toast(r.msg); qsDraw(t); };
    $('l-save').onclick = async () => {
      const B = $('l-save'); B.disabled = true;
      const f = { Training: id, ID: ed.ID || '' }; ['Type', 'Question', 'A', 'B', 'C', 'D', 'Answer'].forEach((k) => { f[k] = $('l-' + k).value; });
      try { after(await X.api('edSaveLiveTest', [f])); }
      catch (e) { $('ed-err').textContent = errText(e); $('ed-err').hidden = false; B.disabled = false; }
    };
    if ($('l-cx')) $('l-cx').onclick = () => { EL.q = ''; EL.dup = ''; qsDraw(t); };
    Q.querySelectorAll('[data-dup]').forEach((b) => { b.onclick = () => { EL.q = ''; EL.dup = b.dataset.dup; qsDraw(t); $('lt-h').scrollIntoView({ block: 'start' }); $('l-Question').focus(); }; });
    tplWire(t, after);
    const tySync = () => { $('l-mc').hidden = $('l-Type').value === 'essay'; };
    $('l-Type').onchange = tySync; tySync();
    Q.querySelectorAll('[data-eq]').forEach((b) => { b.onclick = () => { EL.q = b.dataset.eq; EL.dup = ''; qsDraw(t); $('lt-h').scrollIntoView({ block: 'start' }); $('l-Question').focus(); }; });
    Q.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { after(await X.api('edHideLiveTest', [b.dataset.rm, id])); } catch (e) { X.toast(errText(e)); b.disabled = false; } }; });
  }
  // ---- Add from template: download the Word template, copy the prompt for Claude, upload the filled file (or paste)
  function tplBox() {
    const T = EL.tp, ok = T ? T.qs.filter((q) => !q.err) : [], bad = T ? T.qs.filter((q) => q.err) : [];
    return '<div class="tplbox"><b>Add from template</b><p class="sm muted" style="margin:0">Add many questions at once: download the template, let Claude fill it (or fill it yourself), then upload it.</p>' +
      '<div class="edbtns"><a class="btn soft" href="templates/star-test-template.docx" download="STAR test template.docx">1 · Download template</a>' +
      '<button type="button" class="btn soft" id="tp-copy">2 · Copy prompt for Claude</button>' +
      '<label class="btn" for="tp-file" tabindex="0" id="tp-flbl">3 · Upload filled file</label><input type="file" id="tp-file" accept=".docx,.txt,.md" hidden></div>' +
      '<button type="button" class="lv-link" id="tp-pbtn">' + (EL.tpPaste ? 'Hide the paste box' : 'Or paste the questions as text') + '</button>' +
      (EL.tpPaste ? '<textarea id="tp-text" rows="8" class="tptext" placeholder="1. Question…&#10;A. …&#10;B. …&#10;Answer: B&#10;&#10;2. Essay question…">' + esc(EL.tpText || '') + '</textarea><div class="edbtns"><button type="button" class="btn soft" id="tp-check">Check the text</button></div>' : '') +
      '<p class="gerr" id="tp-err" role="alert" hidden></p>' +
      (T ? '<div class="tpprev"><p style="margin:0"><b>' + T.qs.length + ' question' + (T.qs.length === 1 ? '' : 's') + ' found</b>' + (T.src ? ' in ' + esc(T.src) : '') + ': ' +
        T.qs.filter((q) => !q.Type).length + ' multiple choice, ' + T.qs.filter((q) => q.Type).length + ' essay' + (bad.length ? ' · <span style="color:var(--err)"><b>' + bad.length + ' to fix</b></span>' : '') + '</p>' +
        T.qs.map((q) => '<div class="tpq' + (q.err ? ' bad' : '') + '"><span class="sm muted">' + q.n + ' · ' + (q.Type ? 'Essay' : 'Multiple choice') + '</span><b>' + esc(q.Question || '(no question text)') + '</b>' +
          (q.Type ? '' : '<span class="sm">' + ['A', 'B', 'C', 'D'].filter((k) => q[k]).map((k) => (k === q.Answer ? '<b>✓ ' + k + '. ' + esc(q[k]) + '</b>' : k + '. ' + esc(q[k]))).join(' · ') + '</span>') +
          (q.err ? '<span class="sm" style="color:var(--err)">⚠ ' + esc(q.err) + '</span>' : '') + '</div>').join('') +
        '<div class="edbtns">' + (bad.length ? '<span class="sm" style="color:var(--err)">Fix the questions marked ⚠ in your file, then upload it again.</span>' : '<button type="button" class="btn" id="tp-add">Add all ' + ok.length + '</button>') +
        '<button type="button" class="btn soft" id="tp-clear">Clear</button></div></div>' : '') + '</div>';
  }
  function tplWire(t, after) {
    const id = t.ID, err = (m) => { const E = $('tp-err'); E.textContent = m; E.hidden = !m; };
    const show = (qs, src) => {
      if (!qs.length) { EL.tp = null; qsDraw(t); return err('No questions found. Check that each question starts with a number, like "1."'); }
      EL.tp = { qs, src }; qsDraw(t); const B = document.querySelector('.tpprev'); if (B) B.scrollIntoView({ block: 'nearest' });
    };
    $('tp-copy').onclick = () => {
      const txt = window.STAR_TESTS.PROMPT;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => X.toast('Prompt copied. Paste it in Claude with your questions or slides.'), () => { EL.tpPaste = true; EL.tpText = txt; qsDraw(t); X.toast('Copy the prompt from the box.'); });
    };
    $('tp-flbl').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('tp-file').click(); } };
    $('tp-file').onchange = async () => {
      const f = $('tp-file').files[0]; if (!f) return;
      try { show(await window.STAR_TESTS.read(f), f.name); } catch (e) { err(e.message || 'This file could not be read.'); }
    };
    $('tp-pbtn').onclick = () => { EL.tpPaste = !EL.tpPaste; qsDraw(t); if (EL.tpPaste) $('tp-text').focus(); };
    if ($('tp-text')) $('tp-text').oninput = () => { EL.tpText = $('tp-text').value; };
    if ($('tp-check')) $('tp-check').onclick = () => show(window.STAR_TESTS.parse($('tp-text').value), '');
    if ($('tp-clear')) $('tp-clear').onclick = () => { EL.tp = null; qsDraw(t); };
    if ($('tp-add')) $('tp-add').onclick = async () => {
      const B = $('tp-add'), list = EL.tp.qs.map((q) => ({ Type: q.Type, Question: q.Question, A: q.A, B: q.B, C: q.C, D: q.D, Answer: q.Answer }));
      B.disabled = true;
      // small parts, so each request stays under the server's size limit
      const parts = []; let cur = [];
      list.forEach((q) => { if (cur.length && JSON.stringify(cur.concat([q])).length > 14000) { parts.push(cur); cur = []; } cur.push(q); });
      if (cur.length) parts.push(cur);
      let r = null, n = 0;
      try {
        for (let i = 0; i < parts.length; i++) { B.textContent = 'Adding… ' + n + ' of ' + list.length; r = await X.api('edAddLiveTests', [id, parts[i]]); n += r.n; }
        EL.tp = null; EL.tpText = ''; EL.tpPaste = false; after({ page: r.page, msg: 'Added ' + n + ' questions.' });
      } catch (e) {
        if (r) livePageSet(id, r.page);
        B.disabled = false; B.textContent = 'Add all';
        err((n ? n + ' added, then: ' : '') + errText(e));
      }
    };
  }
  const when = (ms) => ms ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const pct = (x) => (x == null || isNaN(x) ? '–' : x + '%');
  function edSessions() { return fresh('pg-eds', 'edSessions', [], sessionsDraw, 'edit', 'Editor', '#/edit/sessions'); }
  function sessionsDraw(ss) {
    X.view('<section class="sec"><h1 class="big" style="font-size:28px">Editor</h1>' + edTabs() +
      '<p class="sm muted" style="margin:0">Live sessions, newest first. Facilitators start one from a training with Go live.</p><div class="edlist">' +
      (ss.length ? ss.map((s) => '<a class="edrow" href="#/edit/sessions/' + encodeURIComponent(s.code + '-' + s.st) + '"><span class="code">' + esc(s.code) + '</span><span><b>' + esc(s.t + ' · ' + s.tt) + '</b><br><span class="sm muted">' +
        esc(when(s.st) + ' · ' + (s.ce || 'no centre') + ' · ' + s.host + (s.en ? '' : ' · still open')) + '</span></span><span class="sm" style="text-align:right">' + s.people + ' people<br>' + pct(s.pre) + ' → ' + pct(s.post) + '</span></a>').join('')
        : '<p class="muted">No live sessions yet.</p>') + '</div></section>', 'edit');
  }
  function actSummary(ans) {
    const by = {}; ans.forEach((a) => { (by[a.i] = by[a.i] || { s: a.s, ty: a.ty, list: [] }).list.push(a); });
    const TYN = { poll: 'Poll', text: 'Text', drag: 'Draggable', draw: 'Draw' };
    return Object.keys(by).sort((x, y) => by[x].s - by[y].s).map((k) => {
      const g = by[k];
      let body;
      if (g.ty === 'poll') { const c = {}; g.list.forEach((a) => { c[a.v] = (c[a.v] || 0) + 1; }); body = Object.keys(c).sort((x, y) => c[y] - c[x]).map((o) => esc(o) + ': <b>' + c[o] + '</b>').join(' · '); }
      else body = g.list.map((a) => '<div>' + esc(a.n + (a.c ? ' (' + a.c + ')' : '')) + ': ' + (g.ty === 'draw' && /^https:\/\//.test(a.v) ? '<a href="' + esc(a.v) + '" target="_blank" rel="noopener">open drawing</a>' : g.ty === 'drag' ? esc(a.v.split(',').map((x, k) => Math.round(+x * 100) + '% ' + (k ? 'down' : 'across')).join(', ')) : esc(a.v)) + '</div>').join('');
      return '<div class="qcard"><div class="sm muted">Slide ' + g.s + ' · ' + TYN[g.ty] + ' · ' + g.list.length + ' answer' + (g.list.length === 1 ? '' : 's') + '</div><div class="sm" style="margin-top:6px">' + body + '</div></div>';
    }).join('');
  }
  function edSession(key) {
    const m = /^(\d{6})-(\d+)$/.exec(key || '');
    return fresh('pg-es-' + key, 'edSession', [m ? m[1] : '', m ? +m[2] : 0], sessionDraw, 'edit', 'Session', '#/edit/sessions/' + encodeURIComponent(key));
  }
  function sessionDraw(d) {
    const s = d.s, sc = (x) => (x ? x.s + '/' + x.t : '–');
    X.view('<section class="sec"><a class="btn soft back" href="#/edit/sessions">← Sessions</a><h1 class="big" style="font-size:28px">' + esc(s.t + ' · ' + s.tt) + '</h1>' +
      '<p class="sm muted" style="margin:0">' + esc('Code ' + s.code + ' · ' + when(s.st) + (s.en ? ' to ' + when(s.en) : ' · still open') + ' · ' + (s.ce || 'no centre') + ' · host ' + s.host) + '</p>' +
      '<div class="lv-scores"><div class="lv-scbox"><small>Teachers</small><b>' + d.people.length + '</b></div><div class="lv-scbox"><small>Pre-test average</small><b>' + pct(s.pre) + '</b></div><div class="lv-scbox up"><small>Post-test average</small><b>' + pct(s.post) + '</b></div></div>' +
      '<h2 class="lbl">Attendance</h2><div class="edlist">' + (d.people.length ? d.people.map((p) => '<div class="edrow"><span class="code">' + esc(p.c || '—') + '</span><span><b>' + esc(p.n) + '</b>' +
        (p.em ? ' <a class="sm" href="#/person/' + encodeURIComponent(p.em) + '">profile</a>' : '') + '<br><span class="sm muted">' + (p.pa ? esc(p.pa) + ' · ' : '') + 'joined ' + esc(when(p.j)) +
        (p.h ? ' · hand up ' + p.h + '×' : '') + (p.q ? ' · ' + p.q + ' question' + (p.q > 1 ? 's' : '') : '') + '</span></span><span class="sm" style="text-align:right">Pre ' + sc(p.pre) + '<br>Post ' + sc(p.post) + '</span></div>').join('') : '<p class="muted">Nobody joined.</p>') + '</div>' +
      (d.essays && d.essays.length ? '<h2 class="lbl">Essay answers</h2>' + d.essays.map((e) => '<div class="qcard"><div class="sm muted">' + esc(e.id) + ' · ' + e.r.length + ' teacher' + (e.r.length === 1 ? '' : 's') + '</div><p style="margin:4px 0 8px"><b>' + esc(e.q) + '</b></p>' +
        e.r.map((r) => '<div class="esrow"><b class="sm">' + esc(r.n + (r.c ? ' (' + r.c + ')' : '')) + '</b><div class="escols"><div><small>Pre-test</small><p>' + esc(r.pre || '–') + '</p></div><div><small>Post-test</small><p>' + esc(r.post || '–') + '</p></div></div></div>').join('') + '</div>').join('') : '') +
      (d.ans && d.ans.length ? '<h2 class="lbl">Slide activities</h2>' + actSummary(d.ans) : '') +
      '<h2 class="lbl">Questions from the room</h2><div class="edlist">' + (d.q.length ? d.q.map((q) => '<div class="qcard"><div class="sm muted">' + esc(q.n + (q.c ? ' · ' + q.c : '') + ' · slide ' + q.s + ' · ' + when(q.ts)) + '</div><p style="margin:4px 0">' + esc(q.tx) + '</p></div>').join('') : '<p class="muted">No questions.</p>') + '</div>' +
      '<div class="eddanger"><b>Delete this session</b><p class="sm muted" style="margin:0">Removes its attendance, test scores, essays, activity answers and questions. This can\'t be undone. Drawings stay in the Drive folder.</p>' +
      '<button type="button" class="btn soft" id="ses-del" style="color:var(--err)">Delete session</button></div></section>', 'edit');
    let armed = 0;
    $('ses-del').onclick = async () => {
      const B = $('ses-del');
      if (Date.now() - armed > 4000) { armed = Date.now(); B.textContent = 'Tap again to delete'; setTimeout(() => { if (B.isConnected && !B.disabled) B.textContent = 'Delete session'; }, 4000); return; }
      B.disabled = true; B.textContent = 'Deleting…';
      try {
        const r = await X.api('edDeleteSession', [s.code, s.st]);
        S.setJson('pg-eds', r.sessions); S.setJson('pg-es-' + s.code + '-' + s.st, null);
        X.toast(r.msg); location.hash = '#/edit/sessions';
      } catch (e) { X.toast(errText(e)); B.disabled = false; B.textContent = 'Delete session'; }
    };
  }

  function edQuestions() { return fresh('pg-edq', 'edQuestions', [], questionsDraw, 'edit', 'Editor', '#/edit/questions'); }
  function questionsDraw(qs) {
    X.view('<section class="sec"><h1 class="big" style="font-size:28px">Editor</h1>' + edTabs() +
      '<p class="sm muted" style="margin:0">Unanswered first. Everyone sees the answers in the training.</p><div class="edlist">' +
      (qs.length ? qs.map((q) => '<div class="qcard"><div class="sm muted">' + esc(q.id + ' · ' + q.title) + (q.slide ? ' · slide ' + q.slide : '') + (q.at ? ' · ' + day(q.at) : '') + (q.hidden ? ' · hidden' : '') + '</div>' +
        '<p style="margin:4px 0 8px">' + esc(q.text) + '</p><textarea rows="2" data-row="' + q.row + '" aria-label="Answer">' + esc(q.answer) + '</textarea>' +
        '<div class="edbtns"><button type="button" class="btn" data-ans="' + q.row + '">' + (q.answer ? 'Update answer' : 'Post answer') + '</button><button type="button" class="btn soft" data-hide="' + q.row + '" data-h="' + (q.hidden ? 0 : 1) + '">' + (q.hidden ? 'Show' : 'Hide') + '</button></div></div>').join('')
        : '<p class="muted">No questions yet.</p>') + '</div></section>', 'edit');
    document.querySelectorAll('[data-ans]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { const r = await X.api('edAnswer', [+b.dataset.ans, document.querySelector('textarea[data-row="' + b.dataset.ans + '"]').value]); X.toast(r.msg); S.setJson('pg-edq', r.qs); questionsDraw(r.qs); } catch (e) { X.toast(errText(e)); b.disabled = false; } }; });
    document.querySelectorAll('[data-hide]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { const r = await X.api('edHide', [+b.dataset.hide, b.dataset.h === '1']); X.toast(r.msg); S.setJson('pg-edq', r.qs); questionsDraw(r.qs); } catch (e) { X.toast(errText(e)); b.disabled = false; } }; });
  }

  function forget() {   // sign out: remove saved pages from this device
    try { const P = (window.STAR.cfg.prefix || 'starlib-') + 'pg-'; Object.keys(localStorage).forEach((k) => { if (k.indexOf(P) === 0) localStorage.removeItem(k); }); } catch (e) {}
  }
  return { me, test, team, person, editor, prefetch, forget };
};
