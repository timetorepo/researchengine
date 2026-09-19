// Design-Mode bridge: this script is injected into every HTML document served
// by a project's live preview. It turns an arbitrary web app into something the
// AI (and the user) can see and operate: DOM/layout snapshots, element
// inspection with computed styles, click/type/assert actions, console capture,
// accessibility + responsive linting, and an in-page rasteriser that produces a
// real screenshot WITHOUT a headless browser.
//
// The script is intentionally dependency-free ES5-ish JS and never throws: every
// command answers, even when it fails. It talks to the Research Engine UI with
// window.postMessage (the preview is cross-origin by design).
//
// NOTE: no template literals or `${}` sequences inside the BRIDGE string below —
// it is embedded in a TS template literal and only interpolation-free code is safe.

export const BRIDGE_JS = String.raw`
(function () {
  if (window.__RE_DESIGN_BRIDGE__) return;
  window.__RE_DESIGN_BRIDGE__ = true;

  var HOST_SOURCE = 're-design-host';
  var BRIDGE_SOURCE = 're-design-bridge';
  var uidSeq = 0;
  var uidMap = new WeakMap();
  var consoleLog = [];
  var networkLog = [];
  var navCount = 0;
  var pickMode = false;
  var overlay = null;
  var lastError = null;
  // Shared secret handed over in the iframe URL hash, so only the IDE that
  // embedded this frame can drive it (and fake results are ignored).
  var TOKEN = (function () {
    try { var m = /re-token=([A-Za-z0-9_-]{4,40})/.exec(location.hash || ''); return m ? m[1] : ''; } catch (e) { return ''; }
  })();

  /* ---------------- console + error capture ---------------- */
  function record(level, args) {
    try {
      var parts = [];
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (a instanceof Error) parts.push(a.stack || a.message || String(a));
        else if (typeof a === 'object') { try { parts.push(JSON.stringify(a)); } catch (e) { parts.push(String(a)); } }
        else parts.push(String(a));
      }
      var text = parts.join(' ').slice(0, 900);
      if (level === 'error' || level === 'warn' || consoleLog.length < 400) {
        consoleLog.push({ level: level, text: text, at: Date.now(), count: 1 });
        if (consoleLog.length > 500) consoleLog.shift();
      }
    } catch (e) { /* never break the app */ }
  }
  var origError = console.error, origWarn = console.warn, origLog = console.log, origInfo = console.info;
  console.error = function () { record('error', arguments); origError.apply(console, arguments); };
  console.warn = function () { record('warn', arguments); origWarn.apply(console, arguments); };
  console.log = function () { record('log', arguments); origLog.apply(console, arguments); };
  console.info = function () { record('info', arguments); origInfo.apply(console, arguments); };
  window.addEventListener('error', function (e) {
    lastError = (e && e.message ? e.message : 'error') + (e && e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : '');
    record('error', [lastError]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    lastError = 'Unhandled promise rejection: ' + (r && r.message ? r.message : String(r));
    record('error', [lastError]);
  });
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function () {
        var url = String((arguments[0] && arguments[0].url) || arguments[0] || '');
        var t0 = Date.now();
        return origFetch.apply(this, arguments).then(function (res) {
          if (!res.ok) {
            networkLog.push({ url: url.slice(0, 300), status: res.status, ms: Date.now() - t0 });
            if (networkLog.length > 100) networkLog.shift();
          }
          return res;
        }, function (err) {
          networkLog.push({ url: url.slice(0, 300), status: 0, error: String(err && err.message || err), ms: Date.now() - t0 });
          return Promise.reject(err);
        });
      };
    }
  } catch (e) { /* ignore */ }

  /* ---------------- element identity + selectors ---------------- */
  function uid(el) {
    if (!el || el.nodeType !== 1) return null;
    var u = uidMap.get(el);
    if (!u) { u = 'e' + (++uidSeq); uidMap.set(el, u); try { el.setAttribute('data-re-uid', u); } catch (e) {} }
    return u;
  }
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      var sel = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + node.id); break; }
      var cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(function (c) { return c && c.length < 30; }).slice(0, 2);
      if (cls.length) sel += '.' + cls.join('.');
      var parent = node.parentElement;
      if (parent) {
        var same = 0, idx = 1, kids = parent.children;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].tagName === node.tagName) { same++; if (kids[i] === node) idx = same; }
        }
        if (same > 1) sel += ':nth-of-type(' + idx + ')';
      }
      parts.unshift(sel);
      if (node.parentElement && node.parentElement.id) { parts.unshift('#' + node.parentElement.id); break; }
      node = node.parentElement;
    }
    return parts.join(' > ');
  }
  function resolve(target) {
    if (!target) return null;
    var s = String(target);
    if (/^e\d+$/.test(s)) {
      var found = document.querySelector('[data-re-uid="' + s + '"]');
      if (found) return found;
    }
    try { return document.querySelector(s); } catch (e) { return null; }
  }
  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    return true;
  }
  /** Visible text of an element. jsdom (and any engine without layout) leaves
   *  innerText empty, so textContent is the reliable fallback. */
  function textOf(el) {
    if (!el) return '';
    var t = el.innerText;
    if (!t) t = el.textContent || '';
    return String(t).replace(/\s+/g, ' ').trim();
  }
  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }
  function accessibleName(el) {
    var t = el.getAttribute && (el.getAttribute('aria-label') || '');
    if (t) return t.trim();
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (el.id) {
        var lab = document.querySelector('label[for="' + el.id.replace(/"/g, '') + '"]');
        if (lab && lab.textContent) return lab.textContent.trim().slice(0, 80);
      }
      var wrapLab = el.closest && el.closest('label');
      if (wrapLab && wrapLab.textContent) return wrapLab.textContent.trim().slice(0, 80);
      return el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('title') || '';
    }
    if (el.tagName === 'IMG') return el.getAttribute('alt') || '(no alt)';
    var txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return txt.slice(0, 80);
  }
  function roleOf(el) {
    if (el.getAttribute && el.getAttribute('role')) return el.getAttribute('role');
    var t = el.tagName;
    if (t === 'A') return el.getAttribute('href') ? 'link' : 'generic';
    if (t === 'BUTTON') return 'button';
    if (t === 'INPUT') return el.type === 'submit' ? 'button' : (el.type || 'textbox');
    if (t === 'SELECT') return 'combobox';
    if (t === 'TEXTAREA') return 'textbox';
    if (/^H[1-6]$/.test(t)) return 'heading';
    if (t === 'IMG') return 'img';
    if (t === 'NAV') return 'navigation';
    if (t === 'MAIN') return 'main';
    if (t === 'HEADER') return 'banner';
    if (t === 'FOOTER') return 'contentinfo';
    if (t === 'FORM') return 'form';
    return 'generic';
  }
  function styleOf(el, props) {
    var cs = getComputedStyle(el);
    var out = {};
    for (var i = 0; i < props.length; i++) out[props[i]] = cs.getPropertyValue(props[i]);
    return out;
  }
  var STYLE_KEYS = ['display', 'position', 'width', 'height', 'font-size', 'font-weight', 'font-family',
    'line-height', 'color', 'background-color', 'border-radius', 'padding', 'margin', 'gap', 'flex-direction',
    'align-items', 'justify-content', 'overflow', 'z-index', 'text-align', 'box-shadow', 'border-width', 'border-color'];

  function parseColor(c) {
    var m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (v) { return parseFloat(v); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    if (!c) return null;
    var f = function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function effectiveBg(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var cs = getComputedStyle(node);
      var bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0.35) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  function contrastOf(el) {
    var fg = parseColor(getComputedStyle(el).color);
    if (!fg) return null;
    if (!textOf(el)) return null;
    var bg = effectiveBg(el);
    var l1 = lum(fg), l2 = lum(bg);
    if (l1 == null || l2 == null) return null;
    var ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { ratio: Math.round(ratio * 100) / 100, fg: getComputedStyle(el).color, bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')', passAA: ratio >= 4.5, passLargeAA: ratio >= 3 };
  }

  /* ---------------- page snapshot ---------------- */
  var KEY_SELECTOR = 'h1,h2,h3,h4,a[href],button,input,select,textarea,[role],[aria-label],img,form,main,header,footer,nav,aside,section,table,[data-testid],video,canvas,svg[width]';
  function snapshot(opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || 140;
    var nodes = [];
    var all = document.querySelectorAll(KEY_SELECTOR);
    var vp = { w: window.innerWidth, h: window.innerHeight };
    for (var i = 0; i < all.length && nodes.length < maxNodes; i++) {
      var el = all[i];
      if (!isVisible(el)) continue;
      var r = rectOf(el);
      if (r.y > vp.h * 4) continue; // far below the fold — noise for a first pass
      var cs = getComputedStyle(el);
      var txt = textOf(el);
      nodes.push({
        uid: uid(el),
        sel: cssPath(el),
        tag: el.tagName.toLowerCase(),
        role: roleOf(el),
        name: accessibleName(el).slice(0, 90),
        text: roleOf(el) === 'generic' ? undefined : txt.slice(0, 110) || undefined,
        rect: r,
        aboveFold: r.y + r.h > 0 && r.y < vp.h,
        style: {
          fs: cs.fontSize, fw: cs.fontWeight, color: cs.color, bg: cs.backgroundColor,
          pad: cs.padding, gap: cs.gap, radius: cs.borderRadius, display: cs.display
        },
        flags: flagsFor(el, cs, r, vp)
      });
    }
    var headings = [];
    var hs = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
    for (var h = 0; h < hs.length && h < 30; h++) {
      if (isVisible(hs[h])) headings.push({ tag: hs[h].tagName.toLowerCase(), text: textOf(hs[h]).slice(0, 90) });
    }
    return {
      url: location.href,
      title: document.title,
      viewport: vp,
      scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY), height: document.documentElement.scrollHeight },
      headings: headings,
      counts: {
        interactive: document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]').length,
        nodes: document.getElementsByTagName('*').length,
        images: document.images.length
      },
      elements: nodes,
      findings: audit(),
      console: consoleTail(12),
      network: networkLog.slice(-8)
    };
  }

  function flagsFor(el, cs, r, vp) {
    var flags = [];
    if (el.scrollWidth > el.clientWidth + 2 && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis')) flags.push('text-clipped');
    if (r.w > vp.w + 1) flags.push('overflows-viewport');
    if (r.x < -1) flags.push('off-screen-left');
    if (parseFloat(cs.fontSize) < 12) flags.push('tiny-text(' + cs.fontSize + ')');
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && (r.h < 32 || r.w < 24)) flags.push('small-target(' + r.w + 'x' + r.h + ')');
    var c = contrastOf(el);
    if (c && !c.passLargeAA && textOf(el)) flags.push('low-contrast(' + c.ratio + ':1)');
    if (/^\s*0px$/.test(cs.borderRadius) === false && r.w > 0 && r.h > 0 && textOf(el) && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && (el.tagName === 'DIV' || el.tagName === 'SECTION')) flags.push('transparent-text-container');
    if (el.tagName === 'IMG' && !el.getAttribute('alt')) flags.push('img-no-alt');
    if (el.tagName === 'INPUT' && !accessibleName(el)) flags.push('input-no-label');
    if (el.tagName === 'A' && el.getAttribute('href') === '#') flags.push('dead-link-href-#');
    return flags;
  }

  /** Cheap static audit across the whole document (not just the fold). */
  function audit() {
    var out = [];
    var push = function (kind, msg, sel) { if (out.length < 40) out.push({ kind: kind, msg: msg, sel: sel }); };
    var dk = document.documentElement;
    if (dk.scrollWidth > window.innerWidth + 2) push('layout', 'Document is horizontally scrollable (' + dk.scrollWidth + 'px content in ' + window.innerWidth + 'px viewport)', 'html');
    var hs = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
    var prev = 0;
    for (var i = 0; i < hs.length; i++) {
      var lvl = Number(hs[i].tagName[1]);
      if (prev && lvl > prev + 1) push('a11y', 'Heading level jumps from h' + prev + ' to h' + lvl + ': "' + textOf(hs[i]).slice(0, 50) + '"', cssPath(hs[i]));
      prev = lvl;
    }
    if (!document.querySelector('h1')) push('a11y', 'Page has no h1 heading', 'body');
    if (!document.querySelector('main,[role="main"]')) push('a11y', 'No <main> landmark', 'body');
    var imgs = document.images;
    for (var j = 0; j < imgs.length && j < 60; j++) {
      if (!imgs[j].getAttribute('alt')) push('a11y', 'Image without alt text', cssPath(imgs[j]));
      if (imgs[j].naturalWidth === 0 && imgs[j].complete) push('assets', 'Broken image: ' + (imgs[j].currentSrc || imgs[j].src || '').slice(-60), cssPath(imgs[j]));
    }
    var ctrls = document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]');
    var noName = 0;
    for (var k = 0; k < ctrls.length; k++) {
      if (!accessibleName(ctrls[k]) && isVisible(ctrls[k])) { noName++; if (noName <= 5) push('a11y', 'Interactive element has no accessible name (' + ctrls[k].tagName.toLowerCase() + ')', cssPath(ctrls[k])); }
    }
    var small = 0;
    for (var m = 0; m < ctrls.length; m++) {
      if (!isVisible(ctrls[m])) continue;
      var rr = ctrls[m].getBoundingClientRect();
      if (rr.height < 32 || rr.width < 24) small++;
    }
    if (small) push('touch', small + ' interactive element(s) smaller than 32px tall — hard to tap on mobile');
    for (var n = 0; n < ctrls.length && n < 200; n++) {
      if (ctrls[n].tagName === 'A' && ctrls[n].getAttribute('href') === '#') push('ux', 'Anchor with href="#" does nothing', cssPath(ctrls[n]));
      if (ctrls[n].tagName === 'IMG' && !ctrls[n].hasAttribute('width') && !ctrls[n].style.width) push('layout', 'Image without intrinsic size — can cause layout shift', cssPath(ctrls[n]));
    }
    var empties = document.querySelectorAll('div,section,article');
    var emptyCount = 0;
    for (var p = 0; p < empties.length && p < 400; p++) {
      var e = empties[p];
      if (e.children.length === 0 && !(e.textContent || '').trim() && isVisible(e)) {
        var er = e.getBoundingClientRect();
        if (er.width > 40 && er.height > 40) { emptyCount++; if (emptyCount <= 3) push('layout', 'Large empty block ' + Math.round(er.width) + 'x' + Math.round(er.height) + 'px (may be an unloaded/broken section)', cssPath(e)); }
      }
    }
    if (lastError) push('console', 'Runtime error captured: ' + lastError, '');
    var errors = consoleLog.filter(function (l) { return l.level === 'error'; });
    if (errors.length) push('console', errors.length + ' console error(s); first: ' + errors[0].text.slice(0, 160), '');
    for (var q = 0; q < networkLog.length && q < 5; q++) push('network', 'Request failed: ' + networkLog[q].status + ' ' + networkLog[q].url.slice(0, 90), '');
    return out;
  }

  /* ---------------- inspect ---------------- */
  function describe(el) {
    var cs = getComputedStyle(el);
    var r = el.getBoundingClientRect();
    var parents = [];
    var p = el.parentElement;
    while (p && parents.length < 4) { parents.push({ sel: cssPath(p), rect: rectOf(p), display: getComputedStyle(p).display }); p = p.parentElement; }
    var siblings = [];
    if (el.parentElement) {
      var kids = el.parentElement.children;
      for (var i = 0; i < kids.length && siblings.length < 8; i++) {
        if (kids[i] !== el) siblings.push({ sel: cssPath(kids[i]), rect: rectOf(kids[i]), tag: kids[i].tagName.toLowerCase() });
      }
    }
    return {
      uid: uid(el),
      sel: cssPath(el),
      tag: el.tagName.toLowerCase(),
      role: roleOf(el),
      name: accessibleName(el),
      text: textOf(el).slice(0, 400),
      rect: rectOf(el),
      box: {
        margin: cs.margin, padding: cs.padding, border: cs.borderWidth,
        contentBox: { w: el.clientWidth, h: el.clientHeight }, scroll: { w: el.scrollWidth, h: el.scrollHeight }
      },
      styles: styleOf(el, STYLE_KEYS),
      contrast: contrastOf(el),
      flags: flagsFor(el, cs, { x: r.x, y: r.y, w: r.width, h: r.height }, { w: window.innerWidth, h: window.innerHeight }),
      parents: parents,
      siblings: siblings,
      attributes: (function () {
        var a = {};
        for (var i = 0; i < el.attributes.length && i < 25; i++) {
          var at = el.attributes[i];
          if (at.name === 'style' && at.value.length > 400) a.style = at.value.slice(0, 400) + '…';
          else a[at.name] = String(at.value).slice(0, 200);
        }
        return a;
      })(),
      path: (function () {
        var chain = [], node = el;
        while (node && node.tagName && chain.length < 8) {
          chain.unshift(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.className && typeof node.className === 'string' ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
          node = node.parentElement;
        }
        return chain.join(' > ');
      })()
    };
  }

  /* ---------------- interactions ---------------- */
  function fire(el, type, init) {
    try { el.dispatchEvent(new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, view: window }, init || {}))); } catch (e) {}
  }
  function clickTarget(el) {
    if (!el) return { ok: false, error: 'element not found' };
    try { if (el.scrollIntoView) el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
    var r = rectOf(el);
    var before = { url: location.href, nodes: document.getElementsByTagName('*').length };
    highlight(el, true);
    fire(el, 'mouseover'); fire(el, 'mousedown'); fire(el, 'mouseup'); fire(el, 'click');
    try { if (typeof el.click === 'function') el.click(); } catch (e) {}
    return { ok: true, before: before, rect: r, tag: el.tagName.toLowerCase(), name: accessibleName(el).slice(0, 80) };
  }
  function typeInto(el, text, submit) {
    if (!el) return { ok: false, error: 'element not found' };
    try { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); el.focus(); } catch (e) {}
    var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto || {}, 'value');
    if (setter && setter.set) setter.set.call(el, text); else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (submit) {
      var form = el.form;
      fire(el, 'keydown', { key: 'Enter', keyCode: 13 });
      fire(el, 'keypress', { key: 'Enter', keyCode: 13 });
      fire(el, 'keyup', { key: 'Enter', keyCode: 13 });
      if (form && el.type !== 'textarea') { try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (e) {} }
    }
    return { ok: true, value: el.value, tag: el.tagName.toLowerCase(), name: accessibleName(el).slice(0, 80) };
  }

  function checkOne(c) {
    var el = resolve(c.target || c.selector);
    var res = { check: c.kind, target: c.target || c.selector, pass: false };
    // Whole-page checks come first — they need no element and must not be
    // short-circuited by the "element not found" guard below.
    if (c.kind === 'count') {
      var list = []; try { list = document.querySelectorAll(c.selector || c.target); } catch (e) {}
      res.pass = list.length === Number(c.expect);
      res.detail = list.length + ' element(s) matched (expected ' + c.expect + ')';
      return res;
    }
    if (c.kind === 'noConsoleErrors') {
      var errs = consoleLog.filter(function (l) { return l.level === 'error'; });
      res.pass = errs.length === 0;
      res.detail = errs.length ? errs.length + ' console error(s): ' + errs[0].text.slice(0, 120) : 'no console errors';
      return res;
    }
    if (c.kind === 'noHorizontalScroll') {
      res.pass = document.documentElement.scrollWidth <= window.innerWidth + 2;
      res.detail = document.documentElement.scrollWidth + 'px content vs ' + window.innerWidth + 'px viewport';
      return res;
    }
    if (c.kind === 'exists') { res.pass = !!el; res.detail = el ? 'found ' + cssPath(el) : 'not found'; return res; }
    if (!el) { res.detail = 'element not found: ' + (c.target || c.selector); return res; }
    if (c.kind === 'visible') { res.pass = isVisible(el); res.detail = res.pass ? 'visible' : 'hidden or zero-size'; return res; }
    if (c.kind === 'text') {
      var have = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      var want = String(c.expect || '');
      res.pass = c.mode === 'equals' ? have === want : have.toLowerCase().indexOf(want.toLowerCase()) !== -1;
      res.detail = JSON.stringify(have.slice(0, 160)) + (res.pass ? ' contains ' : ' does NOT contain ') + JSON.stringify(want);
      return res;
    }
    if (c.kind === 'value') { res.pass = String(el.value || '') === String(c.expect || ''); res.detail = 'value is ' + JSON.stringify(String(el.value || '').slice(0, 80)); return res; }
    if (c.kind === 'style') {
      var got = getComputedStyle(el).getPropertyValue(c.prop);
      res.pass = String(got).trim() === String(c.expect).trim();
      res.detail = c.prop + ' = ' + got + ' (expected ' + c.expect + ')';
      return res;
    }
    if (c.kind === 'contrast') {
      var cc = contrastOf(el);
      res.pass = !!(cc && cc.ratio >= (Number(c.expect) || 4.5));
      res.detail = cc ? cc.ratio + ':1' : 'unknown';
      return res;
    }
    if (c.kind === 'rect') {
      var rr = rectOf(el);
      res.pass = (!c.minWidth || rr.w >= c.minWidth) && (!c.minHeight || rr.h >= c.minHeight) && (!c.maxWidth || rr.w <= c.maxWidth);
      res.detail = 'rect ' + rr.w + 'x' + rr.h;
      return res;
    }
    res.detail = 'unknown check kind: ' + c.kind;
    return res;
  }

  /* ---------------- overlay highlighting ---------------- */
  function ensureOverlay() {
    if (overlay && overlay.parentNode) return overlay;
    overlay = document.createElement('div');
    overlay.setAttribute('data-re-overlay', '1');
    overlay.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #3ddc84;background:rgba(61,220,132,0.14);border-radius:4px;transition:all .12s ease;top:0;left:0;width:0;height:0;' +
      'font:600 10px/1.2 system-ui,sans-serif;color:#05170e;box-shadow:0 6px 24px rgba(0,0,0,.35)';
    overlay.innerHTML = '<span style="position:absolute;top:-18px;left:0;background:#3ddc84;color:#05170e;padding:1px 5px;border-radius:4px;white-space:nowrap"></span>';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }
  function highlight(el, keep) {
    var o = ensureOverlay();
    if (!el) { o.style.width = '0px'; o.style.height = '0px'; return { ok: true }; }
    var r = el.getBoundingClientRect();
    o.style.top = r.top + 'px'; o.style.left = r.left + 'px';
    o.style.width = r.width + 'px'; o.style.height = r.height + 'px';
    o.firstChild.textContent = el.tagName.toLowerCase() + ' · ' + Math.round(r.width) + '×' + Math.round(r.height) + (accessibleName(el) ? ' · ' + accessibleName(el).slice(0, 40) : '');
    if (!keep) setTimeout(function () { if (overlay) { overlay.style.width = '0px'; overlay.style.height = '0px'; } }, 1400);
    return { ok: true, rect: rectOf(el) };
  }
  window.addEventListener('scroll', function () { if (overlay) { overlay.style.width = '0px'; overlay.style.height = '0px'; } }, true);

  /* ---------------- element picker ---------------- */
  var pickHandler = null, pickHover = null;
  function setPick(on) {
    pickMode = !!on;
    if (pickHandler) { document.removeEventListener('mousemove', pickHover, true); document.removeEventListener('click', pickHandler, true); pickHandler = null; }
    if (!pickMode) return { ok: true, picking: false };
    pickHover = function (e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-re-overlay')) return; highlight(e.target, true); };
    pickHandler = function (e) {
      e.preventDefault(); e.stopPropagation();
      var el = e.target;
      setPick(false);
      highlight(el, false);
      send('picked', describe(el));
    };
    document.addEventListener('mousemove', pickHover, true);
    document.addEventListener('click', pickHandler, true);
    return { ok: true, picking: true };
  }

  /* ---------------- screenshot (DOM → SVG → canvas) ---------------- */
  var SCREENSHOT_PROPS = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height', 'margin', 'padding', 'border', 'border-width', 'border-style', 'border-color', 'border-radius',
    'background', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align',
    'text-decoration', 'text-transform', 'white-space', 'overflow', 'overflow-x', 'overflow-y', 'opacity', 'box-shadow',
    'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'grid-template-columns', 'grid-template-rows',
    'grid-column', 'grid-row', 'transform', 'vertical-align', 'object-fit', 'list-style', 'z-index', 'visibility', 'pointer-events'];
  function inlineStyles(src, dst, depth) {
    if (depth > 22) return;
    var cs = getComputedStyle(src);
    var css = '';
    for (var i = 0; i < SCREENSHOT_PROPS.length; i++) {
      var v = cs.getPropertyValue(SCREENSHOT_PROPS[i]);
      if (!v || v === 'none' && SCREENSHOT_PROPS[i].indexOf('background') === 0) { if (SCREENSHOT_PROPS[i] === 'background-image') css += 'background-image:none;'; continue; }
      css += SCREENSHOT_PROPS[i] + ':' + v + ';';
    }
    var r = src.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (cs.position === 'static')) css += 'box-sizing:border-box;';
    dst.setAttribute('style', css);
    if (src.tagName === 'IMG') {
      try {
        var c = document.createElement('canvas');
        c.width = src.naturalWidth || src.width; c.height = src.naturalHeight || src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        dst.setAttribute('src', c.toDataURL('image/png'));
      } catch (e) { dst.setAttribute('src', src.currentSrc || src.src || ''); }
    }
    if (src.tagName === 'INPUT' || src.tagName === 'TEXTAREA') { try { dst.setAttribute('value', src.value); } catch (e) {} }
    if (src.tagName === 'CANVAS') {
      try {
        var img = document.createElement('img');
        img.setAttribute('src', src.toDataURL('image/png'));
        img.setAttribute('style', dst.getAttribute('style'));
        dst.parentNode.replaceChild(img, dst);
        return;
      } catch (e) { /* tainted canvas — skip */ }
    }
    var sc = src.children, dc = dst.children;
    for (var k = 0; k < sc.length && k < dc.length; k++) {
      if (sc[k].tagName === 'SCRIPT' || sc[k].tagName === 'NOSCRIPT' || sc[k].tagName === 'LINK') continue;
      inlineStyles(sc[k], dc[k], depth + 1);
    }
  }
  function screenshot(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      try {
        var w = Math.max(320, window.innerWidth);
        var full = !!opts.full;
        var h = full ? Math.max(window.innerHeight, document.documentElement.scrollHeight) : window.innerHeight;
        var scale = Math.min(opts.scale || 1, 2);
        var clone = document.documentElement.cloneNode(true);
        var dead = clone.querySelectorAll('script,link[rel="preload"]');
        for (var i = 0; i < dead.length; i++) dead[i].parentNode.removeChild(dead[i]);
        var bodyClone = clone.querySelector('body') || clone;
        inlineStyles(document.body, bodyClone, 0);
        bodyClone.style.margin = '0';
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
          '<foreignObject x="0" y="0" width="100%" height="100%">' +
          '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:#fff">' +
          new XMLSerializer().serializeToString(bodyClone) + '</div></foreignObject></svg>';
        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var fmt = opts.format === 'png' ? 'image/png' : 'image/jpeg';
            resolve({ ok: true, dataUrl: canvas.toDataURL(fmt, opts.quality || 0.82), width: canvas.width, height: canvas.height, url: location.href, title: document.title });
          } catch (e) { resolve({ ok: false, error: 'canvas encode failed: ' + e.message }); }
        };
        img.onerror = function () { resolve({ ok: false, error: 'svg rasterise failed' }); };
        img.src = url;
      } catch (e) { resolve({ ok: false, error: String(e && e.message || e) }); }
    });
  }

  /* ---------------- responsive metrics ---------------- */
  function metrics() {
    var vp = { w: window.innerWidth, h: window.innerHeight };
    var overflowing = [];
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length && overflowing.length < 12; i++) {
      var el = all[i];
      if (!isVisible(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.right > vp.w + 2 && r.width < 4000) overflowing.push({ sel: cssPath(el), right: Math.round(r.right), width: Math.round(r.width), text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50) });
    }
    var smallest = [];
    var ctrls = document.querySelectorAll('button,a[href],input,select,textarea');
    for (var j = 0; j < ctrls.length && smallest.length < 10; j++) {
      if (!isVisible(ctrls[j])) continue;
      var rr = ctrls[j].getBoundingClientRect();
      if (rr.height < 32 || rr.width < 24) smallest.push({ sel: cssPath(ctrls[j]), w: Math.round(rr.width), h: Math.round(rr.height), name: accessibleName(ctrls[j]).slice(0, 40) });
    }
    return {
      viewport: vp,
      document: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, nodes: document.getElementsByTagName('*').length },
      horizontalOverflow: document.documentElement.scrollWidth > vp.w + 2,
      overflowingElements: overflowing,
      smallTargets: smallest,
      media: (function () {
        var m = [];
        if (!window.matchMedia) return m;
        var mq = ['(max-width:480px)', '(max-width:768px)', '(max-width:1024px)', '(min-width:1280px)'];
        for (var i = 0; i < mq.length; i++) { try { m.push({ query: mq[i], matches: window.matchMedia(mq[i]).matches }); } catch (e) {} }
        return m;
      })()
    };
  }

  function interactiveMap() {
    var sel = 'button,a[href],input,select,textarea,[role="button"],[role="tab"],[role="link"],[data-testid]';
    var out = [];
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length && out.length < 120; i++) {
      var el = els[i];
      if (!isVisible(el)) continue;
      var r = rectOf(el);
      var typ = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
      var kind = typ ? 'input' : (el.tagName === 'A' ? 'link' : 'button');
      var name = accessibleName(el).slice(0, 70);
      if (!name && !el.getAttribute('data-testid')) continue;
      out.push({
        uid: uid(el), sel: cssPath(el), kind: kind, name: name || '(unnamed)',
        testid: el.getAttribute('data-testid') || undefined,
        rect: r, aboveFold: r.y < window.innerHeight,
        currentValue: typ ? String(el.value || '').slice(0, 60) : undefined,
        disabled: !!el.disabled,
        pressed: el.getAttribute('aria-pressed') || undefined,
        href: el.getAttribute('href') || undefined,
        type: el.getAttribute('type') || undefined
      });
    }
    return { count: out.length, controls: out };
  }

  /* ---------------- messaging ---------------- */
  function consoleTail(n) {
    var seen = {};
    var out = [];
    for (var i = consoleLog.length - 1; i >= 0 && out.length < n; i--) {
      var l = consoleLog[i];
      var key = l.level + l.text.slice(0, 60);
      if (seen[key]) { seen[key].repeat++; continue; }
      seen[key] = { level: l.level, text: l.text, at: l.at, repeat: 1 };
      out.unshift(seen[key]);
    }
    return out;
  }
  function send(type, payload, id) {
    try { window.parent.postMessage({ source: BRIDGE_SOURCE, type: type, id: id, payload: payload, token: TOKEN }, '*'); } catch (e) {}
  }
  function handle(cmd, args, id) {
    args = args || {};
    var done = function (payload) { send('result', payload, id); };
    var fail = function (msg) { send('error', { message: String(msg) }, id); };
    try {
      switch (cmd) {
        case 'ping': return done({ pong: true, url: location.href, title: document.title, viewport: { w: innerWidth, h: innerHeight }, picking: pickMode });
        case 'snapshot': return done(snapshot(args));
        case 'inspect': { var el = resolve(args.target); return el ? done(describe(el)) : fail('element not found: ' + args.target); }
        case 'query': {
          var list = [];
          try { var m = document.querySelectorAll(args.selector); for (var i = 0; i < m.length && i < 40; i++) list.push(describe(m[i])); } catch (e) { return fail('bad selector'); }
          return done({ count: list.length, matches: list });
        }
        case 'click': {
          var c = clickTarget(resolve(args.target));
          if (!c.ok) return fail(c.error);
          setTimeout(function () {
            var after = document.getElementsByTagName('*').length;
            var delta = consoleLog.slice(c.before.nodes ? -8 : -8);
            done({
              clicked: c.name || c.tag, rect: c.rect, urlBefore: c.before.url, urlAfter: location.href,
              navigated: c.before.url !== location.href,
              domDelta: after - c.before.nodes,
              console: consoleTail(6)
            });
          }, args.waitMs || 450);
          return;
        }
        case 'type': {
          var t = typeInto(resolve(args.target), String(args.text == null ? '' : args.text), !!args.submit);
          if (!t.ok) return fail(t.error);
          setTimeout(function () { done({ typed: t.value, target: t.name, urlAfter: location.href, console: consoleTail(6) }); }, args.waitMs || 400);
          return;
        }
        case 'press': {
          var focused = document.activeElement;
          var ev = { key: args.key || 'Enter', code: args.key || 'Enter', keyCode: args.key === 'Tab' ? 9 : 13, bubbles: true };
          fire(focused, 'keydown', ev); fire(focused, 'keyup', ev);
          if (args.key === 'Escape') { var d = document.querySelector('[role="dialog"],dialog'); if (d && d.close) try { d.close(); } catch (e) {} }
          return done({ ok: true, focused: focused ? cssPath(focused) : null, urlAfter: location.href });
        }
        case 'scrollTo': { var s = resolve(args.target); if (!s) return fail('element not found'); if (s.scrollIntoView) s.scrollIntoView({ block: args.block || 'center', behavior: 'auto' }); return done({ ok: true, scrollY: Math.round(window.scrollY) }); }
        case 'scrollBy': { window.scrollBy(0, args.y || 0); return done({ ok: true, scrollY: Math.round(window.scrollY) }); }
        case 'assert': {
          var checks = (args.checks || []).map(checkOne);
          return done({ passed: checks.filter(function (c) { return c.pass; }).length, total: checks.length, results: checks, allPassed: checks.every(function (c) { return c.pass; }) });
        }
        case 'highlight': { return done(highlight(args.target ? resolve(args.target) : null, !!args.keep)); }
        case 'pick': return done(setPick(args.on !== false));
        case 'console': { var tail = consoleTail(args.limit || 40); if (args.clear) { consoleLog = []; networkLog = []; } return done({ entries: tail, network: networkLog.slice(-10) }); }
        case 'metrics': return done(metrics());
        case 'controls': return done(interactiveMap());
        case 'audit': return done({ findings: audit(), viewport: { w: innerWidth, h: innerHeight }, url: location.href });
        case 'navigate': {
          var target = String(args.url || '/');
          var before = location.href;
          if (/^https?:/i.test(target)) location.href = target;
          else location.href = target.charAt(0) === '/' ? target : '/' + target;
          return done({ navigated: true, from: before, to: location.href });
        }
        case 'reload': location.reload(); return done({ reloading: true });
        case 'screenshot': screenshot(args).then(function (r) { r && r.ok ? done(r) : fail(r && r.error || 'screenshot failed'); }); return;
        case 'report': {
          return done({ snapshot: snapshot({ maxNodes: 120 }), metrics: metrics(), controls: interactiveMap(), console: consoleTail(20), network: networkLog.slice(-10) });
        }
        default: return fail('unknown command: ' + cmd);
      }
    } catch (e) { fail(e && e.message || String(e)); }
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== HOST_SOURCE || !d.cmd) return;
    if (TOKEN && d.token !== TOKEN) return;
    handle(d.cmd, d.args, d.id);
  });
  window.addEventListener('beforeunload', function () { navCount++; try { window.parent.postMessage({ source: BRIDGE_SOURCE, type: 'unloading', payload: { url: location.href } }, '*'); } catch (e) {} });

  // Announce readiness once the DOM exists (and again after load for late listeners).
  var announce = function () { send('ready', { url: location.href, title: document.title, viewport: { w: innerWidth, h: innerHeight }, ua: navigator.userAgent }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce);
  else announce();
  window.addEventListener('load', function () { setTimeout(announce, 150); setTimeout(function () { send('idle', { url: location.href, findings: audit().slice(0, 6), console: consoleTail(6) }); }, 1200); });
})();
`
