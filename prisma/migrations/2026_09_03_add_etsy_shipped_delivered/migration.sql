-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "wasShipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wasDelivered" BOOLEAN NOT NULL DEFAULT false;
