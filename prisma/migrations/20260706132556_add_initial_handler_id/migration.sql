/*
  Warnings:

  - The values [PENDING] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `current_handler_id` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING_COORDINATOR', 'PENDING_VENUE_HANDLER', 'PENDING_HOD', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');
ALTER TABLE "public"."bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING_COORDINATOR';
COMMIT;

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_current_handler_id_fkey";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "current_handler_id",
ADD COLUMN     "initial_handler_id" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PENDING_COORDINATOR';

-- CreateTable
CREATE TABLE "booking_handlers" (
    "booking_id" INTEGER NOT NULL,
    "handler_id" INTEGER NOT NULL,

    CONSTRAINT "booking_handlers_pkey" PRIMARY KEY ("booking_id","handler_id")
);

-- AddForeignKey
ALTER TABLE "booking_handlers" ADD CONSTRAINT "booking_handlers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_handlers" ADD CONSTRAINT "booking_handlers_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
