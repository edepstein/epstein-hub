"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog> element: focus is contained by the
 * browser's modal behaviour, Escape closes, and focus returns to the opener.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onNativeClose = () => {
      const o = opener.current;
      // Restore focus to the opener synchronously, and only if focus has not already moved
      // somewhere deliberate (a deferred restore could steal focus from a fast keyboard user).
      const active = document.activeElement;
      const focusLost = !active || active === document.body || d.contains(active);
      if (o && o.isConnected && typeof o.focus === "function" && focusLost) o.focus();
      onClose();
    };
    d.addEventListener("close", onNativeClose);
    return () => d.removeEventListener("close", onNativeClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="wc-dialog"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {open ? (
        <section className="modal">
          <h2 id={titleId}>{title}</h2>
          {children}
          <div className="modal-actions" style={{ marginTop: 18 }}>
            {actions}
            <button type="button" className={actions ? "btn secondary" : "btn"} onClick={() => ref.current?.close()}>
              {closeLabel}
            </button>
          </div>
        </section>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
  onClose(): void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      closeLabel="Cancel"
      actions={
        <button
          type="button"
          className="btn"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      }
    >
      <div style={{ lineHeight: 1.6 }}>{body}</div>
    </Dialog>
  );
}
