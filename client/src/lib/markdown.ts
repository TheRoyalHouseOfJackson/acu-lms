// Minimal, safe-ish markdown -> HTML. Escapes HTML first, then applies basic formatting.
// Sufficient for lesson text content authored by trusted admins.
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderMarkdown(md: string): string {
  if (!md) return "";
  let text = escapeHtml(md);

  // code blocks
  text = text.replace(/```([\s\S]*?)```/g, (_m, c) => `<pre class="bg-muted rounded-md p-3 overflow-x-auto text-sm"><code>${c.trim()}</code></pre>`);
  // headings
  text = text.replace(/^######\s?(.*)$/gm, '<h6 class="font-semibold mt-4">$1</h6>');
  text = text.replace(/^#####\s?(.*)$/gm, '<h5 class="font-semibold mt-4">$1</h5>');
  text = text.replace(/^####\s?(.*)$/gm, '<h4 class="font-serif text-lg mt-5">$1</h4>');
  text = text.replace(/^###\s?(.*)$/gm, '<h3 class="font-serif text-xl mt-6">$1</h3>');
  text = text.replace(/^##\s?(.*)$/gm, '<h2 class="font-serif text-2xl mt-8">$1</h2>');
  text = text.replace(/^#\s?(.*)$/gm, '<h1 class="font-serif text-3xl mt-8">$1</h1>');
  // blockquote
  text = text.replace(/^&gt;\s?(.*)$/gm, '<blockquote class="border-l-4 border-accent pl-4 italic my-3">$1</blockquote>');
  // bold / italic
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // links
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>');
  // unordered lists
  text = text.replace(/(?:^|\n)((?:[-*] .*(?:\n|$))+)/g, (_m, block) => {
    const items = block.trim().split("\n").map((l: string) => `<li>${l.replace(/^[-*]\s?/, "")}</li>`).join("");
    return `\n<ul class="list-disc pl-6 my-3 space-y-1">${items}</ul>`;
  });
  // ordered lists
  text = text.replace(/(?:^|\n)((?:\d+\. .*(?:\n|$))+)/g, (_m, block) => {
    const items = block.trim().split("\n").map((l: string) => `<li>${l.replace(/^\d+\.\s?/, "")}</li>`).join("");
    return `\n<ol class="list-decimal pl-6 my-3 space-y-1">${items}</ol>`;
  });
  // paragraphs (lines not already wrapped)
  text = text
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (/^<(h\d|ul|ol|pre|blockquote|li)/.test(t)) return t;
      return `<p class="my-3 leading-relaxed">${t.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return text;
}
