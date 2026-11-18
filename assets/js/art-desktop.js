// c:/art-store — the art page as a working Windows 98 desktop.
// Windows drag by the title bar, minimise to the taskbar, maximise and close;
// each work opens in an image viewer with Properties and Acquire… dialogs.
// On phones it behaves like a home screen: one tap opens, apps go full screen.
//
// To add a work: put the PNG in assets/images/art/ and add a line to WORKS.

const ART = '../../images/art/';
const HOME = '../../../index.html';
const CONTACT = 'https://www.instagram.com/ciwrl/';

const WORKS = [
    { id: 'fib', file: 'fib.png', name: 'fibonacci.png', title: 'Homage To Fibonacci', w: 1614, h: 1000 },
    { id: 'vera', file: 'vera.png', name: 'vera_molnar.png', title: 'Homage To Vera Molnar', w: 1398, h: 1398 },
    { id: 'skyeye', file: 'k.png', name: 'skyeye.png', title: 'SkyEye', w: 1539, h: 1620 },
    { id: 'demons', file: 'lbc.png', name: 'demons.png', title: "u can't escape your demons", w: 1404, h: 1392 },
    { id: 'strangelove', file: 'sl.png', name: 'dr_strangelove.png', title: 'Postmodern Dr.Strangelove', w: 1200, h: 1200 },
];

const desk = document.querySelector('.desktop');
const iconsEl = document.querySelector('.icons');
const tasks = document.querySelector('.tasks');
const startBtn = document.querySelector('.start-btn');
const startMenu = document.querySelector('.start-menu');
const narrow = () => innerWidth < 700;
const touch = matchMedia('(pointer: coarse)').matches;
const tapOpen = fn => e => { if (e.pointerType === 'touch') fn(); };

const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    el.append(...kids.flat().filter(k => k != null));
    return el;
};

