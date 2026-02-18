export default function SceneCard({ scene }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-5 mb-4 border border-[#2a2a4a]">
      <div className="flex gap-4">
        {scene.image_url && (
          <img
            src={scene.image_url}
            alt={`Scene ${scene.scene_number}`}
            className="w-48 h-32 object-cover rounded-lg"
          />
        )}
        <div className="flex-1">
          <p className="text-[#e2e8f0] leading-relaxed">{scene.text}</p>
        </div>
      </div>
      {scene.audio_url && (
        <audio controls className="w-full mt-3" src={scene.audio_url} />
      )}
    </div>
  );
}
