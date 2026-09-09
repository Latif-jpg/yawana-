-- Prevent obvious duplicate submissions for the same user in a short time window.
ALTER TABLE prices
ADD COLUMN IF NOT EXISTS submission_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prices_submission_hash
ON prices(submission_hash)
WHERE submission_hash IS NOT NULL;
