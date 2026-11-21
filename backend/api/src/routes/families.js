import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function generateJoinCode() {
  // 6-znakowy kod alfanumeryczny (bez dwuznacznych znaków 0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// POST /api/families — Utwórz nową rodzinę
router.post('/', requireAuth, async (req, res) => {
  const { name, personName, personId } = req.body;
  if (!name || !personName) return res.status(400).json({ error: 'Nazwa rodziny i imię są wymagane' });

  // Sprawdź czy użytkownik już należy do rodziny
  const existing = await query('SELECT id FROM profiles WHERE user_id = $1', [req.userId]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Już należysz do rodziny. Najpierw ją opuść.' });
  }

  let joinCode;
  // Generuj unikalny kod (pętla na wypadek kolizji)
  for (let i = 0; i < 10; i++) {
    joinCode = generateJoinCode();
    const codeCheck = await query('SELECT id FROM families WHERE join_code = $1', [joinCode]);
    if (codeCheck.rows.length === 0) break;
  }

  try {
    // Transakcja: utwórz rodzinę + profil + pusty state
    await query('BEGIN');

    const familyResult = await query(
      'INSERT INTO families (name, join_code, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, joinCode, req.userId]
    );
    const family = familyResult.rows[0];

    // personId może być dostarczony z frontendu (z istniejącego family_state)
    // lub generujemy nowy UUID
    const pid = personId || crypto.randomUUID();

    const profileResult = await query(
      'INSERT INTO profiles (user_id, family_id, person_id, display_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, family.id, pid, personName, 'owner']
    );

    // Inicjalizuj pusty stan rodziny
    await query(
      'INSERT INTO family_state (family_id, data) VALUES ($1, $2)',
      [family.id, JSON.stringify({ tasks: [], budget: {}, members: [] })]
    );

    await query('COMMIT');

    res.status(201).json({
      family: { id: family.id, name: family.name, joinCode: family.join_code },
      profile: profileResult.rows[0]
    });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Create family error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas tworzenia rodziny' });
  }
});

// POST /api/families/join — Dołącz przez kod
router.post('/join', requireAuth, async (req, res) => {
  const { code, personName, personId } = req.body;
  if (!code || !personName) return res.status(400).json({ error: 'Kod i imię są wymagane' });

  // Sprawdź czy użytkownik już należy do rodziny
  const existing = await query('SELECT id FROM profiles WHERE user_id = $1', [req.userId]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Już należysz do rodziny' });
  }

  try {
    const familyResult = await query('SELECT * FROM families WHERE join_code = $1', [code.toUpperCase()]);
    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono rodziny z tym kodem' });
    }

    const family = familyResult.rows[0];
    const pid = personId || crypto.randomUUID();

    const profileResult = await query(
      'INSERT INTO profiles (user_id, family_id, person_id, display_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, family.id, pid, personName, 'member']
    );

    res.status(201).json({
      family: { id: family.id, name: family.name, joinCode: family.join_code },
      profile: profileResult.rows[0]
    });
  } catch (err) {
    console.error('Join family error:', err);
    res.status(500).json({ error: 'Błąd serwera podczas dołączania do rodziny' });
  }
});

// GET /api/families/:id — Dane rodziny
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Sprawdź czy użytkownik należy do tej rodziny
    const memberCheck = await query(
      'SELECT p.*, u.email FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.family_id = $1 AND p.user_id = $2',
      [id, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Brak dostępu do tej rodziny' });
    }

    const familyResult = await query('SELECT id, name, join_code, owner_id, created_at FROM families WHERE id = $1', [id]);
    if (familyResult.rows.length === 0) return res.status(404).json({ error: 'Rodzina nie znaleziona' });

    // Wszystkie profile w tej rodzinie
    const membersResult = await query(
      'SELECT p.id, p.person_id, p.display_name, p.role, u.email FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.family_id = $1',
      [id]
    );

    res.json({
      family: familyResult.rows[0],
      members: membersResult.rows
    });
  } catch (err) {
    console.error('Get family error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/families/:id/leave — Opuść rodzinę
router.delete('/:id/leave', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const profileResult = await query(
      'SELECT p.id, p.role FROM profiles p WHERE p.family_id = $1 AND p.user_id = $2',
      [id, req.userId]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie należysz do tej rodziny' });
    }

    const profile = profileResult.rows[0];

    // Jeśli właściciel opuszcza i jest więcej członków, blokuj
    if (profile.role === 'owner') {
      const membersCount = await query('SELECT COUNT(*) FROM profiles WHERE family_id = $1', [id]);
      if (parseInt(membersCount.rows[0].count) > 1) {
        return res.status(400).json({ error: 'Właściciel nie może opuścić rodziny z innymi członkami. Przenieś własność lub usuń rodzinę.' });
      }
      // Ostatni członek – usuń całą rodzinę
      await query('DELETE FROM family_state WHERE family_id = $1', [id]);
      await query('DELETE FROM profiles WHERE family_id = $1', [id]);
      await query('DELETE FROM families WHERE id = $1', [id]);
      return res.json({ message: 'Rodzina została usunięta' });
    }

    await query('DELETE FROM profiles WHERE id = $1', [profile.id]);
    await query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.userId]);

    res.json({ message: 'Opuszczono rodzinę' });
  } catch (err) {
    console.error('Leave family error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;
