#!/usr/bin/env node
/**
 * Build the shared public landing page.
 *
 * The trading dashboard, the quant engine and the copier engine are three
 * separate applications with three separate tech stacks. The landing page is
 * the one screen a visitor sees before any of that matters, so it is generated
 * here from a single template and written into each app's static directory.
 * Editing this file keeps all three identical; editing the copies drifts.
 *
 *   node scripts/build-landing.mjs
 */

import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const documents = path.resolve(appRoot, '..', '..');

/**
 * Every product shares the same page; only these four values differ.
 * `signUp` is null where the product has no self-service accounts.
 */
const PRODUCTS = [
  {
    key: 'dashboard',
    name: 'Master Trading Dashboard',
    href: 'https://dashboard.gimmholding.com',
    localPort: 3000,
    localHref: 'http://127.0.0.1:3000/',
    signIn: '/login',
    signUp: '/register',
    cta: '/login',
  },
  {
    key: 'quant',
    name: 'Quant Engine',
    href: 'https://quant-engine.gimmholding.com',
    localPort: 8100,
    localHref: 'http://127.0.0.1:8100/',
    signIn: '/login',
    signUp: '/login/register',
    cta: '/login',
  },
  {
    key: 'copier',
    name: 'Trade Copier Engine',
    href: 'https://copier-engine.gimmholding.com',
    localPort: 8200,
    localHref: 'http://127.0.0.1:8200/',
    signIn: '/login',
    signUp: '/login?mode=register',
    cta: '/login',
  },
];

/** Mark shown top-left and in the switcher; same drawing as the app icon. */
const MARK = `<svg class="mark" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
        <defs><linearGradient id="mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7660d5"/><stop offset="1" stop-color="#354e99"/></linearGradient></defs>
        <rect width="64" height="64" rx="16" fill="url(#mk)"/>
        <path d="M17 45V34M29 45V25M41 45V17" fill="none" stroke="#eeeaff" stroke-width="6" stroke-linecap="round"/>
        <path d="m16 24 12-10" fill="none" stroke="#eeeaff" stroke-width="3" stroke-linecap="round"/>
      </svg>`;

