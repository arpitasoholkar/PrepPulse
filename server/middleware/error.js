/**
 * Global error handling middleware returning standardized error response:
 * { "error": { "code": "...", "message": "..." } }
 */
export const errorHandler = (err, req, res, next) => {
  console.error(err);

  let status = err.status || err.statusCode || 500;
  let code = err.code || 'SERVER_ERROR';
  let message = err.message || 'Internal server error';

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
  }

  // Handle Mongoose CastError (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    status = 400;
    code = 'CAST_ERROR';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Handle MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    message = fields.length > 0 
      ? `Duplicate value for field(s): ${fields.join(', ')}` 
      : 'Duplicate key error';
  }

  // Ensure code is formatted as a string
  if (typeof code === 'number') {
    code = String(code);
  }

  // Ensure status is a valid HTTP status code
  if (typeof status !== 'number' || status < 400 || status > 599) {
    status = 500;
  }

  res.status(status).json({
    error: {
      code,
      message
    }
  });
};

export default errorHandler;
