CREATE TABLE IF NOT EXISTS fit_custom_styles (id text PRIMARY KEY, definition jsonb NOT NULL, created_by uuid REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
