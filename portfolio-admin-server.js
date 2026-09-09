#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = __dirname;
const PORT = Number(process.env.PORTFOLIO_ADMIN_PORT || 4173);
const HOST = process.env.PORTFOLIO_ADMIN_HOST || "127.0.0.1";
const DATA_FILE = path.join(ROOT, "portfolio-admin-data.json");
const DATA_SCRIPT = path.join(ROOT, "portfolio-admin-data.js");
const AUTH_FILE = path.join(ROOT, "portfolio-admin-auth.json");
const ANALYTICS_FILE = path.join(ROOT, "portfolio-analytics.json");
const MESSAGES_FILE = path.join(ROOT, "portfolio-messages.json");
const PUBLIC_FILE = path.join(ROOT, "portfolio-werksporen.html");
const IMAGE_DIR = path.join(ROOT, "portfolio-images");
const sessions = new Map();

function atomicWrite(file, contents) {
  const temporary = file + ".tmp";
  fs.writeFileSync(temporary, contents, "utf8");
  fs.renameSync(temporary, file);
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return { username: "admin", salt, hash };
}

function verifyPassword(password, auth) {
  const actual = crypto.pbkdf2Sync(password, auth.salt, 210000, 32, "sha256");
  const expected = Buffer.from(auth.hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function readAuth() {
  if (!fs.existsSync(AUTH_FILE)) atomicWrite(AUTH_FILE, JSON.stringify(passwordRecord("admin"), null, 2));
  return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
}

function makeId() {
  return crypto.randomBytes(9).toString("hex");
}

function buildInitialData() {
  const html = fs.readFileSync(PUBLIC_FILE, "utf8");
  const items = [];
  const bySource = new Map();
  const add = (source, categories, title, gallery = true, glitch = true, format = "image") => {
    if (!source || bySource.has(source)) {
      if (source && gallery && bySource.has(source)) bySource.get(source).gallery = true;
      return;
    }
    const item = { id: makeId(), src: source, title: title || "", categories: categories.length ? categories : ["proces"], gallery, glitch, visible: true, scale: 1, x: 50, y: 50, filter: "normal", brightness: 1, contrast: 1, rotate: 0, skewX: 0, skewY: 0, note:"Selected from the current image archive.", status:"selected", year:"2026", format };
    items.push(item);
    bySource.set(source, item);
  };

  const staticPattern = /<figure class="overview-thumb has-image" data-kind="([^"]+)"><img src="([^"]+)" alt="([^"]*)"/g;
  for (const match of html.matchAll(staticPattern)) add(match[2], match[1].split(/\s+/), match[3], true, true);

  const excludedMatch = html.match(/const excludedArchiveImages = (\[[^;]+\]);/);
  const extraMatch = html.match(/const extraArchiveImages = (\[[^;]+\]);/);
  const excluded = new Set(excludedMatch ? JSON.parse(excludedMatch[1]) : []);
  const extras = extraMatch ? JSON.parse(extraMatch[1]) : [];
  const paint = new Set(["0488", "0492", "0493", "0495", "0497", "0683", "0745", "0879"]);
  const ink = new Set(["0472", "0477", "0483"]);
  const cycle = ["inkt", "verf", "digitaal", "proces"];
  extras.forEach((number, index) => {
    if (excluded.has(number)) return;
    const category = paint.has(number) ? "verf" : ink.has(number) ? "inkt" : cycle[index % cycle.length];
    add(`portfolio-images/IMG_${number}-heic.png`, [category], `Archive ${number}`, true, true);
  });

  const refreshedBlock = (html.match(/const refreshedArchiveItems = \[([\s\S]*?)\n    \];/) || [])[1] || "";
  const refreshedPattern = /\{ number: "([^"]+)", kind: "([^"]+)", format: "([^"]+)" \}/g;
  for (const match of refreshedBlock.matchAll(refreshedPattern)) add(`portfolio-images/IMG_${match[1]}.jpg`, match[2].split(/\s+/), `IMG_${match[1]}`, true, true, match[3]);

  const featureBlock = (html.match(/const featureItems = \[([\s\S]*?)\n    \];/) || [])[1] || "";
  for (const match of featureBlock.matchAll(/src: "([^"]+)"/g)) add(match[1], ["proces"], path.basename(match[1], path.extname(match[1])), false, true);

  const retiredBlock = (html.match(/const retiredSources = new Set\((\[[^;]+\])\)/) || [])[1];
  if (retiredBlock) {
    for (const source of JSON.parse(retiredBlock)) {
      const item = bySource.get(source);
      if (item) item.visible = false;
    }
  }

  return {
    version: 1,
    theme: { background: "#f6f5f0", accent: "#a3442e", homeTone: "color", glitchTone: "warm", glitchGlowMode: "off", glitchGlowColor: "#d94f8f", glitchGlowOpacity: 80, glitchGlowSoftness: 18, frameRadius: 0, homeGridSize: 1, shadowColor: "#1c1b19", shadowAngle: 45, shadowDistance: 0, shadowBlur: 0 },
    sections: [
      { id:"inkt", label:"inkt & flash" },
      { id:"verf", label:"schilderij" },
      { id:"digitaal", label:"digitaal" },
      { id:"proces", label:"proces" }
    ],
    texts: {
      name: "[ Lars Kramer ]",
      edition: "WERKSPOREN / 01 — 2026",
      location: "NL · OPEN VOOR WERK",
      welcome: "Welcome;",
      all: "alles",
      ink: "inkt & flash",
      paint: "schilderij",
      digital: "digitaal",
      process: "proces",
      aboutLabel: "about",
      selection: "01 / SELECTIE",
      overview: "WERKOVERZICHT",
      about: "A small selection of drawing, painting and digital work.\n\nMade slowly, kept in motion.",
      contact: "[ your name ]\nhello@yourdomain.com\n@yourinstagram",
      contactButton: "04 / CONTACT",
      contactEmail: "jij@voorbeeld.nl",
      footer: "laatst bijgewerkt / september 2026"
    },
    items
  };
}

