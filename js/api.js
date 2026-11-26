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
  // Google allows only 30 requests running at once for the whole app. When it is too busy it answers with a
  // page instead of JSON (nothing ran), or BUSY: wait a little (a different time on each phone) and try again.
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (n) => 1200 * n + Math.random() * 2000;
  async function call(fn, args, tries) {
    if (window.STAR_MOCK) return window.STAR_MOCK(fn, args || []);
    if (!CFG.api) throw new Error('NO_API');
    tries = tries || 0;
    let res;
    const ac = window.AbortController ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), 45000) : 0;   // never wait forever
    try {
      res = await fetch(CFG.api, { method: 'POST', redirect: 'follow', body: JSON.stringify({ fn, args: args || [] }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ac ? ac.signal : undefined });
    } catch (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('SLOW');
      if (tries < 1) { await pause(800); return call(fn, args, tries + 1); }
      throw new Error('OFFLINE');
    }
    let body;
    try { body = await res.json(); }
    catch (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('SLOW');
      if (tries < 3) { await pause(jitter(tries + 1)); return call(fn, args, tries + 1); }
      throw new Error('SERVER_ERROR');
    }
    clearTimeout(timer);
    // BUSY = nothing was written: try again by itself
    if (body && body.error === 'BUSY' && tries < 3) { await pause(jitter(tries + 1)); return call(fn, args, tries + 1); }
    if (!body || !body.ok) throw new Error((body && body.error) || 'SERVER_ERROR');
    return body.data;
  }

  window.STAR = { call, store, cfg: CFG };
})();
