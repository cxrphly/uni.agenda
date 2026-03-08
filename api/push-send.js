// api/push-send.js
import { setVapidDetails, sendNotification } from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configurar VAPID
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

setVapidDetails(
  'mailto:contato@uniagenda.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Inicializar Supabase com service role (permissão total)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // PRECISA desta chave!
);

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Pegar token do usuário do header Authorization
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    // Verificar token e pegar user_id
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const userId = user.id;
    const { deviceIdRemetente, tipo, titulo, body, url, dados } = req.body;

    if (!tipo || !titulo) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Buscar TODOS os dispositivos do usuário (exceto o remetente)
    const { data: dispositivos, error } = await supabase
      .from('push_subscriptions')
      .select('subscription, device_id, device_type')
      .eq('user_id', userId);

    if (error) throw error;

    // Filtrar dispositivos (remover o remetente se especificado)
    const dispositivosParaEnviar = deviceIdRemetente 
      ? dispositivos.filter(d => d.device_id !== deviceIdRemetente)
      : dispositivos;

    let enviados = 0;
    let falhas = 0;

    // Payload da notificação
    const payload = JSON.stringify({
      titulo,
      body,
      url,
      tipo,
      timestamp: Date.now(),
      dados
    });

    // Enviar para cada dispositivo
    for (const dispositivo of dispositivosParaEnviar) {
      try {
        await sendNotification(dispositivo.subscription, payload);
        enviados++;
        
        // Log para debug
        console.log(`✅ Notificação enviada para ${dispositivo.device_type} (${dispositivo.device_id})`);
      } catch (err) {
        falhas++;
        console.log(`❌ Falha ao enviar para ${dispositivo.device_id}:`, err.message);
        
        // Se o dispositivo não existe mais, remover do banco
        if (err.statusCode === 410) { // Gone - subscription expirou
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('device_id', dispositivo.device_id);
          console.log(`🗑️ Dispositivo ${dispositivo.device_id} removido (expirado)`);
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      enviados, 
      falhas,
      total: dispositivosParaEnviar.length,
      message: `Notificação enviada para ${enviados} dispositivo(s)`
    });

  } catch (error) {
    console.error('❌ Erro no push-send:', error);
    return res.status(500).json({ error: error.message });
  }
}