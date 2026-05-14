import { TwitterApi } from 'twitter-api-v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { text, link, imageUrl } = req.body;

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  try {
    let mediaId = null;

    // --- SERVER-LEVEL GRAB: Fetch and Upload Image ---
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        
        // Upload to Twitter (v1.1 endpoint is used for media)
        mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
      } catch (imgErr) {
        console.error("Image Fetch/Upload Failed:", imgErr);
        // Continue without image if upload fails
      }
    }

    // --- CONSTRUCT STATUS ---
    const fullStatus = `${text}\n\n🔗 Web: ${link}\n\n#MyJournal #SriLanka #Travel`;

    // --- EXECUTE TWEET WITH MEDIA ---
    const tweetPayload = { text: fullStatus };
    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    const { data } = await client.v2.tweet(tweetPayload);

    return res.status(200).json({ success: true, tweetId: data.id });

  } catch (error) {
    console.error("Twitter Push Error:", error);
    const errorMessage = error.data?.detail || error.message || "Unknown Error";
    return res.status(500).json({ error: errorMessage });
  }
}