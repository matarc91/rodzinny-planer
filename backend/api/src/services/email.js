import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('[EMAIL] Brak konfiguracji SMTP – emaile nie będą wysyłane.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || '"Rodzinny Planer" <noreply@example.com>',
      to,
      subject,
      html,
      text,
    });
    console.log(`[EMAIL] Wysłano: "${subject}" → ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Błąd wysyłki do ${to}:`, err.message);
    return false;
  }
}

export async function sendVerificationEmail(email, token) {
  const url = `${process.env.APP_URL}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Aktywuj konto w Rodzinnym Planerze',
    text: `Kliknij w link, aby aktywować konto: ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#E2B053">🏠 Rodzinny Planer</h2>
        <p>Kliknij poniższy przycisk, aby aktywować swoje konto:</p>
        <a href="${url}" style="display:inline-block;background:#E2B053;color:#121214;font-weight:bold;padding:12px 28px;border-radius:12px;text-decoration:none;margin:16px 0">
          Aktywuj konto
        </a>
        <p style="color:#888;font-size:12px">Link jest ważny przez 24 godziny. Jeśli to nie Ty, zignoruj tę wiadomość.</p>
      </div>
    `,
  });
}

export async function sendResetPasswordEmail(email, token) {
  const url = `${process.env.APP_URL}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Resetowanie hasła – Rodzinny Planer',
    text: `Kliknij w link, aby zresetować hasło: ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#E2B053">🏠 Rodzinny Planer</h2>
        <p>Otrzymaliśmy prośbę o resetowanie hasła. Kliknij poniżej:</p>
        <a href="${url}" style="display:inline-block;background:#E2B053;color:#121214;font-weight:bold;padding:12px 28px;border-radius:12px;text-decoration:none;margin:16px 0">
          Ustaw nowe hasło
        </a>
        <p style="color:#888;font-size:12px">Link jest ważny przez 1 godzinę. Jeśli to nie Ty, zignoruj tę wiadomość.</p>
      </div>
    `,
  });
}
