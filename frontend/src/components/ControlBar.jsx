import { useState } from 'react';

export default function ControlBar({ onSend, connected }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="border-t border-[#2a2a4a] bg-[#12121f] p-4">
      <form onSubmit={handleSubmit} className="flex gap-3 items-center">
        <div
          className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          title={connected ? 'Connected' : 'Disconnected'}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your story..."
          className="flex-1 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg px-4 py-2.5 text-white placeholder-[#64748b] focus:outline-none focus:border-[#a78bfa]"
        />
        <button
          type="submit"
          disabled={!connected}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
