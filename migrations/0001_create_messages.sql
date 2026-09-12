-- Contact form submissions.
--
-- Applied with:
--   npx wrangler d1 execute sinduri-lol --local --file migrations/0001_create_messages.sql
--   npx wrangler d1 execute sinduri-lol --remote --file migrations/0001_create_messages.sql
--
-- `created_at` is Unix milliseconds, which is what Date.now() returns, so
-- nothing has to agree on a date format between the Worker and SQLite.
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Retention is by age, and deletion reads this. Without it the sweep is a
-- full scan of a table that only ever grows.
CREATE INDEX IF NOT EXISTS messages_by_age ON messages (created_at);
