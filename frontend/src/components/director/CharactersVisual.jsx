import { Pill } from './directorUtils.jsx';

export default function CharactersVisual({ list, summary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {summary && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {summary}
        </p>
      )}
      {list && list.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {list.map((char, i) => (
            <Pill
              key={i}
              label={`${char.name}${char.role ? ' \u00b7 ' + char.role : ''}`}
              title={char.trait || ''}
              color="var(--text-primary)"
              bg="var(--glass-bg)"
            />
          ))}
        </div>
      )}
    </div>
  );
}
