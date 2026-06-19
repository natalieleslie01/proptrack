'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeaseStep =
  | 'landsearch' |'rv' |'id-documents' |'form2' |'form5' |'form6' |'pta' |'formal-ta' |'club-forms' |'invoice' |'cleaning' |'handover-form' |'photos' |'meter-readings' |'utilities' |'stamped-ta-cr109' |'tenant-extras';

export type StepStatus = 'pending' | 'in-progress' | 'completed';

export interface LeaseFormData {
  propertyAddress: string;
  rentalAmount: string;
  tenantName: string;
  landlordName: string;
  taSignDate: string;
  moveInDate: string;
  // Step 3 — ID Documents
  tenantPartyType: 'individual' | 'company';
  landlordPartyType: 'individual' | 'company';
  // Step 7 — PTA confirmation
  ptaSignDate: string;
  ptaMoveInDate: string;
  ptaTenantName: string;
  ptaLandlordName: string;
  ptaPropertyAddress: string;
  ptaRentalAmount: string;
  // Step 9 — Club Forms
  clubFormsNotes: string;
  // Step 11 — Cleaning
  cleaningDate: string;
  cleaningNotes: string;
  // Step 12 — Handover Form
  defectNotes: string;
  // Step 14 — Meter Readings
  clpMeterReading: string;
  gasMeterReading: string;
  waterMeterReading: string;
  meterNotes: string;
  // Step 15 — Utilities
  clpNotes: string;
  waterNotes: string;
}

interface UploadedDoc {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  uploaded_at: string;
}

interface StepConfig {
  id: LeaseStep;
  label: string;
  icon: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: 'landsearch', label: 'Landsearch', icon: 'SearchIcon', description: 'Upload the official Land Search document from the Land Registry.' },
  { id: 'rv', label: 'R&V', icon: 'MapPinIcon', description: 'Upload the Rates & Valuation document for the property.' },
  { id: 'id-documents', label: 'ID Documents', icon: 'IdCardIcon', description: 'Collect identity documents from both tenant and landlord.' },
  { id: 'form2', label: 'Form 2', icon: 'FileTextIcon', description: 'EAA Form 2 — Consent to Act. Upload signed copy.' },
  { id: 'form5', label: 'Form 5', icon: 'FileTextIcon', description: 'EAA Form 5 — Property Information Form. Upload signed copy.' },
  { id: 'form6', label: 'Form 6', icon: 'FileTextIcon', description: 'EAA Form 6 — Statement of Particulars of Business. Upload signed copy.' },
  { id: 'pta', label: 'PTA', icon: 'FileSignatureIcon', description: 'Upload the signed Provisional Tenancy Agreement.' },
  { id: 'formal-ta', label: 'Formal TA', icon: 'FilesIcon', description: 'Upload the formal Tenancy Agreement and confirm required clauses.' },
  { id: 'club-forms', label: 'Club Forms', icon: 'ClipboardCheckIcon', description: 'Confirm landlord has signed Discovery Bay club forms.' },
  { id: 'invoice', label: 'Invoice', icon: 'ReceiptIcon', description: 'Confirm invoice sent to both parties covering commission and stamp duty.' },
  { id: 'cleaning', label: 'Cleaning', icon: 'SparklesIcon', description: 'Confirm property has been professionally cleaned before handover.' },
  { id: 'handover-form', label: 'Handover Form', icon: 'ClipboardListIcon', description: 'Upload completed handover form with defect notes.' },
  { id: 'photos', label: 'Photos', icon: 'CameraIcon', description: 'Confirm photos of entire flat taken, including inside all cupboards.' },
  { id: 'meter-readings', label: 'Meter Readings', icon: 'GaugeIcon', description: 'Confirm utility meter readings obtained from building security.' },
  { id: 'utilities', label: 'Utilities Registration', icon: 'BoltIcon', description: 'Confirm utility accounts transferred or set up correctly.' },
  { id: 'stamped-ta-cr109', label: 'Stamped TA & CR109', icon: 'StampIcon', description: 'Upload stamped Tenancy Agreement and CR109 form.' },
  { id: 'tenant-extras', label: 'Tenant Extras', icon: 'GiftIcon', description: 'Confirm completion of tenant onboarding items.' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBadge({ status }: { status: StepStatus }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Icon name="CheckIcon" size={10} />Completed
    </span>
  );
  if (status === 'in-progress') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      <Icon name="ClockIcon" size={10} />In Progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)]">
      Pending
    </span>
  );
}

