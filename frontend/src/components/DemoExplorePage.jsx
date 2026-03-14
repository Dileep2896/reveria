/**
 * Hardcoded Explore page for the demo tour.
 * Shows real published books from Firebase with downloaded cover images.
 */
import UserAvatar from './UserAvatar';
import './LibraryPage.css';
import './ExplorePage.css';

const EXPLORE_BOOKS = [
  {
    id: '1',
    title: 'Neighborhood Tapestry Lives',
    cover_image_url: '/explore-covers/neighborhood-tapestry.png',
    total_scene_count: 4,
    author_name: 'Dileep Kumar',
    author_photo_url: null,
    liked_by: ['user1', 'user2', 'user3'],
    published_at: new Date('2026-03-12T16:53:27Z'),
  },
  {
    id: '2',
    title: 'The Mirrored Island',
    cover_image_url: '/explore-covers/the-mirrored-island.png',
    total_scene_count: 5,
    author_name: 'Dileep Kumar',
    author_photo_url: null,
    liked_by: ['user1', 'user4'],
    published_at: new Date('2026-03-12T16:46:05Z'),
  },
];

function PublicBookCard({ book }) {
  const dateStr = book.published_at.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const likeCount = book.liked_by.length;

  return (
    <div className="book-container">
      <div className="book-3d">
        <img
          className="book-3d-cover"
          src={book.cover_image_url}
          alt={book.title}
        />
        <div className="book-3d-info">
          <p className="book-3d-title">{book.title}</p>
          <div className="book-3d-meta">
            <span><strong>{book.total_scene_count}</strong> scenes</span>
            <span className="book-3d-meta-dot" />
            <span>{dateStr}</span>
          </div>
        </div>
      </div>

      <div className="explore-book-footer">
        <div className="explore-book-author">
          <UserAvatar photoURL={book.author_photo_url} name={book.author_name || '?'} size={24} />
          <span className="explore-book-author-name">{book.author_name}</span>
        </div>
        <button className="explore-book-like explore-book-like--active">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likeCount > 0 && <span className="explore-book-like-count">{likeCount}</span>}
        </button>
      </div>
    </div>
  );
}

export default function DemoExplorePage() {
  return (
    <div className="explore-container" style={{ overflow: 'hidden' }}>
      <div className="explore-sticky-header">
        <div className="explore-header-row">
          <h2 className="explore-title">Explore</h2>
          <div className="explore-search">
            <svg className="explore-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by title or author..."
              readOnly
            />
          </div>
          <div className="explore-header-spacer" />
          <button className="explore-liked-toggle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>Favorites</span>
          </button>
        </div>
        <div className="explore-filter-row">
          <div className="explore-sort-pills">
            <button className="explore-sort-pill explore-sort-pill--active">Recent</button>
            <button className="explore-sort-pill">Title</button>
            <button className="explore-sort-pill">Author</button>
          </div>
          <span className="explore-count">{EXPLORE_BOOKS.length} stories</span>
        </div>
      </div>

      <div className="library-grid">
        {EXPLORE_BOOKS.map((book) => (
          <PublicBookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}