// --- little pixel icons -------------------------------------------------------
const SVG = {
    folder: '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#000" d="M2 7h11l2 3h15v18H2z"/><path fill="#ffd75e" d="M3 8h9l2 3h15v16H3z"/><path fill="#fff3b0" d="M3 12h26v1H3z"/><path fill="#c89a16" d="M3 26h26v1H3z"/></svg>',
    notepad: '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#000" d="M5 3h20v27H5z"/><path fill="#fff" d="M6 4h18v25H6z"/><path fill="#0000a8" d="M8 9h14v1H8zm0 4h14v1H8zm0 4h14v1H8zm0 4h10v1H8z"/><path fill="#808080" d="M8 2h2v4H8zm5 0h2v4h-2zm5 0h2v4h-2z"/></svg>',
    bin: '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#000" d="M7 7h18v2h-1l-2 20H10L8 9H7z"/><path fill="#dfdfdf" d="M9 9h14l-2 19H11z"/><path fill="#808080" d="M12 11h1v15h-1zm4 0h1v15h-1zm4 0h1v15h-1z"/><path fill="#000" d="M12 4h8v3h-8z"/></svg>',
    web: '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#000" d="M3 4h26v19H3z"/><path fill="#c0c0c0" d="M4 5h24v17H4z"/><path fill="#000080" d="M6 7h20v13H6z"/><path fill="#e3120a" d="M12 10h8v7h-8z"/><path fill="#000" d="M11 23h10v3h4v2H7v-2h4z"/></svg>',
    display: '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#000" d="M3 4h26v19H3z"/><path fill="#008080" d="M5 6h22v15H5z"/><path fill="#000" d="M11 23h10v3h4v2H7v-2h4z"/></svg>',
    power: '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><path fill="#000" d="M6 6h20v20H6z"/><path fill="#808080" d="M7 7h18v18H7z"/><path fill="#ffd700" d="M15 9h2v8h-2z"/><path fill="#ffd700" d="M11 12h2v7h1v2h4v-2h1v-7h2v8h-2v2h-6v-2h-2z"/></svg>',
};
const svgImg = name => `data:image/svg+xml;utf8,${encodeURIComponent(SVG[name].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
const glyph = src => h('span', { class: 'glyph' }, h('img', { src, alt: '' }));
const thumb = w => `${ART}${w.file}`;

// --- window manager ------------------------------------------------------------
const wins = new Map();
let z = 20, cascade = 0;

function focusWin(win) {
    for (const w of wins.values()) w.el.classList.remove('is-active');
    win.el.classList.add('is-active');
    win.el.classList.remove('is-min');
    win.el.style.zIndex = ++z;
    for (const w of wins.values()) w.task.classList.toggle('is-active', w === win);
}

function closeWin(win) {
    win.el.remove();
    win.task.remove();
    wins.delete(win.id);
}

function minimise(win) {
    win.el.classList.add('is-min');
    win.el.classList.remove('is-active');
    win.task.classList.remove('is-active');
}

// dialog: small windows (properties, acquire, settings) stay a centred box on phones
function openWin({ id, title, icon, body, w = 420, hgt, x, y, cls = '', dialog = false, max = narrow() && !dialog }) {
    if (wins.has(id)) { focusWin(wins.get(id)); return wins.get(id); }
    const minBtn = h('button', { 'aria-label': 'Minimize' });
    const maxBtn = h('button', { 'aria-label': max ? 'Restore' : 'Maximize' });
    const closeBtn = h('button', { 'aria-label': 'Close' });
    const bar = h('div', { class: 'title-bar' },
        h('div', { class: 'title-bar-text' }, h('img', { src: icon, alt: '' }), title),
        h('div', { class: 'title-bar-controls' }, minBtn, maxBtn, closeBtn));
    const el = h('section', { class: `window app ${cls}${max ? ' is-max' : ''}`, role: 'dialog', 'aria-label': title }, bar, h('div', { class: 'window-body' }, body));
    const dw = desk.clientWidth, dh = desk.clientHeight;
    const ww = Math.min(w, dw - 16);
    if (narrow() && dialog) { x = (dw - ww) / 2; y = Math.max(12, dh * .14); }
    cascade = (cascade + 1) % 8;
    Object.assign(el.style, {
        width: `${ww}px`, height: hgt ? `${Math.min(hgt, dh - 16)}px` : '',
        left: `${x ?? Math.min(dw - ww - 8, 140 + cascade * 26)}px`, top: `${y ?? 30 + cascade * 24}px`,
    });
    desk.append(el);
    const task = h('button', { title }, h('img', { src: icon, alt: '' }), title);
    tasks.append(task);
    const win = { id, el, task };
    wins.set(id, win);

    el.addEventListener('pointerdown', () => focusWin(win));
    minBtn.addEventListener('click', e => { e.stopPropagation(); minimise(win); });
    maxBtn.addEventListener('click', () => { const m = el.classList.toggle('is-max'); maxBtn.setAttribute('aria-label', m ? 'Restore' : 'Maximize'); });
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closeWin(win); });
    bar.addEventListener('dblclick', () => maxBtn.click());
    task.addEventListener('click', () => {
        if (el.classList.contains('is-min') || !el.classList.contains('is-active')) focusWin(win);
        else minimise(win);
    });
    // drag by the title bar
    bar.addEventListener('pointerdown', e => {
        if (e.target.closest('button') || el.classList.contains('is-max')) return;
        const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
        bar.setPointerCapture(e.pointerId);
        const move = ev => {
            el.style.left = `${Math.min(Math.max(ev.clientX - sx, 40 - el.offsetWidth), desk.clientWidth - 40)}px`;
            el.style.top = `${Math.min(Math.max(ev.clientY - sy, 0), desk.clientHeight - 24)}px`;
        };
        const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
        bar.addEventListener('pointermove', move);
        bar.addEventListener('pointerup', up);
    });
    focusWin(win);
    return win;
}

// --- apps ---------------------------------------------------------------------
const menubar = (...items) => h('div', { class: 'menubar', 'aria-hidden': 'true' }, items.map(t => h('span', {}, h('u', {}, t[0]), t.slice(1))));

function openViewer(w, pos = {}) {
    const width = narrow() ? 0 : Math.min(500, desk.clientWidth * .36);
    return openWin({
        id: `view-${w.id}`, title: `${w.name} - Imaging`, icon: thumb(w), cls: 'viewer', w: width + 28, hgt: width * w.h / w.w + 122, ...pos,
        body: [
            menubar('File', 'Edit', 'View', 'Image', 'Help'),
            h('div', { class: 'toolbar' },
                h('button', { onclick: () => openProps(w) }, 'Properties'),
                h('button', { onclick: () => openAcquire(w) }, 'Acquire…')),
            h('div', { class: 'frame' }, h('img', { src: thumb(w), alt: w.title, width: w.w, height: w.h })),
            h('div', { class: 'status-bar' },
                h('p', { class: 'status-bar-field' }, w.title),
                h('p', { class: 'status-bar-field' }, `${w.w} × ${w.h}`)),
        ],
    });
}

function openProps(w) {
    const field = (k, v) => h('div', { class: 'field' }, h('span', {}, `${k}:`), h('span', {}, v));
    const win = openWin({
        id: `props-${w.id}`, title: `${w.name} Properties`, icon: thumb(w), cls: 'props', w: 330, dialog: true,
        body: [
            h('menu', { role: 'tablist' }, h('li', { role: 'tab', 'aria-selected': 'true' }, h('a', {}, 'General'))),
            h('div', { class: 'window', role: 'tabpanel' }, h('div', { class: 'window-body' },
                h('div', { class: 'head' }, h('img', { src: thumb(w), alt: '' }), h('strong', {}, w.title)),
                field('Type', 'PNG image'), field('Size', `${w.w} × ${w.h} px`), field('Location', 'c:/art-store'))),
            h('div', { class: 'buttons' },
                h('button', { onclick: () => closeWin(win) }, 'OK'),
                h('button', { onclick: () => openAcquire(w) }, 'Acquire…')),
        ],
    });
}

function openAcquire(w) {
    const win = openWin({
        id: `acq-${w.id}`, title: 'Acquire', icon: svgImg('folder'), w: 360, dialog: true, x: (desk.clientWidth - 360) / 2, y: desk.clientHeight * .3,
        body: [
            h('div', { class: 'dialog-row' },
                h('img', { src: thumb(w), alt: '' }),
                h('p', {}, `Interested in “${w.title}”?`, h('br'), h('br'), 'Write me on Instagram and we’ll talk about it.')),
            h('div', { class: 'buttons' },
                h('a', { class: 'button default', href: CONTACT, target: '_blank', rel: 'noopener' }, 'Instagram'),
                h('button', { onclick: () => closeWin(win) }, 'Cancel')),
        ],
    });
}

function openStore() {
    const panel = h('div', { class: 'sunken-panel' });
    const status = h('p', { class: 'status-bar-field' }, `${WORKS.length} object(s)`);
    const iconsView = () => h('div', { class: 'grid-view' }, WORKS.map(w => h('button', {
        class: 'icon', ondblclick: () => openViewer(w), onpointerup: tapOpen(() => openViewer(w)),
        onkeydown: e => { if (e.key === 'Enter') openViewer(w); }, onfocus: () => { status.textContent = w.title; },
    }, glyph(thumb(w)), h('span', {}, w.name))));
    const detailsView = () => h('table', { class: 'interactive' },
        h('thead', {}, h('tr', {}, ['Name', 'Title', 'Size'].map(t => h('th', {}, t)))),
        h('tbody', {}, WORKS.map(w => h('tr', {
            ondblclick: () => openViewer(w), onpointerup: tapOpen(() => openViewer(w)),
            onclick: e => { panel.querySelectorAll('tr').forEach(r => r.classList.remove('highlighted')); e.currentTarget.classList.add('highlighted'); },
        }, h('td', {}, h('img', { src: thumb(w), alt: '' }), w.name), h('td', {}, w.title), h('td', {}, `${w.w}×${w.h}`)))));
    const show = view => { panel.replaceChildren(view === 'details' ? detailsView() : iconsView()); };
    show('icons');
    return openWin({
        id: 'store', title: 'c:/art-store', icon: svgImg('folder'), cls: 'explorer', w: 540, hgt: 330, x: 110, y: 26,
        body: [
            menubar('File', 'Edit', 'View', 'Favorites', 'Help'),
            h('div', { class: 'toolbar' },
                h('button', { onclick: () => show('icons') }, 'Large Icons'),
                h('button', { onclick: () => show('details') }, 'Details')),
            panel,
            h('div', { class: 'status-bar' }, status, h('p', { class: 'status-bar-field' }, touch ? 'Tap to open' : 'Double-click to open')),
        ],
    });
}

function openReadme() {
    return openWin({
        id: 'readme', title: 'Readme.txt - Notepad', icon: svgImg('notepad'), cls: 'notepad', w: 360, hgt: 240,
        body: [
            menubar('File', 'Edit', 'Search', 'Help'),
            h('textarea', { readonly: true, 'aria-label': 'Readme' },
                'README.TXT\n\nFive works, mostly red.\nEach one lives in its own window:\nopen it, drag it around, look closer.\n\nInterested in a work?\nOpen it and choose Acquire…'),
        ],
    });
}

function openBin() {
    return openWin({
        id: 'bin', title: 'Recycle Bin', icon: svgImg('bin'), cls: 'explorer', w: 340, hgt: 220,
        body: [
            h('div', { class: 'sunken-panel' }, h('table', { class: 'interactive' },
                h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Deleted'))),
                h('tbody', {}, [['untitled_final_v7.png', 'yesterday'], ['nft_hype_2021.gif', '2022'], ['good_taste.zip', 'never']].map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))))),
            h('div', { class: 'buttons' }, h('button', { disabled: true }, 'Empty Recycle Bin')),
        ],
    });
}

function openDisplay() {
    const opt = (v, label) => h('div', { class: 'field-row' },
        h('input', { type: 'radio', id: `wall-${v}`, name: 'wall', checked: desk.dataset.wall === v, onchange: () => { desk.dataset.wall = v; } }),
        h('label', { for: `wall-${v}` }, label));
    return openWin({
        id: 'display', title: 'Display Properties', icon: svgImg('display'), w: 300, dialog: true,
        body: [
            h('fieldset', {}, h('legend', {}, 'Wallpaper'),
                opt('red-checker', 'Red room, checker floor'), opt('red-black', 'Red room, black floor'), opt('home', 'Homepage red'),
                opt('blue', 'Blue room'), opt('vault', 'The Vault (CRT photo)'), opt('teal', 'Teal 98')),
        ],
    });
}

function shutdown() {
    const s = document.querySelector('.shutdown');
    s.hidden = false;
    s.addEventListener('click', () => { s.hidden = true; }, { once: true });
}

// --- desktop icons ------------------------------------------------------------
const deskIcons = [
    { label: 'art-store', src: svgImg('folder'), open: openStore },
    ...WORKS.map(w => ({ label: w.name, src: thumb(w), open: () => openViewer(w) })),
    { label: 'Readme.txt', src: svgImg('notepad'), open: openReadme },
    { label: 'andreaturchet.github.io', src: svgImg('web'), open: () => { location.href = HOME; } },
    { label: 'Recycle Bin', src: svgImg('bin'), open: openBin },
];
for (const d of deskIcons) {
    // double-click on desktop, one tap on phones, Enter from the keyboard
    const b = h('button', { class: 'icon' }, glyph(d.src), h('span', {}, d.label));
    b.addEventListener('dblclick', d.open);
    b.addEventListener('keydown', e => { if (e.key === 'Enter') d.open(); });
    b.addEventListener('pointerup', tapOpen(d.open));
    iconsEl.append(h('li', {}, b));
}

// --- start menu ---------------------------------------------------------------
const item = (src, label, fn) => h('li', {}, h('button', { onclick: () => { toggleStart(false); fn(); } }, h('img', { src, alt: '' }), label));
startMenu.querySelector('ul').append(
    item(svgImg('folder'), 'art-store', openStore),
    ...WORKS.map(w => item(thumb(w), w.title, () => openViewer(w))),
    h('li', {}, h('hr')),
    item(svgImg('notepad'), 'Readme', openReadme),
    item(svgImg('display'), 'Settings…', openDisplay),
    item(svgImg('web'), 'Back to the website', () => { location.href = HOME; }),
    h('li', {}, h('hr')),
    item(svgImg('power'), 'Shut Down…', shutdown),
);
function toggleStart(on = startMenu.hidden) {
    startMenu.hidden = !on;
    startBtn.setAttribute('aria-expanded', String(on));
}
startBtn.addEventListener('click', e => { e.stopPropagation(); toggleStart(); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('.start-menu, .start-btn')) toggleStart(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleStart(false); });
desk.addEventListener('contextmenu', e => { if (e.target === desk) { e.preventDefault(); openDisplay(); } });

// --- clock --------------------------------------------------------------------
const clock = document.querySelector('.tray time');
const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
tick();
setInterval(tick, 20000);

// --- first view: two windows, leaving the room (path + beige PC) visible -----
if (!narrow()) {
    openStore();
    openViewer(WORKS[0], { x: desk.clientWidth * .26, y: desk.clientHeight * .4 });
}
