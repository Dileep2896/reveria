/** Centralized route paths — single source of truth for all navigation. */

export const ROUTES = {
  HOME: '/',
  STORY: (id) => `/story/${id}`,
  STORY_PREFIX: '/story/',
  LIBRARY: '/library',
  EXPLORE: '/explore',
  BOOK: (id) => `/book/${id}`,
  BOOK_PREFIX: '/book/',
  SUBSCRIPTION: '/subscription',
  TERMS: '/terms',
  ADMIN: '/admin',
};
