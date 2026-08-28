/**
 * Narzędzie do migracji i transformacji notatek do standardu TipTap Document AST (JSON) oraz HTML.
 * Obsługuje formaty archiwalne (oddzielny text/content + lista items/list)
 * oraz nowoczesny format dokumentowy TipTap.
 */

import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

const tipTapExtensions = [
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
];

export function isTipTapDoc(content) {
  return (
    content &&
    typeof content === 'object' &&
    content.type === 'doc' &&
    Array.isArray(content.content)
  );
}

/**
 * Konwertuje starą strukturę notatki do formatu TipTap JSON (Document AST).
 * @param {Object|string} oldNote - Obiekt notatki lub treść tekstowa
 * @returns {Object} TipTap Document JSON { type: 'doc', content: [...] }
 */
export function migrateNoteToTipTapFormat(oldNote) {
  if (!oldNote) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  // Jeśli przekazano bezpośrednio dokument TipTap
  if (isTipTapDoc(oldNote)) {
    return oldNote;
  }

  // Jeśli w obiekcie notatki pole `content` jest już dokumentem TipTap
  if (isTipTapDoc(oldNote.content)) {
    return oldNote.content;
  }

  // Jeśli w obiekcie notatki pole `contentJson` jest dokumentem TipTap
  if (isTipTapDoc(oldNote.contentJson)) {
    return oldNote.contentJson;
  }

  const nodes = [];

  // 1. Obsługa treści tekstowej (z pól `text`, `content` lub `body`)
  const rawText =
    typeof oldNote === 'string'
      ? oldNote
      : typeof oldNote.text === 'string'
      ? oldNote.text
      : typeof oldNote.content === 'string'
      ? oldNote.content
      : typeof oldNote.body === 'string'
      ? oldNote.body
      : '';

  if (rawText.trim()) {
    // Dzielimy linie tekstu na akapity
    const lines = rawText.split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        nodes.push({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: line,
            },
          ],
        });
      } else {
        nodes.push({
          type: 'paragraph',
        });
      }
    });
  }

  // 2. Obsługa listy zadań (z pól `items` lub `list`)
  const rawItems = Array.isArray(oldNote.items)
    ? oldNote.items
    : Array.isArray(oldNote.list)
    ? oldNote.list
    : [];

  if (rawItems.length > 0) {
    const taskItems = rawItems
      .filter((item) => item && (item.text || item.title))
      .map((item) => {
        const itemText = String(item.text || item.title || '');
        const isChecked = Boolean(item.done ?? item.isCompleted ?? item.checked ?? false);

        return {
          type: 'taskItem',
          attrs: {
            checked: isChecked,
          },
          content: [
            {
              type: 'paragraph',
              content: itemText
                ? [
                    {
                      type: 'text',
                      text: itemText,
                    },
                  ]
                : [],
            },
          ],
        };
      });

    if (taskItems.length > 0) {
      nodes.push({
        type: 'taskList',
        content: taskItems,
      });
    }
  }

  // Domyślny pusty akapit jeśli brak zawartości
  if (nodes.length === 0) {
    nodes.push({
      type: 'paragraph',
    });
  }

  return {
    type: 'doc',
    content: nodes,
  };
}

/**
 * Konwertuje obiekt TipTap AST (lub dawną notatkę) na bezpieczny kod HTML.
 */
export function renderTipTapToHtml(docOrNote) {
  try {
    const doc = migrateNoteToTipTapFormat(docOrNote);
    return generateHTML(doc, tipTapExtensions);
  } catch (err) {
    console.error('Błąd generowania HTML z TipTap AST:', err);
    return extractTextSummaryFromDoc(migrateNoteToTipTapFormat(docOrNote));
  }
}

/**
 * Normalizuje cały obiekt notatki w stanie aplikacji (np. po pobraniu z Supabase).
 * Gwarantuje, że notatka posiada poprawne pole `content` w formacie TipTap JSON.
 */
export function normalizeNoteRecord(note) {
  if (!note) return null;
  const doc = migrateNoteToTipTapFormat(note);
  return {
    ...note,
    content: doc,
    textSummary: extractTextSummaryFromDoc(doc),
  };
}

/**
 * Rekursywnie wyciąga czysty tekst z dokumentu TipTap do podglądu, powiadomień lub wyszukiwania.
 */
export function extractTextSummaryFromDoc(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (!doc.content || !Array.isArray(doc.content)) return '';

  const extract = (node) => {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'taskItem') {
      const isChecked = node.attrs?.checked ? '✓ ' : '• ';
      const text = (node.content || []).map(extract).join(' ');
      return `${isChecked}${text}`;
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extract).join(' ');
    }
    return '';
  };

  return doc.content.map(extract).filter(Boolean).join('\n');
}

/**
 * Wyciąga listę zadań z dokumentu TipTap (do odhaczania na kafelkach lub konwersji).
 */
export function extractTasksFromDoc(doc) {
  if (!isTipTapDoc(doc)) return [];
  const tasks = [];

  const traverse = (node, indexRef = { current: 0 }) => {
    if (!node) return;
    if (node.type === 'taskItem') {
      const checked = Boolean(node.attrs?.checked);
      const text = (node.content || [])
        .map((p) => (p.content || []).map((t) => t.text || '').join(''))
        .join(' ')
        .trim();
      tasks.push({
        index: indexRef.current++,
        checked,
        text,
      });
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child) => traverse(child, indexRef));
    }
  };

  traverse(doc);
  return tasks;
}

/**
 * Przełącza stan zaznaczenia (checked) danego taskItem w dokumencie TipTap AST.
 */
export function toggleTaskItemInDoc(doc, targetIndex) {
  if (!isTipTapDoc(doc)) return doc;

  const newDoc = JSON.parse(JSON.stringify(doc));
  let currentIndex = 0;

  const traverse = (node) => {
    if (!node) return false;
    if (node.type === 'taskItem') {
      if (currentIndex === targetIndex) {
        if (!node.attrs) node.attrs = {};
        node.attrs.checked = !node.attrs.checked;
        return true;
      }
      currentIndex++;
    }
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        if (traverse(child)) return true;
      }
    }
    return false;
  };

  traverse(newDoc);
  return newDoc;
}
