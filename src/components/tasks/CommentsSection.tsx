"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { addComment } from "@/actions/comments";
import { relativeTime, getInitials } from "@/lib/utils";
import * as Avatar from "@radix-ui/react-avatar";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface MentionUser {
  id: string;
  name: string;
  email?: string;
}

interface CommentsSectionProps {
  ticketId: string;
  initialComments: any[];
  users?: MentionUser[];
}

// Highlight @firstname tokens in a comment body.
function renderBody(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-accent font-medium">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function CommentsSection({
  ticketId,
  initialComments,
  users = [],
}: CommentsSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mention, setMention] = useState<{ anchor: number; query: string } | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCount = useRef(initialComments.length);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    if (comments.length > prevCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCount.current = comments.length;
  }, [comments]);

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return users
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, users]);

  const detectMention = (value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at < 0) return setMention(null);
    const before = at === 0 ? " " : upToCaret[at - 1];
    const token = upToCaret.slice(at + 1);
    if (/^\w*$/.test(token) && /\s/.test(before)) {
      setMention({ anchor: at, query: token });
    } else {
      setMention(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);
    detectMention(value, e.target.selectionStart ?? value.length);
  };

  const pickMention = (user: MentionUser) => {
    if (!mention) return;
    const first = user.name.split(" ")[0];
    const newBody =
      body.slice(0, mention.anchor) +
      "@" +
      first +
      " " +
      body.slice(mention.anchor + 1 + mention.query.length);
    setBody(newBody);
    setMentionedIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
    setMention(null);
    textareaRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    // Keep only mentions whose token is still present in the text.
    const finalMentions = mentionedIds.filter((id) => {
      const u = users.find((x) => x.id === id);
      return u && body.includes("@" + u.name.split(" ")[0]);
    });

    setIsSubmitting(true);
    try {
      const newComment = await addComment({
        ticketId,
        body: body.trim(),
        mentionedUserIds: finalMentions,
      });
      setComments((prev) => [
        ...prev,
        { ...newComment, authorName: "You", createdAt: new Date() },
      ]);
      setBody("");
      setMentionedIds([]);
      setMention(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <h3 className="text-sm font-semibold text-text-primary">Comments</h3>

      <div className="flex-1 space-y-4 pr-2 kanban-col-scroll">
        {comments.length === 0 ? (
          <p className="text-sm text-text-secondary italic text-center py-4">
            No comments yet.
          </p>
        ) : (
          comments.map((comment, i) => (
            <div key={comment.id || i} className="flex gap-3">
              <Avatar.Root className="w-8 h-8 rounded-full bg-surface/30 border border-border flex items-center justify-center shrink-0">
                <Avatar.Fallback className="text-xs font-semibold text-text-secondary">
                  {getInitials(comment.authorName || "?")}
                </Avatar.Fallback>
              </Avatar.Root>
              <div className="flex-1 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    {comment.authorName || "Unknown"}
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    {relativeTime(comment.createdAt)}
                  </span>
                </div>
                <div className="text-sm text-text-secondary whitespace-pre-wrap break-words bg-surface/20 backdrop-blur-sm p-3 rounded-xl border border-border/40">
                  {renderBody(comment.body)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="relative pt-2">
        {/* @mention dropdown */}
        {mention && matches.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto bg-surface/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl z-[70] p-1">
            {matches.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => pickMention(u)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-accent/15 transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[10px] font-semibold text-text-secondary shrink-0">
                  {getInitials(u.name)}
                </span>
                <span className="text-sm text-text-primary truncate">{u.name}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          placeholder="Write a comment… use @ to mention"
          className="w-full bg-surface/20 backdrop-blur-sm border border-border/60 rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 hover:bg-surface/30 focus:bg-surface/30 focus:outline-none focus:border-accent transition-all min-h-[80px] resize-none pr-12"
          onKeyDown={(e) => {
            if (mention && matches.length > 0 && e.key === "Enter") {
              e.preventDefault();
              pickMention(matches[0]);
              return;
            }
            if (mention && e.key === "Escape") {
              setMention(null);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          className="absolute bottom-4 right-3 w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(249,115,22,0.3)]"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
