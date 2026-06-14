import Dexie from 'dexie';

export const db = new Dexie('RssReaderDB');

db.version(1).stores({
  feeds: '++id, url, title', // Primary key and indexed props
  articles: 'id, feedId, link, pubDate, isRead, isSaved' // Primary key (usually the article guid/link) and indexed props
});
