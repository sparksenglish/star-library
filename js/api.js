/* STAR Library: talking to the Apps Script API, and saving small things on this phone. */
(function () {
  'use strict';
  const CFG = window.STAR_CONFIG || {};
  const P = CFG.prefix || 'starlib-';

  /** Saved on this device only, under the app's own prefix. */
  const store = {
    get(k) { try { return localStorage.getItem(P + k) || ''; } catch (e) { return ''; } },
    set(k, v) { try { if (v) localStorage.setItem(P + k, v); else localStorage.removeItem(P + k); } catch (e) {} },
    json(k) { try { return JSON.parse(localStorage.getItem(P + k) || 'null'); } catch (e) { return null; } },
    setJson(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
  };

  /**
   * call('boot', [token]) -> Promise of the data.
   * Errors are Error objects whose message is a short code (WRONG_PASSWORD, SIGNED_OUT, OFFLINE…).
   * A plain-text POST is a "simple request", so the browser sends it without a CORS pre-check.
   */
  async function call(fn, args, tries) {
    if (window.STAR_MOCK) return window.STAR_MOCK(fn, args || []);
    if (!CFG.api) throw new Error('NO_API');
    let res;
    try {
      res = await fetch(CFG.api, { method: 'POST', redirect: 'follow', body: JSON.stringify({ fn, args: args || [] }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    } catch (e) {
      if ((tries || 0) < 1) { await new Promise((r) => setTimeout(r, 800)); return call(fn, args, 1); }
      throw new Error('OFFLINE');
    }
    let body;
    try { body = await res.json(); } catch (e) { throw new Error('SERVER_ERROR'); }
    if (!body || !body.ok) throw new Error((body && body.error) || 'SERVER_ERROR');
    return body.data;
  }

  window.STAR = { call, store, cfg: CFG };
})();
