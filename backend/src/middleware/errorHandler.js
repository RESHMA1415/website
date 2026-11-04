import { isProduction } from '../config/env.js';
import { HttpError } from '../utils/asyncHandler.js';

export function notFound(req, res) {
  res.status(404).json({ message: 'We couldn’t find what you were looking for.' });
}

// Turns low-level errors into messages a shop owner or customer understands
function friendly(err) {
  // Our own errors already carry a message written for people
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'That file is too large. Photos can be up to 5 MB and videos up to 50 MB.',
      LIMIT_FILE_COUNT: 'Please upload at most 20 files at a time.',
    };
    return { status: 400, message: messages[err.code] || 'The upload didn’t work. Please try again.' };
  }
  if (err.type === 'entity.too.large') return { status: 413, message: 'That file is too large to upload.' };
  if (err.type === 'entity.parse.failed') return { status: 400, message: 'We couldn’t read that request. Please try again.' };
  // Other library errors (body-parser etc.) carry a status but a technical message
  if (err.status >= 400 && err.status < 500) {
    return { status: err.status, message: 'We couldn’t process that request. Please check the details and try again.' };
  }
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return { status: 400, message: first?.message?.startsWith('Path') ? 'Please check the details and try again.' : first?.message || err.message };
  }
  if (err.name === 'CastError') return { status: 400, message: 'Please check the details and try again.' };
  if (err.code === 11000) return { status: 409, message: 'That name or code is already used. Please choose another.' };
  return { status: 500, message: 'Something went wrong on our side. Please try again.' };
}

// Customers see a friendly message; developers get the details in the log
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const { status, message } = friendly(err);
  if (status >= 500) console.error(err);
  res.status(status).json({
    message,
    ...(isProduction || status < 500 ? {} : { detail: err.message }),
  });
}
