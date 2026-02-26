import Avatar from 'boring-avatars';

const MARBLE_COLORS = ['#f59e0b', '#a78bfa', '#6366f1', '#ec4899', '#14b8a6'];

export default function UserAvatar({ photoURL, name, size = 32, className, style }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name || ''}
        className={className}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <Avatar
      size={size}
      name={name || 'User'}
      variant="marble"
      colors={MARBLE_COLORS}
    />
  );
}