function writeData(data) {
  atomicWrite(DATA_FILE, JSON.stringify(data, null, 2));
  atomicWrite(DATA_SCRIPT, "window.PORTFOLIO_ADMIN_DATA = " + JSON.stringify(data) + ";\n");
}

function readAnalytics() {
  if (!fs.existsSync(ANALYTICS_FILE)) atomicWrite(ANALYTICS_FILE, JSON.stringify({ version:1, totalViews:0, totalSessions:0, days:{} }, null, 2));
  return JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf8"));
}

function readMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) atomicWrite(MESSAGES_FILE, "[]");
  return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
}

function saveMessage(input) {
  const name = String(input.name || "").trim().slice(0,120);
  const email = String(input.email || "").trim().toLowerCase().slice(0,254);
  const message = String(input.message || "").trim().slice(0,5000);
  if (input.website) return { ok:true };
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 3) throw new Error("Vul naam, een geldig e-mailadres en een bericht in.");
  const messages = readMessages();
  messages.unshift({ id:makeId(), createdAt:new Date().toISOString(), name, email, message, status:"new" });
  atomicWrite(MESSAGES_FILE, JSON.stringify(messages.slice(0,1000), null, 2));
  return { ok:true };
}

function recordVisit(event) {
  const analytics = readAnalytics();
  const now = new Date();
  const dayKey = now.toISOString().slice(0,10);
  const day = analytics.days[dayKey] ||= { views:0, sessions:0, pages:{}, devices:{}, referrers:{}, hours:Array(24).fill(0), sessionHashes:[] };
  const page = String(event.page || "/portfolio").slice(0,120);
  const device = ["mobile","tablet","desktop"].includes(event.device) ? event.device : "other";
  let referrer = "direct";
  try { if (event.referrer) referrer = new URL(String(event.referrer)).hostname.slice(0,100) || "direct"; } catch {}
  const sessionHash = crypto.createHash("sha256").update(String(event.session || "") + dayKey).digest("hex").slice(0,20);
  analytics.totalViews += 1; day.views += 1;
  day.pages[page] = (day.pages[page] || 0) + 1;
  day.devices[device] = (day.devices[device] || 0) + 1;
  day.referrers[referrer] = (day.referrers[referrer] || 0) + 1;
  day.hours[now.getHours()] = (day.hours[now.getHours()] || 0) + 1;
  if (event.session && !day.sessionHashes.includes(sessionHash)) {
    day.sessionHashes.push(sessionHash);
    day.sessions += 1;
    analytics.totalSessions += 1;
  }
  const keys = Object.keys(analytics.days).sort();
  keys.slice(0, Math.max(0, keys.length - 400)).forEach(key => delete analytics.days[key]);
  atomicWrite(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) writeData(buildInitialData());
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map(part => part.trim().split("=")).filter(pair => pair.length === 2));
}

