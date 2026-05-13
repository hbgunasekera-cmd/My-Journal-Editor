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

  // 2. Data Fetching: Retrieve at least 20 items as per Flipboard guidance
  const { data: places, error } = await supabase
    .from('travel_bucket_list') 
    .select(`id, place_name, created_at, cover_photo_url, ai_article, status`)
    .eq('status', 'done') 
    .order('created_at', { ascending: false })
    .limit(25); // Increased to 25 to ensure a healthy buffer over the 20-item minimum

  if (error) return res.status(500).json({ error: error.message });

  // 3. Construct RSS Items
  const rssItems = places.map(place => {
    // We use a generic UTM to track traffic from aggregators
    const itemUrl = `https://my-journal-view.vercel.app/?place=${encodeURIComponent(place.place_name)}&utm_source=rss_feed`;
    
    const escapedUrl = itemUrl.replace(/&/g, '&amp;');
    const escapedMediaUrl = (place.cover_photo_url || "").replace(/&/g, '&amp;');
    
    // Flipboard prefers longer descriptions (> 300 chars)
    const storyText = place.ai_article?.story 
      ? place.ai_article.story.trim() 
      : `Explore the beauty of ${place.place_name} in Sri Lanka. Check out the full gallery and trip details on My Journal.`;
    
    const fullDescription = `${storyText} \n\n© My Journal | Hasitha Gunasekera. Original photography and travel guides.`;
    
    return `
      <item>
        <title><![CDATA[${place.place_name}]]></title>
        <link>${escapedUrl}</link>
        <guid isPermaLink="true">${escapedUrl}</guid>
        <pubDate>${new Date(place.created_at).toUTCString()}</pubDate>
        <dc:creator>Hasitha Gunasekera</dc:creator>
        <description><![CDATA[${fullDescription}]]></description>
        
        <category>Travel</category>

        <enclosure url="${escapedMediaUrl}" length="0" type="image/jpeg" />

        <media:content url="${escapedMediaUrl}" medium="image" width="1200" height="800">
           <media:title type="plain"><![CDATA[${place.place_name}]]></media:title>
           <media:credit role="photographer">Hasitha Gunasekera</media:credit>
           <media:copyright>My Journal | Sri Lanka</media:copyright>
        </media:content>
      </item>`;
  }).join('');

  // 4. Construct the Full RSS XML with all necessary Namespaces
  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" 
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:media="http://search.yahoo.com/mrss/" 
         xmlns:content="http://purl.org/rss/1.0/modules/content/"
         xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>My Journal | Sri Lanka Travel Photography</title>
        <link>https://my-journal-view.vercel.app/</link>
        <atom:link href="https://my-journal-view.vercel.app/api/feed" rel="self" type="application/rss+xml" />
        <description>Cinematic travel stories, trekking guides, and photography from Sri Lanka by Hasitha Gunasekera.</description>
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