import { createClient } from '@supabase/supabase-js';
import { checkTelegramInitData } from './_utils.js';

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1) Проверяем Telegram WebApp initData
  const tgUser = checkTelegramInitData(req.headers['x-telegram-init-data']||'', process.env.BOT_TOKEN);
  if (!tgUser?.id) return res.status(401).json({ ok:false, error:'Telegram auth failed' });

  if (req.method === 'GET') {
    const email = (req.query.email||'').toLowerCase().trim();
    if (!email) return res.status(400).json({ ok:false, error:'NO_EMAIL' });

    // 2) Ищем пользователя по email и сверяем/привязываем telegram_id
    const { data: userRow, error: uErr } = await supa
      .from('users')
      .select('telegram_id')
      .eq('email', email)
      .maybeSingle();
    if (uErr) return res.status(500).json({ ok:false, error:'DB_ERROR' });
    if (!userRow) return res.status(404).json({ ok:false, error:'USER_NOT_FOUND' });

    // Привязка при первом входе: если telegram_id пуст, запишем текущего tgUser.id
    if (!userRow.telegram_id) {
      const { error: upErr } = await supa
        .from('users')
        .update({ telegram_id: String(tgUser.id), updated_at: new Date().toISOString() })
        .eq('email', email);
      if (upErr) return res.status(500).json({ ok:false, error:'LINK_TELEGRAM_FAILED' });
    } else if (String(userRow.telegram_id) !== String(tgUser.id)) {
      return res.status(403).json({ ok:false, error:'Нет доступа' });
    }

    // 3) Возвращаем профиль (или пустой объект, если его нет — как у тебя и было)
    const { data: profile, error: pErr } = await supa
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (pErr) return res.status(500).json({ ok:false, error:'DB_ERROR' });

    return res.status(200).json({ ok:true, profile: profile || {} });
  }

  if (req.method === 'PUT') {
    const { email, ...payload } = req.body || {};
    const e = (email||'').toLowerCase().trim();
    if (!e) return res.status(400).json({ ok:false, error:'NO_EMAIL' });

    // 2) Проверяем/привязываем telegram_id, как и в GET
    const { data: userRow, error: uErr } = await supa
      .from('users')
      .select('telegram_id')
      .eq('email', e)
      .maybeSingle();
    if (uErr) return res.status(500).json({ ok:false, error:'DB_ERROR' });
    if (!userRow) return res.status(404).json({ ok:false, error:'USER_NOT_FOUND' });

    if (!userRow.telegram_id) {
      const { error: upErr } = await supa
        .from('users')
        .update({ telegram_id: String(tgUser.id), updated_at: new Date().toISOString() })
        .eq('email', e);
      if (upErr) return res.status(500).json({ ok:false, error:'LINK_TELEGRAM_FAILED' });
    } else if (String(userRow.telegram_id) !== String(tgUser.id)) {
      return res.status(403).json({ ok:false, error:'Нет доступа' });
    }

    // 3) Не даём менять DOB с фронта (как у тебя было)
    delete payload.dob;

    // 4) Сохраняем/обновляем профиль
    const { error: saveErr } = await supa
      .from('profiles')
      .upsert({ email: e, ...payload, updated_at: new Date().toISOString() });
    if (saveErr) return res.status(500).json({ ok:false, error:'SAVE_FAILED' });

    return res.status(200).json({ ok:true });
  }

  res.status(405).json({ ok:false, error:'Method Not Allowed' });
}

