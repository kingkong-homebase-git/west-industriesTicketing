/**
 * Builds the Notion page body for a ticket: description, checklist, comments.
 *
 * Markdown handling on description is intentionally minimal — we split on blank
 * lines and emit paragraph blocks. The prompt explicitly accepts this scope cut
 * for v1; full markdown-to-Notion fidelity is not the goal here. Notion is a
 * read-projection for description; round-trip authoring lives in the dashboard.
 */

// Sentinel that opens our auto-managed region. Everything from this marker
// downward is owned by the sync and replaced on every push; anything a human
// writes ABOVE it is never touched. The leading phrase is what we match on when
// listing existing page children, so it must stay stable.
export const MANAGED_MARKER_PREFIX = "Synced from West Industries";
const MANAGED_MARKER_TEXT =
  `${MANAGED_MARKER_PREFIX} — everything below this line is auto-managed and ` +
  `will be overwritten on each sync. Add your own notes above it.`;

function managedMarkerBlock() {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: richText(MANAGED_MARKER_TEXT),
      icon: { type: "emoji", emoji: "⚙️" },
    },
  };
}

/**
 * True if a Notion child block (as returned by blocks.children.list) is our
 * managed-section marker. Tolerant of shape: only reads what it needs.
 */
export function isManagedMarkerBlock(block: unknown): boolean {
  if (typeof block !== "object" || block === null) return false;
  const b = block as { type?: string; callout?: { rich_text?: unknown } };
  if (b.type !== "callout" || !b.callout) return false;
  const rt = b.callout.rich_text;
  if (!Array.isArray(rt)) return false;
  const text = rt
    .map((seg) =>
      typeof seg === "object" && seg !== null
        ? ((seg as { plain_text?: string }).plain_text ??
          (seg as { text?: { content?: string } }).text?.content ??
          "")
        : ""
    )
    .join("");
  return text.startsWith(MANAGED_MARKER_PREFIX);
}

export type ChecklistInput = { label: string; isDone: boolean };
export type CommentInput = {
  body: string;
  createdAt: Date;
  authorName: string;
};

// Notion's per-rich-text-segment limit is 2000 chars. We chunk long strings so
// we never reject a paragraph for length.
const MAX_RICH_TEXT_LEN = 2000;

function richText(content: string): Array<{
  type: "text";
  text: { content: string };
}> {
  if (content.length <= MAX_RICH_TEXT_LEN) {
    return [{ type: "text", text: { content } }];
  }
  const chunks: Array<{ type: "text"; text: { content: string } }> = [];
  for (let i = 0; i < content.length; i += MAX_RICH_TEXT_LEN) {
    chunks.push({
      type: "text",
      text: { content: content.slice(i, i + MAX_RICH_TEXT_LEN) },
    });
  }
  return chunks;
}

function paragraphBlock(text: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(text) },
  };
}

function heading2Block(text: string) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: richText(text) },
  };
}

function todoBlock(text: string, checked: boolean) {
  return {
    object: "block",
    type: "to_do",
    to_do: { rich_text: richText(text), checked },
  };
}

export function buildPageBlocks(input: {
  description: string | null;
  checklist: ChecklistInput[];
  comments: CommentInput[];
}): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [managedMarkerBlock()];

  if (input.description && input.description.trim()) {
    const paragraphs = input.description.split(/\n{2,}/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed) blocks.push(paragraphBlock(trimmed));
    }
  }

  if (input.checklist.length > 0) {
    blocks.push(heading2Block("Checklist"));
    for (const item of input.checklist) {
      blocks.push(todoBlock(item.label, item.isDone));
    }
  }

  if (input.comments.length > 0) {
    blocks.push(heading2Block("Comments"));
    for (const c of input.comments) {
      const stamp = c.createdAt.toISOString();
      blocks.push(paragraphBlock(`${c.authorName} (${stamp}): ${c.body}`));
    }
  }

  return blocks;
}
