"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Main action(s), shown right of Close in one footer row. */
  actions?: ReactNode;
};

/** Native <dialog>: focus trap, Esc and top-layer come from the browser. */
export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Guards keep this safe when Strict Mode runs the effect twice.
    if (open && !dialog.open) {
      // showModal() focuses the first [autofocus] descendant. React's autoFocus
      // prop never writes that attribute on the client, so set it here.
      dialog.querySelector("[data-modal-close]")?.setAttribute("autofocus", "");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Esc fires "cancel", then "close"; "close" covers both paths.
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-lg border border-border bg-surface p-0 text-ink shadow-modal backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div>{children}</div>
        <div
          className={
            actions
              ? "flex flex-wrap justify-end gap-3 *:grow sm:*:grow-0"
              : "flex justify-end"
          }
        >
          <Button variant="secondary" onClick={onClose} data-modal-close="">
            Close
          </Button>
          {actions}
        </div>
      </div>
    </dialog>
  );
}
