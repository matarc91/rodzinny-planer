// WebSocket manager – zarządza "pokojami" rodzin
// Każda rodzina = Set<WebSocket> połączeń
// Klient po połączeniu wysyła: { type: 'join', familyId, token }
// Serwer broadcastuje do wszystkich w rodzinie z wyłączeniem nadawcy

import jwt from 'jsonwebtoken';

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

/**
 * Dodaje klienta do pokoju rodziny
 * @param {string} familyId
 * @param {import('ws').WebSocket} ws
 */
export function addClient(familyId, ws) {
  if (!rooms.has(familyId)) {
    rooms.set(familyId, new Set());
  }
  rooms.get(familyId).add(ws);
  ws._familyId = familyId;
}

/**
 * Usuwa klienta z pokoju rodziny
 * @param {import('ws').WebSocket} ws
 */
export function removeClient(ws) {
  const familyId = ws._familyId;
  if (!familyId) return;
  const room = rooms.get(familyId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) rooms.delete(familyId);
  }
}

/**
 * Broadcastuje dane do wszystkich klientów w rodzinie (opcjonalnie z wyłączeniem nadawcy)
 * @param {string} familyId
 * @param {object} data
 * @param {import('ws').WebSocket|null} excludeWs
 */
export function broadcastToFamily(familyId, data, excludeWs = null) {
  const room = rooms.get(familyId);
  if (!room) return;

  const message = JSON.stringify(data);
  for (const client of room) {
    if (client === excludeWs) continue;
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      client.send(message);
    }
  }
}

/**
 * Zwraca liczbę połączonych klientów w pokoju rodziny
 */
export function getRoomSize(familyId) {
  return rooms.get(familyId)?.size ?? 0;
}

/**
 * Inicjalizuje obsługę nowego połączenia WebSocket
 * Wywoływane z index.js dla każdego nowego ws
 */
export function handleConnection(ws, query) {
  let authenticated = false;
  let pingInterval;

  // Heartbeat – wykrywanie zerwanych połączeń
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  pingInterval = setInterval(() => {
    if (!ws.isAlive) {
      removeClient(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  ws.on('message', async (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      return ws.send(JSON.stringify({ type: 'error', message: 'Nieprawidłowy format wiadomości' }));
    }

    if (msg.type === 'join') {
      // Autentykacja przez JWT
      try {
        const decoded = jwt.verify(msg.token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Sprawdź czy użytkownik należy do tej rodziny
        const result = await query(
          'SELECT id FROM profiles WHERE user_id = $1 AND family_id = $2',
          [userId, msg.familyId]
        );

        if (result.rows.length === 0) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Brak dostępu do tej rodziny' }));
        }

        ws._userId = userId;
        addClient(msg.familyId, ws);
        authenticated = true;

        ws.send(JSON.stringify({ type: 'joined', familyId: msg.familyId }));
        console.log(`WS: użytkownik ${userId} dołączył do rodziny ${msg.familyId} (łącznie w pokoju: ${getRoomSize(msg.familyId)})`);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nieprawidłowy lub wygasły token' }));
      }
    }
    // Inne typy wiadomości można tu dodawać w przyszłości
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    removeClient(ws);
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
    clearInterval(pingInterval);
    removeClient(ws);
  });
}
