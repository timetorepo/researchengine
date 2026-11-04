"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Bold, Italic, Underline, Link, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Local adaptation (documented in scripts/shadcnspace-sources.json):
 *
 * Upstream is a single demo: the toolbar and its contentEditable are welded
 * together, so it cannot be dropped into an editor that owns its own surface.
 * The commands and the selection-state reader are now exported, and the toolbar
 * is a component that takes `active` and `onCommand`; `Pattern` below still
 * renders the upstream demo, using exactly those pieces.
 * ------------------------------------------------------------------------- */

export type EditorCommandId = "bold" | "italic" | "underline" | "link" | "ordered" | "bullet";

export interface EditorSelectionState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link: boolean;
  ordered: boolean;
  bullet: boolean;
}

const NO_SELECTION: EditorSelectionState = {
  bold: false, italic: false, underline: false, link: false, ordered: false, bullet: false,
};

/** Reads what the caret is currently inside, for highlighting the buttons. */
export function readEditorState(): EditorSelectionState {
  if (typeof window === "undefined") return { ...NO_SELECTION };
  try {
    return {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      link: !!document.getSelection()?.anchorNode?.parentElement?.closest("a"),
      ordered: document.queryCommandState("insertOrderedList"),
      bullet: document.queryCommandState("insertUnorderedList"),
    };
  } catch {
    return { ...NO_SELECTION };
  }
}

/**
 * Runs one formatting command on the current selection. Deprecated browser API
 * on purpose: it is still the only thing every browser implements for an
 * editable region, and this is the block upstream ships.
 */
export function runEditorCommand(commandId: EditorCommandId | string, linkHref = ""): void {
  if (typeof window === "undefined") return;
  if (commandId === "link") {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === "") return;
    document.execCommand("createLink", false, linkHref || "#");
    return;
  }
  if (commandId === "ordered") return void document.execCommand("insertOrderedList");
  if (commandId === "bullet") return void document.execCommand("insertUnorderedList");
  document.execCommand(String(commandId));
}

export interface EditorToolbarProps {
  active?: Partial<EditorSelectionState>;
  onCommand: (id: EditorCommandId) => void;
  className?: string;
}

export function EditorToolbar({ active = {}, onCommand, className }: EditorToolbarProps) {
  const buttons: { id: EditorCommandId; icon: React.ComponentType<any>; label: string }[] = [
    { id: "bold", icon: Bold, label: "Bold" },
    { id: "italic", icon: Italic, label: "Italic" },
    { id: "underline", icon: Underline, label: "Underline" },
    { id: "link", icon: Link, label: "Link" },
    { id: "ordered", icon: ListOrdered, label: "Ordered List" },
    { id: "bullet", icon: List, label: "Bulleted List" },
  ];
  return (
    <ButtonGroup className={cn("w-full justify-start", className)}>
      {buttons.map(({ id, icon: Icon, label }) => {
        const isActive = !!active[id];
        return (
          <Button
            key={id}
            type="button"
            size="icon"
            variant="outline"
            onMouseDown={(e) => { e.preventDefault(); onCommand(id) }}
            className={cn(
              "h-8 w-8 bg-background border-border relative transition-all duration-200 cursor-pointer select-none",
              isActive && "bg-muted text-foreground border-border font-bold z-10",
            )}
            aria-label={label}
            aria-pressed={isActive}
          >
            <Icon className={cn("size-3.5 transition-transform duration-200", isActive && "scale-110")} />
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

export default function Pattern() {
  const [active, setActive] = useState<EditorSelectionState>({ ...NO_SELECTION });

  const checkSelectionState = () => setActive(readEditorState());

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href) {
        window.open(href, "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-md bg-background border border-border rounded-xl p-3 shadow-xs">
      <EditorToolbar active={active} onCommand={(id) => { runEditorCommand(id); checkSelectionState() }} />

      <div
        contentEditable
        suppressContentEditableWarning
        onInput={checkSelectionState}
        onKeyUp={checkSelectionState}
        onMouseUp={checkSelectionState}
        onSelect={checkSelectionState}
        onClick={handleContentClick}
        className="w-full bg-transparent border border-border rounded-lg bg-muted/20 min-h-24 p-3 focus:outline-hidden text-sm text-foreground leading-relaxed focus-visible:ring-1 focus-visible:ring-ring [&_a]:text-blue-500 [&_a]:underline [&_a]:cursor-pointer! [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        style={{ outline: 'none' }}
      >
        Select any text in this box and click the formatting buttons above to apply styles!
      </div>
    </div>
  );
}
