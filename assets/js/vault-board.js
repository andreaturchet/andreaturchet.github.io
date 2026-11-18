// The Vault — dithered board under the cover photo (after dapan.es).
//
// The photo's concrete floor crumbles into pixels and settles into a red/ink
// ordered-dither board, rendered in WebGL at 1/3 resolution. Every article in
// the index below is an object on the board; hovering either one lights the
// other, clicking opens the article.
//
// Objects come from the index: each <a data-board="crt|books|globe|shelf"
// data-square="x,z"> becomes one (max 6). Squares are centred on half-units
// and an object reads best on a dark square, i.e. floor(x) + floor(z) even.
// With the fixed corner view, x − z runs across the screen and x + z into depth.

const FLOOR_Y = 858; // wall/floor line in the-vault-crt.webp, natural px
const YAW = Math.PI / 4, PITCH = .6, BOARD = 3.5, INTRO = 2900, MAX_OBJECTS = 6;
const FACE = .45; // objects turned slightly away from facing the camera
const TYPES = {
    crt: { id: 1, scale: 1.65, height: .8, yaw: FACE },
    books: { id: 2, scale: 1.3, height: .34, yaw: FACE + .3 },
    globe: { id: 3, scale: 1.25, height: .9, yaw: 0 },
    shelf: { id: 4, scale: 1.3, height: .74, yaw: FACE - .2 },
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = t => 1 - (1 - t) ** 3;
const boardHeight = () => Math.round(clamp(innerWidth * .62, 400, 700)); // keep in sync with the CSS fallback

const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }';

