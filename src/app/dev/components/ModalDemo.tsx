"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

export function ModalDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Example modal">
        <p className="text-muted">
          Press Esc or the Close button to dismiss. Focus stays inside while it
          is open.
        </p>
      </Modal>
    </>
  );
}
