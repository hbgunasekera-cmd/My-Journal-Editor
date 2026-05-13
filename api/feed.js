// api/feed.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { data: places, error } = await supabase
    .from('travel_bucket_list') 
    .select(`id, place_name, created_at, cover_photo_url, ai_article, status`)
    .eq('status', 'done') 
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) return res.status(500).json({ error: error.message });

  const rssItems = places.map(place => {
    // Pinterest likes a clean link. Adding a timestamp help Pinterest see it as "new"
    const itemUrl = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(place.place_name)}&t=${new Date(place.created_at).getTime()}`;
    const escapedUrl = itemUrl.replace(/&/g, '&amp;');
    const escapedMediaUrl = (place.cover_photo_url || "").replace(/&/g, '&amp;');
    
    const storyText = place.ai_article?.story 
      ? place.ai_article.story.trim().substring(0, 450) // Pinterest description limit is ~500 chars
      : `Explore ${place.place_name} in Sri Lanka.`;
    
    return `
      <item>
        <title><![CDATA[${place.place_name} | Sri Lanka Travel]]></title>
        <link>${escapedUrl}</link>
        <guid isPermaLink="false">${place.id}</guid>
        <pubDate>${new Date(place.created_at).toUTCString()}</pubDate>
        <description><![CDATA[${storyText}]]></description>
        
        <!-- Standard Image tag for simple readers -->
        <image>${escapedMediaUrl}</image>

        <!-- Pinterest / Media tag (CRITICAL) -->
        <media:content url="${escapedMediaUrl}" medium="image">
           <media:title type="plain"><![CDATA[${place.place_name}]]></media:title>
        </media:content>

        <!-- Fallback for Pinterest's older scrapers -->
        <enclosure url="${escapedMediaUrl}" length="0" type="image/jpeg" />
      </item>`;
  }).join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" 
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:media="http://search.yahoo.com/mrss/" 
         xmlns:content="http://purl.org/rss/1.0/modules/content/"
         xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>My Journal | Sri Lanka Travel Photography</title>
        <link>https://my-journal-view.vercel.app/</link>
        <description>Cinematic travel photography from Sri Lanka.</description>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${rssItems}
      </channel>
    </rss>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8'); 
  res.status(200).send(rssFeed.trim());
}