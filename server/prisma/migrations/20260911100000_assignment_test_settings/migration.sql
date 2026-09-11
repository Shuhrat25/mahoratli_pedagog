-- AlterTable: TEST turidagi vazifa uchun vaqt chegarasi va urinishlar soni
-- (ikkalasi ham NULL — cheklovsiz)
ALTER TABLE "Assignment" ADD COLUMN     "timeLimitSec" INTEGER,
ADD COLUMN     "maxAttempts" INTEGER;

-- AlterTable: nechanchi urinish ekani
ALTER TABLE "Submission" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- Allaqachon topshirilgan testlar bitta urinish sifatida hisoblanadi.
UPDATE "Submission" SET "attempts" = 1 WHERE "status" = 'REVIEWED';
