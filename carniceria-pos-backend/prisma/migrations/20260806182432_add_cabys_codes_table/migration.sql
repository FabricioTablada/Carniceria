-- CreateTable
CREATE TABLE "cabys_codes" (
    "code" CHAR(13) NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabys_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "cabys_codes_active_idx" ON "cabys_codes"("active");

-- CreateIndex
CREATE INDEX "cabys_codes_description_trgm_idx" ON "cabys_codes" USING GIN ("description" gin_trgm_ops);
