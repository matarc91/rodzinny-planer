import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastToFamily } from '../services/websocket.js';
import { sendPushToFamily } from '../services/webpush.js';

const router = express.Router({ mergeParams: true });

// GET /api/families/:id/state — Pobierz aktualny stan
router.get('/', requireAuth, async (req, res) => {
  const { id: familyId } = req.params;

  try {
    // Sprawdź dostęp
    const memberCheck = await query(
      'SELECT id FROM profiles WHERE family_id = $1 AND (user_id = $2 OR id = $2)',
      [familyId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Brak dostępu do tej rodziny' });
    }

    const result = await query(
      'SELECT data, updated_at FROM family_state WHERE family_id = $1',
      [familyId]
    );

    if (result.rows.length === 0) {
      // Inicjalizuj pusty stan jeśli nie istnieje
      await query(
        'INSERT INTO family_state (family_id, data) VALUES ($1, $2)',
        [familyId, JSON.stringify({})]
      );
      return res.json({ data: {}, updatedAt: null });
    }

    res.json({
      data: result.rows[0].data,
      updatedAt: result.rows[0].updated_at
    });
  } catch (err) {
    console.error('Get state error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/families/:id/state — Zapisz stan + broadcast WebSocket + (opcjonalnie) push
router.put('/', requireAuth, async (req, res) => {
  const { id: familyId } = req.params;
  const { data, pushNotification } = req.body;

  if (data === undefined) return res.status(400).json({ error: 'Pole data jest wymagane' });

  try {
    // Sprawdź dostęp
    const memberCheck = await query(
      'SELECT id FROM profiles WHERE family_id = $1 AND (user_id = $2 OR id = $2)',
      [familyId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Brak dostępu do tej rodziny' });
    }

    // Upsert stanu
    const result = await query(
      `INSERT INTO family_state (family_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (family_id) DO UPDATE
       SET data = $2, updated_at = NOW()
       RETURNING updated_at`,
      [familyId, JSON.stringify(data)]
    );

    const updatedAt = result.rows[0].updated_at;

    // Broadcast przez WebSocket do innych członków rodziny
    broadcastToFamily(
      familyId,
      { type: 'state_update', data, updatedAt, updatedBy: req.userId },
      req.ws // wyłącz nadawcę (jest ustawiane w index.js dla żądań WS-aware)
    );

    // Opcjonalne push powiadomienie (np. przy dodaniu zadania)
    if (pushNotification) {
      const { title, body, url } = pushNotification;
      // Wyślij tylko do innych członków rodziny (nie do nadawcy)
      sendPushToFamily(familyId, req.userId, { title, body, url }).catch(err => {
        console.warn('Push notification failed (non-critical):', err.message);
      });
    }

    res.json({ success: true, updatedAt });
  } catch (err) {
    console.error('Put state error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;
