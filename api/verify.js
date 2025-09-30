// /api/verify.js — проверка email+dob в Supabase + привязка telegram_id при первом входе
import { createClient } from '@supabase/supabase-js';
import { checkTelegramInitData } from './_utils.js'; // ТОТ САМЫЙ utils с HMAC 'WebAppData'

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res){
  try{
    const { email = '', dob = '' } = req.query || {};
    const e = String(email).trim().toLowerCase();
    const d = String(dob).trim();
    if (!e || !d) return res.status(400).json({ ok:false, error: 'Требуются email и dob' });

    // читаем Telegram initData из заголовка (ОБЯЗАТЕЛЬНО добавим его на фронте)
    const tgUser = checkTelegramInitData(req.headers['x-telegram-init-data']||'', process.env.BOT_TOKEN);
    if (!tgUser?.id) {
      return res.status(401).json({ ok:false, error: 'Telegram auth failed' });
    }

    const { data, error } = await supa
      .from('users')
      .select('id,email,name,dob,access_until,telegram_id')
      .eq('email', e)
      .maybeSingle();

    if (error) return res.status(500).json({ ok:false, error: 'DB error' });
    if (!data) return res.status(200).json({ ok:false, error: 'Пользователь не найден' });

    const storedDob = (data.dob || '').slice(0,10);
    if (storedDob !== d) return res.status(200).json({ ok:false, error: 'Неверная дата рождения' });

    if (data.access_until && new Date(data.access_until) < new Date()) {
      return res.status(200).json({ ok:false, error: 'Срок доступа истёк' });
    }

    // ПРИВЯЗКА: если telegram_id пустой — записываем текущий tg id
    if (!data.telegram_id) {
      const { error: linkErr } = await supa
        .from('users')
        .update({ telegram_id: String(tgUser.id), updated_at: new Date().toISOString() })
        .eq('id', data.id);
      if (linkErr) return res.status(500).json({ ok:false, error: 'LINK_TELEGRAM_FAILED' });
    } else if (String(data.telegram_id) !== String(tgUser.id)) {
      // другой Telegram — не пускаем
      return res.status(403).json({ ok:false, error: 'Этот email уже привязан к другому Telegram' });
    }

    return res.status(200).json({ ok:true, user: { email: data.email, name: data.name, dob: storedDob } });
  } catch (e){
    console.error('/api/verify', e);
    return res.status(500).json({ ok:false, error: 'Server error' });
  }
}


