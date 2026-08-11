/*
  Warnings:

  - A unique constraint covering the columns `[paystackReference]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "paystackAccessCode" TEXT,
ADD COLUMN     "paystackAuthUrl" TEXT,
ADD COLUMN     "paystackReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_paystackReference_key" ON "payments"("paystackReference");
