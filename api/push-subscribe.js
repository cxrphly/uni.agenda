// api/push-subscribe.js
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

    const { subscription, deviceId, deviceType, userAgent } = req.body;

    if (!subscription || !deviceId) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Inserir ou atualizar inscrição
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        device_id: deviceId,
        device_type: deviceType || 'desktop',
        subscription,
        user_agent: userAgent || null,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'user_id, device_id'
      });

    if (error) throw error;

    return res.status(201).json({ 
      success: true, 
      message: 'Inscrição realizada com sucesso'
    });

  } catch (error) {
    console.error('Erro no push-subscribe:', error);
    return res.status(500).json({ error: error.message });
  }
}