const FRAG = `
precision highp float;
uniform vec2 uRes, uCenter, uUvA, uUvB;
uniform float uTime, uReveal, uDecay, uYaw, uPitch, uScale;
uniform float uFloorRow, uPhotoEnd, uFade, uFloorV, uMaxV, uBoard;
uniform vec3 uRed, uInk;
uniform vec4 uObj[6];   // xyz position, w type
uniform vec4 uObjB[6];  // x scale, y yaw, z hover
uniform sampler2D uPhoto;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), f.x),
               mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), f.x), f.y);
}
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(.5 * a) * .25 + bayer2(a); }

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b + r;
    return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r;
}
float sdCyl(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.) + length(max(d, 0.));
}

// 1 CRT, 2 stack of books, 3 globe, 4 standing books; ~1 unit footprint each
float shape(vec3 p, float t) {
    if (t < 1.5) {
        float d = sdBox(p - vec3(0., .44, .02), vec3(.36, .3, .3), .05);
        d = min(d, sdBox(p - vec3(0., .43, -.25), vec3(.27, .22, .2), .05));
        d = min(d, sdBox(p - vec3(0., .07, 0.), vec3(.24, .06, .22), .02));
        return max(d, -sdBox(p - vec3(0., .46, .35), vec3(.27, .2, .05), .02));
    }
    if (t < 2.5) {
        float d = 1e3;
        for (int i = 0; i < 3; i++) {
            vec3 q = p - vec3(0., .065 + float(i) * .125, 0.);
            q.xz = rot(float(i) * .45 - .4) * q.xz;
            d = min(d, sdBox(q, vec3(.34 - float(i) * .04, .056, .24 - float(i) * .02), .012));
        }
        return d;
    }
    if (t < 3.5) {
        float d = length(p - vec3(0., .58, 0.)) - .3;
        d = min(d, sdCyl(p - vec3(0., .19, 0.), .035, .14));
        return min(d, sdCyl(p - vec3(0., .03, 0.), .19, .03));
    }
    float d = sdBox(p - vec3(-.26, .31, 0.), vec3(.1, .31, .24), .015);
    d = min(d, sdBox(p - vec3(-.04, .36, 0.), vec3(.1, .36, .26), .015));
    vec3 r = p - vec3(.22, .29, 0.);
    r.xy = rot(-.32) * r.xy;
    return min(d, sdBox(r, vec3(.1, .29, .22), .015));
}

float map(vec3 p, out float oid) {
    float d = 1e3;
    oid = -1.;
    for (int i = 0; i < 6; i++) {
        vec4 o = uObj[i];
        if (o.w < .5) continue;
        vec4 b = uObjB[i];
        vec3 q = p - o.xyz;
        float di = length(q - vec3(0., .45 * b.x, 0.)) - .8 * b.x; // bounding sphere
        if (di < .05) {
            q.xz = rot(b.y) * q.xz;
            di = shape(q / b.x, o.w) * b.x;
        }
        if (di < d) { d = di; oid = float(i); }
    }
    return d;
}

vec3 calcN(vec3 p) {
    vec2 e = vec2(.0015, -.0015);
    float i;
    return normalize(e.xyy * map(p + e.xyy, i) + e.yyx * map(p + e.yyx, i) +
                     e.yxy * map(p + e.yxy, i) + e.xxx * map(p + e.xxx, i));
}

float shadow(vec3 p, vec3 L) {
    float res = 1., t = .02, i;
    for (int k = 0; k < 28; k++) {
        float h = map(p + L * t, i);
        res = min(res, 8. * h / t);
        t += clamp(h, .02, .25);
        if (res < .02 || t > 3.) break;
    }
    return clamp(res, 0., 1.);
}

float shadeFloor(vec3 p, vec3 L) {
    vec2 f = p.xz;
    float chk = mod(floor(f.x) + floor(f.y), 2.);
    float e = max(abs(f.x), abs(f.y)) / uBoard;
    float on = 1. - smoothstep(.74, 1.06, e);
    float v = mix(.13, .84, chk);
    for (int i = 0; i < 6; i++) {
        if (uObj[i].w < .5) continue;
        if (all(equal(floor(f), floor(uObj[i].xz)))) v = mix(v, chk > .5 ? 1. : .5, uObjB[i].z);
    }
    v *= .45 + .55 * shadow(p + vec3(0., .002, 0.), L);
    v = floor(v * 5. + .5) / 5.; // flat tones give clean dither patterns
    float halo = .09 * (1. - smoothstep(.95, 1.5, e));
    return mix(halo, v, on);
}

float shadeObject(vec3 p, vec3 rd, float oid, vec3 L) {
    vec3 n = calcN(p);
    float dif = max(dot(n, L), 0.);
    float v = .12 + .9 * dif * (.35 + .65 * shadow(p + n * .01, L)) + .18 * max(n.y, 0.);
    v *= 1. - .92 * smoothstep(.62, .9, 1. - max(dot(n, -rd), 0.)); // dark silhouette edge
    for (int i = 0; i < 6; i++) {
        if (float(i) != oid) continue;
        vec4 o = uObj[i];
        vec4 b = uObjB[i];
        vec3 q = p - o.xyz;
        q.xz = rot(b.y) * q.xz;
        q /= b.x;
        vec3 nl = n;
        nl.xz = rot(b.y) * nl.xz;
        if (o.w < 1.5) {            // CRT screen with a ring
            if (q.z > .27 && abs(q.x) < .29 && abs(q.y - .46) < .22) {
                float ring = 1. - smoothstep(0., .03, abs(length(vec2(q.x, q.y - .46)) - .13));
                v = .05 + .8 * ring * (.6 + .4 * b.z);
            }
        } else if (o.w < 2.5 || o.w > 3.5) { // book page edges
            if (abs(nl.y) < .5) v = .3 + .55 * dif;
        } else {                    // globe grid
            vec3 g = q - vec3(0., .58, 0.);
            if (length(g) < .32) {
                float lon = atan(g.z, g.x);
                float lat = asin(clamp(g.y / .3, -1., 1.));
                float lines = max(step(.84, fract(lon * 1.5915)), step(.8, fract(lat * 2.2 + .5)));
                v = mix(v * .4, .95, lines);
            }
        }
        v += .22 * b.z;
    }
    return floor(v * 5. + .5) / 5.;
}

// Orthographic corner view of the board; kind: 0 nothing, 1 floor, 2 object.
float scene(vec2 pix, out float kind) {
    vec3 back = vec3(sin(uYaw) * cos(uPitch), sin(uPitch), cos(uYaw) * cos(uPitch));
    vec3 right = vec3(cos(uYaw), 0., -sin(uYaw));
    vec3 up = cross(back, right);
    vec2 q = pix + .5 - uCenter;
    q.y = -q.y;
    vec3 ro = back * 30. + (right * q.x + up * q.y) * uScale, rd = -back;
    vec3 L = normalize(vec3(-.4, .9, .3));
    float tf = -ro.y / rd.y;
    float t = max(0., (ro.y - 1.6) / -rd.y);
    float oid = -1., id;
    for (int i = 0; i < 96; i++) {
        if (t > tf) break;
        float d = map(ro + rd * t, id);
        if (d < .0015) { oid = id; break; }
        t += d;
    }
    if (oid > -.5) { kind = 2.; return shadeObject(ro + rd * t, rd, oid, L); }
    kind = 1.;
    return shadeFloor(ro + rd * tf, L);
}

// The photo's concrete: -1 where the photo still shows, else dither intensity.
// Lit pixels keep the concrete's colour near the photo and turn red (one by
// one, never blended) as they fall towards the board.
float dissolve(vec2 pix, out vec3 col) {
    vec2 uv = pix * uUvA + uUvB;
    if (uv.y > uMaxV) uv.y = uMaxV - mod(uv.y - uMaxV, (uMaxV - uFloorV) * .75);
    vec3 ph = texture2D(uPhoto, uv).rgb;
    float L = dot(ph, vec3(.2126, .7152, .0722));
    float yy = (pix.y - uFloorRow) / max(uPhotoEnd - uFloorRow, 1.);
    float nn = vnoise(pix * vec2(.07, .16) + vec2(uTime * .05, -uTime * .3));
    float front = yy + (nn - .5) * .55 + (uReveal - 1.) * 1.7 + uDecay;
    float amt = smoothstep(.2, .85, front);
    float h = hash12(pix + step(.9, hash12(pix * 1.37)) * floor(uTime * 8.));
    if (pix.y < uPhotoEnd && h >= amt) return -1.;
    float below = (pix.y - uPhotoEnd) / max(uFade, 1.);
    float m = smoothstep(.25, 1., (pix.y - uFloorRow) / max(uPhotoEnd + uFade - uFloorRow, 1.));
    col = hash12(pix * 3.17 + 11.) < m ? uRed : ph * 1.06;
    float base = mix(clamp(L * 1.45, 0., .94), L * .65, m);
    return base * (1. - smoothstep(-.3, 1., below)) * smoothstep(0., .5, uReveal);
}

void main() {
    vec2 pix = vec2(floor(gl_FragCoord.x), uRes.y - 1. - floor(gl_FragCoord.y));
    float row = pix.y, pd = 0., kind = 0.;
    vec3 pcol = uRed, onc = uRed;
    if (row < uPhotoEnd + uFade + 1.) pd = dissolve(pix, pcol);
    if (row < uPhotoEnd && pd < 0.) { gl_FragColor = vec4(0.); return; }
    float s = scene(pix, kind);
    float k = kind > 1.5 ? smoothstep(.45, 1., uReveal)
                         : smoothstep(uPhotoEnd + 2., uPhotoEnd + 40., row) * smoothstep(.2, .9, uReveal);
    if (pd > s * k) onc = pcol;
    float v = max(pd, s * k);
    v *= 1. - smoothstep(uRes.y - 40., uRes.y - 2., row);
    gl_FragColor = vec4(mix(uInk, onc, step(bayer8(pix) + 1. / 128., v)), 1.);
}
`;

