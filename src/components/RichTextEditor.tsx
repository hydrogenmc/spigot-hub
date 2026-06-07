import { useEffect, useRef } from "react";
import { Bold, Italic, Underline as UnderlineIcon, List, Eraser } from "lucide-react";

/**
 * Minimal rich-text editor using contentEditable + document.execCommand.
 * Stores HTML; render with sanitizeHtml() on read.
 */
export function RichTextEditor({
  value,
  onChange,
  rows = 6,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value into the DOM only when it diverges (avoids caret jumps while typing).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Paste as plain text so we don't import arbitrary styles from other sites.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const Btn = ({ cmd, icon: Icon, label }: { cmd: string; icon: typeof Bold; label: string }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep selection
      onClick={() => exec(cmd)}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon size={13} />
    </button>
  );

  return (
    <div className="rounded-lg ring-1 ring-border/60 focus-within:ring-primary">
      <div className="flex items-center gap-0.5 border-b border-border/50 bg-secondary/30 px-2 py-1">
        <Btn cmd="bold" icon={Bold} label="Bold (Ctrl+B)" />
        <Btn cmd="italic" icon={Italic} label="Italic (Ctrl+I)" />
        <Btn cmd="underline" icon={UnderlineIcon} label="Underline (Ctrl+U)" />
        <Btn cmd="insertUnorderedList" icon={List} label="Bulleted list" />
        <div className="mx-1 h-4 w-px bg-border/60" />
        <Btn cmd="removeFormat" icon={Eraser} label="Clear formatting" />
        <span className="ml-auto text-[10px] text-muted-foreground">Select text, then click Bold</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onPaste={onPaste}
        data-placeholder={placeholder}
        style={{ minHeight: `${rows * 1.5}rem` }}
        className="prose-rt w-full whitespace-pre-wrap break-words bg-input/60 px-3 py-2 text-sm text-foreground outline-none [&[data-placeholder]:empty]:before:text-muted-foreground [&[data-placeholder]:empty]:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

/**
 * Sanitize HTML to a small whitelist of inline-formatting tags.
 * Strips scripts, event handlers, styles, and any other tags/attributes.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // SSR fallback: strip every tag except a tiny whitelist.
    return html.replace(/<(?!\/?(b|strong|i|em|u|br|p|ul|ol|li|div)\b)[^>]*>/gi, "");
  }
  const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "BR", "P", "UL", "OL", "LI", "DIV", "SPAN"]);
  const template = document.createElement("template");
  template.innerHTML = html;
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) {
        const el = child as Element;
        if (!allowedTags.has(el.tagName)) {
          // Replace disallowed element with its children
          while (el.firstChild) el.parentNode!.insertBefore(el.firstChild, el);
          el.remove();
          continue;
        }
        // Strip all attributes (no styles, no event handlers, no href on these tags).
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
        walk(el);
      } else if (child.nodeType !== 3) {
        // Drop comments / processing instructions
        child.parentNode?.removeChild(child);
      }
    }
  };
  walk(template.content);
  return template.innerHTML;
}
