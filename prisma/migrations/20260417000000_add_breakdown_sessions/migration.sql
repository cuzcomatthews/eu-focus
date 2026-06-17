-- CreateTable
CREATE TABLE "breakdown_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raw_input" TEXT NOT NULL,
    "structured_output" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breakdown_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "breakdown_sessions"
ADD CONSTRAINT "breakdown_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddIndex
CREATE INDEX "breakdown_sessions_user_id_created_at_idx"
ON "breakdown_sessions"("user_id", "created_at" DESC);
