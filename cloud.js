// VPRCloud: the only place the app talks to Supabase (auth, Lookbook sync, analytics).
// When config.js is empty, `enabled` is false and every call is a no-op, so the
// prototype keeps working as a local-only guest app.
(function () {
  'use strict';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
  var SDK_SRI = 'sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R';
  var CONSENT_KEY = 'vpr_consent_v1', VISITOR_KEY = 'vpr_visitor_v1', SESSION_KEY = 'vpr_session_v1';

  var cfg = window.VPR_CONFIG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var sb = null, user = null, listeners = [];

  // kind: 'local' (default) or 'session'. Storage can throw when blocked; ids then live in memory.
  var mem = {};
  function store(kind) { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; } }
  function lsGet(k, kind) { try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v, kind) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (e) {} }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.from(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function idFor(key, kind) { var v = lsGet(key, kind) || mem[key]; if (!v) { v = uuid(); lsSet(key, v, kind); } mem[key] = v; return v; }

  // Pull any auth error Supabase put in the redirect URL (#error=...&error_description=...).
  var urlError = null;
  (function () {
    var h = location.hash.replace(/^#/, ''); if (!/(^|&)error/.test(h)) return;
    var p = new URLSearchParams(h);
    urlError = { code: p.get('error_code') || p.get('error'), message: (p.get('error_description') || '').replace(/\+/g, ' ') };
    history.replaceState(history.state, '', location.pathname + location.search);
  })();

  function loadSdk() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script');
      s.src = SDK; s.integrity = SDK_SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('Could not load Supabase SDK')); };
      document.head.appendChild(s);
    });
  }
  function toUser(u) {
    if (!u) return null;
    var m = u.user_metadata || {};
    return { id: u.id, email: u.email, name: m.display_name || (u.email || '').split('@')[0], createdAt: u.created_at };
  }
  function emit(evt) {
    // Deferred: Supabase warns against calling its API inside onAuthStateChange.
    setTimeout(function () { listeners.forEach(function (cb) { try { cb(evt, user); } catch (e) { console.error(e); } }); }, 0);
  }

  var ready = !enabled ? Promise.resolve(null) : loadSdk().then(function () {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      // keepalive lets the last analytics batch finish when the tab is closing.
      global: { fetch: function (url, opts) { return fetch(url, /\/rest\/v1\/events/.test(String(url)) ? Object.assign({}, opts, { keepalive: true }) : opts); } }
    });
    sb.auth.onAuthStateChange(function (evt, session) {
      user = toUser(session && session.user);
      if (/access_token|type=(signup|recovery|invite|magiclink)/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
      emit(evt);
    });
    return sb.auth.getSession().then(function (r) { user = toUser(r.data && r.data.session && r.data.session.user); return user; });
  }).catch(function (e) { console.warn('[VPRCloud]', e); enabled = false; return null; });

  function need() { return ready.then(function () { if (!sb) throw new Error('Cloud is not available'); return sb; }); }
  function unwrap(r) { if (r.error) throw r.error; return r.data; }
  function here() { return location.origin + location.pathname; }

  // Strip anything that should not leave the device or would bloat the row.
  function cleanLook(l) {
    var o = Object.assign({}, l), u = o.tryOnResultUrl;
    o.tryOnResultUrl = (typeof u === 'string' && /^https:\/\//.test(u) && u.length < 2000) ? u : null;
    return o;
  }

  // ── analytics ────────────────────────────────────────────────────────────
  var queue = [], timer = null;
  function device() { var w = window.innerWidth; return w < 760 ? 'mobile' : w < 1180 ? 'tablet' : 'desktop'; }
  // Keep payloads small and flat: the events table rejects rows over 2 KB, which would drop the whole batch.
  function cleanData(d) {
    var o = {}; if (!d || typeof d !== 'object') return o;
    Object.keys(d).slice(0, 12).forEach(function (k) {
      var v = d[k]; o[k.slice(0, 40)] = (v == null || typeof v === 'number' || typeof v === 'boolean') ? v : String(v).slice(0, 160);
    });
    return o;
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!queue.length || !enabled) return;
    var batch = queue.splice(0, queue.length);
    need().then(function (c) { return c.from('events').insert(batch); })
      .then(function (r) { if (r && r.error) console.warn('[VPRCloud] events', r.error.message); })
      .catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });

  window.VPRCloud = {
    get enabled() { return enabled; },
    ready: ready,
    urlError: function () { var e = urlError; urlError = null; return e; },
    user: function () { return user; },
    onAuth: function (cb) { listeners.push(cb); return function () { listeners = listeners.filter(function (x) { return x !== cb; }); }; },

    signUp: function (o) {
      return need().then(function (c) {
        return c.auth.signUp({ email: o.email, password: o.password, options: { emailRedirectTo: here(), data: { display_name: o.name || '', lang: o.lang || 'vi' } } });
      }).then(unwrap).then(function (d) {
        // With email confirmation on, an already-registered email comes back with no identities.
        if (d.user && Array.isArray(d.user.identities) && d.user.identities.length === 0) { var e = new Error('User already registered'); e.code = 'user_already_exists'; throw e; }
        return { needsConfirm: !d.session };
      });
    },
    signIn: function (o) { return need().then(function (c) { return c.auth.signInWithPassword({ email: o.email, password: o.password }); }).then(unwrap); },
    resetPassword: function (email) { return need().then(function (c) { return c.auth.resetPasswordForEmail(email, { redirectTo: here() }); }).then(unwrap); },
    updatePassword: function (password) { return need().then(function (c) { return c.auth.updateUser({ password: password }); }).then(unwrap); },
    client: need, // the shared Supabase client, for admin.html queries
    // Gemini via the "gemini" Edge Function (the API key never reaches the browser).
    // Resolves to the function's `data`; rejects with an Error whose .code is the function's error code.
    gemini: function (mode, context, question) {
      return need().then(function (c) { return c.functions.invoke('gemini', { body: { mode: mode, context: context, question: question || '' } }); })
        .then(function (r) {
          if (!r.error && r.data && r.data.ok) return r.data.data;
          var res = r.error && r.error.context;
          var read = res && typeof res.json === 'function' ? res.json().catch(function () { return {}; }) : Promise.resolve(r.data || {});
          return read.then(function (b) {
            var e = new Error((b && (b.detail || b.error)) || (r.error && r.error.message) || 'Gemini error');
            e.code = (b && b.error) || (res && res.status === 404 ? 'not_deployed' : 'network'); throw e;
          });
        });
    },
    isAdmin: function () { return need().then(function (c) { return c.rpc('is_admin'); }).then(function (r) { return !r.error && r.data === true; }).catch(function () { return false; }); },
    signOut: function () { flush(); return need().then(function (c) { return c.auth.signOut(); }).then(unwrap); },
    deleteAccount: function () {
      return need().then(function (c) { return c.rpc('delete_my_account').then(unwrap).then(function () { return c.auth.signOut({ scope: 'local' }); }); });
    },

    listLooks: function () {
      return need().then(function (c) { return c.from('looks').select('id,data,created_at').order('created_at', { ascending: false }).limit(500); })
        .then(unwrap).then(function (rows) { return rows.map(function (r) { return Object.assign({}, r.data, { id: r.id, createdAt: r.data.createdAt || r.created_at }); }); });
    },
    saveLooks: function (looks) {
      if (!looks.length) return Promise.resolve();
      var rows = looks.map(function (l) { var d = cleanLook(l); return { id: l.id, data: d, created_at: l.createdAt || new Date().toISOString() }; });
      return need().then(function (c) { return c.from('looks').upsert(rows, { onConflict: 'user_id,id' }); }).then(unwrap);
    },
    deleteLooks: function (ids) {
      if (!ids.length) return Promise.resolve();
      return need().then(function (c) { return c.from('looks').delete().in('id', ids); }).then(unwrap);
    },

    consent: function () { var v = lsGet(CONSENT_KEY); return v === 'granted' || v === 'denied' ? v : null; },
    setConsent: function (granted) {
      lsSet(CONSENT_KEY, granted ? 'granted' : 'denied');
      if (!granted) { queue = []; clearTimeout(timer); timer = null; }
      if (user && sb) sb.from('profiles').update({ analytics_consent: !!granted }).eq('id', user.id).then(function () {});
    },
    track: function (name, data, ctx) {
      if (!enabled || this.consent() !== 'granted' || !/^[a-z][a-z_]{1,39}$/.test(name)) return;
      queue.push({
        visitor_id: idFor(VISITOR_KEY), session_id: idFor(SESSION_KEY, 'session'), name: name,
        data: cleanData(data), lang: (ctx && ctx.lang) || null, view: (ctx && ctx.view) || null, device: device()
      });
      if (queue.length >= 20) flush(); else if (!timer) timer = setTimeout(flush, 4000);
    },
    flush: flush
  };
})();
