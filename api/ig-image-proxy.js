// api/ig-image-proxy.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing image URL parameter" });
  }

  try {
    // 1. Fetch the raw HTML body text stream. Standard GET inherently handles Google redirects natively.
    const pageRes = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to load Google Photos page metadata: ${pageRes.status} ${pageRes.statusText}`);
    }

    const htmlText = await pageRes.text();

    // 2. Extract the high-res OpenGraph metadata image property tag
    // This targets Google's direct CDN location string (<meta property="og:image" content="...">)
    const ogImageMatch = htmlText.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        htmlText.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    let binaryImageUrl = null;
    if (ogImageMatch && ogImageMatch[1]) {
      binaryImageUrl = ogImageMatch[1];
    } else {
      // Fallback: search for direct user content address markers if OpenGraph tags match dynamically
      const fallbackMatch = htmlText.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_\-]+/);
      if (fallbackMatch) binaryImageUrl = fallbackMatch[0];
    }

    if (!binaryImageUrl) {
      console.error("HTML Structure Analysis Failed. Received HTML Snippet:", htmlText.substring(0, 500));
      throw new Error("Could not extract raw image stream from Google Photos layout data.");
    }

    // 3. Strip any old resizing parameters and force optimal high-res dimensions
    // Google Photos URLs often end with =w... or =s... to scale previews down.
    const cleanBaseUrl = binaryImageUrl.split('=')[0];
    const finalBinaryUrl = `${cleanBaseUrl}=w2400-h1600`;

    // 4. Download the actual photo binary bytes using your functional Mastodon-style engine approach
    const imageResp = await fetch(finalBinaryUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!imageResp.ok) throw new Error(`Failed fetching image file data stream: ${imageResp.statusText}`);

    const arrayBuffer = await imageResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Send the clean binary image block stream straight to Meta's ingestion scraper
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    return res.send(buffer);

  } catch (error) {
    console.error("Proxy Processing Failure:", error.message);
    // Explicitly return plain text so Meta can interpret structural script issues inside your Vercel logs
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Proxy Error: ${error.message}`);
  }
}