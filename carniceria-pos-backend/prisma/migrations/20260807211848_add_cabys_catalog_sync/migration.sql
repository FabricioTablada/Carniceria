-- CreateTable
CREATE TABLE "cabys_catalog_sync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "last_etag" TEXT,
    "last_modified" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "record_count" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabys_catalog_sync_pkey" PRIMARY KEY ("id")
);
