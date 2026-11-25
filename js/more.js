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
    if (here(hash) && JSON.stringify(d) !== JSON.stringify(old)) draw(d);
  }
  function prefetch(role) {   // after sign-in: get My page (and Team) ready in the background
    setTimeout(() => {
      X.api('profile', []).then((d) => S.setJson('pg-me', d)).catch(() => {});
      if (role && role !== 'Teacher') X.api('team', []).then((d) => S.setJson('pg-team', d)).catch(() => {});
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
  let ED = null, edTab = 'trainings', edQ = '', edFilter = '', poll = 0;
  async function edLoad(force) { if (!ED || force) ED = await X.api('edCatalogue', []); return ED; }
  const statusPill = (t) => t._building ? '<span class="st soon">Building…</span>' : '<span class="st' + (t.Status === 'Live' ? '' : ' soon') + '">' + esc(t.Status || 'Placeholder') + '</span>';
  const edTabs = () => '<div class="tabs">' + [['trainings', 'Trainings'], ['modules', 'Modules'], ['questions', 'Questions']].map((t) => '<a class="chip' + (edTab === t[0] ? ' on' : '') + '" href="#/edit/' + t[0] + '">' + t[1] + '</a>').join('') + '</div>';

  async function editor(tab, id) {
    edTab = tab || 'trainings';
    clearInterval(poll);
    loading('edit', 'Editor');
    try { await edLoad(!id); } catch (e) { return failed('edit', e); }
    if (edTab === 'trainings' && id) return edTraining(id);
    if (edTab === 'modules' && id) return edModule(id);
    if (edTab === 'questions') return edQuestions();
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
        (t.Status !== 'Retired' ? '<button type="button" class="btn soft" id="ed-retire" style="color:var(--err)">Retire</button>' : '')) + '</div></section>';
    X.view(h, 'edit');
    const msg = (ok, text) => { $('ed-ok').hidden = !ok; $('ed-err').hidden = ok; $(ok ? 'ed-ok' : 'ed-err').textContent = text; };
    const run = async (B, label, fn) => { B.disabled = true; const t0 = B.textContent; B.textContent = label; try { const r = await fn(); msg(true, r.msg); return r; } catch (e) { msg(false, errText(e)); } finally { B.disabled = false; B.textContent = t0; } };
    $('ed-save').onclick = () => run($('ed-save'), 'Saving…', async () => {
      const f = { ID: t.ID };
      ['Module', 'Group', 'Title', 'Type', 'Description', 'Recording', 'Status', 'Format', 'Cover slide', 'Recommended', 'FO items', 'Slide videos', 'Video link', 'Owner', 'Notes'].forEach((k) => { f[k] = $('f-' + k).value; });
      f.Featured = $('f-Featured').checked ? 'Yes' : '';
      f.src = $('f-src').value.trim();
      const r = await X.api('edSaveTraining', [f]);
      await edLoad(true); X.refresh();
      setTimeout(() => { location.hash = '#/edit/trainings/' + encodeURIComponent(r.id); setTimeout(() => msg(true, r.msg), 50); }, 0);
      return r;
    });
    if ($('ed-live')) $('ed-live').onclick = () => run($('ed-live'), 'Working…', async () => { const r = await X.api('edStatus', [t.ID, 'Live']); await edLoad(true); X.refresh(); edTraining(t.ID); msg(true, r.msg); return r; });
    if ($('ed-retire')) $('ed-retire').onclick = () => { if (confirm('Retire ' + t.ID + '? It stops showing in the app. You can set it back to Live later.')) run($('ed-retire'), 'Working…', async () => { const r = await X.api('edStatus', [t.ID, 'Retired']); await edLoad(true); X.refresh(); edTraining(t.ID); msg(true, r.msg); return r; }); };
    if ($('ed-build')) $('ed-build').onclick = () => run($('ed-build'), 'Building…', () => X.api('edBuild', [t.ID]));
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
        const r = await X.api('edAddModule', [f]); await edLoad(true); X.refresh();
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
      try { const r = await X.api('edSaveModule', [code, f]); await edLoad(true); X.refresh(); $('ed-ok').textContent = r.msg; $('ed-ok').hidden = false; $('ed-err').hidden = true; }
      catch (e) { $('ed-err').textContent = errText(e); $('ed-err').hidden = false; $('ed-ok').hidden = true; }
      B.disabled = false;
    };
  }
  async function edQuestions() {
    let qs; try { qs = await X.api('edQuestions', []); } catch (e) { return failed('edit', e); }
    X.view('<section class="sec"><h1 class="big" style="font-size:28px">Editor</h1>' + edTabs() +
      '<p class="sm muted" style="margin:0">Unanswered first. Everyone sees the answers in the training.</p><div class="edlist">' +
      (qs.length ? qs.map((q) => '<div class="qcard"><div class="sm muted">' + esc(q.id + ' · ' + q.title) + (q.slide ? ' · slide ' + q.slide : '') + (q.at ? ' · ' + day(q.at) : '') + (q.hidden ? ' · hidden' : '') + '</div>' +
        '<p style="margin:4px 0 8px">' + esc(q.text) + '</p><textarea rows="2" data-row="' + q.row + '" aria-label="Answer">' + esc(q.answer) + '</textarea>' +
        '<div class="edbtns"><button type="button" class="btn" data-ans="' + q.row + '">' + (q.answer ? 'Update answer' : 'Post answer') + '</button><button type="button" class="btn soft" data-hide="' + q.row + '" data-h="' + (q.hidden ? 0 : 1) + '">' + (q.hidden ? 'Show' : 'Hide') + '</button></div></div>').join('')
        : '<p class="muted">No questions yet.</p>') + '</div></section>', 'edit');
    document.querySelectorAll('[data-ans]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { const r = await X.api('edAnswer', [+b.dataset.ans, document.querySelector('textarea[data-row="' + b.dataset.ans + '"]').value]); X.toast(r.msg); edQuestions(); } catch (e) { X.toast(errText(e)); b.disabled = false; } }; });
    document.querySelectorAll('[data-hide]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { const r = await X.api('edHide', [+b.dataset.hide, b.dataset.h === '1']); X.toast(r.msg); edQuestions(); } catch (e) { X.toast(errText(e)); b.disabled = false; } }; });
  }

  function forget() {   // sign out: remove saved pages from this device
    try { const P = (window.STAR.cfg.prefix || 'starlib-') + 'pg-'; Object.keys(localStorage).forEach((k) => { if (k.indexOf(P) === 0) localStorage.removeItem(k); }); } catch (e) {}
  }
  return { me, test, team, person, editor, prefetch, forget };
};
