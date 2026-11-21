import jwt from 'jsonwebtoken';

/**
 * Middleware weryfikujący JWT w nagłówku Authorization: Bearer <token>
 * Dołącza do req.user: { id, email }
 */
export function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji.' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token jest nieprawidłowy lub wygasł.' });
  }
}
