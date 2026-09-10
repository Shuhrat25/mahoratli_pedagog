"use client";

// Rich-text (HTML) matnlar bilan ishlash uchun umumiy yordamchilar.
//
// O'qituvchi/admin kabinetidagi RichTextEditor HTML chiqaradi, lekin bazada
// eski yozuvlar oddiy matn (\n bilan) bo'lib qolgan — shuning uchun har bir
// qiymat ko'rsatilishidan oldin "bu HTMLmi yoki oddiy matnmi" deb tekshiriladi.
//
// XSS himoyasi ikki qavatli: server saqlashdan oldin tozalaydi
// (server/src/lib/sanitizeHtml.js), bu yerdagi sanitizeHtml esa ko'rsatishdan
// oldin brauzerda yana bir bor tozalaydi (eski, tozalanmagan yozuvlar uchun).

const BLOCK_STYLE_TAGS = ["P", "DIV", "SPAN", "H1", "H2", "H3", "BLOCKQUOTE", "LI", "UL", "OL", "TD", "TH", "PRE"];

const ALLOWED_TAGS = {
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
const DROP_ENTIRELY = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "NOSCRIPT",
  "TEMPLATE", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "SVG", "MATH",
  "BASE", "HEAD", "TITLE", "AUDIO", "VIDEO", "SOURCE", "CANVAS", "APPLET",
]);

const ALLOWED_CSS_PROPS = new Set([
  "color", "background-color", "text-align", "font-weight", "font-style", "text-decoration",
]);

const UNSAFE_CSS = /url\s*\(|expression\s*\(|javascript:|@import|<|behavior\s*:/i;

function safeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  // Nisbiy yo'l, anchor yoki xavfsiz sxema — qolgani (javascript:, data: HTML...) rad etiladi.
  if (/^(https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(value)) return value;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) return value;
  return null;
}

function sanitizeStyle(raw) {
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

function unwrap(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function cleanNode(node) {
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === 8) {
      // sharh (comment) — olib tashlanadi
      child.remove();
      return;
    }
    if (child.nodeType !== 1) return;

    const tag = child.tagName.toUpperCase();
    if (DROP_ENTIRELY.has(tag)) {
      child.remove();
      return;
    }

    cleanNode(child);

    const allowedAttrs = ALLOWED_TAGS[tag];
    if (!allowedAttrs) {
      unwrap(child);
      return;
    }

    Array.from(child.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (!allowedAttrs.includes(name)) {
        child.removeAttribute(attr.name);
        return;
      }
      if (name === "href" || name === "src") {
        const url = safeUrl(attr.value);
        if (url) child.setAttribute(name, url);
        else child.removeAttribute(attr.name);
      } else if (name === "style") {
        const style = sanitizeStyle(attr.value);
        if (style) child.setAttribute("style", style);
        else child.removeAttribute("style");
      }
    });

    if (tag === "A" && child.getAttribute("href")) {
      child.setAttribute("target", "_blank");
      child.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML'ni ruxsat etilgan teglar ro'yxati bo'yicha tozalaydi. */
export function sanitizeHtml(html) {
  const raw = String(html ?? "");
  if (!raw) return "";
  // SSR paytida DOMParser yo'q — bu holda hech qanday teg qoldirilmaydi.
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return escapeHtml(raw.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  }
  const doc = new window.DOMParser().parseFromString(`<body>${raw}</body>`, "text/html");
  cleanNode(doc.body);
  return doc.body.innerHTML;
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

/** Tahrirlagichga berish uchun: eski oddiy matn ham, HTML ham bir xil ko'rinishga keladi. */
export function toEditorHtml(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  return looksLikeHtml(raw) ? sanitizeHtml(raw) : htmlFromPlainText(raw);
}

/** Ro'yxat/preview uchun HTML'dan sof matn. */
export function plainTextFromHtml(value) {
  const raw = String(value ?? "");
  if (!raw) return "";
  if (!looksLikeHtml(raw)) return raw;
  // Blok teglar chegarasida bo'shliq qo'yamiz, aks holda textContent
  // "SarlavhaBirinchi band" kabi qo'shilib ketgan matn beradi.
  const spaced = raw.replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th)\s*>/gi, " ");
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return spaced.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new window.DOMParser().parseFromString(`<body>${spaced}</body>`, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
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
