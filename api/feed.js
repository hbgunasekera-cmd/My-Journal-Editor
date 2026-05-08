// api/feed.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

export default async function handler(req, res) {
  // 1. Handle CORS Preflight for Vercel Allowlist
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { data: places, error } = await supabase
    .from('travel_bucket_list') 
    .select(`id, place_name, created_at, cover_photo_url, ai_article`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  const rssItems = places.map(place => {
    const rawUrl = `https://my-journal-viewer.vercel.app/?place=${encodeURIComponent(place.place_name)}&utm_source=rss_feed`;
    const escapedUrl = rawUrl.replace(/&/g, '&amp;');
    const escapedMediaUrl = (place.cover_photo_url || "").replace(/&/g, '&amp;');
    
    const description = place.ai_article?.story 
      ? place.ai_article.story.substring(0, 450).trim() + "..." 
      : "Explore this hidden gem in Sri Lanka.";
    
    return `
      <item>
        <title><![CDATA[${place.place_name}]]></title>
        <link>${escapedUrl}</link>
        <description><![CDATA[${description}]]></description>
        <pubDate>${new Date(place.created_at).toUTCString()}</pubDate>
        <guid isPermaLink="true">${escapedUrl}</guid>
        <media:content url="${escapedMediaUrl}" medium="image" />
      </item>`;
  }).join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" 
         xmlns:media="http://search.yahoo.com/mrss/" 
         xmlns:content="http://purl.org/rss/1.0/modules/content/"
         xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>My Journal | Sri Lanka Exploration</title>
        <link>https://my-journal-viewer.vercel.app/</link>
        <atom:link href="https://my-journal-editor.vercel.app/api/feed" rel="self" type="application/rss+xml" />
        <description>Hidden waterfalls, mountain treks, and cinematic drone footage by Hasitha Gunasekera.</description>
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${rssItems}
      </channel>
    </rss>`;

  // 5. Final Header Polish for Pinterest
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); 
  res.setHeader('Content-Type', 'application/xml; charset=utf-8'); 
  res.status(200).send(rssFeed.trim());
}