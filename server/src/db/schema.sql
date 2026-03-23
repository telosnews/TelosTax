-- TelosTax Server Schema
-- The only actively used table is rate_limits (for API rate limiting).
-- All tax data is stored client-side in localStorage.

CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT 'default',
  request_time INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_time ON rate_limits (ip, endpoint, request_time);
