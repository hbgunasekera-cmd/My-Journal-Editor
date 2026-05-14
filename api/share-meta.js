// api/share-meta.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { platform, text, imageUrl, link } = req.body;
  const ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FB_PAGE_ID;
  const IG_USER_ID = process.env.IG_USER_ID;

  try {
    if (platform === 'facebook') {
      // Facebook Page Publishing
      const fbUrl = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`;
      const fbResponse = await fetch(fbUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imageUrl,
          message: `${text}\n\n📍 View Map: ${link}`,
          access_token: ACCESS_TOKEN
        })
      });
      
      const fbData = await fbResponse.json();
      if (fbData.error) throw new Error(fbData.error.message);
      return res.status(200).json({ success: true, id: fbData.id });

    } else if (platform === 'instagram') {
      // Instagram Publishing is a 2-step process
      
      // Step 1: Create Media Container
      const igCreateUrl = `https://graph.facebook.com/v19.0/${IG_USER_ID}/media`;
      const createRes = await fetch(igCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message);
      
      // Step 2: Publish the Container
      const igPublishUrl = `https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`;
      const publishRes = await fetch(igPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: ACCESS_TOKEN
        })
      });

      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message);
      return res.status(200).json({ success: true, id: publishData.id });
    }

  } catch (error) {
    console.error("Meta API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}