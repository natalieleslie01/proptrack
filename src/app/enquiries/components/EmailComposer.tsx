'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface EmailComposerProps {
  visitorName: string;
  visitorEmail: string;
  propertyRef?: string | null;
  propertyAddress?: string | null;
  onEmailSent?: () => void;
}

interface Template {
  id: string;
  label: string;
  subject: string;
  body: (name: string, property: string) => string;
}

const TEMPLATES: Template[] = [
  {
    id: 'acknowledgement',
    label: 'Acknowledgement',
    subject: 'Thank You for Your Enquiry – Homes R Us',
    body: (name, property) =>
      `Dear ${name},\n\nThank you for your enquiry${property ? ` regarding ${property}` : ''}. We have received your message and one of our agents will be in touch with you shortly.\n\nIn the meantime, please feel free to browse our latest listings at homesrus.hk.\n\nWarm regards,\nHomes R Us Team`,
  },
  {
    id: 'viewing',
    label: 'Schedule Viewing',
    subject: `Let's Arrange a Viewing – Homes R Us`,
    body: (name, property) =>
      `Dear ${name},\n\nThank you for your interest${property ? ` in ${property}` : ''}. We would love to arrange a viewing at your convenience.\n\nPlease let us know your preferred dates and times and we will confirm the appointment as soon as possible.\n\nLooking forward to hearing from you.\n\nWarm regards,\nHomes R Us Team`,
  },
  {
    id: 'more-info',
    label: 'More Information',
    subject: 'Further Details on Your Enquiry – Homes R Us',
    body: (name, property) =>
      `Dear ${name},\n\nThank you for reaching out to us${property ? ` about ${property}` : ''}. We are happy to provide you with more information.\n\nCould you please let us know what specific details you are looking for? We will do our best to assist you promptly.\n\nWarm regards,\nHomes R Us Team`,
  },
  {
    id: 'follow-up',
    label: 'Follow-up',
    subject: 'Following Up on Your Enquiry – Homes R Us',
    body: (name, property) =>
      `Dear ${name},\n\nWe wanted to follow up on your recent enquiry${property ? ` regarding ${property}` : ''}. We hope you are still interested and would love to assist you further.\n\nPlease do not hesitate to get in touch if you have any questions or would like to arrange a viewing.\n\nWarm regards,\nHomes R Us Team`,
  },
  {
    id: 'price-update',
    label: 'Price Update',
    subject: 'Price Update – Homes R Us',
    body: (name, property) =>
      `Dear ${name},\n\nWe wanted to reach out regarding your enquiry${property ? ` on ${property}` : ''}. We have a price update that may be of interest to you.\n\nPlease reply to this email or call us directly to discuss the latest details.\n\nWarm regards,\nHomes R Us Team`,
  },
];

type SendState = 'idle' | 'sending' | 'success' | 'error';

export default function EmailComposer({
  visitorName,
  visitorEmail,
  propertyRef,
  propertyAddress,
  onEmailSent,
}: EmailComposerProps) {
  const propertyLabel = propertyAddress ?? propertyRef ?? '';

  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('acknowledgement');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplate(templateId);
    setSubject(tpl.subject);
    setBody(tpl.body(visitorName, propertyLabel));
  };

  const handleOpen = () => {
    if (!isOpen) {
      applyTemplate('acknowledgement');
    }
    setIsOpen((v) => !v);
    setSendState('idle');
    setErrorMsg('');
  };

  const handleTemplateChange = (id: string) => {
    applyTemplate(id);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSendState('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: visitorEmail,
          subject: subject.trim(),
          body: body.trim(),
          fromName: 'Homes R Us',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Failed to send email');
      }
      setSendState('success');
      onEmailSent?.();
      setTimeout(() => {
        setIsOpen(false);
        setSendState('idle');
      }, 2000);
    } catch (err: any) {
      setSendState('error');
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="border-t border-[hsl(214,20%,88%)] pt-4">
      {/* Toggle button */}
      <button
        onClick={handleOpen}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#7a1625] transition-colors"
      >
        <Icon name="SendIcon" size={14} />
        {isOpen ? 'Close Composer' : 'Compose Reply Email'}
      </button>

      {/* Composer panel */}
      {isOpen && (
        <div className="mt-4 space-y-3">
          {/* To field */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1 uppercase tracking-wide">To</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(210,15%,97%)] border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)]">
              <Icon name="MailIcon" size={13} className="text-[hsl(215,15%,52%)] flex-shrink-0" />
              <span className="font-medium">{visitorName}</span>
              <span className="text-[hsl(215,15%,52%)]">·</span>
              <span className="text-[hsl(215,15%,52%)] truncate">{visitorEmail}</span>
            </div>
          </div>

          {/* Template selector */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5 uppercase tracking-wide">Quick Template</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleTemplateChange(tpl.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                    selectedTemplate === tpl.id
                      ? 'bg-[#8B1A2B] text-white border-[#8B1A2B]'
                      : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#8B1A2B] hover:text-[#8B1A2B]'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1 uppercase tracking-wide">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B]"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1 uppercase tracking-wide">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write your message…"
              className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] resize-none leading-relaxed"
            />
          </div>

          {/* Error message */}
          {sendState === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <Icon name="AlertCircleIcon" size={13} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sendState === 'sending' || sendState === 'success' || !subject.trim() || !body.trim()}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
              sendState === 'success' ?'bg-green-600 text-white' :'bg-[#8B1A2B] text-white hover:bg-[#7a1625]'
            }`}
          >
            {sendState === 'sending' ? (
              <>
                <Icon name="LoaderIcon" size={14} className="animate-spin" />
                Sending…
              </>
            ) : sendState === 'success' ? (
              <>
                <Icon name="CheckCircleIcon" size={14} />
                Email Sent!
              </>
            ) : (
              <>
                <Icon name="SendIcon" size={14} />
                Send Email
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
