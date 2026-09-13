export function MarkdownPreview({ content }: { content: string }) {
  return <div className="k-markdown-preview" data-testid="notes-markdown-preview">
    {content.split('\n').map((line, index) => {
      if (!line.trim()) return <div className="h-3" key={`space-${index}`} />;
      if (line.startsWith('### ')) return <h4 key={index}>{line.slice(4)}</h4>;
      if (line.startsWith('## ')) return <h3 key={index}>{line.slice(3)}</h3>;
      if (line.startsWith('# ')) return <h2 key={index}>{line.slice(2)}</h2>;
      if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>;
      if (line.startsWith('> ')) return <blockquote key={index}>{line.slice(2)}</blockquote>;
      if (line.startsWith('`') && line.endsWith('`')) return <pre key={index}><code>{line.slice(1, -1)}</code></pre>;
      return <p key={index}>{line}</p>;
    })}
  </div>;
}
