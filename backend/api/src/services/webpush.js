import webpush from 'web-push';
import { query } from '../db.js';

let initialized = false;

export function initWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!pub || !priv || !subject) {
    console.warn('[PUSH] Brak pełnej konfiguracji VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) – Web Push wyłączony.');
    return;
  }

  try {
    webpush.setVapidDetails(subject.trim(), pub.trim(), priv.trim());
    initialized = true;
    console.log('[PUSH] Web Push VAPID pomyślnie skonfigurowany.');
  } catch (err) {
    console.error('[PUSH] Błąd konfiguracji VAPID:', err.message);
  }
}

/**
 * Wysyła powiadomienie do pojedynczej subskrypcji
 * @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription
 * @param {{ title: string, body: string, url: string, tag?: string }} payload
 * @returns {Promise<boolean>}
 */
export async function sendPushNotification(subscription, payload) {
  if (!initialized) return false;
  try {
    const notification = JSON.stringify({
      title: payload.title || 'Rodzinny Planer 🔔',
      body: payload.body || '',
      icon: payload.icon || '/favicon.svg',
      badge: payload.badge || '/badge-72.png',
      tag: payload.tag || `rp_${Date.now()}`,
      data: { url: payload.url || '/' },
    });

    await webpush.sendNotification(subscription, notification, { TTL: 60 * 60 * 24 });
    return true;
  } catch (err) {
    console.error('[PUSH] Błąd pojedynczego Web Push:', err.message);
    return false;
  }
}

/**
 * Wysyła Web Push do wszystkich urządzeń rodziny poza autorem akcji.
 * @param {string} familyId
 * @param {string|null} excludeUserId - ID użytkownika który wywołał akcję (nie dostaje powiadomienia)
 * @param {{ title: string, body: string, url: string, tag?: string }} payload
 */
export async function sendPushToFamily(familyId, excludeUserId, payload) {
  if (!initialized) return 0;

  try {
    const { rows } = await query(
      `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE family_id = $1
         AND ($2::uuid IS NULL OR user_id != $2)`,
      [familyId, excludeUserId || null]
    );

    if (rows.length === 0) return 0;

    const notification = JSON.stringify({
      title: payload.title || 'Rodzinny Planer 🔔',
      body: payload.body || '',
      icon: '/favicon.svg',
      badge: '/badge-72.png',
      tag: payload.tag || `rp_${Date.now()}`,
      data: { url: payload.url || '/' },
    });

    const results = await Promise.allSettled(
      rows.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
          { TTL: 60 * 60 * 24 } // 24h
        )
      )
    );

    // Usuń nieaktywne subskrypcje (410 Gone / 404 Not Found)
    const staleEndpoints = rows
      .filter((_, i) => results[i].status === 'rejected' && (results[i].reason?.statusCode === 410 || results[i].reason?.statusCode === 404))
      .map((s) => s.endpoint);

    if (staleEndpoints.length > 0) {
      await query(
        `DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`,
        [staleEndpoints]
      );
      console.log(`[PUSH] Usunięto ${staleEndpoints.length} wygasłych subskrypcji.`);
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[PUSH] Wysłano powiadomienie do ${sent}/${rows.length} urządzeń rodziny ${familyId}.`);
    return sent;
  } catch (err) {
    console.error('[PUSH] Błąd wysyłania Web Push do rodziny:', err.message);
    return 0;
  }
}
