const GITHUB_FALLBACK = "https://layersbylayersbylayers.github.io/Werksporen";
const GITHUB_ORIGIN = "https://layersbylayersbylayers.github.io";
const MAX_JSON = 6 * 1024 * 1024;
const MAX_IMAGE = 25 * 1024 * 1024;

function securityHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob: https://layersbylayersbylayers.github.io; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self' mailto:"
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers:{ ...securityHeaders(), "Cache-Control":"no-store", ...extra } });
}

function ownerIdentity(request, env) {
  const email = (request.headers.get("oai-authenticated-user-email") || "").trim().toLowerCase();
  const id = request.headers.get("oai-authenticated-user-id") || "";
  const allowedEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  const allowedId = String(env.ADMIN_USER_ID || "").trim();
  return email && ((allowedEmail && email === allowedEmail) || (allowedId && id === allowedId)) ? { email, id } : null;
}

async function requireOwner(request, env) {
  const identity = ownerIdentity(request, env);
  return identity || null;
}

async function seedData(request, env) {
  const response = await env.ASSETS.fetch(new Request(new URL("/seed.json", request.url)));
  if (!response.ok) throw new Error("Startgegevens ontbreken");
  return response.json();
}

async function readContent(request, env, slot) {
  const row = await env.DB.prepare("SELECT revision, data_json, updated_at FROM content_versions WHERE slot = ?").bind(slot).first();
  if (!row) return { data:await seedData(request, env), revision:0, updatedAt:null };
  return { data:JSON.parse(row.data_json), revision:Number(row.revision), updatedAt:row.updated_at };
}

function cleanContent(input) {
  if (!input || !Array.isArray(input.items) || !Array.isArray(input.sections) || typeof input.texts !== "object") throw new Error("Ongeldige portfolio-inhoud");
  if (input.items.length > 1000 || input.sections.length > 60) throw new Error("Te veel onderdelen");
  const copy = structuredClone(input);
  delete copy._revision;
  return copy;
}

async function saveSlot(env, slot, data, actor, expectedRevision) {
  const current = await env.DB.prepare("SELECT revision FROM content_versions WHERE slot = ?").bind(slot).first();
  const revision = Number(current?.revision || 0);
  if (expectedRevision != null && Number(expectedRevision) !== revision) {
    const error = new Error("Deze versie is intussen op een ander apparaat gewijzigd. Herlaad eerst of importeer je backup.");
    error.status = 409; throw error;
  }
  const next = revision + 1;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO content_versions(slot,revision,data_json,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(slot) DO UPDATE SET revision=excluded.revision,data_json=excluded.data_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(slot,next,JSON.stringify(data),now,actor),
    env.DB.prepare("INSERT INTO audit_log(created_at,actor,action,revision) VALUES(?,?,?,?)").bind(now,actor,slot === "published" ? "publish" : "save-draft",next)
  ]);
  return { ...data, _revision:next };
}

async function readJson(request, max = MAX_JSON) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > max) throw Object.assign(new Error("Bestand is te groot"), { status:413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > max) throw Object.assign(new Error("Bestand is te groot"), { status:413 });
  try { return JSON.parse(text || "{}"); } catch { throw Object.assign(new Error("Ongeldige gegevens"), { status:400 }); }
}

function decodeImage(dataUrl, original = false) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || (!original && /heic|heif/.test(match[1]))) throw Object.assign(new Error("Deze foto kon niet naar een webbeeld worden omgezet. Exporteer hem als JPG of PNG."), { status:400 });
  const binary = atob(match[2]);
  if (binary.length > MAX_IMAGE) throw Object.assign(new Error("Afbeelding is groter dan 25 MB"), { status:413 });
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, type:match[1] };
}

function safeStem(name) {
  return String(name || "werk").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g,"-").replace(/-+/g,"-").slice(0,60) || "werk";
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,"0")).join("").slice(0,32);
}

async function rateLimit(request, env, kind, limit, seconds) {
  const source = request.headers.get("cf-connecting-ip") || "unknown";
  const windowId = Math.floor(Date.now() / (seconds * 1000));
  const bucket = `${kind}:${await hash(source)}:${windowId}`;
  const expires = Math.floor(Date.now() / 1000) + seconds;
  await env.DB.prepare("INSERT INTO rate_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1").bind(bucket,expires).run();
  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE bucket=?").bind(bucket).first();
  if (Number(row?.count || 0) > limit) throw Object.assign(new Error("Te veel pogingen; probeer later opnieuw"), { status:429 });
}

