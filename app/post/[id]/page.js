import Link from "next/link";
import { notFound } from "next/navigation";
// Diqqat: bu SERVER komponenti, shuning uchun import "@/lib/richText" dan
// EMAS, "@/lib/richTextCore" dan. Birinchisida "use client" bor va uning
// eksportlari serverda chaqirib bo'lmaydigan mijoz havolalariga aylanadi.
import { sanitizeHtmlString, looksLikeHtml, plainTextFromHtml, truncate } from "@/lib/richTextCore";

// Postning alohida sahifasi — SERVERDA render qilinadi.
//
// Nima uchun bu muhim: qolgan sahifalar mijoz tomonida ma'lumot yuklaydi,
// shuning uchun Telegram/Facebook/WhatsApp botlari havolani ochganda bo'sh
// sahifani ko'radi va ulashishda hech qanday ko'rinish chiqmaydi. Bu sahifa
// esa serverda to'ldiriladi va Open Graph teglarini beradi.
//
// "Ulashish" tugmasi ham endi aynan shu manzilni nusxa qiladi (ilgari u
// lentaning umumiy manzilini nusxalardi).

export const revalidate = 300;

function backendUrl() {
  return process.env.BACKEND_URL || "";
}

async function fetchPost(id) {
  const backend = backendUrl();
  if (!backend) return null;
  try {
    const res = await fetch(`${backend}/api/posts/public/${encodeURIComponent(id)}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post || null;
  } catch {
    return null;
  }
}

function publicImageUrl(imageId) {
  if (!imageId) return null;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/api/files/public/${imageId}`;
  return site ? `${site.replace(/\/$/, "")}${path}` : path;
}

export async function generateMetadata({ params }) {
  const post = await fetchPost(params.id);
  if (!post) return { title: "Post topilmadi" };

  const description = truncate(plainTextFromHtml(post.text) || post.title, 200);
  const image = publicImageUrl(post.imageId);

  return {
    title: post.title,
    description,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt || post.createdAt,
      authors: [post.authorName],
      tags: post.tags,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function PublicPostPage({ params }) {
  const post = await fetchPost(params.id);
  if (!post) notFound();

  const date = new Date(post.publishedAt || post.createdAt);
  const body = looksLikeHtml(post.text) ? sanitizeHtmlString(post.text) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-lg font-bold text-brand-700 dark:text-brand-400">
            Mahoratli pedagog
          </Link>
          <Link href="/login" className="btn-primary">
            Kirish
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          {post.tags?.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{post.title}</h1>

          <p className="mt-2 text-sm text-slate-500">
            {post.authorName} · <time dateTime={date.toISOString()}>{date.toLocaleDateString("uz-UZ")}</time> ·{" "}
            {post.readingMinutes} daqiqa o&apos;qish
          </p>

          {post.videoUrl && (
            <div className="mt-5 aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe src={post.videoUrl} title={post.title} className="h-full w-full" allowFullScreen />
            </div>
          )}

          {!post.videoUrl && post.imageId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicImageUrl(post.imageId)} alt={post.title} className="mt-5 w-full rounded-xl object-cover" />
          )}

          {post.text &&
            (body === null ? (
              <div className="mt-5 whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-300">
                {post.text}
              </div>
            ) : (
              <div
                className="rich-content mt-5 leading-relaxed text-slate-700 dark:text-slate-300"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ))}

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-800">
            <span>❤ {post.likes}</span>
            <span>💬 {post.commentCount ?? 0}</span>
            <Link href="/login" className="text-brand-700 hover:underline dark:text-brand-400">
              Muhokamada qatnashish uchun kiring
            </Link>
          </div>
        </article>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800">
        © 2026 Mahoratli pedagog
      </footer>
    </div>
  );
}
