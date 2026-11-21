import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToFamily, sendPushNotification } from '../services/webpush.js';

const router = express.Router();

// GET /api/push/vapid-public-key — Pobierz publiczny klucz VAPID dla frontendu
router.get('/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'Klucz VAPID nie jest skonfigurowany na serwerze' });
  }
  res.json({ publicKey });
});

// POST /api/push/subscribe — Zapisz subskrypcję powiadomień
router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Niekompletne dane subskrypcji' });
  }

  try {
    // Upsert po unikalnym endpoincie
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = $1, p256dh = $3, auth = $4, updated_at = NOW()`,
      [req.userId, endpoint, keys.p256dh, keys.auth]
    );

    res.json({ success: true, message: 'Subskrypcja powiadomień zapisana' });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas zapisywania subskrypcji' });
  }
});

// POST /api/push/unsubscribe — Usuń subskrypcję
router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Brak endpointu' });
  }

  try {
    await query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
      [endpoint, req.userId]
    );
    res.json({ success: true, message: 'Subskrypcja usunięta' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania subskrypcji' });
  }
});

// POST /api/push/send — Ręczne wysyłanie powiadomienia (np. powiadomienie do rodziny o zadaniu)
router.post('/send', requireAuth, async (req, res) => {
  const { familyId, title, body, url, testOnly } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Tytuł jest wymagany' });
  }

  try {
    if (testOnly) {
      // Wyślij powiadomienie testowe tylko do aktualnego użytkownika
      const subs = await query('SELECT * FROM push_subscriptions WHERE user_id = $1', [req.userId]);
      let sentCount = 0;
      for (const sub of subs.rows) {
        const ok = await sendPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, body: body || 'Testowe powiadomienie z serwera cosmere', url: url || '/' }
        );
        if (ok) sentCount++;
      }
      return res.json({ success: true, sentCount });
    }

    if (!familyId) {
      return res.status(400).json({ error: 'ID rodziny jest wymagane' });
    }

    // Sprawdź czy użytkownik należy do rodziny
    const memberCheck = await query(
      'SELECT id FROM profiles WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Brak dostępu do rodziny' });
    }

    const sentCount = await sendPushToFamily(familyId, req.userId, {
      title,
      body: body || '',
      url: url || '/'
    });

    res.json({ success: true, sentCount });
  } catch (err) {
    console.error('Send push error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas wysyłania powiadomień' });
  }
});

export default router;