async function analytics(env) {
  const totals = await env.DB.prepare("SELECT COUNT(*) views, COUNT(DISTINCT day || ':' || session_hash) sessions FROM visits").first();
  const [daily,pages,devices,referrers] = await Promise.all([
    env.DB.prepare("SELECT day,COUNT(*) views,COUNT(DISTINCT session_hash) sessions FROM visits GROUP BY day ORDER BY day DESC LIMIT 30").all(),
    env.DB.prepare("SELECT day,page,COUNT(*) count FROM visits GROUP BY day,page").all(),
    env.DB.prepare("SELECT day,device,COUNT(*) count FROM visits GROUP BY day,device").all(),
    env.DB.prepare("SELECT day,referrer,COUNT(*) count FROM visits GROUP BY day,referrer").all()
  ]);
  const days = {};
  for (const row of daily.results || []) days[row.day] = { views:Number(row.views), sessions:Number(row.sessions), pages:{}, devices:{}, referrers:{} };
  for (const row of pages.results || []) if (days[row.day]) days[row.day].pages[row.page] = Number(row.count);
  for (const row of devices.results || []) if (days[row.day]) days[row.day].devices[row.device] = Number(row.count);
  for (const row of referrers.results || []) if (days[row.day]) days[row.day].referrers[row.referrer] = Number(row.count);
  return { totalViews:Number(totals?.views || 0), totalSessions:Number(totals?.sessions || 0), days };
}

async function messages(env) {
  const result = await env.DB.prepare("SELECT id,created_at createdAt,name,email,message,status FROM messages ORDER BY created_at DESC LIMIT 100").all();
  return result.results || [];
}

function publicContent(data, request) {
  const origin = new URL(request.url).origin;
  const copy = structuredClone(data);
  for (const item of copy.items || []) {
    if (String(item.src || "").startsWith("media/")) item.src = `${origin}/${item.src}`;
    delete item.originalSrc;
  }
  return copy;
}

