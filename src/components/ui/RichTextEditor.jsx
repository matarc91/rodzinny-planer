import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
} from 'lucide-react';
import { useEffect } from 'react';
import { migrateNoteToTipTapFormat } from '../../utils/noteMigration.js';

export function RichTextEditor({
  value,
  initialContent,
  onChange,
  editable = true,
  placeholder = 'Napisz coś... Użyj skrótów np. # Nagłówek, - [ ] Zadanie, > Cytat...',
  className = '',
  minHeight = 'min-h-[140px]',
}) {
  const effectiveContent = value !== undefined ? value : initialContent;
  const initialDoc = migrateNoteToTipTapFormat(effectiveContent);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        blockquote: {},
        codeBlock: {},
        horizontalRule: {},
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialDoc,
    editorProps: {
      attributes: {
        class: `prose prose-invert prose-stone max-w-none focus:outline-none ${minHeight} text-sm text-stone-100 leading-relaxed font-normal p-3.5`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (onChange) {
        onChange(ed.getJSON());
      }
    },
  });

  // Bezpieczna synchronizacja stanu, jeśli wartość u rodzica zmieni się z zewnątrz
  useEffect(() => {
    if (editor && effectiveContent !== undefined) {
      const currentJson = JSON.stringify(editor.getJSON());
      const nextDoc = migrateNoteToTipTapFormat(effectiveContent);
      const nextJson = JSON.stringify(nextDoc);
      if (currentJson !== nextJson) {
        editor.commands.setContent(nextDoc);
      }
    }
  }, [editor, effectiveContent]);

  if (!editor) {
    return (
      <div className={`w-full ${minHeight} bg-stone-900/60 rounded-xl border border-stone-800 animate-pulse flex items-center justify-center text-xs text-stone-500`}>
        Wczytywanie edytora...
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl border border-stone-800 bg-stone-900/90 overflow-hidden focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/20 transition ${className}`}
    >
      {/* Szybki pasek narzędzi (Toolbar) */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-stone-950/60 border-b border-stone-800 text-stone-400 select-none">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('bold') ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Pogrubienie (Ctrl+B)"
          >
            <Bold size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('italic') ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Kursywa (Ctrl+I)"
          >
            <Italic size={15} />
          </button>

          <div className="w-px h-4 bg-stone-800 mx-0.5" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('heading', { level: 1 }) ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Tytuł (# )"
          >
            <Heading1 size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('heading', { level: 2 }) ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Podtytuł (## )"
          >
            <Heading2 size={15} />
          </button>

          <div className="w-px h-4 bg-stone-800 mx-0.5" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('taskList') ? 'text-emerald-400 bg-emerald-950/40' : ''
            }`}
            title="Checklista (- [ ] )"
          >
            <CheckSquare size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('bulletList') ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Lista punktowana (- )"
          >
            <List size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('orderedList') ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Lista numerowana (1. )"
          >
            <ListOrdered size={15} />
          </button>

          <div className="w-px h-4 bg-stone-800 mx-0.5" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('blockquote') ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Cytat (> )"
          >
            <Quote size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition ${
              editor.isActive('codeBlock') ? 'text-amber-400 bg-amber-950/40' : ''
            }`}
            title="Blok kodu (```)"
          >
            <Code size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded-lg hover:text-stone-100 hover:bg-stone-800/80 transition"
            title="Linia pozioma (---)"
          >
            <Minus size={15} />
          </button>
        </div>
      )}

      {/* Główna zawartość edytora */}
      <EditorContent editor={editor} />
    </div>
  );
}

export const NoteEditor = RichTextEditor;
export default RichTextEditor;
