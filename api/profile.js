import { createClient } from '@supabase/supabase-js';
import { checkTelegramInitData } from './_utils.js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const tgUser = checkTelegramInitData(req.headers['x-telegram-init-data']||'', process.env.BOT_TOKEN);
  if (!tgUser?.id) return res.status(401).json({ ok:false, error:'Telegram auth failed' });

  if (req.method === 'GET') {
    const email = (req.query.email||'').toLowerCase().trim();
    const { data: userRow } = await supa.from('users').select('telegram_user_id').eq('email', email).maybeSingle();
    if (!userRow || String(userRow.telegram_user_id)!==String(tgUser.id))
      return res.status(403).json({ ok:false, error:'Нет доступа' });

    const { data: profile } = await supa.from('profiles').select('*').eq('email', email).maybeSingle();
    return res.status(200).json({ ok:true, profile: profile||{} });
  }

  if (req.method === 'PUT') {
    const { email, ...payload } = req.body || {};
    const e = (email||'').toLowerCase().trim();
    const { data: userRow } = await supa.from('users').select('telegram_user_id').eq('email', e).maybeSingle();
    if (!userRow || String(userRow.telegram_user_id)!==String(tgUser.id))
      return res.status(403).json({ ok:false, error:'Нет доступа' });

    delete payload.dob; // DOB нельзя менять
    await supa.from('profiles').upsert({ email: e, ...payload, updated_at: new Date().toISOString() });
    return res.status(200).json({ ok:true });
  }

  res.status(405).json({ ok:false, error:'Method Not Allowed' });
}
