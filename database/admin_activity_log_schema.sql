-- Activity Log Table Schema
-- This table stores all admin activities for audit trail purposes
-- Run this SQL in your Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id BIGSERIAL PRIMARY KEY,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('user_add', 'user_remove', 'admin_add', 'admin_remove', 'bulk', 'access')),
    target_email TEXT,
    details TEXT,
    count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_admin_activity_log_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX idx_admin_activity_log_admin_email ON admin_activity_log(admin_email);
CREATE INDEX idx_admin_activity_log_action_type ON admin_activity_log(action_type);
CREATE INDEX idx_admin_activity_log_target_email ON admin_activity_log(target_email);

-- Enable Row Level Security (RLS)
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read activity logs
CREATE POLICY "Admins can view activity logs"
ON admin_activity_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admins
        WHERE admins.email = auth.jwt() ->> 'email'
    )
);

-- Create policy: Only admins can insert activity logs
CREATE POLICY "Admins can insert activity logs"
ON admin_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM admins
        WHERE admins.email = auth.jwt() ->> 'email'
    )
);

-- Create policy: Only admins can delete old activity logs
CREATE POLICY "Admins can delete old activity logs"
ON admin_activity_log
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admins
        WHERE admins.email = auth.jwt() ->> 'email'
    )
);

-- Add comments for documentation
COMMENT ON TABLE admin_activity_log IS 'Stores audit trail of all admin panel activities';
COMMENT ON COLUMN admin_activity_log.admin_email IS 'Email of the admin who performed the action';
COMMENT ON COLUMN admin_activity_log.action IS 'Human-readable description of the action';
COMMENT ON COLUMN admin_activity_log.action_type IS 'Type of action: user_add, user_remove, admin_add, admin_remove, bulk, access';
COMMENT ON COLUMN admin_activity_log.target_email IS 'Email address affected by the action (if applicable)';
COMMENT ON COLUMN admin_activity_log.details IS 'Additional details about the action';
COMMENT ON COLUMN admin_activity_log.count IS 'Number of items affected (for bulk actions)';
COMMENT ON COLUMN admin_activity_log.created_at IS 'Timestamp when the action occurred';
