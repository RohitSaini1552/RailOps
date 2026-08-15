# Train4 - Train Ticket Booking Platform

A simple PERN stack train ticket booking app with JWT auth, searchable trains, date-specific seat selection, mock payment, booking management, Redis-backed seat locking, and Socket.io real-time updates.

## Project Structure

- `backend` - Express + PostgreSQL API
- `frontend` - React + Vite + Tailwind client

## Prerequisites

- Node.js 18+
- PostgreSQL installed and running locally
- Redis installed and running locally
- `psql` available in your terminal, or another PostgreSQL client to run the SQL files

## Backend Setup

1. Open a terminal in `backend`.
2. Install dependencies:

```bash
npm install
```

3. Copy or edit `backend/.env` with your local values.
4. Create the database:

```bash
psql -U postgres -c "CREATE DATABASE train_booking;"
```

5. Run the schema and seed files:

```bash
psql -U postgres -d train_booking -f db/schema.sql
psql -U postgres -d train_booking -f db/seed.sql
```

6. Start the backend:

```bash
npm run dev
```

Backend defaults:
- API base: `http://localhost:5000`
- Health check: `GET /health`
- Real-time seat updates use Socket.io on the same backend server.

## Backend Environment

Edit `backend/.env` and replace the placeholders with real values:

- `PORT` - backend port
- `CLIENT_URL` - frontend URL for CORS
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string for temporary seat locks
- `JWT_SECRET` - long random secret for signing tokens
- `JWT_EXPIRES_IN` - token lifetime

A matching template is available at `backend/.env.example`.

## Frontend Setup

1. Open a terminal in `frontend`.
2. Install dependencies:

```bash
npm install
```

3. If needed, edit `frontend/.env.example` and create a local `frontend/.env` with:

```bash
VITE_API_URL=http://localhost:5000/api
```

The frontend connects to Socket.io automatically using the backend origin.

4. Start the frontend:

```bash
npm run dev
```

Frontend defaults to:
- `http://localhost:5173`

## User Flow

- Open `/` to log in or register.
- After login, go to Search Trains.
- Search by source, destination, and journey date.
- Open a train card to choose seats and passenger details.
- Available seats stay green, booked seats stay red, and temporary locks appear immediately for everyone else.
- Click Pay to trigger the mock payment flow and create a booking.
- View and cancel upcoming bookings from My Bookings.

## Notes

- Seat availability is calculated per `train_id + journey_date` from confirmed bookings.
- Seat locking uses Redis with TTL so another user cannot grab the same seat while it is held.
- Booking creation uses a transaction and an advisory lock to reduce race conditions.
- Socket.io broadcasts seat changes in real time to everyone viewing the same train and date.
- If PostgreSQL is unavailable, the API returns a clear 503 response instead of failing silently.
- If Redis is unavailable, the seat-lock endpoints return a clear 503 response.
- This v1 does not include a real payment gateway or an admin panel.

## Local Redis Test

To test locking and concurrency without Docker, start Redis locally first, then launch the backend and frontend in separate terminals. Once both are running, open the same train/date page in two browser windows and try locking or booking the same seat from both windows.
