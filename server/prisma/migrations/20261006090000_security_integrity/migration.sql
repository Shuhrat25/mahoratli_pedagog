ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailVerification" ADD COLUMN "consumedAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN "creditedPoints" INTEGER NOT NULL DEFAULT 0;
UPDATE "Submission" SET "creditedPoints" = COALESCE("score", 0) WHERE "status" = 'REVIEWED';
ALTER TABLE "PuzzleProgress" ADD COLUMN "session" JSONB;
CREATE TABLE "GradeAudit" (
 "id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL,
 "studentId" TEXT NOT NULL, "targetId" TEXT NOT NULL, "action" TEXT NOT NULL,
 "before" TEXT NOT NULL, "after" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "GradeAudit_studentId_createdAt_idx" ON "GradeAudit"("studentId", "createdAt");
