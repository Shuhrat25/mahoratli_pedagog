"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { topicsApi } from "@/lib/api";
import PuzzleLesson from "@/components/puzzle/PuzzleLesson";
import { Icon, paths } from "@/components/icons";

// O'qituvchi pazlni talaba ko'radigan ko'rinishda sinab ko'radi. Uning
// natijalari ball yoki dars taraqqiyotiga yozilmaydi (routes/puzzles.js).
export default function TeacherPuzzlePreviewPage() {
  const { topicId, lessonId } = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState(undefined);

  useEffect(() => {
    topicsApi
      .list()
      .then(({ topics }) => {
        const topic = topics.find((t) => t.id === topicId);
        const found = topic?.lessons.find((l) => l.id === lessonId && l.type === "PUZZLE");
        setLesson(found || null);
      })
      .catch(() => setLesson(null));
  }, [topicId, lessonId]);

  if (lesson === undefined) return <div className="text-slate-400">Yuklanmoqda...</div>;

  return (
    <div>
      <button
        onClick={() => router.push(`/teacher/lessons/${topicId}`)}
        className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
      >
        <Icon path={paths.chevronLeft} className="h-4 w-4" /> Darslar ro&apos;yxati
      </button>

      {!lesson ? (
        <p>Pazl darsi topilmadi.</p>
      ) : (
        <>
          <div className="mb-4">
            <h1 className="text-xl font-semibold">{lesson.title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Sinov rejimi — talabalar shu ko&apos;rinishni ko&apos;radi. Sizning natijangiz saqlanadi, lekin ball
              berilmaydi.
            </p>
          </div>
          <PuzzleLesson lesson={lesson} />
        </>
      )}
    </div>
  );
}
