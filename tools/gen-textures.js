#!/usr/bin/env node
/**
 * Generate pixel-art PNG textures for district buildings.
 * Pure Node.js — no external dependencies. Writes 16x16 PNGs.
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "apps", "client", "public", "buildings");
fs.mkdirSync(OUT, { recursive: true });

// --- Minimal PNG encoder ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, "ascii");
  const crcBuf = Buffer.concat([typeB, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function writePng(filepath, w, h, pixels) {
  // pixels: flat array of [r,g,b,a] per pixel, row-major
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0); // filter: none
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
    }
  }
  const rawBuf = Buffer.from(raw);
  const deflated = zlib.deflateSync(rawBuf);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const png = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflated),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filepath, png);
}

// --- Pixel art patterns (16x16) ---
function rgba(r, g, b, a = 255) { return [r, g, b, a]; }
const T = [0, 0, 0, 0]; // transparent

function makePixels(w, h, drawFn) {
  const px = new Array(w * h * 4).fill(0);
  function set(x, y, c) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  }
  function fill(x1, y1, x2, y2, c) {
    for (let y = y1; y <= y2; y++)
      for (let x = x1; x <= x2; x++) set(x, y, c);
  }
  drawFn(set, fill);
  return px;
}

// Color palettes
const Y_WALL = rgba(200, 170, 80);
const Y_DARK = rgba(160, 130, 50);
const Y_LIGHT = rgba(230, 200, 120);
const Y_ROOF = rgba(180, 150, 60);

const B_WALL = rgba(80, 130, 200);
const B_DARK = rgba(50, 90, 160);
const B_LIGHT = rgba(120, 170, 230);
const B_ROOF = rgba(60, 110, 180);

const G_WALL = rgba(80, 170, 100);
const G_DARK = rgba(40, 120, 60);
const G_LIGHT = rgba(120, 200, 140);
const G_ROOF = rgba(60, 150, 80);

const R_WALL = rgba(190, 70, 70);
const R_DARK = rgba(140, 40, 40);
const R_LIGHT = rgba(220, 110, 110);
const R_ROOF = rgba(170, 50, 50);

const P_WALL = rgba(130, 80, 200);
const P_DARK = rgba(90, 50, 160);
const P_LIGHT = rgba(170, 120, 230);
const P_ROOF = rgba(110, 60, 180);

const STONE = rgba(140, 140, 150);
const STONE_D = rgba(100, 100, 110);
const WINDOW = rgba(255, 240, 160);
const DOOR = rgba(100, 70, 40);
const WOOD = rgba(130, 90, 50);

// --- Building designs ---

// Generic tower/castle shape
function drawTower(set, fill, wall, dark, light, roof) {
  // Base
  fill(3, 10, 12, 15, wall);
  fill(3, 10, 3, 15, dark);
  fill(12, 10, 12, 15, dark);
  // Roof
  fill(2, 7, 13, 9, roof);
  fill(4, 6, 11, 6, roof);
  fill(6, 5, 9, 5, roof);
  // Crenellations
  set(2, 6, roof); set(5, 4, light); set(10, 4, light);
  set(13, 6, roof);
  // Windows
  set(6, 12, WINDOW); set(9, 12, WINDOW);
  // Door
  fill(7, 13, 8, 15, DOOR);
}

// Temple/church shape
function drawTemple(set, fill, wall, dark, light, roof) {
  // Base
  fill(2, 11, 13, 15, wall);
  fill(2, 11, 2, 15, dark);
  fill(13, 11, 13, 15, dark);
  // Roof triangle
  fill(3, 8, 12, 10, roof);
  fill(5, 7, 10, 7, roof);
  fill(6, 6, 9, 6, roof);
  fill(7, 5, 8, 5, roof);
  // Cross/spire
  set(7, 3, light); set(8, 3, light);
  set(7, 4, light); set(8, 4, light);
  set(6, 3, light); set(9, 3, light);
  // Window (round)
  set(7, 9, WINDOW); set(8, 9, WINDOW);
  // Door
  fill(7, 13, 8, 15, DOOR);
  // Columns
  fill(4, 11, 4, 15, dark); fill(11, 11, 11, 15, dark);
}

// Market/shop shape
function drawShop(set, fill, wall, dark, light, roof) {
  // Base
  fill(2, 9, 13, 15, wall);
  fill(2, 9, 2, 15, dark);
  fill(13, 9, 13, 15, dark);
  // Roof (slanted awning)
  fill(1, 7, 14, 8, roof);
  fill(2, 6, 13, 6, roof);
  // Awning stripes
  for (let x = 1; x <= 14; x += 2) set(x, 7, light);
  // Window display
  fill(4, 11, 6, 13, WINDOW);
  fill(9, 11, 11, 13, WINDOW);
  // Door
  fill(7, 12, 8, 15, DOOR);
  // Sign
  fill(5, 4, 10, 5, WOOD);
  set(6, 4, light); set(9, 4, light);
}

// Fortress shape
function drawFortress(set, fill, wall, dark, light, roof) {
  // Main wall
  fill(4, 8, 11, 15, wall);
  fill(4, 8, 4, 15, dark);
  fill(11, 8, 11, 15, dark);
  // Left tower
  fill(1, 5, 4, 15, wall);
  fill(1, 5, 1, 15, dark);
  // Right tower
  fill(11, 5, 14, 15, wall);
  fill(14, 5, 14, 15, dark);
  // Crenellations
  set(1, 4, dark); set(3, 4, dark);
  set(12, 4, dark); set(14, 4, dark);
  fill(5, 7, 10, 7, dark);
  set(5, 6, dark); set(7, 6, dark); set(9, 6, dark);
  // Gate
  fill(6, 11, 9, 15, DOOR);
  fill(6, 11, 9, 11, dark);
  set(7, 12, STONE_D); set(8, 12, STONE_D);
  // Windows
  set(2, 8, WINDOW); set(13, 8, WINDOW);
}

// Special/magical shape
function drawMagical(set, fill, wall, dark, light, roof) {
  // Tower base
  fill(5, 7, 10, 15, wall);
  fill(5, 7, 5, 15, dark);
  fill(10, 7, 10, 15, dark);
  // Pointed roof
  fill(4, 5, 11, 6, roof);
  fill(5, 4, 10, 4, roof);
  fill(6, 3, 9, 3, roof);
  fill(7, 2, 8, 2, roof);
  // Star on top
  set(7, 1, rgba(255, 255, 100)); set(8, 1, rgba(255, 255, 100));
  // Magical windows (glowing)
  set(7, 9, rgba(200, 150, 255)); set(8, 9, rgba(200, 150, 255));
  set(7, 12, rgba(200, 150, 255)); set(8, 12, rgba(200, 150, 255));
  // Sparkles
  set(3, 4, rgba(200, 180, 255, 180));
  set(12, 6, rgba(200, 180, 255, 180));
  set(2, 9, rgba(200, 180, 255, 150));
  set(13, 3, rgba(200, 180, 255, 150));
  // Door
  fill(7, 13, 8, 15, DOOR);
}

// --- Generate all building textures ---
const buildings = {
  // Yellow buildings
  "yellow_1": (s, f) => drawTower(s, f, Y_WALL, Y_DARK, Y_LIGHT, Y_ROOF),   // Сторожевая башня
  "yellow_2": (s, f) => drawTower(s, f, Y_WALL, Y_DARK, Y_LIGHT, Y_ROOF),   // Казармы стражи
  "yellow_3": (s, f) => drawTemple(s, f, Y_WALL, Y_DARK, Y_LIGHT, Y_ROOF),  // Тронный зал
  "yellow_4": (s, f) => drawShop(s, f, Y_WALL, Y_DARK, Y_LIGHT, Y_ROOF),    // Королевский сад
  "yellow_5": (s, f) => drawFortress(s, f, Y_WALL, Y_DARK, Y_LIGHT, Y_ROOF),// Дворец

  // Blue buildings
  "blue_1": (s, f) => drawTemple(s, f, B_WALL, B_DARK, B_LIGHT, B_ROOF),     // Храм
  "blue_2": (s, f) => drawTemple(s, f, B_WALL, B_DARK, B_LIGHT, B_ROOF),     // Часовня
  "blue_3": (s, f) => drawFortress(s, f, B_WALL, B_DARK, B_LIGHT, B_ROOF),   // Монастырь
  "blue_4": (s, f) => drawMagical(s, f, B_WALL, B_DARK, B_LIGHT, B_ROOF),    // Святилище
  "blue_5": (s, f) => drawTemple(s, f, B_WALL, B_DARK, B_LIGHT, B_ROOF),     // Собор

  // Green buildings
  "green_1": (s, f) => drawShop(s, f, G_WALL, G_DARK, G_LIGHT, G_ROOF),      // Таверна
  "green_2": (s, f) => drawShop(s, f, G_WALL, G_DARK, G_LIGHT, G_ROOF),      // Рынок
  "green_3": (s, f) => drawTower(s, f, G_WALL, G_DARK, G_LIGHT, G_ROOF),     // Торговый пост
  "green_4": (s, f) => drawFortress(s, f, G_WALL, G_DARK, G_LIGHT, G_ROOF),  // Порт
  "green_5": (s, f) => drawTemple(s, f, G_WALL, G_DARK, G_LIGHT, G_ROOF),    // Ратуша

  // Red buildings
  "red_1": (s, f) => drawTower(s, f, R_WALL, R_DARK, R_LIGHT, R_ROOF),       // Застава
  "red_2": (s, f) => drawFortress(s, f, R_WALL, R_DARK, R_LIGHT, R_ROOF),    // Тюрьма
  "red_3": (s, f) => drawFortress(s, f, R_WALL, R_DARK, R_LIGHT, R_ROOF),    // Крепость
  "red_4": (s, f) => drawTower(s, f, R_WALL, R_DARK, R_LIGHT, R_ROOF),       // Арсенал
  "red_5": (s, f) => drawFortress(s, f, R_WALL, R_DARK, R_LIGHT, R_ROOF),    // Цитадель

  // Purple buildings
  "purple_4": (s, f) => drawMagical(s, f, P_WALL, P_DARK, P_LIGHT, P_ROOF),  // special
  "purple_5": (s, f) => drawMagical(s, f, P_WALL, P_DARK, P_LIGHT, P_ROOF),
  "purple_6": (s, f) => drawMagical(s, f, P_WALL, P_DARK, P_LIGHT, P_ROOF),
};

// Also generate a generic texture per color for fallback
const colorFallbacks = {
  "yellow": (s, f) => drawTower(s, f, Y_WALL, Y_DARK, Y_LIGHT, Y_ROOF),
  "blue": (s, f) => drawTemple(s, f, B_WALL, B_DARK, B_LIGHT, B_ROOF),
  "green": (s, f) => drawShop(s, f, G_WALL, G_DARK, G_LIGHT, G_ROOF),
  "red": (s, f) => drawFortress(s, f, R_WALL, R_DARK, R_LIGHT, R_ROOF),
  "purple": (s, f) => drawMagical(s, f, P_WALL, P_DARK, P_LIGHT, P_ROOF),
};

const W = 16, H = 16;

for (const [name, drawFn] of Object.entries(buildings)) {
  const pixels = makePixels(W, H, drawFn);
  writePng(path.join(OUT, `${name}.png`), W, H, pixels);
  console.log(`  ${name}.png`);
}

for (const [name, drawFn] of Object.entries(colorFallbacks)) {
  const pixels = makePixels(W, H, drawFn);
  writePng(path.join(OUT, `${name}.png`), W, H, pixels);
  console.log(`  ${name}.png (fallback)`);
}

console.log(`\nDone! Generated ${Object.keys(buildings).length + Object.keys(colorFallbacks).length} textures in ${OUT}`);
