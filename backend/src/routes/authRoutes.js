const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/pool');
const env = require('../config/env');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, passwordHash]
    );

    return res.status(201).json({
      message: 'Registration successful. Please log in.',
      user: sanitizeUser(inserted.rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const result = await pool.query('SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: sanitizeUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
