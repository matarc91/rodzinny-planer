import { useState } from 'react';
import { Info, HelpCircle, X, CheckSquare, Hash, List, Quote, Code, Minus } from 'lucide-react';
import { COLORS, uid } from '../../utils/constants.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { NoteEditor } from '../ui/NoteEditor.jsx';
import {
  migrateNoteToTipTapFormat,
  extractTextSummaryFromDoc,
} from '../../utils/noteMigration.js';

export function NoteModal({ editItem, currentUserId, onClose, onSave }) {
  const isEdit = Boolean(editItem?.id);
  const [docContent, setDocContent] = useState(() => migrateNoteToTipTapFormat(editItem));
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const save = () => {
    const textSummary = extractTextSummaryFromDoc(docContent);
    if (!textSummary.trim()) return;

    onSave({
      id: editItem?.id || uid('note'),
      content: docContent,
      text: textSummary,
      createdAt: editItem?.createdAt || new Date().toISOString(),
      personId: editItem?.personId || currentUserId,
    });
    onClose();
  };

  const headerInfoButton = (
    <button
      type="button"
      onClick={() => setShowCheatSheet(true)}
      className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition"
      title="Skróty klawiszowe i wskazówki (Markdown)"
      aria-label="Ściągawka skrótów"
    >
      <HelpCircle size={20} />
    </button>
  );

  return (
    <>
      <ModalShell
        title={isEdit ? 'Edytuj notatkę' : 'Nowa notatka'}
        onClose={onClose}
        headerAction={headerInfoButton}
        maxWidth="sm:max-w-xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-amber-950/20 border border-amber-900/40 rounded-xl px-3 py-2 text-amber-300 text-xs">
            <div className="flex items-center gap-2">
              <Info size={15} className="shrink-0 text-amber-400" />
              <span>
                Notatki są <b>prywatne</b> i widoczne tylko dla Ciebie.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCheatSheet(true)}
              className="text-[11px] text-amber-400 hover:underline font-semibold flex items-center gap-1 shrink-0 ml-2"
            >
              Ściągawka skrótów
            </button>
          </div>

          <div>
            <NoteEditor
              initialContent={docContent}
              onChange={(newJson) => setDocContent(newJson)}
              placeholder="Wpisz treść notatki... Wpisz # dla nagłówka, - [ ] dla checklisty, > dla cytatu..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 transition"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={save}
              style={{ background: COLORS.accent, color: '#121214' }}
              className="px-6 py-2.5 rounded-xl text-xs font-bold shadow hover:opacity-90 transition active:scale-95"
            >
              {isEdit ? 'Zapisz zmiany' : 'Dodaj notatkę'}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Modal ze Ściągawką Skrótów (Markdown Cheat Sheet) */}
      {showCheatSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
          onClick={() => setShowCheatSheet(false)}
        >
          <div
            style={{ background: '#18181B', borderColor: '#33333C' }}
            className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto text-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Info size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-stone-100">Ściągawka Skrótów (Markdown)</h4>
                  <p className="text-[11px] text-stone-400">Wpisz na początku linii, aby sformatować tekst</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheatSheet(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Hash size={16} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-200">Nagłówki / Tytuły</span>
                    <p className="text-[11px] text-stone-400">Wielkości sekcji</p>
                  </div>
                </div>
                <code className="bg-stone-950 px-2 py-1 rounded text-amber-300 font-mono text-[11px] border border-stone-800">
                  # lub ## lub ###
                </code>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckSquare size={16} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-200">Interaktywna Checklista</span>
                    <p className="text-[11px] text-stone-400">Zadanie do odhaczania</p>
                  </div>
                </div>
                <code className="bg-stone-950 px-2 py-1 rounded text-emerald-300 font-mono text-[11px] border border-stone-800">
                  - [ ] (ze spacją)
                </code>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <List size={16} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-200">Listy punktowane / numerowane</span>
                    <p className="text-[11px] text-stone-400">Wypunktowanie pozycji</p>
                  </div>
                </div>
                <code className="bg-stone-950 px-2 py-1 rounded text-amber-300 font-mono text-[11px] border border-stone-800">
                  - lub 1.
                </code>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Quote size={16} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-200">Wyróżnienie / Cytat</span>
                    <p className="text-[11px] text-stone-400">Ważna uwaga z belką</p>
                  </div>
                </div>
                <code className="bg-stone-950 px-2 py-1 rounded text-amber-300 font-mono text-[11px] border border-stone-800">
                  &gt;
                </code>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Minus size={16} className="text-stone-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-200">Pozioma linia</span>
                    <p className="text-[11px] text-stone-400">Oddzielenie sekcji</p>
                  </div>
                </div>
                <code className="bg-stone-950 px-2 py-1 rounded text-stone-300 font-mono text-[11px] border border-stone-800">
                  ---
                </code>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Code size={16} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-200">Blok kodu (Monospace)</span>
                    <p className="text-[11px] text-stone-400">Hasła Wi-Fi, kody PIN, dane techniczne</p>
                  </div>
                </div>
                <code className="bg-stone-950 px-2 py-1 rounded text-amber-300 font-mono text-[11px] border border-stone-800">
                  ```
                </code>
              </div>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200/90 leading-relaxed">
              💡 <b>Wskazówka:</b> Notatki są prywatne i widoczne tylko dla Ciebie. Aby inni domownicy je widzieli, użyj
              opcji <b>„Opublikuj na tablicy”</b> w menu notatki.
            </div>

            <button
              type="button"
              onClick={() => setShowCheatSheet(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs transition"
            >
              Rozumiem, zamknij
            </button>
          </div>
        </div>
      )}
    </>
  );
}
