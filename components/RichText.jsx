"use client";

import { useMemo } from "react";
import { looksLikeHtml, sanitizeHtml } from "@/lib/richText";

/**
 * RichTextEditor'da yozilgan matnni xavfsiz ko'rsatadi.
 *
 * Bazadagi eski yozuvlar oddiy matn (\n bilan) bo'lgani uchun HTML emasligi
 * aniqlansa, ular avvalgidek `whitespace-pre-line` bilan chiqariladi — ya'ni
 * migratsiya talab qilinmaydi.
 */
export default function RichText({ value, className = "", inline = false, as: Tag = "div" }) {
  const html = useMemo(() => (looksLikeHtml(value) ? sanitizeHtml(value) : null), [value]);

  if (!value) return null;

  if (html === null) {
    return <Tag className={`whitespace-pre-line ${className}`}>{value}</Tag>;
  }

  return (
    <Tag
      className={`${inline ? "rich-content rich-content-inline" : "rich-content"} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
