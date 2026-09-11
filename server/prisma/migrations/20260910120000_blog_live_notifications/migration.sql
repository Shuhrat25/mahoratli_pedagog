-- AlterTable: presence WebSocket uzilganda ham saqlanib qolishi uchun
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable: blog (qoralama, rejalashtirilgan e'lon, teglar, qadash)
ALTER TABLE "Post" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT;

-- Mavjud postlar e'lon qilingan deb hisoblanadi
UPDATE "Post" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;

-- AlterTable: jonli dars + test sozlamalari
ALTER TABLE "Lesson" ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "passScore" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "timeLimitSec" INTEGER,
ADD COLUMN     "shuffle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxAttempts" INTEGER;

-- AlterTable: test urinishlari soni
ALTER TABLE "LessonProgress" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: forum mavzusining matni endi alohida ustunda
ALTER TABLE "ForumThread" ADD COLUMN     "body" TEXT;

-- Eski mavzularda matn birinchi "javob" sifatida saqlangan edi: uni body'ga
-- ko'chiramiz va o'sha javobni olib tashlaymiz. Faqat mavzu bilan bir vaqtda,
-- mavzu muallifi tomonidan yaratilgan javoblar ko'chiriladi — boshqa javoblarga
-- tegilmaydi.
UPDATE "ForumThread" t
SET "body" = r."text"
FROM "ForumReply" r
WHERE r."threadId" = t."id"
  AND r."authorId" = t."authorId"
  AND r."createdAt" <= t."createdAt" + INTERVAL '2 seconds'
  AND t."body" IS NULL;

DELETE FROM "ForumReply" r
USING "ForumThread" t
WHERE r."threadId" = t."id"
  AND r."authorId" = t."authorId"
  AND r."createdAt" <= t."createdAt" + INTERVAL '2 seconds'
  AND t."body" = r."text";

-- CreateTable
CREATE TABLE "LessonMaterial" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- AddForeignKey
ALTER TABLE "LessonMaterial" ADD CONSTRAINT "LessonMaterial_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonMaterial" ADD CONSTRAINT "LessonMaterial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyActivity_day_idx" ON "DailyActivity"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_userId_day_key" ON "DailyActivity"("userId", "day");

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
