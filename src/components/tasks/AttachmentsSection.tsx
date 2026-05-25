"use client";

import { useEffect, useRef, useState } from "react";
import {
  addLinkAttachment,
  uploadAttachment,
  deleteAttachment,
} from "@/actions/attachments";
import { formatBytes, relativeTime } from "@/lib/utils";
import { FileText, Link2, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  id: string;
  kind: "link" | "file";
  url: string | null;
  filename: string;
  mimeType: string | null;
  size: number | null;
  createdAt: Date | string;
  uploadedById: string | null;
  uploadedByName?: string | null;
}

interface AttachmentsSectionProps {
  ticketId: string;
  initialAttachments: Attachment[];
  canEdit: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;

export default function AttachmentsSection({
  ticketId,
  initialAttachments,
  canEdit,
}: AttachmentsSectionProps) {
  const [items, setItems] = useState<Attachment[]>(initialAttachments);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(initialAttachments);
  }, [initialAttachments]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isBusy) return;
    setIsBusy(true);
    try {
      const res = await addLinkAttachment({
        ticketId,
        url: url.trim(),
        label: label.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems((prev) => [...prev, res.attachment]);
      setUrl("");
      setLabel("");
      setShowLinkInput(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add link");
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("File is too large (max 10MB).");
      return;
    }
    if (file.type.startsWith("image/")) {
      toast.error("Images aren't supported yet — attach documents only.");
      return;
    }

    setIsBusy(true);
    try {
      const fd = new FormData();
      fd.append("ticketId", ticketId);
      fd.append("file", file);
      const res = await uploadAttachment(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems((prev) => [...prev, res.attachment]);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = items;
    setItems((curr) => curr.filter((a) => a.id !== id));
    try {
      await deleteAttachment(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove attachment");
      setItems(prev); // rollback
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Paperclip size={14} />
          Attachments
        </h3>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowLinkInput((v) => !v)}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-2 transition-colors"
            >
              <Plus size={12} /> Link
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              <Upload size={12} /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {canEdit && showLinkInput && (
        <form onSubmit={handleAddLink} className="space-y-2">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-surface/20 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:bg-surface/30 focus:outline-none focus:border-accent transition-all"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="flex-1 bg-surface/20 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:bg-surface/30 focus:outline-none focus:border-accent transition-all"
            />
            <button
              type="submit"
              disabled={!url.trim() || isBusy}
              className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-text-secondary italic py-2">
          No attachments yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="group flex items-center gap-3 bg-surface/20 backdrop-blur-sm border border-border/40 rounded-xl px-3 py-2"
            >
              <span className="shrink-0 text-text-secondary">
                {a.kind === "link" ? (
                  <Link2 size={16} />
                ) : (
                  <FileText size={16} />
                )}
              </span>
              <a
                href={
                  a.kind === "link" && a.url
                    ? a.url
                    : `/api/attachments/${a.id}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <span className="block text-sm text-text-primary truncate hover:text-accent transition-colors">
                  {a.filename}
                </span>
                <span className="block text-[10px] text-text-secondary">
                  {a.kind === "file" && a.size ? `${formatBytes(a.size)} · ` : ""}
                  {a.uploadedByName ? `${a.uploadedByName} · ` : ""}
                  {relativeTime(a.createdAt)}
                </span>
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="shrink-0 p-1 rounded text-text-secondary opacity-0 group-hover:opacity-100 hover:text-danger transition-all"
                  aria-label="Remove attachment"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