function render(product) {
  const others = PRODUCTS.filter(item => item.key !== product.key);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${product.name}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: #04060c; color: #f1f3f7;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  .page { position: relative; min-height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

  /* --- backdrop ------------------------------------------------------- */
  .bg { position: absolute; inset: 0; background: #04060c; }
  .bg video {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0; transition: opacity 2.2s cubic-bezier(.4,0,.2,1);
  }
  .bg video.on { opacity: 1; }
  .scrim {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse 30% 20% at 50% 13%, #04060cf5 0%, #04060cd9 46%, transparent 100%),
      linear-gradient(180deg, #04060cf7 0%, #04060ce8 20%, #04060caa 34%, #04060c4d 48%, transparent 60%),
      linear-gradient(to top, #04060c 0%, #04060c00 20%);
  }

  /* --- header --------------------------------------------------------- */
  header {
    /* Above main: the navigation dropdown has to paint over the headline. */
    position: relative; z-index: 20;
    display: flex; align-items: center; justify-content: space-between;
    gap: 14px; padding: 20px clamp(14px, 3.4vw, 40px);
  }
  .brand { display: inline-flex; align-items: center; gap: 10px; }
  .brand .mark { border-radius: 9px; box-shadow: 0 4px 20px #6253d526; flex-shrink: 0; }
  .brand-name {
    font-size: 11.5px; font-weight: 600; letter-spacing: .15em;
    text-transform: uppercase; color: #cfd6e4; white-space: nowrap;
  }

  /* Navigation button with a dropdown, opening on hover or click. */
  .nav-switch { position: relative; }
  .nav-switch > button {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
    height: 32px; padding: 0 12px; border-radius: 8px;
    border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.04);
    color: #cfd6e4; font: inherit; font-size: 11px; font-weight: 550;
    backdrop-filter: blur(8px);
    transition: border-color .16s, background .16s, color .16s;
  }
  .nav-switch > button:hover, .nav-switch.open > button {
    border-color: rgba(255,255,255,.3); background: rgba(255,255,255,.09); color: #fff;
  }
  .nav-switch svg.chev { width: 12px; height: 12px; transition: transform .18s; }
  .nav-switch.open svg.chev { transform: rotate(180deg); }
  .nav-switch .menu {
    position: absolute; top: calc(100% + 7px); left: 0; z-index: 70;
    width: 244px; padding: 6px;
    border: 1px solid rgba(255,255,255,.12); border-radius: 11px;
    background: rgba(17,20,30,.97); backdrop-filter: blur(16px);
    box-shadow: 0 24px 60px #000000a6;
    display: none;
  }
  .nav-switch.open .menu { display: block; }
  .nav-switch .menu a, .nav-switch .menu span.current {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 10px; border-radius: 7px;
    color: #c9d1e0; font-size: 11.5px; text-decoration: none;
  }
  .nav-switch .menu a:hover { background: rgba(255,255,255,.07); color: #fff; }
  .nav-switch .menu span.current { color: #a99bff; }
  .nav-switch .menu i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  .auth { display: flex; align-items: center; gap: 8px; }
  .auth a {
    display: inline-flex; align-items: center; gap: 7px;
    height: 36px; padding: 0 15px; border-radius: 9px;
    font-size: 12px; font-weight: 600; text-decoration: none;
    transition: background .16s, border-color .16s, color .16s, transform .16s;
  }
  .auth .signin {
    border: 1px solid rgba(255,255,255,.14); color: #cfd6e4;
    background: rgba(255,255,255,.03); backdrop-filter: blur(8px);
  }
  .auth .signin:hover { border-color: rgba(255,255,255,.3); color: #fff; }
  .auth .signup {
    border: 1px solid transparent; color: #fff;
    background: linear-gradient(100deg,#8b7aff,#6f7dff 60%,#5b9dff);
    box-shadow: 0 8px 24px #6f7dff33;
  }
  .auth .signup:hover { transform: translateY(-1px); box-shadow: 0 11px 30px #6f7dff4a; }

  /* --- centre --------------------------------------------------------- */
  main {
    position: relative; z-index: 3; flex: 1;
    display: flex; flex-direction: column; align-items: center;
    gap: 14px; padding: clamp(20px, 4vh, 54px) 18px 0; text-align: center;
  }
  h1 {
    margin: 0; max-width: 20ch;
    font-size: clamp(38px, 6.6vw, 92px);
    font-weight: 700; line-height: .96; letter-spacing: -.045em;
    text-shadow: 0 3px 60px #04060ce6, 0 1px 4px #000000b3;
  }
  /* The tagline sits directly under the company name. */
  main > p {
    margin: -6px 0 0;
    max-width: 22ch;
    font-size: clamp(22px, 3.2vw, 44px);
    font-weight: 650; line-height: 1.1; letter-spacing: -.03em;
    color: #e6eaf4;
    text-shadow: 0 2px 40px #04060ce6;
  }
  main > p span {
    background: linear-gradient(100deg,#cbbcff 0%,#7db8ff 44%,#6ef2a8 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: none;
  }
  .cta {
    display: inline-flex; align-items: center; gap: 9px;
    height: 48px; margin-top: 14px; padding: 0 26px; border-radius: 11px;
    background: #f4f6fb; color: #0a0d14; text-decoration: none;
    font-size: 13px; font-weight: 650;
    box-shadow: 0 12px 40px #00000066;
    transition: transform .16s, box-shadow .16s;
  }
  .cta:hover { transform: translateY(-2px); box-shadow: 0 18px 50px #00000080; }
  .cta svg { width: 16px; height: 16px; }

  @media (max-width: 640px) {
    .brand-name { display: none; }
    .auth .signin { padding: 0 11px; font-size: 11px; }
    .auth .signup { padding: 0 12px; font-size: 11px; }
    .cta { height: 44px; padding: 0 20px; font-size: 12px; }
  }
  /* Narrow phones: keep the header on one row by shrinking the labels
     instead of letting them wrap. */
  @media (max-width: 430px) {
    header { padding: 14px 12px; gap: 8px; }
    .brand { gap: 8px; }
    .auth { gap: 6px; }
    .auth a { height: 32px; padding: 0 9px; font-size: 10.5px; gap: 5px; white-space: nowrap; }
    .auth a svg { width: 12px; height: 12px; }
    .nav-switch > button { height: 30px; padding: 0 9px; font-size: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bg video { transition: none; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="bg" aria-hidden="true">
    <video id="wide" muted loop playsinline autoplay preload="auto" poster="/videos/globe-landscape.jpg">
      <source src="/videos/globe-landscape.mp4" type="video/mp4">
    </video>
    <video id="tall" muted loop playsinline autoplay preload="auto" poster="/videos/globe-portrait.jpg">
      <source src="/videos/globe-portrait.mp4" type="video/mp4">
    </video>
    <div class="scrim"></div>
  </div>

  <header>
    <div class="brand">
      ${MARK}
      <span class="brand-name">${product.name}</span>
      <div class="nav-switch" id="nav-switch">
        <button type="button" aria-expanded="false" aria-controls="nav-menu" aria-haspopup="true">
          Navigation
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="menu" id="nav-menu" role="menu" aria-label="Products">
${PRODUCTS.map(item => item.key === product.key
  ? `          <span class="current" role="menuitem" aria-current="page"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>${item.name}</span>`
  : `          <a role="menuitem" href="${item.href}" data-port="${item.localPort}"><i></i>${item.name}</a>`).join('\n')}
        </div>
      </div>
    </div>
    <nav class="auth" aria-label="Account">
      <a class="signin" href="${product.signIn}">Sign in</a>
      ${product.signUp ? `<a class="signup" href="${product.signUp}">Sign up</a>` : ''}
    </nav>
  </header>

  <main>
    <h1>Tenaxcore</h1>
    <p>Join the <span>Revolution</span>.</p>
    <a class="cta" href="${product.cta}">
      Become The Change
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>
  </main>
</div>

<script src="/landing.js"></script>
</body>
</html>
`;
}

const SCRIPT = `(function () {
  // --- product navigation: opens on hover and on click ---------------------
  (function () {
    var box = document.getElementById('nav-switch');
    if (!box) return;
    var button = box.querySelector('button');
    var timer = null;
    // Hover opens the menu before the click lands, so a click right after a
    // hover must not close it again -- only a deliberate second click should.
    var openedByHover = false;
    function set(open) {
      box.classList.toggle('open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      if (openedByHover) { openedByHover = false; return; }
      set(!box.classList.contains('open'));
    });
    box.addEventListener('mouseenter', function () {
      clearTimeout(timer);
      if (!box.classList.contains('open')) { openedByHover = true; set(true); }
    });
    box.addEventListener('mouseleave', function () {
      clearTimeout(timer);
      openedByHover = false;
      timer = setTimeout(function () { set(false); }, 140);
    });
    document.addEventListener('click', function () { set(false); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') set(false);
    });

    // Opened from this machine, the three products link to their local ports
    // so they can be tested against each other without touching production.
    var host = location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && !/\.local$/.test(host)) return;
    var scheme = location.protocol === 'https:' ? 'https' : 'http';
    Array.prototype.forEach.call(box.querySelectorAll('a[data-port]'), function (link) {
      link.href = scheme + '://' + host + ':' + link.getAttribute('data-port') + '/';
    });
  })();

  // --- one clip per orientation; only the matching one is loaded -----------
  var wide = document.getElementById('wide');
  var tall = document.getElementById('tall');
  var portrait = window.matchMedia('(orientation: portrait)');
  function apply() {
    var tall_ = portrait.matches || window.innerWidth < window.innerHeight;
    wide.classList.toggle('on', !tall_);
    tall.classList.toggle('on', tall_);
    var active = tall_ ? tall : wide;
    var idle = tall_ ? wide : tall;
    idle.pause();
    if (!reduced.matches) active.play().catch(function () {});
  }
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // --- alternate between the two scenes every two minutes ------------------
  var scenes = [
    { wide: '/videos/globe-landscape.mp4', tall: '/videos/globe-portrait.mp4' },
    { wide: '/videos/horizon-landscape.mp4', tall: '/videos/horizon-portrait.mp4' }
  ];
  var index = 0;
  function swap() {
    index = (index + 1) % scenes.length;
    var target = (portrait.matches || window.innerWidth < window.innerHeight) ? 'tall' : 'wide';
    var el = target === 'tall' ? tall : wide;
    var other = target === 'tall' ? wide : tall;
    other.classList.remove('on');
    el.classList.remove('on');
    el.src = scenes[index][target];
    el.load();
    el.play().catch(function () {});
    el.classList.add('on');
  }

  apply();
  portrait.addEventListener('change', apply);
  window.addEventListener('resize', apply);
  if (!reduced.matches) setInterval(swap, 120000);

  // Pause when the tab is hidden: a background video should not burn battery.
  document.addEventListener('visibilitychange', function () {
    var active = wide.classList.contains('on') ? wide : tall;
    if (document.hidden) active.pause();
    else if (!reduced.matches) active.play().catch(function () {});
  });

})();
`;

// The Next app renders its own landing as a React page, so only the two Python
// apps need the generated HTML. The video source still lives in this repo.
const targets = [
  { dir: path.join(documents, 'Quant Engine', 'web'), file: 'landing.html', product: 'quant' },
  { dir: path.join(documents, 'Trade-Copier', 'public'), file: 'landing.html', product: 'copier' },
];

for (const target of targets) {
  const product = PRODUCTS.find(item => item.key === target.product);
  if (!existsSync(target.dir)) {
    console.warn(`skip ${target.product}: ${target.dir} does not exist`);
    continue;
  }
  await mkdir(target.dir, { recursive: true });
  // The video names are identical in every app, so one page fits all three.
  const html = render(product);
  await writeFile(path.join(target.dir, target.file), html);
  // External, not inline: the copier engine sends script-src 'self', which
  // blocks an inline block outright.
  await writeFile(path.join(target.dir, 'landing.js'), SCRIPT);
  console.log(`wrote ${path.join(target.dir, target.file)} + landing.js`);
}

// Videos: copy only what is missing so repeated runs are cheap.
const videoSource = path.join(appRoot, 'public', 'videos');
for (const target of targets) {
  if (!existsSync(target.dir) || !existsSync(videoSource)) continue;
  const videoDir = path.join(target.dir, 'videos');
  await mkdir(videoDir, { recursive: true });
  for (const name of [
    'globe-landscape.mp4', 'horizon-landscape.mp4',
    'globe-portrait.mp4', 'horizon-portrait.mp4',
    'globe-landscape.jpg', 'horizon-landscape.jpg',
    'globe-portrait.jpg', 'horizon-portrait.jpg',
  ]) {
    const from = path.join(videoSource, name);
    const to = path.join(videoDir, name);
    if (!existsSync(from)) continue;
    if (existsSync(to)) continue;
    await copyFile(from, to);
  }
  console.log(`synced videos into ${videoDir}`);
}
