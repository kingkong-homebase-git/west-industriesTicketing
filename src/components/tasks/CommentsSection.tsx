"use client";

import { useState, useRef, useEffect } from "react";
import { addComment } from "@/actions/comments";
import { relativeTime, getInitials } from "@/lib/utils";
import * as Avatar from "@radix-ui/react-avatar";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface CommentsSectionProps {
  ticketId: string;
  initialComments: any[];
}

export default function CommentsSection({ ticketId, initialComments }: CommentsSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setIsSubmitting(true);
    try {
      const newComment = await addComment({ ticketId, body: body.trim() });
      setComments((prev) => [
        ...prev,
        { ...newComment, authorName: "You", createdAt: new Date() }, // optimistic display
      ]);
      setBody("");
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
                  {comment.body}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="relative pt-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment..."
          className="w-full bg-surface/20 backdrop-blur-sm border border-border/60 rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 hover:bg-surface/30 focus:bg-surface/30 focus:outline-none focus:border-accent transition-all min-h-[80px] resize-none pr-12"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          className="absolute bottom-4 right-3 w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(59,130,246,0.3)]"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
