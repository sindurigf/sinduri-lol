-- Post comments, and the moderation links already used.
--
-- Applied with:
--   npx wrangler d1 execute sinduri-lol --local --file migrations/0002_create_comments.sql
--   npx wrangler d1 execute sinduri-lol --remote --file migrations/0002_create_comments.sql
--
-- Times are Unix milliseconds, as in 0001.

-- `parent_id` is null for a comment on the post and names a top-level comment
-- for a reply: threads are one level deep, and the Worker attaches a reply to
-- a reply to its thread's top-level comment. `email` is never published and is
-- cleared by the retention sweep; `status` is 'pending' until the owner
-- approves it, and a rejected comment is deleted rather than marked.
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_slug   TEXT NOT NULL,
  parent_id   TEXT,
  name        TEXT NOT NULL,
  email       TEXT,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  is_owner    INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
  created_at  INTEGER NOT NULL,
  approved_at INTEGER
);

-- The export reads approved comments in order; the sweep reads by age.
CREATE INDEX IF NOT EXISTS comments_by_status ON comments (status, created_at);
CREATE INDEX IF NOT EXISTS comments_by_age ON comments (created_at);

-- A moderation link is signed, so it cannot be forged, but a signature alone
-- would let it be replayed until it expires. Using one inserts its id here,
-- in the same batch as the action, so a second use fails on the primary key
-- and rolls the action back.
CREATE TABLE IF NOT EXISTS used_links (
  id         TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS used_links_by_expiry ON used_links (expires_at);
