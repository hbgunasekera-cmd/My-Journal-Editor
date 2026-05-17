export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. Unpack data payloads sent by your React client
  const { platform, text, imageUrl, fbAccessToken, threadsAccessToken } = req.body;
  
  // 2. Read global environment variables from Vercel
  const IG_USER_ID = process.env.IG_USER_ID;

  try {
    // ==========================================
    // DYNAMIC GOOGLE PHOTOS RESOLVER (Global Asset Fix)
    // ==========================================
    let finalImageUrl = imageUrl;
    
    if (imageUrl && (imageUrl.includes("photos.app.goo.gl") || imageUrl.includes("googleusercontent.com/photos.google.com"))) {
      try {
        // Fetch the raw HTML wrapper page using a lightweight browser User-Agent header string
        const googleRes = await fetch(imageUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } 
        });
        const htmlText = await googleRes.text();
        
        // Regex extracts the direct underlying static hosting source address from Google's OpenGraph content properties
        const match = htmlText.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_\-]+/);
        
        if (match && match[0]) {
          // Force high-resolution layout override dimensions optimized for Instagram and Threads canvas rules
          finalImageUrl = `${match[0]}=w2400-h1600`;
        } else {
          console.warn("Regex fallback: Could not identify direct image reference stream in Google Photos wrapper.");
        }
      } catch (gErr) {
        console.error("Google Photos Stream Extractions Failed:", gErr);
      }
    }

    // ==========================================
    // INSTAGRAM ROUTE (Standalone Graph Engine)
    // ==========================================
    if (platform === 'instagram') {
      const ACCESS_TOKEN = fbAccessToken || process.env.META_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) {
        return res.status(400).json({ error: "Authorization failed: Missing Instagram token." });
      }
      if (!IG_USER_ID) {
        return res.status(400).json({ error: "Configuration failed: Missing IG_USER_ID engine variable." });
      }

      // Step 1: Create Instagram Media Container
      const igCreateUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media`;
      const createRes = await fetch(igCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: finalImageUrl, // 💡 Uses transformed direct binary image source
          caption: text,
          access_token: ACCESS_TOKEN
        })
      });
      
      const createData = await createRes.json();
      
      if (createData.error) {
        console.error("Instagram Container Creation Detailed Failure:", createData.error);
        throw new Error(`Container Creation Failed: ${createData.error.message} (Code: ${createData.error.code})`);
      }
      
      if (!createData.id) {
        throw new Error("Instagram rejected asset parameters. Ensure image URL is fully public and uses a valid aspect ratio.");
      }
      
      // Step 2: Publish the Instagram Container live
      const igPublishUrl = `https://graph.instagram.com/v21.0/${IG_USER_ID}/media_publish`;
      const publishRes = await fetch(igPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: ACCESS_TOKEN
        })
      });

      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message || "Failed publishing Instagram media container.");
      return res.status(200).json({ success: true, id: publishData.id });

    // ==========================================
    // THREADS ROUTE (Dedicated Threads API Engine)
    // ==========================================
    } else if (platform === 'threads') {
      const ACCESS_TOKEN = threadsAccessToken || process.env.THREADS_ACCESS_TOKEN;
      if (!ACCESS_TOKEN) {
        return res.status(400).json({ error: "Authorization failed: Missing Threads token." });
      }

      // Step 1: Create Threads Media Container
      const threadsCreateUrl = `https://graph.threads.net/v1.0/me/threads`;
      const createRes = await fetch(threadsCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'IMAGE',
          image_url: finalImageUrl, // 💡 Uses transformed direct binary image source
          text: text,
          access_token: ACCESS_TOKEN
        })
      });

      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error.message || "Failed creating Threads post container.");

      // Crucial Meta CDN synchronization delay window
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Step 2: Publish the Threads Container live
      const threadsPublishUrl = `https://graph.threads.net/v1.0/me/threads_publish`;
      const publishRes = await fetch(threadsPublishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: ACCESS_TOKEN
        })
      });

      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message || "Failed finalizing Threads post deployment.");
      return res.status(200).json({ success: true, id: publishData.id });
    }

    return res.status(400).json({ error: "Unsupported platform selection." });

  } catch (error) {
    console.error("Meta API Architecture Error:", error);
    
    let clientErrorMessage = error.message;
    if (clientErrorMessage.includes("access token") || clientErrorMessage.includes("session")) {
      clientErrorMessage = "The session has invalidated. Please check or renew your 60-day authorization tokens.";
    }
    
    return res.status(500).json({ error: clientErrorMessage });
  }
}