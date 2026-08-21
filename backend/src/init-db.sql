-- init-db.sql
-- Creates the Checkpoint Kiosk schema (attendees, print_requests) and seeds sample data.
-- Run with: psql -U postgres -d checkpoint_kiosk -f backend/src/init-db.sql

CREATE TABLE IF NOT EXISTS attendees (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_checked_in',
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS print_requests (
  request_id VARCHAR(50) PRIMARY KEY,
  attendee_id VARCHAR(20) REFERENCES attendees(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sample data: 3+ test attendees, including one for duplicate-scan testing
INSERT INTO attendees (id, name, status)
VALUES ('A001', 'Jane Wanjiru', 'not_checked_in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO attendees (id, name, status)
VALUES ('A002', 'Kevin Otieno', 'not_checked_in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO attendees (id, name, status)
VALUES ('A003', 'Amina Hassan', 'checked_in')
ON CONFLICT (id) DO NOTHING;
