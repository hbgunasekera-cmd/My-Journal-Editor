// api/ig-image-proxy.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Missing image URL parameter");
  }

  try {
    // Force switch to https to avoid Google redirect loops
    let cleanUrl = url.replace(/^http:\/\//i, 'https://');

    // If it's an un-parameterized Google content link, ensure it requests raw bytes
    if (cleanUrl.includes("googleusercontent.com") && !cleanUrl.includes('=')) {
      cleanUrl = `${cleanUrl}=s0`;
    }

    const imageResp = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!imageResp.ok) {
      return res.status(imageResp.status).send(`Proxy failed to fetch asset from Google: ${imageResp.statusText}`);
    }

    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    return res.send(buffer);

  } catch (error) {
    console.error("Proxy Error:", error.message);
    return res.status(500).send(`Proxy Error: ${error.message}`);
  }
}