// api/feed.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_KEY
);

export default async function handler(req, res) {
  // 1. CORS & Security
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Data Fetching
  const { data: places, error } = await supabase
    .from('travel_bucket_list') 
    .select(`id, place_name, created_at, cover_photo_url, ai_article, status, tags`) // Added 'tags' for Mastodon hashtags
    .eq('status', 'done') 
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) return res.status(500).json({ error: error.message });

  // 3. Construct RSS Items
  const rssItems = places.map(place => {
    const itemUrl = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(place.place_name)}&utm_source=mastodon_rss`;
    const escapedUrl = itemUrl.replace(/&/g, '&amp;');
    const escapedMediaUrl = (place.cover_photo_url || "").replace(/&/g, '&amp;');
    
    // Formatting Tags for MastoFeed (category tags become hashtags)
    // If you don't have a tags column, we'll use defaults
    const categories = place.tags && Array.isArray(place.tags) 
      ? place.tags.map(t => `<category>${t}</category>`).join('')
      : `<category>Travel</category><category>SriLanka</category><category>Photography</category>`;

    const storyText = place.ai_article?.story 
      ? place.ai_article.story.trim() 
      : `Explore the beauty of ${place.place_name} in Sri Lanka.`;
    
    const fullDescription = `${storyText} \n\n© My Journal | Hasitha Gunasekera.`;
    
    return `
      <item>
        <title><![CDATA[${place.place_name}]]></title>
        <link>${escapedUrl}</link>
        <guid isPermaLink="true">${escapedUrl}</guid>
        <pubDate>${new Date(place.created_at).toUTCString()}</pubDate>
        <dc:creator>Hasitha Gunasekera</dc:creator>
        <description><![CDATA[${fullDescription}]]></description>
        ${categories}
        <enclosure url="${escapedMediaUrl}" length="0" type="image/jpeg" />
        <media:content url="${escapedMediaUrl}" medium="image" width="1200" height="800">
           <media:title type="plain"><![CDATA[${place.place_name}]]></media:title>
           <media:credit role="photographer">Hasitha Gunasekera</media:credit>
        </media:content>
      </item>`;
  }).join('');

  // 4. Construct the Full RSS XML
  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" 
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:media="http://search.yahoo.com/mrss/" 
         xmlns:content="http://purl.org/rss/1.0/modules/content/"
         xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>My Journal | Sri Lanka Travel Photography</title>
        <link>https://my-journal-view.vercel.app/</link>
        <atom:link href="https://my-journal-editor.vercel.app/api/feed" rel="self" type="application/rss+xml" />
        <description>Cinematic travel stories from Sri Lanka by Hasitha Gunasekera.</description>
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${rssItems}
      </channel>
    </rss>`;

  // 5. Headers & Delivery
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); 
  res.setHeader('Content-Type', 'application/xml; charset=utf-8'); 
  res.status(200).send(rssFeed.trim());
}