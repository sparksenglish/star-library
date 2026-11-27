/* STAR Library: read pre/post test questions from the Word template (or pasted text). No packages: a small zip
   reader plus the browser's own DecompressionStream. Used by the Editor › Live session page (more.js). */
(function () {
  'use strict';
  const PROMPT = "I'm making a pre-test / post-test for a STAR Library training.\nUse the attached template (or my questions/slides below) and give me the questions in EXACTLY this format, as plain text or a Word file:\n\n1. [Question text, one paragraph]\nA. [option]\nB. [option]\nC. [option]   (C and D are optional; at least A and B)\nD. [option]\nAnswer: [one letter: A, B, C or D]\n\n2. [Essay question text]   (no options and no Answer line = essay)\n\nRules:\n- Number every question (1., 2., 3. \u2026) and leave one empty line between questions.\n- Type the numbers and letters as text. Do not use Word's automatic numbering or bullets.\n- Options start with \"A.\", \"B.\", \"C.\", \"D.\" on their own lines.\n- Exactly one \"Answer:\" line for each multiple-choice question.\n- Do not add explanations, headings, bold text or anything else.\n- Keep the wording of my questions unless I ask you to change it.\n- If you fill the template file, put the questions under the line \"=== YOUR QUESTIONS START BELOW ===\".\n\nMy questions / slides:\n[paste here or attach the file]";

  /** One file out of a .docx (zip) as text. */
  async function unzipText(buf, name) {
    const dv = new DataView(buf), dec = new TextDecoder();
    let end = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error('This file is not a Word (.docx) file.');
    let off = dv.getUint32(end + 16, true);
    const count = dv.getUint16(end + 10, true);
    for (let k = 0; k < count; k++) {
      const method = dv.getUint16(off + 10, true), size = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), local = dv.getUint32(off + 42, true);
      if (dec.decode(new Uint8Array(buf, off + 46, nlen)) === name) {
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true), data = new Uint8Array(buf, start, size);
        if (method === 0) return dec.decode(data);
        if (!window.DecompressionStream) throw new Error('This browser can\'t read Word files. Paste the text instead.');
        const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
        return dec.decode(out);
      }
      off += 46 + nlen + elen + clen;
    }
    throw new Error('This Word file looks empty.');
  }

  /** The text of a .docx, one line per paragraph. Word's automatic numbering is turned back into "1." and "A.". */
  async function docxText(file) {
    const xml = new DOMParser().parseFromString(await unzipText(await file.arrayBuffer(), 'word/document.xml'), 'application/xml');
    const out = []; let qn = 0, li = 0;
    Array.from(xml.getElementsByTagName('w:p')).forEach((p) => {
      let t = '';
      const walk = (n) => {
        Array.from(n.childNodes).forEach((c) => {
          if (c.nodeName === 'w:t') t += c.textContent;
          else if (c.nodeName === 'w:tab') t += '\t';
          else if (c.nodeName === 'w:br') t += '\n';
          else if (c.nodeName !== 'w:pPr') walk(c);
        });
      };
      walk(p);
      const np = p.getElementsByTagName('w:numPr')[0], ps = p.getElementsByTagName('w:pStyle')[0];
      const sty = ps ? ps.getAttribute('w:val') || '' : '', listSty = /^List(Number|Paragraph)(\d?)$/i.exec(sty);
      if ((np || listSty) && t.trim() && !/^\s*(\d{1,3}|[A-Da-d])\s*[.)]/.test(t) && !/^\s*(answer|kunci|jawaban)\s*[:：]/i.test(t)) {
        const lv = np && np.getElementsByTagName('w:ilvl')[0];
        const lvl = lv ? +lv.getAttribute('w:val') || 0 : listSty && listSty[2] ? +listSty[2] - 1 : 0;
        if (lvl === 0) { qn++; li = 0; t = qn + '. ' + t; } else { t = 'ABCD'[Math.min(li++, 3)] + '. ' + t; }
      }
      out.push(t);
    });
    return out.join('\n');
  }

  /** Questions from text in the template format (or rows copied from a sheet: Question, A, B, C, D, Answer). */
  function parse(text) {
    text = String(text || '').replace(/\r/g, '').replace(/ /g, ' ');
    const re = /=+\s*YOUR QUESTIONS START BELOW\s*=+/gi; let mk = -1, m0;
    while ((m0 = re.exec(text))) mk = m0.index;                        // the last one (the prompt in the template mentions it too)
    if (mk >= 0) text = text.slice(mk).replace(/^[^\n]*\n?/, '');
    const lines = text.split('\n').map((l) => l.replace(/\*\*|__/g, '').replace(/^\s*[-•]\s+/, '').trim());
    const qs = [];
    const tabRows = lines.filter((l) => l.split('\t').length >= 3);
    if (tabRows.length && tabRows.length >= lines.filter(Boolean).length - 1) {          // copied from a sheet
      tabRows.forEach((l) => {
        const c = l.split('\t').map((x) => x.trim());
        if (/^question$/i.test(c[0])) return;
        const o = { A: c[1] || '', B: c[2] || '', C: c[3] || '', D: c[4] || '' };
        qs.push({ Question: c[0], opts: o, ans: (c[5] || '').toUpperCase().slice(0, 1) });
      });
    } else {
      let cur = null;
      lines.forEach((l) => {
        if (!l) return;
        let m;
        if ((m = /^(?:q(?:uestion)?\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i.exec(l)) && (!cur || !/^[A-Da-d][.)]/.test(l))) { cur = { Question: m[2], opts: {}, ans: '' }; qs.push(cur); return; }
        if (!cur) return;
        if ((m = /^([A-Da-d])\s*[.)]\s*(.+)$/.exec(l))) { cur.opts[m[1].toUpperCase()] = m[2]; return; }
        if ((m = /^(?:correct\s+)?(?:answer|kunci(?:\s+jawaban)?|jawaban)\s*[:：-]\s*\(?([A-Da-d])\b/i.exec(l))) { cur.ans = m[1].toUpperCase(); return; }
        const keys = Object.keys(cur.opts);
        if (keys.length) cur.opts[keys[keys.length - 1]] += ' ' + l; else cur.Question += (cur.Question ? ' ' : '') + l;
      });
    }
    return qs.map((q, i) => {
      const o = q.opts, has = ['A', 'B', 'C', 'D'].filter((k) => o[k]);
      const f = { Question: q.Question.trim(), Type: '', A: o.A || '', B: o.B || '', C: o.C || '', D: o.D || '', Answer: q.ans };
      let err = '';
      if (!f.Question) err = 'The question text is empty.';
      else if (!has.length && !q.ans) { f.Type = 'essay'; }
      else if (!has.length) err = 'It has an answer but no options.';
      else if (!o.A || !o.B) err = 'Add at least options A and B.';
      else if (!q.ans) err = 'The "Answer:" line is missing.';
      else if (!o[q.ans]) err = 'The answer is ' + q.ans + ', but there is no option ' + q.ans + '.';
      f.err = err; f.n = i + 1;
      return f;
    });
  }

  async function read(file) {
    if (/\.docx$/i.test(file.name)) return parse(await docxText(file));
    if (/\.(txt|md|csv|tsv)$/i.test(file.name) || /^text\//.test(file.type)) return parse(await file.text());
    throw new Error('Upload the filled Word file (.docx) or a text file (.txt).');
  }

  window.STAR_TESTS = { parse, read, PROMPT };
})();
