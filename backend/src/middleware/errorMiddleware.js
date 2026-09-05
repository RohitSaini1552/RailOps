function errorMiddleware(error, req, res, next) {
  console.error(error);

  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.code === '57P01' ||
    error.code === '57P03'
  ) {
    return res.status(503).json({
      message: 'Database connection unavailable. Check backend/.env and make sure PostgreSQL is running.'
    });
  }

  if (error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Something went wrong on the server.' });
}

module.exports = errorMiddleware;
