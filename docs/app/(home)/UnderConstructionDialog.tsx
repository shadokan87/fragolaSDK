"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const STORAGE_KEY = 'fragola-docs-under-construction-dismissed';

export function UnderConstructionDialog() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={true}>
      <DialogContent showCloseButton={false} onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>👋 Welcome! 🚧 Docs under construction</DialogTitle>
          <DialogDescription>
            Hey there! Parts of these docs are still being built, but the
            core features are already documented and ready for you to
            explore.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={(value) => {
              const checked = value === true;
              setDontShowAgain(checked);
              if (typeof window === 'undefined') return;
              if (checked) {
                window.localStorage.setItem(STORAGE_KEY, 'true');
              } else {
                window.localStorage.removeItem(STORAGE_KEY);
              }
            }}
          />
          <label
            htmlFor="dont-show-again"
            className="select-none text-sm text-muted-foreground"
          >
            Don&apos;t tell me again
          </label>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            I understand
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
