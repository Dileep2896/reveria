import SceneCard from './SceneCard';

export default function StoryCanvas({ messages }) {
  const textMessages = messages.filter((m) => m.type === 'text');

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-white">Story</h2>
      {textMessages.length === 0 ? (
        <div className="text-[#64748b] text-center mt-20">
          <p className="text-4xl mb-4">&#x1F4D6;</p>
          <p className="text-lg">Start your story by typing a prompt below</p>
        </div>
      ) : (
        textMessages.map((msg, i) => (
          <SceneCard
            key={i}
            scene={{ scene_number: i + 1, text: msg.content }}
          />
        ))
      )}
    </div>
  );
}
