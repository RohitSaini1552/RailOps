CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trains (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  source VARCHAR(120) NOT NULL,
  destination VARCHAR(120) NOT NULL,
  distance_km INTEGER NOT NULL CHECK (distance_km > 0),
  fare INTEGER NOT NULL CHECK (fare > 0),
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  duration VARCHAR(40) NOT NULL,
  total_seats INTEGER NOT NULL DEFAULT 100 CHECK (total_seats > 0)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  train_id INTEGER NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  journey_date DATE NOT NULL,
  total_fare INTEGER NOT NULL CHECK (total_fare >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  pnr VARCHAR(40) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_passengers (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL CHECK (seat_number BETWEEN 1 AND 100),
  name VARCHAR(120) NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0),
  id_proof VARCHAR(160) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_train_date ON bookings(train_id, journey_date);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking_id ON booking_passengers(booking_id);