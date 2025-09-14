import { createClient } from '@supabase/supabase-js';
import { checkTelegramInitData } from './_utils.js';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const email = (req.query.email||'').toLowerCase().trim();
  const dob = (req.query.dob||'').trim();
  if (!email) return res.status(400).json({ ok:false, error:'Нет e-mail' });

  const tgUser = checkTelegramInitData(req.headers['x-telegram-init-data']||'', process.env.BOT_TOKEN);
  if (!tgUser?.id) return res.status(401).json({ ok:false, error:'Не авторизовано (Telegram)' });

  // users: создать/проверить и зафиксировать DOB
  const { data: userRow } = await supa.from('users').select('*').eq('email', email).maybeSingle();
  if (!userRow) {
    if (!dob) return res.status(400).json({ ok:false, error:'Укажите дату рождения' });
    await supa.from('users').insert({ email, telegram_user_id: String(tgUser.id), dob });
  } else {
    if (String(userRow.telegram_user_id||'') && String(userRow.telegram_user_id)!==String(tgUser.id))
      return res.status(403).json({ ok:false, error:'Доступ уже привязан к другому Telegram-аккаунту' });
    // Никогда не обновляем dob здесь — он «заморожен»
    if (!userRow.telegram_user_id) {
      await supa.from('users').update({ telegram_user_id: String(tgUser.id) }).eq('email', email);
    }
  }

  // access: проверка срока
  const { data: acc } = await supa.from('access').select('paid_until').eq('email', email).maybeSingle();
  if (!acc || !acc.paid_until || new Date(acc.paid_until) < new Date())
    return res.status(200).json({ ok:false, error:'Срок доступа истёк или не оплачен.' });

  return res.status(200).json({ ok:true, paid_until: acc.paid_until });
}
