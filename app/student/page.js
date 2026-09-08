"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/auth-context";
import { bannersApi, postsApi, pollsApi, usersApi } from "@/lib/api";
import BannerCarousel from "@/components/BannerCarousel";
import RatingWidget, { PointsBadge } from "@/components/RatingWidget";
import PostCard from "@/components/PostCard";
import PollCard from "@/components/PollCard";

export default function StudentHomePage() {
  const { currentUser } = useApp();
  const [banners, setBanners] = useState([]);
  const [posts, setPosts] = useState([]);
  const [polls, setPolls] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([bannersApi.list(), postsApi.list(), pollsApi.list(), usersApi.leaderboard()])
      .then(([b, p, poll, lb]) => {
        setBanners(b.banners);
        setPosts(p.posts);
        setPolls(poll.polls);
        setLeaderboard(lb.users);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Yuklanmoqda...</div>;

  const feed = [
    ...posts.map((p) => ({ kind: "post", data: p, ts: p.createdAt })),
    ...polls.map((p) => ({ kind: "poll", data: p, ts: p.createdAt || "2026-01-01" })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Xush kelibsiz, {currentUser?.firstName}!</h1>
        <PointsBadge points={currentUser?.points ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <BannerCarousel banners={banners} />

          <div className="space-y-4">
            <h2 className="text-lg font-bold">Postlar va so'rovnomalar</h2>
            {feed.map((item) =>
              item.kind === "post" ? (
                <PostCard
                  key={item.data.id}
                  post={item.data}
                  onUpdate={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                />
              ) : (
                <PollCard
                  key={item.data.id}
                  poll={item.data}
                  onUpdate={(updated) => setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
                />
              )
            )}
          </div>
        </div>

        <div className="space-y-4">
          <RatingWidget users={leaderboard} />
        </div>
      </div>
    </div>
  );
}
