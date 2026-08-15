import { logger } from '../utils/logger';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY?.trim() && process.env.FROM_EMAIL?.trim());
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const from = process.env.FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new Error('SendGrid is not configured');
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: { email: from },
      subject: args.subject,
      content: [
        { type: 'text/plain', value: args.text },
        { type: 'text/html', value: args.html },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('sendgrid_email_failed', { status: res.status, body: text.slice(0, 500) });
    throw new Error(`SendGrid email failed: ${res.status}`);
  }
}
