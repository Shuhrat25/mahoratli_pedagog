-- AlterTable: pazl darsi uchun ball (NULL — ball berilmaydi)
ALTER TABLE "Lesson" ADD COLUMN     "puzzlePoints" INTEGER;

-- CreateTable
CREATE TABLE "PuzzleImage" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleImageId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "bestTimeSec" INTEGER,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "lastSolvedAt" TIMESTAMP(3),

    CONSTRAINT "PuzzleProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PuzzleImage_lessonId_idx" ON "PuzzleImage"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleProgress_userId_puzzleImageId_difficulty_key" ON "PuzzleProgress"("userId", "puzzleImageId", "difficulty");

-- AddForeignKey
ALTER TABLE "PuzzleImage" ADD CONSTRAINT "PuzzleImage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleImage" ADD CONSTRAINT "PuzzleImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleProgress" ADD CONSTRAINT "PuzzleProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleProgress" ADD CONSTRAINT "PuzzleProgress_puzzleImageId_fkey" FOREIGN KEY ("puzzleImageId") REFERENCES "PuzzleImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
