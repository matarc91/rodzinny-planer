import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendVerificationEmail, sendResetPasswordEmail } from '../services/email.js';

const router = express.Router();

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane' });
  if (password.length < 6) return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków' });

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Konto z tym emailem już istnieje' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const result = await query(
      `INSERT INTO users (email, password_hash, verification_token, verification_expires)
       VALUES ($1, $2, $3, $4) RETURNING id, email, is_verified`,
      [email.toLowerCase(), passwordHash, verificationToken, verificationExpires]
    );

    const user = result.rows[0];
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message: 'Konto zostało utworzone. Sprawdź email, aby je aktywować.',
      user: { id: user.id, email: user.email, isVerified: user.is_verified }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas rejestracji' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane' });

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Konto nie zostało jeszcze aktywowane. Sprawdź email.' });
    }

    const token = generateToken(user.id);

    // Pobierz powiązany profil rodziny
    const profileResult = await query(
      'SELECT p.*, f.name as family_name FROM profiles p JOIN families f ON p.family_id = f.id WHERE p.user_id = $1 LIMIT 1',
      [user.id]
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
      profile: profileResult.rows[0] || null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas logowania' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  // Opcjonalnie: usuń push subscriptions tego użytkownika
  try {
    await query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.userId]);
  } catch (err) {
    console.warn('Nie usunięto push subscriptions przy wylogowaniu:', err.message);
  }
  res.json({ message: 'Wylogowano pomyślnie' });
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token jest wymagany' });

  try {
    const result = await query(
      'SELECT id FROM users WHERE verification_token = $1 AND verification_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token nieprawidłowy lub wygasł' });
    }

    const userId = result.rows[0].id;
    await query(
      'UPDATE users SET is_verified = true, verification_token = NULL, verification_expires = NULL WHERE id = $1',
      [userId]
    );

    const jwtToken = generateToken(userId);
    res.json({ message: 'Email zweryfikowany pomyślnie', token: jwtToken });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/auth/reset-password-request
router.post('/reset-password-request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email jest wymagany' });

  try {
    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    // Zawsze zwracamy sukces (nie ujawniamy czy email istnieje)
    if (result.rows.length > 0) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1h

      await query(
        'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
        [resetToken, resetExpires, result.rows[0].id]
      );

      await sendResetPasswordEmail(email, resetToken);
    }

    res.json({ message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła' });
  } catch (err) {
    console.error('Reset password request error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token i nowe hasło są wymagane' });
  if (password.length < 6) return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków' });

  try {
    const result = await query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token nieprawidłowy lub wygasł' });
    }

    const userId = result.rows[0].id;
    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [passwordHash, userId]
    );

    res.json({ message: 'Hasło zostało zmienione pomyślnie' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT id, email, is_verified, created_at FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

    const profileResult = await query(
      'SELECT p.*, f.name as family_name, f.id as family_id FROM profiles p JOIN families f ON p.family_id = f.id WHERE p.user_id = $1 LIMIT 1',
      [req.userId]
    );

    res.json({
      user: result.rows[0],
      profile: profileResult.rows[0] || null
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PATCH /api/auth/me/password
router.patch('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Obecne i nowe hasło są wymagane' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Nowe hasło musi mieć minimum 6 znaków' });

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Obecne hasło jest nieprawidłowe' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);

    res.json({ message: 'Hasło zostało zmienione' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;
