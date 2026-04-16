"use client";

import { useState } from "react";
import { FeedbackForm } from "@/components/feedback-form";

export function FeedbackFooter() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      <span>A problem or an idea?</span>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        Report a bug
      </button>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
        Suggest a feature
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Send Feedback</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <FeedbackForm onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
