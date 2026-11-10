// Safety net against database-operator injection and prototype pollution:
// removes keys that start with "$" (e.g. {"email": {"$ne": ""}}) and the
// special names __proto__ / constructor / prototype from body, query and params.
// Every service also cleans its own inputs; this catches anything missed.
const BAD = /^\$|^__proto__$|^constructor$|^prototype$/;

function clean(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = clean(value[i], depth + 1);
    return value;
  }
  for (const key of Object.keys(value)) {
    if (BAD.test(key)) delete value[key];
    else value[key] = clean(value[key], depth + 1);
  }
  return value;
}

export function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) clean(req.body);
  if (req.query) clean(req.query);
  if (req.params) clean(req.params);
  next();
}
