import { renderTipTapToHtml, isTipTapDoc } from '../../utils/noteMigration.js';

export function RichContentView({ content, className = '' }) {
  if (!content) return null;

  // 1. Jeśli to obiekt AST TipTap
  if (isTipTapDoc(content) || (typeof content === 'object' && content !== null)) {
    const html = renderTipTapToHtml(content);
    return (
      <div
        className={`prose prose-invert prose-stone max-w-none text-sm text-stone-200 leading-snug prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_blockquote]:border-amber-500/60 [&_blockquote]:bg-stone-900/40 [&_blockquote]:py-1 [&_blockquote]:px-3 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:pl-0 [&_li[data-type="taskItem"]]:flex [&_li[data-type="taskItem"]]:items-start [&_li[data-type="taskItem"]]:gap-2 [&_input[type="checkbox"]]:mt-0.5 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // 2. Jeśli to string zawierający znaczniki HTML
  if (typeof content === 'string' && /<[a-z][\s\S]*>/i.test(content)) {
    return (
      <div
        className={`prose prose-invert prose-stone max-w-none text-sm text-stone-200 leading-snug prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_blockquote]:border-amber-500/60 [&_blockquote]:bg-stone-900/40 [&_blockquote]:py-1 [&_blockquote]:px-3 [&_blockquote]:rounded-r-lg [&_blockquote]:italic [&_ul[data-type="taskList"]]:list-none [&_ul[data-type="taskList"]]:pl-0 [&_li[data-type="taskItem"]]:flex [&_li[data-type="taskItem"]]:items-start [&_li[data-type="taskItem"]]:gap-2 [&_input[type="checkbox"]]:mt-0.5 ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // 3. Zwykły tekst płaski
  return (
    <div className={`whitespace-pre-wrap text-sm text-stone-300 ${className}`}>
      {String(content)}
    </div>
  );
}

export default RichContentView;
