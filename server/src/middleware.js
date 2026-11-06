const { validationResult } = require('express-validator');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Runs after express-validator chains; returns 400 with field messages.
const validate = (req, res, next) => {
  const r = validationResult(req);
  if (r.isEmpty()) return next();
  res.status(400).json({ message: 'Validation failed', errors: r.array().map(e => ({ field: e.path, msg: e.msg })) });
};

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

// Central error handler: maps Mongoose / Mongo errors to clean HTTP responses.
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500, message = err.message, errors;
  if (err.name === 'CastError') { status = 400; message = `Invalid ${err.path}`; }
  else if (err.name === 'ValidationError') { status = 400; message = 'Validation failed'; errors = Object.values(err.errors).map(e => ({ field: e.path, msg: e.message })); }
  else if (err.code === 11000) { status = 409; message = 'That SKU already exists. SKUs must be unique.'; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Malformed JSON body'; }
  if (status >= 500) { console.error(err); message = 'Internal server error'; }
  res.status(status).json({ message, errors });
};

module.exports = { HttpError, validate, wrap, notFound, errorHandler };
