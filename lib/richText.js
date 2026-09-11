"use client";

// Brauzerga xos rich-text yordamchilari.
//
// Tozalash uchun DOMParser ishlatiladi — nusxa-ko'chirilgan murakkab HTML
// (Word, veb-sahifa) bilan u matnli tokenizerdan ishonchliroq. Qolgan hamma
// narsa lib/richTextCore.js dan qayta eksport qilinadi, chunki u muhitga
// bog'liq emas va Next.js server komponentlarida ham ishlaydi.

import {
  ALLOWED_TAGS,
  DROP_ENTIRELY,
  safeUrl,
  sanitizeStyle,
  sanitizeHtmlString,
  looksLikeHtml,
  htmlFromPlainText,
} from "./richTextCore";

export {
  escapeHtml,
  looksLikeHtml,
  htmlFromPlainText,
  plainTextFromHtml,
  isEmptyHtml,
  truncate,
  sanitizeHtmlString,
} from "./richTextCore";

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

/** HTML'ni ruxsat etilgan teglar ro'yxati bo'yicha tozalaydi. */
export function sanitizeHtml(html) {
  const raw = String(html ?? "");
  if (!raw) return "";
  // DOMParser yo'q bo'lsa (server rendering) — bir xil ruxsat ro'yxati bo'yicha
  // ishlaydigan matnli tokenizerga tushamiz, formatlash saqlanadi.
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return sanitizeHtmlString(raw);
  }
  const doc = new window.DOMParser().parseFromString(`<body>${raw}</body>`, "text/html");
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/** Tahrirlagichga berish uchun: eski oddiy matn ham, HTML ham bir xil ko'rinishga keladi. */
export function toEditorHtml(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  return looksLikeHtml(raw) ? sanitizeHtml(raw) : htmlFromPlainText(raw);
}
