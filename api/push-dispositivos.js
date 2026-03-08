// api/push-dispositivos.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const { deviceId } = req.body;

    // Buscar dispositivos do usuário
    const { data: dispositivos, error } = await supabase
      .from('push_subscriptions')
      .select('device_id, device_type, last_seen')
      .eq('user_id', user.id)
      .order('last_seen', { ascending: false });

    if (error) throw error;

    // Atualizar last_seen do dispositivo atual
    if (deviceId) {
      await supabase
        .from('push_subscriptions')
        .update({ last_seen: new Date().toISOString() })
        .eq('device_id', deviceId)
        .eq('user_id', user.id);
    }

    return res.status(200).json({ 
      dispositivos: dispositivos.map(d => ({
        id: d.device_id,
        tipo: d.device_type,
        ativo: d.device_id === deviceId ? 'atual' : 'outro',
        ultimaVez: d.last_seen
      }))
    });

  } catch (error) {
    console.error('Erro no push-dispositivos:', error);
    return res.status(500).json({ error: error.message });
  }
}