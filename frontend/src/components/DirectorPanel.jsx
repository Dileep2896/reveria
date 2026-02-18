export default function DirectorPanel({ messages }) {
  const directorMessages = messages.filter((m) => m.type === 'director');

  return (
    <div className="w-80 bg-[#12121f] border-l border-[#2a2a4a] p-5 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4 text-[#a78bfa]">Director Mode</h2>

      {directorMessages.length === 0 ? (
        <p className="text-[#64748b] text-sm">
          Creative reasoning will appear here as the story unfolds...
        </p>
      ) : (
        directorMessages.map((msg, i) => (
          <div
            key={i}
            className="mb-3 p-3 bg-[#1a1a2e] rounded-lg text-sm text-[#c4b5fd]"
          >
            {msg.content}
          </div>
        ))
      )}
    </div>
  );
}
