export default function SceneCard({ scene }) {
  return (
    <div
      className="rounded-2xl p-5 mb-4 transition-all"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-glass)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--glass-border-accent)';
        e.currentTarget.style.boxShadow = 'var(--shadow-glow-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--glass-border)';
        e.currentTarget.style.boxShadow = 'var(--shadow-glass)';
      }}
    >
      {/* Scene number badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--accent-primary-soft)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--glass-border-accent)',
          }}
        >
          Scene {scene.scene_number}
        </span>
      </div>

      <div className="flex gap-5">
        {scene.image_url && (
          <img
            src={scene.image_url}
            alt={`Scene ${scene.scene_number}`}
            className="w-52 h-36 object-cover rounded-xl"
            style={{
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--glass-border)',
            }}
          />
        )}
        <div className="flex-1">
          <p
            className="leading-7 text-[15px]"
            style={{ color: 'var(--text-primary)' }}
          >
            {scene.text}
          </p>
        </div>
      </div>

      {scene.audio_url && (
        <div
          className="mt-4 pt-3"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          <audio controls className="w-full h-8" src={scene.audio_url} />
        </div>
      )}
    </div>
  );
}
