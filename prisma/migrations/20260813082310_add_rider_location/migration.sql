/*
  Warnings:

  - The values [PENDING,CONFIRMED,SHIPPED,DELIVERED] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `priceAtTime` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `orders` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bookingId]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unitPrice` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerId` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deliveryFee` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dropoffAddress` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dropoffZoneId` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productsTotal` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientName` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientPhone` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'CANCELLED');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'AWAITING_PAYMENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_bookingId_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "riderLat" DOUBLE PRECISION,
ADD COLUMN     "riderLng" DOUBLE PRECISION,
ADD COLUMN     "riderLocatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "createdAt",
DROP COLUMN "priceAtTime",
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "userId",
ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "deliveryFee" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "dropoffAddress" TEXT NOT NULL,
ADD COLUMN     "dropoffZoneId" TEXT NOT NULL,
ADD COLUMN     "productsTotal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "recipientName" TEXT NOT NULL,
ADD COLUMN     "recipientPhone" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "orderId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_bookingId_key" ON "orders"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_dropoffZoneId_fkey" FOREIGN KEY ("dropoffZoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
