ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS delivery_qr_expires_at timestamptz;
