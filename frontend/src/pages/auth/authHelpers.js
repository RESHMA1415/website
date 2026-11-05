// Where to go after login: only pages on this site (never another website)
export function safeNext(searchParams, fallback = '/account') {
  const next = searchParams.get('next') || '';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_HINT = 'At least 8 characters, with 1 letter and 1 number.';
