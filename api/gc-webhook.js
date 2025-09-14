import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body = req.body || {};
  const status = String(body.status || body.order_status || '').toLowerCase();
  const email = String(body.email || body.user_email || '').toLowerCase().trim();
  const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();

  if (!email) return res.status(400).send('No email');
  if (!['paid','success'].includes(status)) return res.status(200).send('Ignored');

  const paidUntil = new Date(paidAt); paidUntil.setDate(paidUntil.getDate() + 365);

  // Создадим пустого пользователя (без DOB), если его ещё нет
  await supa.from('users').upsert({ email });

  // Продлим доступ, если новая дата больше
  const { data: curr } = await supa.from('access').select('paid_until').eq('email', email).maybeSingle();
  const newUntil = (!curr || new Date(curr.paid_until) < paidUntil) ? paidUntil.toISOString() : curr.paid_until;
  await supa.from('access').upsert({ email, paid_until: newUntil });

  return res.status(200).send('OK');
}
