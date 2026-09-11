// Rich-text (HTML) matnlar bilan ishlash uchun MUHITGA BOG'LIQ BO'LMAGAN yadro.
//
// Bu fayl ataylab "use client" ga ega EMAS: uni ham brauzer komponentlari, ham
// Next.js server komponentlari (app/post/[id]/page.js — Open Graph uchun
// serverda render qilinadi) ishlata oladi.
//
// Brauzerga xos (DOMParser'ga tayanadigan) qism — lib/richText.js da.

const BLOCK_STYLE_TAGS = ["P", "DIV", "SPAN", "H1", "H2", "H3", "BLOCKQUOTE", "LI", "UL", "OL", "TD", "TH", "PRE"];

export const ALLOWED_TAGS = {
  P: [],
  BR: [],
  DIV: [],
  SPAN: [],
  B: [],
  STRONG: [],
  I: [],
  EM: [],
  U: [],
  S: [],
  STRIKE: [],
  DEL: [],
  MARK: [],
  H1: [],
  H2: [],
  H3: [],
  UL: [],
  OL: ["start"],
  LI: [],
  BLOCKQUOTE: [],
  PRE: [],
  CODE: [],
  A: ["href", "title", "target", "rel"],
  HR: [],
  SUB: [],
  SUP: [],
  TABLE: [],
  THEAD: [],
  TBODY: [],
  TR: [],
  TH: ["colspan", "rowspan"],
  TD: ["colspan", "rowspan"],
  IMG: ["src", "alt", "title", "width", "height"],
  FONT: ["color"],
};

BLOCK_STYLE_TAGS.forEach((tag) => {
  ALLOWED_TAGS[tag] = [...(ALLOWED_TAGS[tag] || []), "style"];
});

// Butunlay olib tashlanadigan (ichidagi matni bilan birga) teglar.
export const DROP_ENTIRELY = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "NOSCRIPT",
  "TEMPLATE", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "SVG", "MATH",
  "BASE", "HEAD", "TITLE", "AUDIO", "VIDEO", "SOURCE", "CANVAS", "APPLET",
]);

const ALLOWED_CSS_PROPS = new Set([
  "color", "background-color", "text-align", "font-weight", "font-style", "text-decoration",
]);

const UNSAFE_CSS = /url\s*\(|expression\s*\(|javascript:|@import|<|behavior\s*:/i;

export function safeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  // Nisbiy yo'l, anchor yoki xavfsiz sxema — qolgani (javascript:, data: HTML...) rad etiladi.
  if (/^(https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(value)) return value;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) return value;
  return null;
}

export function sanitizeStyle(raw) {
  if (!raw || UNSAFE_CSS.test(raw)) return "";
  return String(raw)
    .split(";")
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 1) return null;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const value = decl.slice(idx + 1).trim();
      if (!ALLOWED_CSS_PROPS.has(prop) || !value || UNSAFE_CSS.test(value)) return null;
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

// --- DOMParser'siz muhit (Next.js server rendering) uchun tokenizer ---
//
// Post sahifasi serverda render qilinadi (Open Graph meta-teglari uchun), u
// yerda DOMParser yo'q. Ilgari bunday holatda hamma teglar olib tashlanardi va
// server javobida post formatlanmagan matn bo'lib chiqardi. Bu funksiya
// server/src/lib/sanitizeHtml.js bilan bir xil ro'yxat asosida ishlaydi
// (ikkalasi mos ekani tests/sanitize.test.js da tekshiriladi).

const VOID_TAGS = new Set(["br", "hr", "img"]);

const STRIP_WITH_CONTENT = [
  "script", "style", "iframe", "object", "embed", "noscript", "template",
  "form", "select", "textarea", "button", "svg", "math", "audio", "video", "canvas", "applet",
];

function allowedAttrsFor(tag) {
  const key = tag.toUpperCase();
  return ALLOWED_TAGS[key] ? ALLOWED_TAGS[key].map((a) => a.toLowerCase()) : null;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

function buildTag(tagName, attrString) {
  const allowed = allowedAttrsFor(tagName);
  const parts = [];
  let match;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";

    if (name === "href" || name === "src") {
      const url = safeUrl(rawValue);
      if (url) parts.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }
    if (name === "style") {
      const style = sanitizeStyle(rawValue);
      if (style) parts.push(`style="${escapeAttr(style)}"`);
      continue;
    }
    if (name === "target" || name === "rel") continue;
    parts.push(`${name}="${escapeAttr(rawValue)}"`);
  }

  if (tagName === "a") {
    if (!parts.some((p) => p.startsWith("href="))) return "";
    parts.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
  }

  return `<${tagName}${parts.length ? ` ${parts.join(" ")}` : ""}>`;
}

export function sanitizeHtmlString(input) {
  let html = String(input ?? "");
  if (!html.includes("<")) return html;

  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<![\s\S]*?>/g, "");

  STRIP_WITH_CONTENT.forEach((tag) => {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  });

  return html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (full, closing, name, attrs) => {
    const tagName = name.toLowerCase();
    if (!allowedAttrsFor(tagName)) return "";
    if (closing) return VOID_TAGS.has(tagName) ? "" : `</${tagName}>`;
    return buildTag(tagName, attrs);
  });
}

export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Qiymat rich-text (HTML) sifatida saqlanganmi yoki eski oddiy matnmi? */
export function looksLikeHtml(value) {
  return /<(p|div|br|ul|ol|li|h[1-3]|b|strong|i|em|u|s|a|blockquote|pre|code|span|mark|table|img|hr)\b[^>]*>/i.test(
    String(value || "")
  );
}

/** Oddiy matnni (\n bilan) tahrirlash uchun HTML paragraflarga aylantiradi. */
export function htmlFromPlainText(text) {
  const value = String(text ?? "");
  if (!value.trim()) return "";
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Ro'yxat/preview uchun HTML'dan sof matn. */
export function plainTextFromHtml(value) {
  const raw = String(value ?? "");
  if (!raw) return "";
  if (!looksLikeHtml(raw)) return raw;
  // Blok teglar chegarasida bo'shliq qo'yamiz, aks holda "SarlavhaBirinchi band"
  // kabi qo'shilib ketgan matn chiqadi.
  return raw
    .replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th)\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ko'rinadigan mazmun bormi? (bo'sh <p><br></p> "bor" hisoblanmaydi) */
export function isEmptyHtml(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) return true;
  if (/<(img|hr|table)\b/i.test(raw)) return false;
  return !raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

export function truncate(text, max = 160) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}
