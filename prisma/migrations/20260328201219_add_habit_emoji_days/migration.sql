-- AlterTable
ALTER TABLE "habits" ADD COLUMN     "emoji" TEXT NOT NULL DEFAULT '📚',
ADD COLUMN     "recurrence_days" TEXT NOT NULL DEFAULT '';
