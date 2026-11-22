import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'planer-rodzinny-jwt-secret-cosmere-2026';

/**
 * Middleware weryfikujący JWT w nagłówku Authorization: Bearer <token>
 * Dołącza do req.userId oraz req.user: { id, email }
 */
export function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji.' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id || decoded.sub;
    req.userId = userId;
    req.user = { id: userId, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token jest nieprawidłowy lub wygasł.' });
  }
}
