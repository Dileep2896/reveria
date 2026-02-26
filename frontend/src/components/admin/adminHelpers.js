export function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const TIER_OPTIONS = ['all', 'free', 'standard', 'pro'];
export const PROVIDER_OPTIONS = [['all', 'All'], ['google.com', 'Google'], ['password', 'Email']];
export const VERIFIED_OPTIONS = [['all', 'All'], ['yes', 'Verified'], ['no', 'Unverified']];
export const SORT_OPTIONS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['most_stories', 'Most Stories']];