function UploadSection({
  label,
  docType,
  propertyRef,
  docs,
  uploading,
  onUpload,
  onDownload,
  onDelete,
  accept = 'application/pdf',
  acceptLabel = 'PDF only',
  multiple = false,
}: {
  label: string;
  docType: string;
  propertyRef: string;
  docs: UploadedDoc[];
  uploading: boolean;
  onUpload: (file: File, docType: string) => Promise<void>;
  onDownload: (doc: UploadedDoc) => Promise<void>;
  onDelete: (doc: UploadedDoc, docType: string) => Promise<void>;
  accept?: string;
  acceptLabel?: string;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files) Array.from(files).forEach((file) => onUpload(file, docType));
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      {docs.length === 0 ? (
        <div
          className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-xl p-6 text-center cursor-pointer hover:border-[#1B4F8A] hover:bg-blue-50/30 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="UploadIcon" size={24} className="text-[hsl(215,15%,62%)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Upload {label}</p>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{acceptLabel} · Max 50 MB · Click to browse</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-[hsl(210,20%,97%)] rounded-lg border border-[hsl(214,20%,88%)]">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <Icon name="FileTextIcon" size={14} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)]">{formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-HK')}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onDownload(doc)} className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] transition-colors" title="Download">
                  <Icon name="DownloadIcon" size={13} className="text-[hsl(215,15%,52%)]" />
                </button>
                <button onClick={() => onDelete(doc, docType)} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Delete">
                  <Icon name="TrashIcon" size={13} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 px-4 text-xs border border-dashed border-[hsl(214,20%,88%)] rounded-lg text-[hsl(215,15%,52%)] hover:border-[#1B4F8A] hover:text-[#1B4F8A] transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="PlusIcon" size={12} />
            {uploading ? 'Uploading...' : 'Upload another'}
          </button>
        </div>
      )}
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-[hsl(210,20%,97%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/40'}`}>
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-[hsl(214,20%,78%)] bg-white'}`}>
        {checked && <Icon name="CheckIcon" size={11} className="text-white" />}
      </div>
      <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`text-sm ${checked ? 'text-emerald-800' : 'text-[hsl(215,25%,18%)]'}`}>{label}</span>
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LeaseWorkflowProps {
  propertyRef?: string;
  initialAddress?: string;
  initialRentalAmount?: string;
  initialTenantName?: string;
  initialLandlordName?: string;
}

export default function LeaseWorkflow({
  propertyRef = 'LEASE-NEW',
  initialAddress = '',
  initialRentalAmount = '',
  initialTenantName = '',
  initialLandlordName = '',
}: LeaseWorkflowProps) {
  const [activeStep, setActiveStep] = useState<LeaseStep>('landsearch');
  const [stepStatuses, setStepStatuses] = useState<Record<LeaseStep, StepStatus>>({
    'landsearch': 'in-progress',
    'rv': 'pending',
    'id-documents': 'pending',
    'form2': 'pending',
    'form5': 'pending',
    'form6': 'pending',
    'pta': 'pending',
    'formal-ta': 'pending',
    'club-forms': 'pending',
    'invoice': 'pending',
    'cleaning': 'pending',
    'handover-form': 'pending',
    'photos': 'pending',
    'meter-readings': 'pending',
    'utilities': 'pending',
    'stamped-ta-cr109': 'pending',
    'tenant-extras': 'pending',
  });

  const [formData, setFormData] = useState<LeaseFormData>({
    propertyAddress: initialAddress,
    rentalAmount: initialRentalAmount,
    tenantName: initialTenantName,
    landlordName: initialLandlordName,
    taSignDate: '',
    moveInDate: '',
    tenantPartyType: 'individual',
    landlordPartyType: 'individual',
    ptaSignDate: '',
    ptaMoveInDate: '',
    ptaTenantName: initialTenantName,
    ptaLandlordName: initialLandlordName,
    ptaPropertyAddress: initialAddress,
    ptaRentalAmount: initialRentalAmount,
    clubFormsNotes: '',
    cleaningDate: '',
    cleaningNotes: '',
    defectNotes: '',
    clpMeterReading: '',
    gasMeterReading: '',
    waterMeterReading: '',
    meterNotes: '',
    clpNotes: '',
    waterNotes: '',
  });

  // Checkboxes state
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<Record<string, UploadedDoc[]>>({});

  // Property details edit mode
  const [editingDetails, setEditingDetails] = useState(
    !initialAddress && !initialTenantName && !initialLandlordName
  );

  const updateField = (field: keyof LeaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setCheck = (key: string, value: boolean) => {
    setChecks((prev) => ({ ...prev, [key]: value }));
  };

  const markStepComplete = (step: LeaseStep) => {
    setStepStatuses((prev) => ({ ...prev, [step]: 'completed' }));
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) {
      const nextStep = STEPS[idx + 1].id;
      setStepStatuses((prev) => ({
        ...prev,
        [nextStep]: prev[nextStep] === 'pending' ? 'in-progress' : prev[nextStep],
      }));
    }
  };

  const navigateToStep = (step: LeaseStep) => {
    const stepIdx = STEPS.findIndex((s) => s.id === step);
    const currentIdx = STEPS.findIndex((s) => s.id === activeStep);
    const targetStatus = stepStatuses[step];
    if (targetStatus !== 'pending' || stepIdx <= currentIdx) {
      setActiveStep(step);
    }
  };

  const goNext = (current: LeaseStep) => {
    markStepComplete(current);
    const idx = STEPS.findIndex((s) => s.id === current);
    if (idx < STEPS.length - 1) setActiveStep(STEPS[idx + 1].id);
  };

  // ── Upload helpers ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async (file: File, docType: string) => {
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    if (!isPDF && !isImage) { toast.error('Only PDF or image files accepted'); return; }
    if (file.size > 52428800) { toast.error('File must be under 50 MB'); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `lease-workflow/${propertyRef}/${docType}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: dbData, error: dbError } = await supabase.from('property_documents').insert({
        property_ref: propertyRef,
        document_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
      }).select('id, file_name, file_path, file_size_bytes, uploaded_at').single();
      if (dbError) throw dbError;
      setDocs((prev) => ({ ...prev, [docType]: [...(prev[docType] ?? []), dbData] }));
      toast.success(`${file.name} uploaded successfully`);
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [propertyRef]);

  const handleDownload = useCallback(async (doc: UploadedDoc) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Could not generate download link');
    }
  }, []);

  const handleDelete = useCallback(async (doc: UploadedDoc, docType: string) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    try {
      const supabase = createClient();
      await supabase.storage.from('documents').remove([doc.file_path]);
      await supabase.from('property_documents').delete().eq('id', doc.id);
      setDocs((prev) => ({ ...prev, [docType]: (prev[docType] ?? []).filter((d) => d.id !== doc.id) }));
      toast.success('Document deleted');
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Delete failed');
    }
  }, []);

  // ── Shared UI helpers ──────────────────────────────────────────────────────

  function FieldInput({ label, value, onChange, type = 'text', placeholder = '' }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
        />
      </div>
    );
  }

  function SkipContinueButtons({ step, onConfirm, confirmDisabled = false, confirmLabel = 'Confirm & Continue' }: {
    step: LeaseStep;
    onConfirm?: () => void;
    confirmDisabled?: boolean;
    confirmLabel?: string;
  }) {
    return (
      <div className="flex justify-end gap-3">
        <button
          onClick={() => goNext(step)}
          className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
        >
          Skip & Continue
          <Icon name="ArrowRightIcon" size={14} />
        </button>
        <button
          onClick={onConfirm ?? (() => goNext(step))}
          disabled={confirmDisabled}
          className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="CheckIcon" size={14} />
          {confirmLabel}
        </button>
      </div>
    );
  }

  // ── Step renderers ─────────────────────────────────────────────────────────

  function renderLandsearch() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Land Search Document</p>
            <p className="text-xs text-blue-700 mt-1">Upload the official Land Search document from the Land Registry confirming ownership and encumbrances on the property.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Land Search</h3>
          <UploadSection label="Land Search Document" docType="landsearch" propertyRef={propertyRef} docs={docs['landsearch'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <SkipContinueButtons step="landsearch" />
      </div>
    );
  }

  function renderRV() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Rates & Valuation Document</p>
            <p className="text-xs text-blue-700 mt-1">Upload the Rates & Valuation document for the property.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload R&V Document</h3>
          <UploadSection label="R&V Document" docType="rv" propertyRef={propertyRef} docs={docs['rv'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <SkipContinueButtons step="rv" />
      </div>
    );
  }

  function renderIDDocuments() {
    const tenantIsCompany = formData.tenantPartyType === 'company';
    const landlordIsCompany = formData.landlordPartyType === 'company';

    return (
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Icon name="AlertTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Identity Document Requirements</p>
            <p className="text-xs text-amber-700 mt-1">Individual: HKID of tenant AND landlord. Company: Business Registration (BR), Certificate of Incorporation (CR), and HKID of signatory.</p>
          </div>
        </div>

        {/* Tenant */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
              <Icon name="UserIcon" size={15} className="text-[#1B4F8A]" />
              Tenant Identity Documents
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(215,15%,52%)]">Individual</span>
              <button
                type="button"
                onClick={() => updateField('tenantPartyType', tenantIsCompany ? 'individual' : 'company')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${tenantIsCompany ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,78%)]'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${tenantIsCompany ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-[hsl(215,15%,52%)]">Company</span>
            </div>
          </div>

          {!tenantIsCompany ? (
            <UploadSection label="Tenant HKID" docType="tenant-hkid" propertyRef={propertyRef} docs={docs['tenant-hkid'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Business Registration (BR)</p>
                <UploadSection label="Tenant BR" docType="tenant-br" propertyRef={propertyRef} docs={docs['tenant-br'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Certificate of Incorporation (CR)</p>
                <UploadSection label="Tenant CR" docType="tenant-cr" propertyRef={propertyRef} docs={docs['tenant-cr'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">HKID of Signatory</p>
                <UploadSection label="Tenant Signatory HKID" docType="tenant-signatory-hkid" propertyRef={propertyRef} docs={docs['tenant-signatory-hkid'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
              </div>
            </div>
          )}
        </div>

        {/* Landlord */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
              <Icon name="UserCheckIcon" size={15} className="text-[#1B4F8A]" />
              Landlord Identity Documents
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[hsl(215,15%,52%)]">Individual</span>
              <button
                type="button"
                onClick={() => updateField('landlordPartyType', landlordIsCompany ? 'individual' : 'company')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${landlordIsCompany ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,78%)]'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${landlordIsCompany ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-[hsl(215,15%,52%)]">Company</span>
            </div>
          </div>

          {!landlordIsCompany ? (
            <UploadSection label="Landlord HKID" docType="landlord-hkid" propertyRef={propertyRef} docs={docs['landlord-hkid'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Business Registration (BR)</p>
                <UploadSection label="Landlord BR" docType="landlord-br" propertyRef={propertyRef} docs={docs['landlord-br'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Certificate of Incorporation (CR)</p>
                <UploadSection label="Landlord CR" docType="landlord-cr" propertyRef={propertyRef} docs={docs['landlord-cr'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">HKID of Signatory</p>
                <UploadSection label="Landlord Signatory HKID" docType="landlord-signatory-hkid" propertyRef={propertyRef} docs={docs['landlord-signatory-hkid'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
              </div>
            </div>
          )}
        </div>

        <SkipContinueButtons step="id-documents" />
      </div>
    );
  }

  function renderForm2() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">EAA Form 2 — Consent to Act</p>
            <p className="text-xs text-blue-700 mt-1">Upload the signed copy of EAA Form 2. Confirm that one copy has been provided to the tenant.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed Form 2</h3>
          <UploadSection label="Form 2 (Signed)" docType="form2" propertyRef={propertyRef} docs={docs['form2'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Confirmation</h3>
          <CheckItem label="1 copy provided to tenant" checked={!!checks['form2-copy-tenant']} onChange={(v) => setCheck('form2-copy-tenant', v)} />
        </div>
        <SkipContinueButtons step="form2" />
      </div>
    );
  }

  function renderForm5() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">EAA Form 5 — Property Information Form</p>
            <p className="text-xs text-blue-700 mt-1">Upload the signed copy of EAA Form 5. Confirm that one copy has been provided to the landlord.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed Form 5</h3>
          <UploadSection label="Form 5 (Signed)" docType="form5" propertyRef={propertyRef} docs={docs['form5'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Confirmation</h3>
          <CheckItem label="1 copy provided to landlord" checked={!!checks['form5-copy-landlord']} onChange={(v) => setCheck('form5-copy-landlord', v)} />
        </div>
        <SkipContinueButtons step="form5" />
      </div>
    );
  }

  function renderForm6() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">EAA Form 6 — Statement of Particulars of Business</p>
            <p className="text-xs text-blue-700 mt-1">Upload the signed copy of EAA Form 6. Confirm that one copy has been provided to the tenant.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed Form 6</h3>
          <UploadSection label="Form 6 (Signed)" docType="form6" propertyRef={propertyRef} docs={docs['form6'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Confirmation</h3>
          <CheckItem label="1 copy provided to tenant" checked={!!checks['form6-copy-tenant']} onChange={(v) => setCheck('form6-copy-tenant', v)} />
        </div>
        <SkipContinueButtons step="form6" />
      </div>
    );
  }

  function renderPTA() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Provisional Tenancy Agreement</p>
            <p className="text-xs text-blue-700 mt-1">Upload the signed PTA and confirm the key details below.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed PTA</h3>
          <UploadSection label="Provisional Tenancy Agreement" docType="pta" propertyRef={propertyRef} docs={docs['pta'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="ClipboardCheckIcon" size={15} className="text-[#1B4F8A]" />
            Confirm PTA Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput label="TA Sign Date" value={formData.ptaSignDate} onChange={(v) => updateField('ptaSignDate', v)} type="date" />
            <FieldInput label="Move In Date" value={formData.ptaMoveInDate} onChange={(v) => updateField('ptaMoveInDate', v)} type="date" />
            <FieldInput label="Tenant Name" value={formData.ptaTenantName} onChange={(v) => updateField('ptaTenantName', v)} placeholder="Full name" />
            <FieldInput label="Landlord Name" value={formData.ptaLandlordName} onChange={(v) => updateField('ptaLandlordName', v)} placeholder="Full name" />
            <div className="md:col-span-2">
              <FieldInput label="Property Address" value={formData.ptaPropertyAddress} onChange={(v) => updateField('ptaPropertyAddress', v)} placeholder="Unit, Building, Street, District" />
            </div>
            <FieldInput label="Rental Amount (HKD/month)" value={formData.ptaRentalAmount} onChange={(v) => updateField('ptaRentalAmount', v)} placeholder="e.g. 25000" />
          </div>
        </div>
        <SkipContinueButtons step="pta" />
      </div>
    );
  }

  function renderFormalTA() {
    const clauses = [
      { key: 'ta-pets', label: 'Pets clause included' },
      { key: 'ta-diplomatic', label: 'Diplomatic clause included' },
      { key: 'ta-aircons', label: 'Aircons cleaned confirmed' },
      { key: 'ta-cleaning', label: 'Cleaning throughout confirmed' },
      { key: 'ta-appliances', label: 'All appliances in good working order confirmed' },
    ];
    const allClausesChecked = clauses.every((c) => checks[c.key]);

    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Formal Tenancy Agreement</p>
            <p className="text-xs text-blue-700 mt-1">Upload the formal TA and confirm all required clauses are included before marking complete.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Formal Tenancy Agreement</h3>
          <UploadSection label="Formal Tenancy Agreement" docType="formal-ta" propertyRef={propertyRef} docs={docs['formal-ta'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Required Clauses Checklist</h3>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${allClausesChecked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'}`}>
              {clauses.filter((c) => checks[c.key]).length} / {clauses.length}
            </span>
          </div>
          <div className="space-y-2">
            {clauses.map((c) => (
              <CheckItem key={c.key} label={c.label} checked={!!checks[c.key]} onChange={(v) => setCheck(c.key, v)} />
            ))}
          </div>
        </div>
        <SkipContinueButtons step="formal-ta" />
      </div>
    );
  }

  function renderClubForms() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Discovery Bay Club Forms</p>
            <p className="text-xs text-blue-700 mt-1">Confirm landlord has signed Discovery Bay club forms. Optionally upload a copy.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Confirmation</h3>
          <CheckItem label="Landlord club forms signed and returned" checked={!!checks['club-forms-signed']} onChange={(v) => setCheck('club-forms-signed', v)} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Club Forms (Optional)</h3>
          <UploadSection label="Club Forms" docType="club-forms" propertyRef={propertyRef} docs={docs['club-forms'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
        </div>
        <SkipContinueButtons step="club-forms" />
      </div>
    );
  }

  function renderInvoice() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Invoice — Commission & Stamp Duty</p>
            <p className="text-xs text-blue-700 mt-1">Confirm invoice has been sent to both parties covering commission and stamp duty.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Invoice Sent Confirmation</h3>
          <div className="space-y-2">
            <CheckItem label="Invoice sent to tenant" checked={!!checks['invoice-tenant']} onChange={(v) => setCheck('invoice-tenant', v)} />
            <CheckItem label="Invoice sent to landlord" checked={!!checks['invoice-landlord']} onChange={(v) => setCheck('invoice-landlord', v)} />
          </div>
        </div>
        <SkipContinueButtons step="invoice" />
      </div>
    );
  }

  function renderCleaning() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Professional Cleaning</p>
            <p className="text-xs text-blue-700 mt-1">Confirm the property has been professionally cleaned before handover.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Cleaning Confirmation</h3>
          <CheckItem label="Cleaning completed" checked={!!checks['cleaning-done']} onChange={(v) => setCheck('cleaning-done', v)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <FieldInput label="Cleaning Date (Optional)" value={formData.cleaningDate} onChange={(v) => updateField('cleaningDate', v)} type="date" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Notes (Optional)</label>
            <textarea
              value={formData.cleaningNotes}
              onChange={(e) => updateField('cleaningNotes', e.target.value)}
              rows={3}
              placeholder="Any notes about the cleaning..."
              className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none"
            />
          </div>
        </div>
        <SkipContinueButtons step="cleaning" />
      </div>
    );
  }

  function renderHandoverForm() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Handover Form</p>
            <p className="text-xs text-blue-700 mt-1">Upload the completed handover form listing landlord and tenant point of call details and any noted defects.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Handover Form</h3>
          <UploadSection label="Handover Form" docType="handover-form" propertyRef={propertyRef} docs={docs['handover-form'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Defect Notes</h3>
          <textarea
            value={formData.defectNotes}
            onChange={(e) => updateField('defectNotes', e.target.value)}
            rows={4}
            placeholder="List any defects noted during handover..."
            className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none"
          />
        </div>
        <SkipContinueButtons step="handover-form" />
      </div>
    );
  }

  function renderPhotos() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Property Photos</p>
            <p className="text-xs text-blue-700 mt-1">Confirm photos of the entire flat have been taken, including inside all cupboards.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Photo Confirmation</h3>
          <CheckItem label="Photos completed (entire flat including all cupboards)" checked={!!checks['photos-done']} onChange={(v) => setCheck('photos-done', v)} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Photo Confirmation (Optional)</h3>
          <UploadSection label="Photo Confirmation" docType="photos" propertyRef={propertyRef} docs={docs['photos'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} accept="application/pdf,image/*" acceptLabel="PDF or image" multiple />
        </div>
        <SkipContinueButtons step="photos" />
      </div>
    );
  }

  function renderMeterReadings() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Utility Meter Readings</p>
            <p className="text-xs text-blue-700 mt-1">Confirm utility meter readings obtained from building security.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Meter Readings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldInput label="CLP Meter Reading" value={formData.clpMeterReading} onChange={(v) => updateField('clpMeterReading', v)} placeholder="e.g. 12345" />
            <FieldInput label="Gas Meter Reading" value={formData.gasMeterReading} onChange={(v) => updateField('gasMeterReading', v)} placeholder="e.g. 6789" />
            <FieldInput label="Water Meter Reading" value={formData.waterMeterReading} onChange={(v) => updateField('waterMeterReading', v)} placeholder="e.g. 3456" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Notes</label>
            <textarea
              value={formData.meterNotes}
              onChange={(e) => updateField('meterNotes', e.target.value)}
              rows={3}
              placeholder="Any notes about meter readings..."
              className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none"
            />
          </div>
        </div>
        <SkipContinueButtons step="meter-readings" />
      </div>
    );
  }

  function renderUtilities() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Utilities Registration</p>
            <p className="text-xs text-blue-700 mt-1">Confirm utility accounts have been transferred or set up correctly.</p>
          </div>
        </div>

        {/* CLP */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="BoltIcon" size={15} className="text-amber-500" />
            CLP (Electricity)
          </h3>
          <CheckItem label="CLP registered in Tenant's name (unless otherwise instructed)" checked={!!checks['clp-registered']} onChange={(v) => setCheck('clp-registered', v)} />
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Notes</label>
            <input
              type="text"
              value={formData.clpNotes}
              onChange={(e) => updateField('clpNotes', e.target.value)}
              placeholder="e.g. Registered in landlord's name per instruction"
              className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
            />
          </div>
        </div>

        {/* Gas */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="FlameIcon" size={15} className="text-orange-500" />
            Gas
          </h3>
          <CheckItem label="Gas registered in Landlord's name" checked={!!checks['gas-registered']} onChange={(v) => setCheck('gas-registered', v)} />
        </div>

        {/* Water */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="DropletIcon" size={15} className="text-blue-500" />
            Water
          </h3>
          <CheckItem label="Water registered in Tenant's name (unless otherwise instructed)" checked={!!checks['water-registered']} onChange={(v) => setCheck('water-registered', v)} />
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Notes</label>
            <input
              type="text"
              value={formData.waterNotes}
              onChange={(e) => updateField('waterNotes', e.target.value)}
              placeholder="e.g. Registered in landlord's name per instruction"
              className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
            />
          </div>
        </div>

        <SkipContinueButtons step="utilities" />
      </div>
    );
  }

  function renderStampedTACR109() {
    const distributionChecks = [
      { key: 'stamped-copy-landlord', label: 'Copy sent to landlord' },
      { key: 'stamped-copy-tenant', label: 'Copy sent to tenant' },
      { key: 'stamped-copy-drive', label: 'Copy saved to shared drive' },
    ];

    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Stamped TA & CR109</p>
            <p className="text-xs text-blue-700 mt-1">Upload the stamped Tenancy Agreement and CR109 form, and confirm distribution to all parties.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Stamped Tenancy Agreement</h3>
          <UploadSection label="Stamped TA" docType="stamped-ta" propertyRef={propertyRef} docs={docs['stamped-ta'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload CR109 Form</h3>
          <UploadSection label="CR109 Form" docType="cr109" propertyRef={propertyRef} docs={docs['cr109'] ?? []} uploading={uploading} onUpload={handleUpload} onDownload={handleDownload} onDelete={handleDelete} />
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Distribution Confirmation</h3>
          <div className="space-y-2">
            {distributionChecks.map((c) => (
              <CheckItem key={c.key} label={c.label} checked={!!checks[c.key]} onChange={(v) => setCheck(c.key, v)} />
            ))}
          </div>
        </div>
        <SkipContinueButtons step="stamped-ta-cr109" />
      </div>
    );
  }

  function renderTenantExtras() {
    const extras = [
      { key: 'extras-octopus', label: 'Octopus card application provided' },
      { key: 'extras-responsibilities', label: 'Tenant responsibilities document provided' },
      { key: 'extras-handy-numbers', label: 'Handy numbers list provided' },
    ];
    const allDone = extras.every((e) => checks[e.key]);

    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Tenant Onboarding Extras</p>
            <p className="text-xs text-blue-700 mt-1">Confirm all tenant onboarding items have been completed.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Onboarding Checklist</h3>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${allDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'}`}>
              {extras.filter((e) => checks[e.key]).length} / {extras.length}
            </span>
          </div>
          <div className="space-y-2">
            {extras.map((e) => (
              <CheckItem key={e.key} label={e.label} checked={!!checks[e.key]} onChange={(v) => setCheck(e.key, v)} />
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => markStepComplete('tenant-extras')}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Icon name="CheckCircleIcon" size={14} />
            Complete Lease Workflow
          </button>
        </div>
        {stepStatuses['tenant-extras'] === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Icon name="CheckCircleIcon" size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Lease Workflow Complete 🎉</p>
              <p className="text-xs text-emerald-700 mt-0.5">All steps have been completed for this tenancy transaction.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStepContent() {
    switch (activeStep) {
      case 'landsearch': return renderLandsearch();
      case 'rv': return renderRV();
      case 'id-documents': return renderIDDocuments();
      case 'form2': return renderForm2();
      case 'form5': return renderForm5();
      case 'form6': return renderForm6();
      case 'pta': return renderPTA();
      case 'formal-ta': return renderFormalTA();
      case 'club-forms': return renderClubForms();
      case 'invoice': return renderInvoice();
      case 'cleaning': return renderCleaning();
      case 'handover-form': return renderHandoverForm();
      case 'photos': return renderPhotos();
      case 'meter-readings': return renderMeterReadings();
      case 'utilities': return renderUtilities();
      case 'stamped-ta-cr109': return renderStampedTACR109();
      case 'tenant-extras': return renderTenantExtras();
    }
  }

  const completedCount = Object.values(stepStatuses).filter((s) => s === 'completed').length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  const hasDetails = formData.propertyAddress || formData.tenantName || formData.landlordName;

  return (
    <div className="space-y-5">
      {/* Property Details Banner */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
        {editingDetails ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
                <Icon name="BuildingIcon" size={15} className="text-[#1B4F8A]" />
                Lease Details
              </h3>
              {hasDetails && (
                <button onClick={() => setEditingDetails(false)} className="text-xs text-[hsl(215,15%,52%)] hover:text-[#1B4F8A] flex items-center gap-1">
                  <Icon name="XIcon" size={12} />Cancel
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2 lg:col-span-3">
                <FieldInput label="Property Address" value={formData.propertyAddress} onChange={(v) => updateField('propertyAddress', v)} placeholder="Unit, Building, Street, District" />
              </div>
              <FieldInput label="Rental Amount (HKD/month)" value={formData.rentalAmount} onChange={(v) => updateField('rentalAmount', v)} placeholder="e.g. 25000" />
              <FieldInput label="Tenant Name" value={formData.tenantName} onChange={(v) => updateField('tenantName', v)} placeholder="Full name" />
              <FieldInput label="Landlord Name" value={formData.landlordName} onChange={(v) => updateField('landlordName', v)} placeholder="Full name" />
              <FieldInput label="TA Sign Date" value={formData.taSignDate} onChange={(v) => updateField('taSignDate', v)} type="date" />
              <FieldInput label="Move In Date" value={formData.moveInDate} onChange={(v) => updateField('moveInDate', v)} type="date" />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setEditingDetails(false)}
                className="px-5 py-2 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] transition-colors flex items-center gap-2"
              >
                <Icon name="CheckIcon" size={14} />
                Save Details
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Lease Details</h3>
              <button onClick={() => setEditingDetails(true)} className="text-xs text-[#1B4F8A] hover:underline flex items-center gap-1">
                <Icon name="PencilIcon" size={11} />Edit
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Property', value: formData.propertyAddress || '—' },
                { label: 'Rental (HKD/mo)', value: formData.rentalAmount ? `HK$${Number(formData.rentalAmount).toLocaleString()}` : '—' },
                { label: 'Tenant', value: formData.tenantName || '—' },
                { label: 'Landlord', value: formData.landlordName || '—' },
                { label: 'TA Sign Date', value: formData.taSignDate || '—' },
                { label: 'Move In Date', value: formData.moveInDate || '—' },
              ].map((item) => (
                <div key={item.label} className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">{item.label}</p>
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate" title={item.value}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Workflow layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar stepper */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 sticky top-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Progress</span>
                <span className="text-xs font-bold text-[hsl(215,25%,18%)]">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-[hsl(210,15%,94%)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1B4F8A] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-[hsl(215,15%,52%)] mt-1">{completedCount} of {STEPS.length} steps complete</p>
            </div>

            <div className="space-y-1">
              {STEPS.map((step, idx) => {
                const status = stepStatuses[step.id];
                const isActive = activeStep === step.id;
                const isClickable = status !== 'pending';

                return (
                  <button
                    key={step.id}
                    onClick={() => navigateToStep(step.id)}
                    disabled={!isClickable}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-[#1B4F8A]/10 border border-[#1B4F8A]/20'
                        : isClickable
                        ? 'hover:bg-[hsl(210,15%,94%)]'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                      status === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? 'bg-[#1B4F8A] text-white'
                        : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'
                    }`}>
                      {status === 'completed' ? <Icon name="CheckIcon" size={12} /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-[#1B4F8A]' : 'text-[hsl(215,25%,18%)]'}`}>
                        {step.label}
                      </p>
                      <StepBadge status={status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Step header */}
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">
                    Step {STEPS.findIndex((s) => s.id === activeStep) + 1} of {STEPS.length}
                  </span>
                  <StepBadge status={stepStatuses[activeStep]} />
                </div>
                <h2 className="text-lg font-bold text-[hsl(215,25%,18%)]">
                  {STEPS.find((s) => s.id === activeStep)?.label}
                </h2>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                  {STEPS.find((s) => s.id === activeStep)?.description}
                </p>
              </div>
              <Icon
                name={(STEPS.find((s) => s.id === activeStep)?.icon ?? 'FileTextIcon') as Parameters<typeof Icon>[0]['name']}
                size={28}
                className="text-[hsl(214,20%,88%)] flex-shrink-0"
              />
            </div>
          </div>

          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
