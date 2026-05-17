// api/share-meta.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { platform, text, imageUrl, fbAccessToken, threadsAccessToken } = req.body;
  const IG_USER_ID = process.env.IG_USER_ID;

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host; 
    
    // 💡 THE TRICK: We append '&ignore=/image.jpg' so Meta's URL parser explicitly sees a '.jpg' extension
    const unblockableImageUrl = `${protocol}://${host}/api/ig-image-proxy?url=${encodeURIComponent(imageUrl)}&ignore=/image.jpg`;

    if (platform === 'instagram') {
      const ACCESS_TOKEN = fbAccessToken || process.env.META_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) return res.status(400).json({ error: "Missing Instagram token." });

      // Step 1: Create Instagram Media Container
      const igCreateUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media`;
      const createRes = await fetch(igCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: unblockableImageUrl,
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      
      // 🔥 DIAGNOSTIC UPGRADE: If Meta fails, bubble up their exact error parameters
      if (createData.error) {
        return res.status(createRes.status).json({
          error: `Meta rejected container creation: ${createData.error.message}`,
          code: createData.error.code,
          subcode: createData.error.error_subcode
        });
      }
      
      if (!createData.id) {
        return res.status(500).json({ error: "No Media ID returned from Meta", rawData: createData });
      }
      
      // Step 2: Publish the Container
      const igPublishUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media_publish`;
      const publishRes = await fetch(igPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: createData.id, access_token: ACCESS_TOKEN })
      });

      const publishData = await publishRes.json();
      if (publishData.error) return res.status(publishRes.status).json({ error: publishData.error.message });
      
      return res.status(200).json({ success: true, id: publishData.id });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}