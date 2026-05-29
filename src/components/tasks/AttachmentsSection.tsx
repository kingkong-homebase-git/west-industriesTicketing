"use client";

import { useEffect, useRef, useState } from "react";
import {
  addLinkAttachment,
  uploadAttachment,
  deleteAttachment,
} from "@/actions/attachments";
import { formatBytes, relativeTime } from "@/lib/utils";
import { FileText, Link2, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";

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

const CLIENT_MAX_BYTES = 100 * 1024 * 1024; // 100MB (server will reject if limit is lower)

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
  const [activeImage, setActiveImage] = useState<Attachment | null>(null);
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

    if (file.size > CLIENT_MAX_BYTES) {
      toast.error("File is too large (max 100MB).");
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

  const images = items.filter(
    (a) => a.kind === "file" && a.mimeType?.startsWith("image/")
  );
  const filesAndLinks = items.filter(
    (a) => a.kind === "link" || !a.mimeType?.startsWith("image/")
  );

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
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <Plus size={12} /> Link
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Upload size={12} /> Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
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
              className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Images Section */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-text-secondary/60 uppercase tracking-wider">Images</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((a) => (
              <div
                key={a.id}
                onClick={() => setActiveImage(a)}
                className="group relative aspect-[4/3] rounded-xl border border-border/40 bg-surface/10 backdrop-blur-sm overflow-hidden cursor-pointer hover:border-accent/40 transition-all duration-300"
              >
                <img
                  src={`/api/attachments/${a.id}`}
                  alt={a.filename}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2.5">
                  <div className="flex justify-end">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(a.id);
                        }}
                        className="p-1.5 rounded-lg bg-black/50 hover:bg-danger/80 text-white/80 hover:text-white transition-all cursor-pointer"
                        aria-label="Remove image"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-white truncate">
                      {a.filename}
                    </span>
                    <span className="block text-[9px] text-white/60 truncate">
                      {a.size ? formatBytes(a.size) : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files & Links Section */}
      {filesAndLinks.length > 0 && (
        <div className="space-y-2">
          {images.length > 0 && (
            <div className="text-[10px] font-bold text-text-secondary/60 uppercase tracking-wider pt-2">Files & Links</div>
          )}
          <ul className="space-y-2">
            {filesAndLinks.map((a) => (
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
                    className="shrink-0 p-1 rounded text-text-secondary opacity-0 group-hover:opacity-100 hover:text-danger transition-all cursor-pointer"
                    aria-label="Remove attachment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-text-secondary italic py-2">
          No attachments yet.
        </p>
      )}

      {/* Lightbox Dialog */}
      <Dialog.Root open={!!activeImage} onOpenChange={(open) => { if (!open) setActiveImage(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 transition-opacity duration-300" />
          <Dialog.Content className="fixed inset-4 md:inset-10 z-50 flex flex-col items-center justify-center focus:outline-none">
            <div className="relative max-w-full max-h-full flex flex-col items-center">
              {activeImage && (
                <>
                  <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    <a
                      href={`/api/attachments/${activeImage.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm cursor-pointer"
                      title="Download"
                    >
                      <Upload size={18} className="rotate-180" />
                    </a>
                    <Dialog.Close className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm cursor-pointer">
                      <X size={18} />
                    </Dialog.Close>
                  </div>

                  <img
                    src={`/api/attachments/${activeImage.id}`}
                    alt={activeImage.filename}
                    className="max-w-[90vw] max-h-[80vh] md:max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10 select-none animate-in zoom-in-95 duration-200"
                  />

                  <div className="mt-4 text-center px-4 py-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/5 max-w-md">
                    <p className="text-sm font-semibold text-white truncate">
                      {activeImage.filename}
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      {activeImage.size ? `${formatBytes(activeImage.size)} · ` : ""}
                      {activeImage.uploadedByName ? `${activeImage.uploadedByName} · ` : ""}
                      {relativeTime(activeImage.createdAt)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

