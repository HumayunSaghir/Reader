const { isProduction } = require('../config/env');

// Map well-known errors to client-facing status codes and messages
const describe = (error) => {
  if (error.status && error.status < 500) return { status: error.status, message: error.message };
  if (error.status === 503) return { status: 503, message: error.message };
  if (error.name === 'CastError') return { status: 400, message: `Invalid ${error.path || 'id'}` };
  if (error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return { status: 400, message: first?.message || 'Invalid input' };
  }
  if (error.code === 11000) return { status: 409, message: 'That already exists' };
  if (error.type === 'entity.parse.failed') return { status: 400, message: 'Malformed JSON body' };
  if (error.type === 'entity.too.large') return { status: 413, message: 'Request body too large' };
  if (error.name === 'MulterError') {
    return { status: 400, message: error.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : error.message };
  }
  return { status: 500, message: isProduction ? 'Something went wrong. Please try again.' : error.message };
};

/** Send an error response from inside a controller's catch block. */
const sendError = (res, error) => {
  const { status, message } = describe(error);
  if (status >= 500) console.error(`[${res.req?.method} ${res.req?.originalUrl}]`, error);
  if (res.headersSent) return;
  res.status(status).json({ message });
};

// Express error middleware (errors thrown or passed to next())
const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  sendError(res, error);
};

const notFound = (req, res) => {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { errorHandler, notFound, sendError, HttpError };
