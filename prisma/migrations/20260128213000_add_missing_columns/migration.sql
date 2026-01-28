-- AlterTable: Add missing columns to event_series
ALTER TABLE "event_series" ADD COLUMN "chatId" BIGINT;
ALTER TABLE "event_series" ADD COLUMN "topicId" TEXT;
ALTER TABLE "event_series" ADD COLUMN "maxParticipants" INTEGER;

-- AlterTable: Add missing columns to event_instances
ALTER TABLE "event_instances" ADD COLUMN "announcementMessageId" BIGINT;
ALTER TABLE "event_instances" ADD COLUMN "announcementChatId" BIGINT;
