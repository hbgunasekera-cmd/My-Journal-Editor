// api/share-mastodon.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tootText, coverImageUrl, locationName } = req.body;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: "MASTODON_ACCESS_TOKEN is missing." });
  }

  try {
    let mediaIds = [];

    if (coverImageUrl) {
      try {
        // Mimic a browser fetch to prevent Google Photos from blocking the request
        const imageResp = await fetch(coverImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (imageResp.ok) {
          const arrayBuffer = await imageResp.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Use standard FormData (supported natively in Node 18+ on Vercel)
          const formData = new FormData();
          const fileBlob = new Blob([buffer], { type: 'image/jpeg' });
          
          formData.append('file', fileBlob, 'cover.jpg');
          formData.append('description', `Scenic view of ${locationName}`);

          const mediaUpload = await fetch('https://mastodon.social/api/v1/media', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData,
          });

          if (mediaUpload.ok) {
            const mediaData = await mediaUpload.json();
            mediaIds.push(mediaData.id);
          } else {
            const errorText = await mediaUpload.text();
            console.error("Mastodon Media Upload Failed:", errorText);
          }
        } else {
          console.error(`Google Photos Fetch Failed: ${imageResp.status} ${imageResp.statusText}`);
        }
      } catch (e) {
        console.error("Image Processing Exception:", e.message);
      }
    }

    // 2. POST STATUS
    // We proceed even if image fails, but you now have logs to see why
    const statusResp = await fetch('https://mastodon.social/api/v1/statuses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: tootText,
        media_ids: mediaIds,
        visibility: 'public',
      }),
    });

    const result = await statusResp.json();
    
    // If the image failed to attach, we send a 206 (Partial Content) or custom flag
    // so the frontend knows the text worked but the image didn't.
    const finalStatus = (statusResp.ok && coverImageUrl && mediaIds.length === 0) ? 206 : statusResp.status;

    return res.status(finalStatus === 200 || finalStatus === 206 ? 200 : finalStatus).json({
      ...result,
      imageAttached: mediaIds.length > 0
    });

  } catch (error) {
    console.error("Global Handler Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}