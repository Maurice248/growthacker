"use client";

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ImageIcon, PenTool } from 'lucide-react';

interface ImagePromptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (prompt: string) => void;
  loading: boolean;
}

export default function ImagePromptModal({ isOpen, onOpenChange, onSubmit, loading }: ImagePromptModalProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(prompt);
    setPrompt("");
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sd-modal-overlay" />
        <Dialog.Content className="sd-modal-content" style={{ maxWidth: 440 }}>
          <div className="sd-modal-header">
            <div className="sd-modal-title-row">
              <div className="sd-modal-icon-bg" style={{ background: '#e0f2fe' }}>
                <ImageIcon size={20} color="#003049" />
              </div>
              <div>
                <Dialog.Title className="sd-modal-title">Generate Social Images</Dialog.Title>
                <Dialog.Description className="sd-modal-desc">
                  Enter an image generation prompt to scale for your active social channels.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="sd-modal-close-btn" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="sd-modal-form">
            <div className="sd-form-field sd-full-width">
              <label className="sd-form-label"><PenTool size={13} /> Image Prompt</label>
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Modern dental clinic interior, professional lighting, warm atmosphere..."
                className="sd-form-textarea"
                required
              />
            </div>

            <div className="sd-modal-footer">
              <Dialog.Close asChild>
                <button type="button" className="sd-modal-btn-cancel">Cancel</button>
              </Dialog.Close>
              <button 
                type="submit" 
                className="sd-modal-btn-submit"
                style={{ background: '#003049' }}
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate Images"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
