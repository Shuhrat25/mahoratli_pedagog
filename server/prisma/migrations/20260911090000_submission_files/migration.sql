-- AlterTable: talabaning javobiga izoh
ALTER TABLE "Submission" ADD COLUMN     "text" TEXT;

-- CreateTable: javobga biriktirilgan fayllar (ilgari faqat bitta fayl edi)
CREATE TABLE "SubmissionFile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionFile_submissionId_idx" ON "SubmissionFile"("submissionId");

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mavjud bitta fayllik javoblarni yangi jadvalga ko'chiramiz.
-- md5(...) — id uchun yetarli darajada noyob satr (qo'shimcha kengaytma talab qilmaydi).
INSERT INTO "SubmissionFile" ("id", "submissionId", "fileId", "order")
SELECT md5(random()::text || clock_timestamp()::text || s."id"), s."id", s."fileId", 0
FROM "Submission" s
WHERE s."fileId" IS NOT NULL;