async function handleApi(request, env, path) {
  const owner = await requireOwner(request, env);
  if (path === "/api/session") return json({ authenticated:Boolean(owner), email:owner?.email || null });
  if (path === "/api/public/content" && request.method === "GET") {
    const content = await readContent(request, env, "published");
    return json({ ...publicContent(content.data,request), _revision:content.revision }, 200, { "Cache-Control":"public, max-age=30, stale-while-revalidate=300", "ETag":`W/\"${content.revision}\"`, "Access-Control-Allow-Origin":GITHUB_ORIGIN });
  }
  if (path === "/api/contact" && request.method === "POST") {
    await rateLimit(request, env, "contact", 5, 900);
    const body = await readJson(request, 16 * 1024);
    if (body.website) return json({ ok:true });
    const name = String(body.name || "").trim().slice(0,120), email = String(body.email || "").trim().toLowerCase().slice(0,254), message = String(body.message || "").trim().slice(0,5000);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 3) return json({ error:"Vul alle velden correct in" }, 400);
    await env.DB.prepare("INSERT INTO messages(id,created_at,name,email,message,status) VALUES(?,?,?,?,?,'new')").bind(crypto.randomUUID(),new Date().toISOString(),name,email,message).run();
    return json({ ok:true });
  }
  if (path === "/api/track" && request.method === "POST") {
    await rateLimit(request, env, "track", 120, 900);
    const body = await readJson(request, 8 * 1024), now = new Date(), referrer = (() => { try { return body.referrer ? new URL(String(body.referrer)).hostname : "direct"; } catch { return "direct"; } })();
    const sessionHash = await hash(`${String(body.session || "")}:${now.toISOString().slice(0,10)}`);
    await env.DB.prepare("INSERT INTO visits(created_at,day,page,device,referrer,session_hash) VALUES(?,?,?,?,?,?)").bind(now.toISOString(),now.toISOString().slice(0,10),String(body.page || "/portfolio").slice(0,120),["mobile","tablet","desktop"].includes(body.device) ? body.device : "other",referrer.slice(0,100),sessionHash).run();
    return json({ ok:true });
  }
  if (!owner) return json({ error:"Log veilig in om de Admin te gebruiken" }, 401);
  if (path === "/api/data" && request.method === "GET") {
    const content = await readContent(request, env, "draft"); return json({ ...content.data, _revision:content.revision });
  }
  if (path === "/api/data" && request.method === "POST") {
    const body = await readJson(request), expected = body._revision ?? null, clean = cleanContent(body);
    const saved = await saveSlot(env,"draft",clean,owner.email,expected); return json({ ok:true, data:saved });
  }
  if (path === "/api/publish" && request.method === "POST") {
    const body = await readJson(request), clean = cleanContent(body);
    const draft = await saveSlot(env,"draft",clean,owner.email,body._revision ?? null);
    const published = await saveSlot(env,"published",clean,owner.email,null);
    return json({ ok:true, data:{ ...draft, _publishedRevision:published._revision } });
  }
  if (path === "/api/upload" && request.method === "POST") {
    await rateLimit(request, env, "upload", 40, 900);
    const body = await readJson(request, 40 * 1024 * 1024);
    const publicImage = decodeImage(body.data), originalImage = body.originalData ? decodeImage(body.originalData,true) : publicImage;
    const id = crypto.randomUUID(), stem = safeStem(body.name), publicExt = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"}[publicImage.type];
    const originalExt = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/heic":"heic","image/heif":"heif"}[originalImage.type];
    const publicKey = `public/${id}-${stem}.${publicExt}`, originalKey = `originals/${id}-${stem}.${originalExt}`;
    await Promise.all([env.MEDIA.put(publicKey,publicImage.bytes,{httpMetadata:{contentType:publicImage.type}}),env.MEDIA.put(originalKey,originalImage.bytes,{httpMetadata:{contentType:originalImage.type}})]);
    return json({ src:`media/${publicKey}`, originalSrc:`media/${originalKey}` });
  }
  if (path === "/api/analytics" && request.method === "GET") return json(await analytics(env));
  if (path === "/api/messages" && request.method === "GET") return json(await messages(env));
  if (path === "/api/logout" && request.method === "POST") return json({ ok:true, signOut:"/signout-with-chatgpt?return_to=/" });
  return json({ error:"Niet gevonden" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url.pathname);
      if (url.pathname === "/portfolio-admin-data.js") {
        const content = await readContent(request, env, "published");
        return new Response(`window.PORTFOLIO_ADMIN_DATA=${JSON.stringify(publicContent(content.data,request))};window.WERKSPOREN_STUDIO_ORIGIN=${JSON.stringify(new URL(request.url).origin)};`, { headers:{ ...securityHeaders("application/javascript; charset=utf-8"), "Cache-Control":"public,max-age=30", "Access-Control-Allow-Origin":"*" } });
      }
      if (url.pathname.startsWith("/media/")) {
        const key = decodeURIComponent(url.pathname.slice(7));
        if (key.startsWith("originals/") && !ownerIdentity(request, env)) return json({ error:"Geen toegang" }, 403);
        if (!key.startsWith("public/") && !key.startsWith("originals/")) return json({ error:"Ongeldig bestand" }, 400);
        const object = await env.MEDIA.get(key); if (!object) return new Response("Niet gevonden", { status:404 });
        const headers = new Headers(securityHeaders(object.httpMetadata?.contentType || "application/octet-stream"));
        object.writeHttpMetadata(headers); headers.set("Cache-Control",key.startsWith("public/") ? "public,max-age=31536000,immutable" : "private,no-store");
        return new Response(object.body,{headers});
      }
      if (url.pathname.startsWith("/portfolio-images/")) return Response.redirect(`${GITHUB_FALLBACK}${url.pathname}`, 302);
      if (url.pathname === "/admin" || url.pathname === "/admin/") {
        const owner = ownerIdentity(request, env);
        if (!owner) return Response.redirect(new URL(`/signin-with-chatgpt?return_to=${encodeURIComponent("/admin")}`,request.url),302);
        return env.ASSETS.fetch(new Request(new URL("/portfolio-admin.html",request.url),request));
      }
      if (url.pathname === "/" || url.pathname === "/portfolio" || url.pathname === "/portfolio/") return env.ASSETS.fetch(new Request(new URL("/portfolio-werksporen.html",request.url),request));
      const asset = await env.ASSETS.fetch(request);
      return asset.status === 404 ? new Response("Niet gevonden",{status:404,headers:securityHeaders("text/plain; charset=utf-8")}) : asset;
    } catch (error) {
      return json({ error:error?.message || "Serverfout" }, Number(error?.status || 500));
    }
  }
};
