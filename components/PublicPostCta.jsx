"use client";

import Link from "next/link";
import { useApp } from "@/lib/auth-context";

// Post sahifasi serverda render qilinadi (Open Graph uchun), shuning uchun u
// o'zi sessiyani bilmaydi. Bu kichik mijoz komponenti aynan shu bo'shliqni
// to'ldiradi.
//
// Ilgari sahifa har doim "Kirish" deb turardi — tizimga kirgan talaba ham uni
// bosib login sahifasiga tushar, u yerda kirgach kabinetga tashlanar va postga
// qayta kelib yana o'sha tugmani ko'rardi. Aylanish shundan chiqqan.

function homeFor(role) {
  return role === "STUDENT" ? "/student" : "/teacher";
}

export function PublicPostHeaderAction({ postId }) {
  const { currentUser, ready } = useApp();

  if (!ready) {
    return <span className="h-9 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" aria-hidden />;
  }

  if (currentUser) {
    return (
      <Link href={homeFor(currentUser.role)} className="btn-primary">
        Kabinetga
      </Link>
    );
  }

  return (
    <Link href={`/login?next=${encodeURIComponent(`/post/${postId}`)}`} className="btn-primary">
      Kirish
    </Link>
  );
}

export function PublicPostDiscussion({ postId }) {
  const { currentUser, ready } = useApp();

  if (!ready) return null;

  if (currentUser) {
    return (
      <Link
        href={`${homeFor(currentUser.role)}?post=${postId}`}
        className="font-medium text-brand-700 hover:underline dark:text-brand-400"
      >
        Lentada ochish va muhokama qilish
      </Link>
    );
  }

  return (
    <Link
      href={`/login?next=${encodeURIComponent(`/post/${postId}`)}`}
      className="font-medium text-brand-700 hover:underline dark:text-brand-400"
    >
      Muhokamada qatnashish uchun kiring
    </Link>
  );
}
