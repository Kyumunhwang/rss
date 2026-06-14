import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { fetchRss } from './rss';
import { Plus, RefreshCw, Rss, Moon, Sun, Trash2, ExternalLink, ChevronLeft, LayoutGrid } from 'lucide-react';

function App() {
  const [theme, setTheme] = useState('dark');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation State
  const [selectedFeedId, setSelectedFeedId] = useState(null); // null means "All Feeds"
  const [selectedArticle, setSelectedArticle] = useState(null); // null means "Grid View"

  const feeds = useLiveQuery(() => db.feeds.toArray()) || [];
  
  // Filter articles based on selected feed
  const articles = useLiveQuery(() => {
    let collection = db.articles.orderBy('pubDate').reverse();
    if (selectedFeedId) {
       return db.articles.where('feedId').equals(selectedFeedId).reverse().sortBy('pubDate');
    }
    return collection.toArray();
  }, [selectedFeedId]) || [];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  };

  const handleAddFeed = async (e) => {
    e.preventDefault();
    if (!feedUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRss(feedUrl);
      
      const feedId = await db.feeds.add({
        url: feedUrl,
        title: data.title
      });

      const articlesToSave = data.items.map(item => ({
        ...item,
        feedId,
        isRead: false,
        isSaved: false
      }));
      
      await db.articles.bulkPut(articlesToSave);
      
      setFeedUrl('');
      setShowAddFeed(false);
    } catch (err) {
      setError(err.message || 'Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const refreshFeeds = async () => {
    if (feeds.length === 0) return;
    setLoading(true);
    try {
      for (const feed of feeds) {
        const data = await fetchRss(feed.url);
        const articlesToSave = data.items.map(item => ({
          ...item,
          feedId: feed.id,
          isRead: false,
          isSaved: false
        }));
        await db.articles.bulkPut(articlesToSave);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFeed = async (id, e) => {
    e.stopPropagation();
    await db.feeds.delete(id);
    await db.articles.where('feedId').equals(id).delete();
    if (selectedFeedId === id) setSelectedFeedId(null);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Rss color="var(--primary-color)" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Today RSS</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${selectedFeedId === null ? 'active' : ''}`}
            onClick={() => { setSelectedFeedId(null); setSelectedArticle(null); }}
          >
            <LayoutGrid size={18} />
            <span>All Feeds</span>
          </button>
          
          {feeds.length > 0 && <div className="nav-section-title">My Feeds</div>}
          
          {feeds.map(feed => (
            <div 
              key={feed.id} 
              className={`nav-item ${selectedFeedId === feed.id ? 'active' : ''}`}
              onClick={() => { setSelectedFeedId(feed.id); setSelectedArticle(null); }}
            >
              <span className="nav-item-text">{feed.title}</span>
              <button 
                className="btn-icon delete-btn" 
                onClick={(e) => removeFeed(feed.id, e)}
                title="Remove Feed"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn" onClick={() => setShowAddFeed(true)} style={{ width: '100%' }}>
            <Plus size={18} /> Add Feed
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar glass" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: '0' }}>
          <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>
             {selectedFeedId ? feeds.find(f => f.id === selectedFeedId)?.title : 'All Feeds'}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
             <button className="btn btn-ghost" onClick={refreshFeeds} disabled={loading} title="Refresh Feeds">
              <RefreshCw className={loading ? 'spin' : ''} size={20} />
            </button>
            <button className="btn btn-ghost" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>

        <div className="content-scroll">
          {selectedArticle ? (
            /* Reading View */
            <article className="reading-view glass">
              <button className="btn btn-ghost" style={{ marginBottom: '1.5rem' }} onClick={() => setSelectedArticle(null)}>
                <ChevronLeft size={20} /> Back to Articles
              </button>
              
              <h1 className="article-headline">{selectedArticle.title}</h1>
              <div className="article-meta">
                {new Date(selectedArticle.pubDate).toLocaleString()}
              </div>
              
              {selectedArticle.imageUrl && (
                <img src={selectedArticle.imageUrl} alt={selectedArticle.title} className="article-hero-img" />
              )}
              
              <div className="article-content" dangerouslySetInnerHTML={{ __html: selectedArticle.contentSnippet }} />
              
              <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <a href={selectedArticle.link} target="_blank" rel="noopener noreferrer" className="btn">
                   Read Full Article on Original Site <ExternalLink size={18} />
                </a>
              </div>
            </article>
          ) : (
            /* Grid View */
            <>
              {feeds.length === 0 ? (
                <div className="empty-state">
                  <Rss size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <h2>No Feeds Yet</h2>
                  <p>Click "Add Feed" in the sidebar to get started.</p>
                </div>
              ) : articles.length === 0 ? (
                <div className="empty-state">
                  <p>No articles found for this feed.</p>
                </div>
              ) : (
                <div className="article-grid">
                  {articles.map(article => (
                    <div key={article.id} className="card glass" onClick={() => setSelectedArticle(article)} style={{ cursor: 'pointer' }}>
                      {article.imageUrl ? (
                         <img src={article.imageUrl} alt={article.title} className="card-img" />
                      ) : (
                         <div className="card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Rss size={48} opacity={0.2} />
                         </div>
                      )}
                      <div className="card-body">
                        <h3 className="card-title">{article.title}</h3>
                        <div className="card-meta">
                          {new Date(article.pubDate).toLocaleDateString()}
                        </div>
                        <div className="card-snippet" dangerouslySetInnerHTML={{ __html: article.contentSnippet }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Feed Modal */}
      {showAddFeed && (
        <div className="modal-overlay" onClick={() => setShowAddFeed(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem' }}>Add New Feed</h2>
            <form onSubmit={handleAddFeed}>
              <div className="input-group">
                <input 
                  type="url" 
                  className="input" 
                  placeholder="https://example.com/feed.xml" 
                  value={feedUrl}
                  onChange={e => setFeedUrl(e.target.value)}
                  required
                />
              </div>
              {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddFeed(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