function session(request) {
  const token = cookies(request).portfolio_admin_session;
  const entry = token && sessions.get(token);
  if (!entry || entry.expires < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  entry.expires = Date.now() + 12 * 60 * 60 * 1000;
  return entry;
}

function send(response, status, body, type = "application/json; charset=utf-8", headers = {}) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self' mailto:",
    ...headers
  });
  response.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

function readJson(request, limit = 35 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > limit) { reject(new Error("Te groot bestand")); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("Ongeldige gegevens")); }
    });
    request.on("error", reject);
  });
}

function requireSession(request, response) {
  if (session(request)) return true;
  send(response, 401, { error: "Log opnieuw in." });
  return false;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeData(input) {
  if (!input || !Array.isArray(input.items) || input.items.length > 500 || typeof input.texts !== "object") throw new Error("Ongeldige portfolio-inhoud");
  const rawSections = Array.isArray(input.sections) ? input.sections.slice(0, 30) : [];
  const sections = [];
  const usedSectionIds = new Set();
  rawSections.forEach((section, index) => {
    const id = String(section.id || `pagina-${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    if (!id || usedSectionIds.has(id)) return;
    usedSectionIds.add(id);
    sections.push({ id, label:String(section.label || id).slice(0, 80), note:String(section.note || "").slice(0, 1000) });
  });
  if (!sections.length) sections.push({ id:"werk", label:"werk" });
  const categories = new Set(sections.map(section => section.id));
  return {
    version: 1,
    theme: {
      background: /^#[0-9a-f]{6}$/i.test(input.theme?.background || "") ? input.theme.background : "#f6f5f0",
      accent: /^#[0-9a-f]{6}$/i.test(input.theme?.accent || "") ? input.theme.accent : "#a3442e",
      homeTone: ["color", "gray", "warm", "cool"].includes(input.theme?.homeTone) ? input.theme.homeTone : "color",
      glitchTone: ["color", "gray", "warm", "cool"].includes(input.theme?.glitchTone) ? input.theme.glitchTone : "warm",
      glitchGlow: Boolean(input.theme?.glitchGlow),
      glitchGlowMode: ["off", "synth", "earth", "research", "mono"].includes(input.theme?.glitchGlowMode) ? input.theme.glitchGlowMode : (input.theme?.glitchGlow ? "synth" : "off"),
      glitchGlowColor: /^#[0-9a-f]{6}$/i.test(input.theme?.glitchGlowColor || "") ? input.theme.glitchGlowColor : "#d94f8f",
      glitchGlowOpacity: Math.min(100, Math.max(0, input.theme?.glitchGlowOpacity == null ? 80 : Number(input.theme.glitchGlowOpacity))),
      glitchGlowSoftness: Math.min(36, Math.max(2, Number(input.theme?.glitchGlowSoftness) || 18)),
      frameRadius: Math.min(32, Math.max(0, Number(input.theme?.frameRadius) || 0)),
      homeGridSize: Math.min(2, Math.max(0, Math.round(Number(input.theme?.homeGridSize) || 0))),
      shadowColor: /^#[0-9a-f]{6}$/i.test(input.theme?.shadowColor || "") ? input.theme.shadowColor : "#1c1b19",
      shadowAngle: Math.min(360, Math.max(0, Number(input.theme?.shadowAngle) || 0)),
      shadowDistance: Math.min(28, Math.max(0, Number(input.theme?.shadowDistance) || 0)),
      shadowBlur: Math.min(40, Math.max(0, Number(input.theme?.shadowBlur) || 0))
    },
    home: { baseItemId:String(input.home?.baseItemId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) },
    sections,
    texts: Object.fromEntries(Object.entries(input.texts).map(([key, value]) => [String(key).slice(0, 80), String(value).slice(0, 10000)])),
    items: input.items.map((item, index) => ({
      id: String(item.id || makeId()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64),
      src: String(item.src || "").replace(/^\/+/, "").slice(0, 500),
      originalSrc: String(item.originalSrc || item.src || "").replace(/^\/+/, "").slice(0, 500),
      title: String(item.title || "").slice(0, 200),
      note: String(item.note || "Selected from the current image archive.").slice(0, 1000),
      status: String(item.status || "selected").slice(0, 100),
      year: String(item.year || "2026").slice(0, 20),
      medium: String(item.medium || "").slice(0, 120),
      categories: Array.isArray(item.categories) ? item.categories.filter(value => categories.has(value)) : ["proces"],
      gallery: Boolean(item.gallery), glitch: Boolean(item.glitch), visible: Boolean(item.visible),
      thumbFit: item.thumbFit === "contain" ? "contain" : "cover",
      scale: Math.min(4, Math.max(.35, finiteNumber(item.scale, 1))),
      x: Math.min(100, Math.max(0, finiteNumber(item.x, 50))),
      y: Math.min(100, Math.max(0, finiteNumber(item.y, 50))),
      filter: ["normal", "gray", "warm", "cool"].includes(item.filter) ? item.filter : "normal",
      brightness: Math.min(2, Math.max(.4, finiteNumber(item.brightness, 1))),
      contrast: Math.min(2, Math.max(.4, finiteNumber(item.contrast, 1))),
      rotate: Math.min(15, Math.max(-15, finiteNumber(item.rotate, 0))),
      skewX: Math.min(20, Math.max(-20, finiteNumber(item.skewX, 0))),
      skewY: Math.min(20, Math.max(-20, finiteNumber(item.skewY, 0))),
      viewerFit: item.viewerFit === "cover" ? "cover" : "contain",
      viewerScale: Math.min(4, Math.max(.2, finiteNumber(item.viewerScale, 1))),
      viewerX: Math.min(100, Math.max(0, finiteNumber(item.viewerX, 50))),
      viewerY: Math.min(100, Math.max(0, finiteNumber(item.viewerY, 50))),
      viewerRotate: Math.min(15, Math.max(-15, finiteNumber(item.viewerRotate, 0))),
      viewerSkewX: Math.min(20, Math.max(-20, finiteNumber(item.viewerSkewX, 0))),
      viewerSkewY: Math.min(20, Math.max(-20, finiteNumber(item.viewerSkewY, 0))),
      viewerPerspectiveX: Math.min(25, Math.max(-25, finiteNumber(item.viewerPerspectiveX, 0))),
      viewerPerspectiveY: Math.min(25, Math.max(-25, finiteNumber(item.viewerPerspectiveY, 0))),
      format: String(item.format || "image").slice(0, 100), order: index
    }))
  };
}

async function api(request, response, pathname) {
  if (pathname === "/api/contact" && request.method === "POST") {
    try { return send(response, 200, saveMessage(await readJson(request, 16384))); }
    catch (error) { return send(response, 400, { error:error.message }); }
  }
  if (pathname === "/api/track" && request.method === "POST") {
    const body = await readJson(request, 8192);
    recordVisit(body);
    return send(response, 200, { ok:true });
  }
  if (pathname === "/api/session" && request.method === "GET") return send(response, 200, { authenticated: Boolean(session(request)) });
  if (pathname === "/api/login" && request.method === "POST") {
    const body = await readJson(request, 4096);
    const auth = readAuth();
    if (body.username !== auth.username || !verifyPassword(String(body.password || ""), auth)) return send(response, 403, { error: "Naam of wachtwoord klopt niet." });
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { expires: Date.now() + 12 * 60 * 60 * 1000 });
    return send(response, 200, { ok: true }, "application/json; charset=utf-8", { "Set-Cookie": `portfolio_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
  }
  if (pathname === "/api/logout" && request.method === "POST") {
    const token = cookies(request).portfolio_admin_session;
    if (token) sessions.delete(token);
    return send(response, 200, { ok: true }, "application/json; charset=utf-8", { "Set-Cookie": "portfolio_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (!requireSession(request, response)) return;
  if (pathname === "/api/data" && request.method === "GET") return send(response, 200, readData());
  if (pathname === "/api/analytics" && request.method === "GET") return send(response, 200, readAnalytics());
  if (pathname === "/api/messages" && request.method === "GET") return send(response, 200, readMessages());
  if ((pathname === "/api/data" || pathname === "/api/publish") && request.method === "POST") {
    const data = safeData(await readJson(request));
    writeData(data);
    return send(response, 200, { ok: true, data });
  }
  if (pathname === "/api/upload" && request.method === "POST") {
    const body = await readJson(request);
    const match = String(body.data || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return send(response, 400, { error: "Gebruik een JPG, PNG, WEBP of GIF." });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 25 * 1024 * 1024) return send(response, 413, { error: "Afbeelding is groter dan 25 MB." });
    const extension = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[match[1]];
    const stem = path.basename(String(body.name || "werk"), path.extname(String(body.name || ""))).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 60) || "werk";
    const filename = `${Date.now()}-${stem}${extension}`;
    fs.writeFileSync(path.join(IMAGE_DIR, filename), bytes);
    let originalSrc = `portfolio-images/${filename}`;
    const originalMatch = String(body.originalData || "").match(/^data:(image\/(?:jpeg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/=]+)$/);
    if (originalMatch) {
      const originalBytes = Buffer.from(originalMatch[2], "base64");
      if (originalBytes.length <= 25 * 1024 * 1024) {
        const originalExtension = { "image/jpeg":".jpg", "image/png":".png", "image/webp":".webp", "image/gif":".gif", "image/heic":".heic", "image/heif":".heif" }[originalMatch[1]];
        const originalFilename = `${Date.now()}-${stem}-original${originalExtension}`;
        fs.writeFileSync(path.join(IMAGE_DIR, originalFilename), originalBytes);
        originalSrc = `portfolio-images/${originalFilename}`;
      }
    }
    return send(response, 200, { src: `portfolio-images/${filename}`, originalSrc });
  }
  if (pathname === "/api/password" && request.method === "POST") {
    const body = await readJson(request, 8192);
    const auth = readAuth();
    if (!verifyPassword(String(body.current || ""), auth)) return send(response, 403, { error: "Huidig wachtwoord klopt niet." });
    if (String(body.next || "").length < 8) return send(response, 400, { error: "Gebruik minimaal 8 tekens." });
    atomicWrite(AUTH_FILE, JSON.stringify(passwordRecord(String(body.next)), null, 2));
    sessions.clear();
    return send(response, 200, { ok: true });
  }
  send(response, 404, { error: "Niet gevonden" });
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith("/api/")) return await api(request, response, url.pathname);
    const requested = url.pathname === "/" || url.pathname === "/portfolio" ? "portfolio-werksporen.html" : url.pathname === "/admin" ? "portfolio-admin.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.resolve(ROOT, requested);
    if (!file.startsWith(path.resolve(ROOT) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(response, 404, "Niet gevonden", "text/plain; charset=utf-8");
    response.writeHead(200, { "Content-Type": mime[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    send(response, 500, { error: error.message || "Serverfout" });
  }
});

readAuth();
readData();
server.listen(PORT, HOST, () => {
  console.log(`Portfolio admin: http://127.0.0.1:${PORT}/admin`);
  if (HOST !== "127.0.0.1" && HOST !== "localhost") Object.values(os.networkInterfaces()).flat().filter(entry => entry && entry.family === "IPv4" && !entry.internal).forEach(entry => console.log(`Lokaal netwerk: http://${entry.address}:${PORT}/admin`));
});
