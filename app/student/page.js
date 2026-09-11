"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/auth-context";
import { bannersApi, postsApi, pollsApi, usersApi } from "@/lib/api";
import BannerCarousel from "@/components/BannerCarousel";
import RatingWidget, { PointsBadge } from "@/components/RatingWidget";
import PostCard from "@/components/PostCard";
import PollCard from "@/components/PollCard";
import Pagination from "@/components/Pagination";
import { Icon, paths } from "@/components/icons";

const PAGE_SIZE = 10;

export default function StudentHomePage() {
  const { currentUser } = useApp();
  const [banners, setBanners] = useState([]);
  const [posts, setPosts] = useState([]);
  const [polls, setPolls] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  // Qidiruv / rukn (teg) / sahifalash — ilgari lenta to'liq yuklanardi.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadPosts = useCallback(async () => {
    const data = await postsApi.list({ page, limit: PAGE_SIZE, search, tag });
    setPosts(data.posts);
    setPages(data.pages);
    setTotal(data.total);
    setTags(data.tags);
  }, [page, search, tag]);

  useEffect(() => {
    Promise.all([bannersApi.list(), pollsApi.list(), usersApi.leaderboard()])
      .then(([b, poll, lb]) => {
        setBanners(b.banners);
        setPolls(poll.polls);
        setLeaderboard(lb.users);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPosts()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadPosts]);

  // Qidiruvni har bosishda emas, yozib tugatgandan keyin yuboramiz.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  function selectTag(next) {
    setTag((prev) => (prev === next ? "" : next));
    setPage(1);
  }

  // So'rovnomalar birinchi sahifada, postlar orasida ko'rsatiladi.
  const showPolls = page === 1 && !search && !tag;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Xush kelibsiz, {currentUser?.firstName}!</h1>
        <PointsBadge points={currentUser?.points ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {page === 1 && !search && !tag && <BannerCarousel banners={banners} />}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Postlar va so&apos;rovnomalar</h2>
              <div className="relative w-full sm:w-64">
                <Icon path={paths.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Postlardan qidirish..."
                  className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => selectTag(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      tag === t
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    #{t}
                  </button>
                ))}
                {(tag || search) && (
                  <button onClick={() => { setTag(""); setSearchInput(""); }} className="px-2 text-xs text-slate-400 hover:text-rose-600">
                    Filtrlarni tozalash
                  </button>
                )}
              </div>
            )}

            {(search || tag) && (
              <p className="text-sm text-slate-500">
                {total} ta natija{search && ` — "${search}"`}
                {tag && ` — #${tag}`}
              </p>
            )}

            {loading ? (
              <div className="text-slate-400">Yuklanmoqda...</div>
            ) : posts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                {search || tag ? "Hech narsa topilmadi." : "Hozircha post yo'q."}
              </p>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onTagClick={selectTag}
                  onUpdate={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                />
              ))
            )}

            {showPolls &&
              polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onUpdate={(updated) => setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                />
              ))}

            <Pagination page={page} pages={pages} onChange={setPage} className="pt-2" />
          </div>
        </div>

        <div className="space-y-4">
          <RatingWidget users={leaderboard} />
        </div>
      </div>
    </div>
  );
}
