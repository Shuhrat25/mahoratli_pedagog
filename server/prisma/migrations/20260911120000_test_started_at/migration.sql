-- AlterTable: test urinishi qachon boshlangani (vaqt hisobi serverda yuritiladi)
ALTER TABLE "Submission" ADD COLUMN     "testStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "testStartedAt" TIMESTAMP(3);
