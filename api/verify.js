// /api/verify.js — Верификация email+DOB + привязка Telegram ID
import { createClient } from '@supabase/supabase-js';
import { checkTelegramInitData } from './_utils.js';

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res){
  try{
    // 1) Проверяем Telegram WebApp initData
    const tgUser = checkTelegramInitData(
      req.headers['x-telegram-init-data'] || '',
      process.env.BOT_TOKEN
    );
    if (!tgUser?.id) {
      return res.status(401).json({ ok:false, error:'Telegram auth failed' });
    }

    // 2) Параметры
    const { email = '', dob = '' } = req.query || {};
    const e = String(email).trim().toLowerCase();
    const d = String(dob).trim();
    if (!e || !d) return res.status(400).json({ ok:false, error: 'Требуются email и dob' });

    // 3) Находим пользователя
    const { data, error } = await supa
      .from('users')
      .select('id,email,name,dob,access_until,telegram_id')
      .eq('email', e)
      .maybeSingle();

    if (error) return res.status(500).json({ ok:false, error: 'DB error' });
    if (!data)  return res.status(200).json({ ok:false, error: 'Пользователь не найден' });

    // 4) Проверяем дату рождения
    const storedDob = (data.dob || '').slice(0,10);
    if (storedDob !== d) {
      return res.status(200).json({ ok:false, error: 'Неверная дата рождения' });
    }

    // 5) Проверяем срок доступа
    if (data.access_until && new Date(data.access_until) < new Date()) {
      return res.status(200).json({ ok:false, error: 'Срок доступа истёк' });
    }

    // 6) Привязываем Telegram ID при первом входе
    if (!data.telegram_id) {
      const { error: upErr } = await supa
        .from('users')
        .update({ telegram_id: String(tgUser.id), updated_at: new Date().toISOString() })
        .eq('id', data.id);
      if (upErr) return res.status(500).json({ ok:false, error: 'Link telegram failed' });
    } else if (String(data.telegram_id) !== String(tgUser.id)) {
      // Уже привязан к другому TG-пользователю
      return res.status(403).json({ ok:false, error:'Нет доступа' });
    }

    // 7) Успех
    return res.status(200).json({
      ok:true,
      user: { email: data.email, name: data.name, dob: storedDob }
    });
  } catch (e){
    console.error('/api/verify error:', e);
    return res.status(500).json({ ok:false, error: 'Server error' });
  }
}

