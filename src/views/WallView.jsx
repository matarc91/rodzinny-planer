import { MessageSquare, Pin, Trash2 } from 'lucide-react';
import { COLORS } from '../utils/constants.js';
import { Chip } from '../components/ui/Chip.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { RichContentView } from '../components/ui/RichContentView.jsx';

export function WallView({ wall = [], people, onDeleteWallMessage, onTogglePinWallMessage }) {
  const sorted = [...wall].sort((a, b) =>
    a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : b.createdAt.localeCompare(a.createdAt)
  );
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="px-1">
        <h2 style={{ fontFamily: 'Fraunces' }} className="text-2xl font-bold text-stone-100">
          Tablica
        </h2>
        <p className="text-xs text-stone-400">Wirtualna korkówka</p>
      </div>
      {sorted.length === 0 ? (
        <EmptyState text="Brak wiadomości" icon={MessageSquare} />
      ) : (
        <div className="columns-1 sm:columns-2 gap-4">
          {sorted.map((msg) => {
            const author = people.find((p) => p.id === msg.personId);
            return (
              <div
                key={msg.id}
                style={{ background: msg.color || COLORS.surface, borderColor: msg.isPinned ? COLORS.accent : COLORS.border }}
                className="break-inside-avoid mb-4 border rounded-2xl p-4 flex flex-col justify-between relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 bg-black/20 pr-2.5 rounded-full">
                      <Chip person={author} size="sm" />
                      <span className="text-xs font-bold text-stone-200">{author?.name || 'Domownik'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onTogglePinWallMessage(msg.id)}
                        className={`p-1 rounded ${msg.isPinned ? 'text-amber-400' : 'text-stone-500'}`}
                      >
                        <Pin size={15} />
                      </button>
                      <button onClick={() => onDeleteWallMessage(msg.id)} className="p-1 text-stone-500 hover:text-red-400">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="my-2">
                    <RichContentView content={msg.text || msg.content} />
                  </div>
                </div>
                <div className="pt-2 border-t mt-2 flex items-center justify-between border-stone-800/80">
                  <span className="text-[10px] font-mono text-stone-500">
                    {new Date(msg.createdAt).toLocaleDateString('pl-PL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.isPinned && (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                      <Pin size={10} /> Przypięte
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