function program(gl) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
}

// Where the cover photo is drawn on the page (object-fit: cover + object-position).
function photoMap(img) {
    const r = img.getBoundingClientRect();
    const kw = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
    const pos = getComputedStyle(img).objectPosition.split(' ').map(v => (v in kw ? kw[v] : parseFloat(v)) / 100);
    const W = img.naturalWidth, H = img.naturalHeight;
    const s = Math.max(r.width / W, r.height / H);
    return {
        s, W, H,
        left: r.left + scrollX + (r.width - W * s) * pos[0],
        top: r.top + scrollY + (r.height - H * s) * pos[1],
        bottom: r.bottom + scrollY,
    };
}

// Mirrors the shader camera so the HTML labels can be pinned to 3D points.
function camera(center, scale) {
    const b = [Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH)];
    const r = [Math.cos(YAW), 0, -Math.sin(YAW)];
    const u = [b[1] * r[2] - b[2] * r[1], b[2] * r[0] - b[0] * r[2], b[0] * r[1] - b[1] * r[0]];
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    return P => [center[0] + dot(P, r) / scale, center[1] - dot(P, u) / scale];
}

async function start() {
    const root = document.documentElement;
    const img = document.querySelector('.cover-photo');
    const board = document.querySelector('.vault-board');
    const canvas = board.querySelector('canvas');
    const layer = board.querySelector('.board-labels');

    const items = [...document.querySelectorAll('.index-list a[data-board][data-square]')].slice(0, MAX_OBJECTS).map(a => {
        const t = TYPES[a.dataset.board] || TYPES.books;
        const [x, z] = a.dataset.square.split(',').map(Number);
        const label = document.createElement('a');
        label.className = 'board-label';
        label.href = a.href;
        label.tabIndex = -1; // the index link is the keyboard/screen-reader path
        const kind = document.createElement('span');
        kind.className = 'board-label-kind';
        kind.textContent = `${a.dataset.kind || a.querySelector('.index-kind')?.textContent || ''} · ${a.querySelector('time')?.textContent || ''}`;
        const title = document.createElement('span');
        title.textContent = a.dataset.label || a.querySelector('h3').textContent;
        if (a.querySelector('h3').lang) label.lang = a.querySelector('h3').lang;
        label.append(kind, title);
        layer.append(label);
        return { ...t, x, z, href: a.href, row: a, label, hover: 0 };
    });

    if (!img.complete || !img.naturalWidth) await new Promise((ok, fail) => {
        img.addEventListener('load', ok, { once: true });
        img.addEventListener('error', fail, { once: true });
    });
    await document.fonts.ready;

    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL unavailable');
    const prog = program(gl);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

    const locs = new Map();
    const set = obj => {
        for (const [name, v] of Object.entries(obj)) {
            if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name));
            const l = locs.get(name);
            if (!l) continue;
            if (typeof v === 'number') gl.uniform1f(l, v);
            else if (v.length === 2) gl.uniform2fv(l, v);
            else if (v.length === 3) gl.uniform3fv(l, v);
            else gl.uniform4fv(l, v);
        }
    };
    set({ uRed: [.89, .07, .04], uInk: [.063, .063, .063], uYaw: YAW, uPitch: PITCH, uBoard: BOARD, uFade: 18 });

    // layout: canvas runs from the floor line in the photo to `below` px under it
    const L = {};
    function layout() {
        const PX = innerWidth < 620 ? 2 : 3;
        const below = boardHeight();
        root.style.setProperty('--board-height', `${below}px`);
        const m = photoMap(img);
        const top = Math.round(m.top + FLOOR_Y * m.s);
        const W = Math.ceil(root.clientWidth / PX), H = Math.ceil((m.bottom - top + below) / PX);
        Object.assign(canvas, { width: W, height: H });
        Object.assign(canvas.style, { width: `${W * PX}px`, height: `${H * PX}px`, top: `${top - m.bottom}px` });
        layer.style.top = canvas.style.top;
        gl.viewport(0, 0, W, H);
        const photoEnd = (m.bottom - top) / PX, avail = H - photoEnd;
        // narrow screens: let the faded outer squares run off the edges
        const scale = Math.max((innerWidth < 620 ? 5 : 6.6) / W, 4.3 / (avail * .9));
        // objects span screen-x −2.8…+1.4 units: shift so the group sits centred
        const center = [W / 2 + .7 / scale, photoEnd + avail * .52];
        Object.assign(L, { PX, W, H, project: camera(center, scale), unit: 1 / scale });
        set({
            uRes: [W, H], uFloorRow: 0, uPhotoEnd: photoEnd, uCenter: center, uScale: scale,
            uUvA: [PX / m.s / m.W, PX / m.s / m.H],
            uUvB: [(PX / 2 - m.left) / m.s / m.W, (top + PX / 2 - m.top) / m.s / m.H],
            uFloorV: FLOOR_Y / m.H, uMaxV: (m.H - 1) / m.H,
        });
        for (const o of items) {
            const [x, y] = L.project([o.x, o.height * o.scale, o.z]);
            [o.mx, o.my] = L.project([o.x, o.height * o.scale * .5, o.z]);
            o.rad = Math.max(5, .5 * o.scale * L.unit);
            const half = o.label.offsetWidth / 2 + 8, vw = root.clientWidth;
            o.label.style.transform = `translate3d(${Math.min(Math.max(x * PX, half), vw - half).toFixed(1)}px, ${(y * PX).toFixed(1)}px, 0)`;
        }
        layer.classList.add('is-ready');
    }

    // hover: plain on/off highlight, from the board, its labels or the index
    let hovered = null, picked = null;
    const objects = new Float32Array(24), objectsB = new Float32Array(24);
    function sync() {
        const on = hovered || picked;
        let changed = false;
        items.forEach((o, i) => {
            const h = o === on ? 1 : 0;
            if (h !== o.hover) changed = true;
            o.hover = h;
            o.label.classList.toggle('is-on', !!h);
            o.row.classList.toggle('is-on', !!h);
            objects.set([o.x, 0, o.z, o.id], i * 4);
            objectsB.set([o.scale, o.yaw, h, 0], i * 4);
        });
        return changed;
    }
    for (const o of items) {
        for (const el of [o.label, o.row]) {
            el.addEventListener('pointerenter', () => { hovered = o; kick(); });
            el.addEventListener('pointerleave', () => { if (hovered === o) hovered = null; kick(); });
        }
        o.row.addEventListener('focus', () => { hovered = o; kick(); });
        o.row.addEventListener('blur', () => { if (hovered === o) hovered = null; kick(); });
    }
    canvas.addEventListener('pointermove', e => {
        const x = e.offsetX / L.PX, y = e.offsetY / L.PX;
        let best = null, bd = 1;
        for (const o of items) {
            const d = Math.hypot(x - o.mx, y - o.my) / o.rad;
            if (d < bd) { bd = d; best = o; }
        }
        picked = best;
        canvas.style.cursor = best ? 'pointer' : '';
        kick();
    });
    canvas.addEventListener('pointerleave', () => { picked = null; kick(); });
    canvas.addEventListener('click', () => { if (picked) location.href = picked.href; });

    // render loop: full rate during the intro, then ~8×/s for the crumbling
    // floor (its pixels only change that often) or on hover/scroll
    let raf = 0, visible = true, lastDraw = -1e9, lastScroll = -1;
    const t0 = performance.now();
    function tick(now) {
        raf = 0;
        const t = reducedMotion ? 1e5 : now - t0;
        const changed = sync() || scrollY !== lastScroll;
        if (t < INTRO || changed || t - lastDraw >= 125) {
            set({
                uTime: t / 1000, uReveal: easeOut(clamp((t - 150) / (INTRO - 300))),
                uDecay: clamp(scrollY / 900) * .6, uObj: objects, uObjB: objectsB,
            });
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            lastDraw = t;
            lastScroll = scrollY;
        }
        if (visible && !reducedMotion) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }

    layout();
    root.classList.add('has-board');
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
    let w = innerWidth, timer;
    addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (innerWidth !== w) { w = innerWidth; layout(); kick(); } }, 150);
    });
    if (reducedMotion) addEventListener('scroll', kick, { passive: true });
    kick();
}

start().catch(err => {
    // no WebGL / image failed: fall back to the plain index
    document.documentElement.classList.remove('has-board');
    console.warn('Vault board disabled:', err);
});
