"use client";

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Wand2, Music, Mic2, Monitor, MessageSquare, Tag, User, Sparkles } from 'lucide-react';
import { Spinner } from './components';
import VoiceExplorerModal from './VoiceExplorerModal';

interface GeneratorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: typeof initialFormData) => void;
  loading: boolean;
}

const VOICE_OPTIONS = {
  male: [
    { id: "KLoLpdGWK7agg0O2TJYg", label: "Charlie - Men" },
    { id: "eqz5FuihuZwmJPuvZ65E", label: "Jess - Men" }
  ],
  female: [
    { id: "wrxvN1LZJIfL3HHvffqe", label: "Bella - Lady" },
    { id: "odyUrTN5HMVKujvVAgWW", label: "Emily - Lady" },
    { id: "aD6riP1btT197c6dACmy", label: "Rachel - Lady" },
    { id: "KClAuq9Hs0wFY7oJmaGN", label: "Maayan - Lady" }
  ]
};

const initialFormData = {
  character: "male",
  category: "Hair Transplant",
  description: "",
  videoStyle: "Highly Realistic 4k, real life",
  language: "English",
  voice: "KLoLpdGWK7agg0O2TJYg",
  backgroundSong: "Inspirational - Sunrise Bloom"
};

export default function GeneratorModal({ isOpen, onOpenChange, onSubmit, loading }: GeneratorModalProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [voiceLabel, setVoiceLabel] = useState<string>("Charlie - Men");

  React.useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
      setVoiceLabel("Charlie - Men");
      setIsVoiceModalOpen(false);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sd-modal-overlay" />
        <Dialog.Content className="sd-modal-content">
          <div className="sd-modal-header">
            <div className="sd-modal-title-row">
              <div className="sd-modal-icon-bg">
                <Wand2 size={20} color="#003049" />
              </div>
              <div>
                <Dialog.Title className="sd-modal-title">Video AI Generation</Dialog.Title>
                <Dialog.Description className="sd-modal-desc">
                  Configure your story and style preferences.
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
            <div className="sd-form-grid">
              
              {/* Category */}
              <div className="sd-form-field">
                <label className="sd-form-label"><Tag size={13} /> Category</label>
                <input 
                  type="text"
                  name="category" 
                  value={formData.category} 
                  onChange={handleChange}
                  className="sd-form-select"
                  placeholder="e.g. Hair Transplant"
                />
              </div>

              {/* Video Style */}
              <div className="sd-form-field">
                <label className="sd-form-label"><Monitor size={13} /> Video Style</label>
                <select 
                  name="videoStyle" 
                  value={formData.videoStyle} 
                  onChange={handleChange}
                  className="sd-form-select"
                >
                  <option value="Highly Realistic 4k, real life">Highly Realistic 4k, real life</option>
                  <option value="Cinematic Drone - Smooth">Cinematic Drone - Smooth</option>
                  <option value="Studio Professional - Clean">Studio Professional - Clean</option>
                </select>
              </div>

              {/* Character */}
              <div className="sd-form-field">
                <label className="sd-form-label"><User size={13} /> Character</label>
                <select 
                  name="character" 
                  value={formData.character || "male"} 
                  onChange={(e) => {
                    const newChar = e.target.value as 'male' | 'female';
                    const firstVoice = VOICE_OPTIONS[newChar][0].id;
                    setFormData(prev => ({ 
                      ...prev, 
                      character: newChar, 
                      voice: firstVoice 
                    }));
                  }}
                  className="sd-form-select"
                >
                  <option value="male">👨 Male</option>
                  <option value="female">👩 Female</option>
                </select>
              </div>

              {/* Voice */}
              <div className="sd-form-field">
                <label className="sd-form-label"><Mic2 size={13} /> Voice</label>
                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(true)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid #C2B79A',
                    borderRadius: '8px',
                    background: '#FDF6E3',
                    color: '#003049',
                    outline: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#003049'; e.currentTarget.style.background = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#C2B79A'; e.currentTarget.style.background = '#FDF6E3'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} color="#003049" />
                    {voiceLabel}
                  </span>
                  <span style={{ fontSize: '10px', color: '#8C8474', fontWeight: 700, textTransform: 'uppercase', background: '#E8DCC2', padding: '2px 6px', borderRadius: '4px' }}>
                    Explore
                  </span>
                </button>
              </div>

              {/* Language */}
              <div className="sd-form-field">
                <label className="sd-form-label">Language</label>
                <select 
                  name="language" 
                  value={formData.language} 
                  onChange={handleChange}
                  className="sd-form-select"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                </select>
              </div>

              {/* Background Song */}
              <div className="sd-form-field">
                <label className="sd-form-label"><Music size={13} /> Background Song</label>
                <select 
                  name="backgroundSong" 
                  value={formData.backgroundSong} 
                  onChange={handleChange}
                  className="sd-form-select"
                >
                  <option value="Inspirational - Sunrise Bloom">Inspirational - Sunrise Bloom</option>
                  <option value="Upbeat - Corporate Drive">Upbeat - Corporate Drive</option>
                  <option value="Lo-fi - Midnight Study">Lo-fi - Midnight Study</option>
                  <option value="Cinematic - Epic Journey">Cinematic - Epic Journey</option>
                  <option value="Ambient - Calm Waters">Ambient - Calm Waters</option>
                </select>
              </div>

              {/* Story Description */}
              <div className="sd-form-field sd-full-width">
                <label className="sd-form-label"><MessageSquare size={13} /> Story Description</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange}
                  placeholder="Tell your patient story or describe the blog post content..."
                  className="sd-form-textarea"
                  required
                />
              </div>

            </div>

            <div className="sd-modal-footer">
              <Dialog.Close asChild>
                <button type="button" className="sd-modal-btn-cancel">Cancel</button>
              </Dialog.Close>
              <button 
                type="submit" 
                className="sd-modal-btn-submit"
                disabled={loading}
              >
                {loading ? <><Spinner size={14} color="white" /> Generating...</> : "Generate Video"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>

      <VoiceExplorerModal 
        isOpen={isVoiceModalOpen}
        onOpenChange={setIsVoiceModalOpen}
        selectedVoiceId={formData.voice}
        onSelectVoice={(id, label) => {
          setFormData(prev => ({ ...prev, voice: id }));
          setVoiceLabel(label);
          setIsVoiceModalOpen(false);
        }}
      />

    </Dialog.Root>
  );
}
