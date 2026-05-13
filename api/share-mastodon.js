// api/share-mastodon.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tootText, coverImageUrl, locationName } = req.body;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: "MASTODON_ACCESS_TOKEN not found in Vercel environment." });
  }

  try {
    let mediaIds = [];

    // 1. PROCESS IMAGE
    if (coverImageUrl) {
      try {
        const imageResp = await fetch(coverImageUrl);
        if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
        
        const arrayBuffer = await imageResp.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Mastodon requires a Multipart form with a filename
        const formData = new FormData();
        const fileBlob = new Blob([uint8Array], { type: 'image/jpeg' });
        
        // The third argument 'cover.jpg' is MANDATORY for Mastodon validation
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
          const mediaErr = await mediaUpload.json();
          console.error("Mastodon Media API Error:", mediaErr);
          // If media fails, we still want to try posting the text
        }
      } catch (imgErr) {
        console.error("Image Processing Failed:", imgErr.message);
      }
    }

    // 2. POST STATUS
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

    if (!statusResp.ok) {
      return res.status(statusResp.status).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Proxy Global Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}