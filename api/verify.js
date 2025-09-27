// /api/verify.js — проверка e-mail + DOB в Supabase, возвращаем имя и дату
import { createClient } from '@supabase/supabase-js';

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

    const { data, error } = await supa
      .from('users')
      .select('email,name,dob,access_until')
      .eq('email', e)
      .maybeSingle();

    if (error) return res.status(500).json({ ok:false, error: 'DB error' });
    if (!data) return res.status(200).json({ ok:false, error: 'Пользователь не найден' });

    const storedDob = (data.dob || '').slice(0,10);
    if (storedDob !== d) return res.status(200).json({ ok:false, error: 'Неверная дата рождения' });

    if (data.access_until && new Date(data.access_until) < new Date()) {
      return res.status(200).json({ ok:false, error: 'Срок доступа истёк' });
    }

    return res.status(200).json({ ok:true, user: { email: data.email, name: data.name, dob: storedDob } });
  } catch (e){
    return res.status(500).json({ ok:false, error: 'Server error' });
  }
}
