import crypto from 'crypto';

export function checkTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const data = [];
  for (const [k,v] of urlParams.entries()) data.push(`${k}=${v}`);
  data.sort();
  const dataCheckString = data.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (hmac !== hash) return null;
  try { return JSON.parse(urlParams.get('user') || '{}'); } catch { return null; }
}
