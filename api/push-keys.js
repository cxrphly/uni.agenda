// api/push-keys.js
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ 
      publicKey: process.env.VAPID_PUBLIC_KEY 
    });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}