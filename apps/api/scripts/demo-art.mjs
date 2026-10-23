// Generated product pictures for the demo, so the apps show something worth looking at without shipping image files.
// A tiny anti-aliased rasteriser (signed-distance shapes painted back to front) draws a soft studio backdrop and a
// recognisable silhouette: a console, a VR headset, a camera, and a "drawer" of lockers for places.
import { crc32, deflateSync } from 'node:zlib';

const W = 800;
const H = 520;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Signed distance to a rounded rectangle centred at (cx, cy). */
const rrect = (cx, cy, w, h, r) => (x, y) => {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
const disc = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const ellipse = (cx, cy, rx, ry) => (x, y) =>
  (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);

class Canvas {
  constructor(top, bottom) {
    this.px = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y += 1) {
      const t = y / (H - 1);
      for (let x = 0; x < W; x += 1) {
        // gradient with a soft vignette
        const v = 1 - 0.28 * clamp(Math.hypot(x - W / 2, y - H / 2) / (W * 0.62));
        const c = mix(top, bottom, t);
        for (let k = 0; k < 3; k += 1) this.px[(y * W + x) * 3 + k] = c[k] * v;
      }
    }
  }

  /** Paint a shape; `color` is an RGB array or a function (x, y) => RGB; `alpha` fades it. */
  paint(sdf, color, alpha = 1, blur = 0) {
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const d = sdf(x + 0.5, y + 0.5);
        if (d > 1 + blur) continue;
        const cover = (blur > 0 ? clamp(0.5 - d / (2 * blur)) : clamp(0.5 - d)) * alpha;
        if (cover <= 0) continue;
        const c = typeof color === 'function' ? color(x, y) : color;
        const i = (y * W + x) * 3;
        for (let k = 0; k < 3; k += 1) this.px[i + k] = this.px[i + k] * (1 - cover) + c[k] * cover;
      }
    }
  }

  png() {
    const raw = Buffer.alloc((W * 3 + 1) * H);
    for (let y = 0; y < H; y += 1) {
      const row = y * (W * 3 + 1);
      raw[row] = 0;
      for (let x = 0; x < W * 3; x += 1)
        raw[row + 1 + x] = Math.round(clamp(this.px[y * W * 3 + x], 0, 255));
    }
    const chunk = (type, data) => {
      const body = Buffer.concat([Buffer.from(type), data]);
      const out = Buffer.alloc(body.length + 8);
      out.writeUInt32BE(data.length, 0);
      body.copy(out, 4);
      out.writeUInt32BE(crc32(body), body.length + 4);
      return out;
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(W, 0);
    header.writeUInt32BE(H, 4);
    header[8] = 8;
    header[9] = 2;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

/** Light-to-dark shading across a shape, for a hint of volume. */
const shade = (light, dark, y0, y1) => (_x, y) => mix(light, dark, clamp((y - y0) / (y1 - y0)));

const floorShadow = (c, cx, cy, rx) => c.paint(ellipse(cx, cy, rx, rx * 0.14), [0, 0, 0], 0.35, 14);

const scenes = {
  console(c) {
    floorShadow(c, 400, 452, 150);
    // two side plates, the dark centre, then the white shell with its curve
    c.paint(rrect(318, 245, 70, 360, 34), shade([252, 252, 255], [205, 210, 225], 70, 420));
    c.paint(rrect(482, 245, 70, 360, 34), shade([252, 252, 255], [205, 210, 225], 70, 420));
    c.paint(rrect(400, 250, 112, 380, 30), shade([28, 30, 44], [8, 8, 16], 60, 440));
    c.paint(rrect(400, 250, 22, 330, 11), [60, 120, 255], 0.9, 4);
    c.paint(rrect(400, 442, 190, 26, 13), shade([235, 238, 248], [180, 186, 205], 430, 456));
  },
  headset(c) {
    floorShadow(c, 400, 440, 210);
    // straps
    c.paint(rrect(166, 255, 70, 150, 30), shade([70, 74, 92], [30, 32, 44], 180, 330));
    c.paint(rrect(634, 255, 70, 150, 30), shade([70, 74, 92], [30, 32, 44], 180, 330));
    c.paint(rrect(400, 130, 260, 36, 18), shade([88, 92, 112], [44, 46, 60], 112, 150));
    // shell and visor
    c.paint(rrect(400, 262, 470, 240, 70), shade([250, 250, 253], [205, 208, 222], 142, 382));
    c.paint(rrect(400, 262, 430, 196, 54), shade([36, 38, 54], [10, 10, 18], 164, 360));
    for (const x of [318, 482]) {
      c.paint(disc(x, 262, 58), [14, 14, 22]);
      c.paint(disc(x, 262, 44), shade([70, 90, 190], [20, 24, 60], 218, 306));
      c.paint(disc(x - 14, 246, 11), [255, 255, 255], 0.7, 3);
    }
    c.paint(rrect(400, 262, 30, 90, 14), [18, 18, 28]);
  },
  camera(c) {
    floorShadow(c, 400, 430, 170);
    // mount prongs under the body
    for (const x of [352, 400, 448])
      c.paint(rrect(x, 388, 22, 70, 6), shade([60, 62, 76], [30, 32, 44], 360, 424));
    c.paint(rrect(400, 262, 330, 250, 46), shade([58, 60, 74], [18, 18, 26], 140, 390));
    c.paint(rrect(400, 262, 316, 236, 40), shade([42, 44, 58], [14, 14, 20], 150, 380));
    // lens
    c.paint(disc(400, 268, 92), shade([190, 194, 208], [80, 84, 100], 176, 360));
    c.paint(disc(400, 268, 74), [10, 10, 16]);
    c.paint(disc(400, 268, 56), shade([40, 70, 180], [10, 14, 50], 212, 324));
    c.paint(disc(378, 244, 16), [255, 255, 255], 0.65, 4);
    // status screen and record light
    c.paint(rrect(514, 176, 78, 52, 10), shade([36, 40, 56], [16, 18, 26], 150, 202));
    c.paint(disc(300, 172, 8), [235, 60, 60], 1, 2);
  },
  /** A friendly head-and-shoulders avatar, for the demo customer. */
  portrait(c) {
    c.paint(ellipse(400, 560, 250, 230), shade([255, 255, 255], [214, 218, 240], 330, 520), 0.95);
    c.paint(rrect(400, 372, 64, 70, 24), [236, 190, 160]);
    c.paint(disc(400, 240, 112), shade([248, 206, 176], [226, 170, 138], 130, 350));
    c.paint(ellipse(400, 158, 120, 48), shade([60, 40, 40], [30, 20, 24], 100, 250), 0.98);
    c.paint(disc(358, 246, 9), [40, 30, 30]);
    c.paint(disc(442, 246, 9), [40, 30, 30]);
    c.paint(ellipse(400, 298, 28, 9), [200, 92, 96], 0.9, 1);
  },
  /** A wall of lockers, for places. */
  lockers(c) {
    floorShadow(c, 400, 470, 300);
    const cols = 4;
    const rows = 2;
    for (let r = 0; r < rows; r += 1) {
      for (let k = 0; k < cols; k += 1) {
        const cx = 160 + k * 160;
        const cy = 170 + r * 150;
        const lit = r === 0 && k === 1;
        c.paint(
          rrect(cx, cy, 142, 132, 16),
          lit
            ? shade([255, 255, 255], [225, 228, 245], cy - 66, cy + 66)
            : shade([120, 120, 210], [70, 70, 160], cy - 66, cy + 66),
          0.96,
        );
        c.paint(disc(cx + 46, cy, 7), lit ? [79, 70, 229] : [235, 235, 255], 0.9, 1);
        c.paint(rrect(cx - 10, cy - 38, 76, 8, 4), lit ? [200, 204, 230] : [150, 150, 230], 0.8);
      }
    }
  },
};

const THEMES = {
  blue: [
    [16, 44, 110],
    [96, 150, 235],
  ],
  purple: [
    [60, 20, 104],
    [186, 112, 232],
  ],
  teal: [
    [8, 78, 72],
    [72, 200, 170],
  ],
  indigo: [
    [30, 27, 100],
    [124, 92, 240],
  ],
  amber: [
    [120, 54, 12],
    [244, 170, 80],
  ],
};

/** @param {'console'|'headset'|'camera'|'lockers'|'portrait'} kind @param {keyof typeof THEMES} theme @returns {Buffer} a PNG */
export function productArt(kind, theme) {
  const [top, bottom] = THEMES[theme];
  const canvas = new Canvas(top, bottom);
  scenes[kind](canvas);
  return canvas.png();
}
