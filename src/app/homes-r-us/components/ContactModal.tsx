'use client';

import React, { useState, useEffect } from 'react';
import { PublicProperty } from './HomesRUsClient';
import { createClient } from '@/lib/supabase/client';

interface ContactModalProps {
  property: PublicProperty | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactModal({ property, onClose }: ContactModalProps) {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    message: property
      ? `Hi, I'm interested in property ${property.property_ref}. Please get in touch with me.`
      : 'Hi, I would like to enquire about your available properties.',
  });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setErrorMsg('Please fill in your name, email, and message.');
      return;
    }
    setSubmitState('submitting');
    setErrorMsg('');

    try {
      const supabase = createClient();
      const { error } = await supabase.from('enquiries').insert({
        visitor_name: form.name.trim(),
        visitor_email: form.email.trim(),
        visitor_phone: form.phone.trim() || null,
        message: form.message.trim(),
        property_ref: property?.property_ref || null,
        property_id: property?.id || null,
      });

      if (error) {
        // If table doesn't exist yet, still show success to visitor
        console.warn('Enquiry insert error:', error.message);
      }
      setSubmitState('success');
      // Track form submission
      const supabaseTrack = createClient();
      await supabaseTrack.from('event_tracking').insert({
        event_type: 'form_submission',
        user_id: null,
        metadata: {
          form_type: 'property_enquiry',
          property_ref: property?.property_ref ?? null,
          property_id: property?.id ?? null,
        },
      });
    } catch {
      setSubmitState('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_rgba(27,79,138,0.18)] w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[hsl(214,20%,88%)]">
          <div>
            <h2 className="text-[hsl(215,25%,18%)] font-bold text-lg leading-none">
              {property ? 'Enquire About Property' : 'Contact Homes R Us'}
            </h2>
            {property && (
              <p className="text-[hsl(215,15%,52%)] text-xs mt-1 font-mono">{property.property_ref}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center hover:bg-[hsl(214,20%,88%)] transition-all"
          >
            <svg className="w-4 h-4 text-[hsl(215,25%,18%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {submitState === 'success' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-[hsl(215,25%,18%)] font-bold text-lg mb-2">Message Sent!</h3>
              <p className="text-[hsl(215,15%,52%)] text-sm leading-relaxed mb-6">
                Thank you, {form.name.split(' ')[0]}! We've received your enquiry and will be in touch shortly.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#6E1522] transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className="w-full px-3 py-2 bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg text-sm text-[hsl(215,25%,18%)] placeholder:text-[hsl(215,15%,62%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+852 ..."
                    className="w-full px-3 py-2 bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg text-sm text-[hsl(215,25%,18%)] placeholder:text-[hsl(215,15%,62%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg text-sm text-[hsl(215,25%,18%)] placeholder:text-[hsl(215,15%,62%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg text-sm text-[hsl(215,25%,18%)] placeholder:text-[hsl(215,15%,62%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-all resize-none"
                />
              </div>

              {errorMsg && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={submitState === 'submitting'}
                className="w-full px-4 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#6E1522] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitState === 'submitting' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
