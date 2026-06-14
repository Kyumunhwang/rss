function extractImageFromHtml(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}

function extractImageFromEnclosure(enclosure) {
  if (enclosure && enclosure.link && enclosure.type && enclosure.type.startsWith('image/')) {
    return enclosure.link;
  }
  return null;
}

export async function fetchRss(url) {
  const encodedUrl = encodeURIComponent(url);
  
  // 1. Try rss2json API first (Most reliable, returns parsed JSON)
  try {
    const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodedUrl}&api_key=`; // public rate limit is usually fine for testing
    const response = await fetch(rss2jsonUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok') {
        return {
          title: data.feed.title || "Unknown Feed",
          description: data.feed.description || "",
          items: data.items.map(item => ({
            id: item.guid || item.link,
            title: item.title || "No Title",
            link: item.link,
            pubDate: item.pubDate || new Date().toISOString(),
            contentSnippet: item.description || item.content || "",
            imageUrl: item.thumbnail || extractImageFromEnclosure(item.enclosure) || extractImageFromHtml(item.description || item.content) || null
          }))
        };
      }
    }
  } catch (e) {
    console.warn("rss2json API failed, falling back to raw XML proxies...", e);
  }

  // 2. Fallback to raw XML proxies if rss2json fails
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodedUrl}`,
    `https://corsproxy.io/?${encodedUrl}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`
  ];
  
  let xmlString = "";
  let success = false;

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy);
      if (!response.ok) continue;
      
      const text = await response.text();
      if (text && text.trim().startsWith('<')) {
        xmlString = text;
        success = true;
        break; 
      }
    } catch (e) {
      console.warn(`Proxy ${proxy} failed:`, e);
    }
  }
  
  if (!success) {
    throw new Error("Failed to fetch feed. The URL might be blocking proxy requests, or your ad-blocker is preventing the connection.");
  }

  // Parse raw XML fallback
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) throw new Error("Error parsing XML");
    
    const feedTitle = xmlDoc.querySelector("channel > title")?.textContent || xmlDoc.querySelector("feed > title")?.textContent || "Unknown Feed";
    const feedDescription = xmlDoc.querySelector("channel > description")?.textContent || "";
    
    const items = Array.from(xmlDoc.querySelectorAll("item, entry")).map(item => {
      const title = item.querySelector("title")?.textContent || "No Title";
      
      let link = item.querySelector("link")?.textContent;
      if (!link) {
        const linkNode = item.querySelector("link");
        if (linkNode && linkNode.getAttribute('href')) link = linkNode.getAttribute('href');
      }
      
      const pubDate = item.querySelector("pubDate")?.textContent || item.querySelector("published")?.textContent || item.querySelector("updated")?.textContent || new Date().toISOString();
      const contentSnippet = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || "";
      const guid = item.querySelector("guid")?.textContent || item.querySelector("id")?.textContent || link;
      
      let imageUrl = null;
      const enclosure = item.querySelector("enclosure[type^='image']");
      if (enclosure) {
        imageUrl = enclosure.getAttribute('url');
      } else {
        const mediaContent = item.getElementsByTagNameNS("*", "content");
        for (let i = 0; i < mediaContent.length; i++) {
          if (mediaContent[i].getAttribute('medium') === 'image' || mediaContent[i].getAttribute('url')?.match(/\.(jpeg|jpg|gif|png)$/i)) {
            imageUrl = mediaContent[i].getAttribute('url');
            break;
          }
        }
      }
      
      if (!imageUrl && contentSnippet) imageUrl = extractImageFromHtml(contentSnippet);
      
      return { id: guid, title, link, pubDate, contentSnippet, imageUrl };
    });
    
    return { title: feedTitle, description: feedDescription, items };
  } catch (error) {
    console.error("Failed to parse fallback XML:", error);
    throw new Error("Failed to parse the RSS XML data.");
  }
}
