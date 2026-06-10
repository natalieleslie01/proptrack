'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { agentProfiles } from '@/app/property-management/components/mockData';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { generateForm3PDF, Form3Data } from '@/lib/generateForm3';
import InvoiceGenerator from '@/app/property-management/components/InvoiceGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SalesStep =
  | 'landsearch' |'rv' |'id-uploads' |'sale-details' |'form1' |'form3-4' |'pasp' |'stamp-duty' |'pre-completion' |'invoice' |'management-office';

export type StepStatus = 'pending' | 'in-progress' | 'completed';

export interface SalesFormData {
  // Property
  propertyAddress: string;
  salePrice: string;
  completionDate: string;
  // Vendor
  vendorName: string;
  vendorIdNumber: string;
  vendorAddress: string;
  vendorPhone: string;
  vendorEmail: string;
  // Purchaser
  purchaserName: string;
  purchaserIdNumber: string;
  purchaserAddress: string;
  purchaserPhone: string;
  purchaserEmail: string;
  // Agent
  selectedAgentIndex: number;
  // Deposit (5%)
  depositAmount: string;
  depositMethod: 'cash' | 'transfer' | 'cheque' | '';
  // Agency
  agencyType: 'exclusive' | 'non-exclusive';
  // Co-op
  isCoOp: boolean;
  // Company vendor
  isCompanyVendor: boolean;
  companyBRNumber: string;
  // Company purchaser
  isCompanyPurchaser: boolean;
  purchaserCompanyBRNumber: string;
  // Solicitors
  vendorSolicitor: string;
  vendorSolicitorPhone: string;
  vendorSolicitorEmail: string;
  purchaserSolicitor: string;
  purchaserSolicitorPhone: string;
  purchaserSolicitorEmail: string;
  // R&V bulk addresses
  rvBulkAddresses: string;
  // Meter readings
  waterMeterNumber: string;
  waterMeterReading: string;
  clpMeterNumber: string;
  clpMeterReading: string;
  gasMeterNumber: string;
  gasMeterReading: string;
}

interface UploadedDoc {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  uploaded_at: string;
}

interface StepConfig {
  id: SalesStep;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: 'landsearch', label: 'Landsearch', shortLabel: 'Land', icon: 'SearchIcon', description: 'Upload Land Search document for the property' },
  { id: 'rv', label: 'R&V', shortLabel: 'R&V', icon: 'MapPinIcon', description: 'Upload R&V document — bulk address import available' },
  { id: 'id-uploads', label: 'ID Documents', shortLabel: 'IDs', icon: 'IdCardIcon', description: 'Upload HKID / Passport for vendor and purchaser; Company BR & CR if applicable' },
  { id: 'sale-details', label: 'Sale Details', shortLabel: 'Details', icon: 'ClipboardListIcon', description: 'Enter property, vendor, purchaser, solicitor and agent details' },
  { id: 'form1', label: 'Form 1', shortLabel: 'Form 1', icon: 'FileTextIcon', description: 'Property Information Form — required before sale' },
  { id: 'form3-4', label: 'Form 3 & 4', shortLabel: 'F3 & F4', icon: 'FilesIcon', description: 'Estate Agency Agreements for Sale — bypass if co-op' },
  { id: 'pasp', label: 'PASP', shortLabel: 'PASP', icon: 'FileSignatureIcon', description: 'Provisional Agreement for Sale & Purchase with 5% deposit' },
  { id: 'stamp-duty', label: 'Stamp Duty', shortLabel: 'Stamp', icon: 'ExternalLinkIcon', description: 'Submit stamp duty via IRD government portal (30-day deadline)' },
  { id: 'pre-completion', label: 'Pre-Completion', shortLabel: 'Pre-Comp', icon: 'ClipboardCheckIcon', description: 'Final inspection, meter readings and DBRC debenture transfer (1 week before completion)' },
  { id: 'invoice', label: 'Invoice & Receipt', shortLabel: 'Invoice', icon: 'ReceiptIcon', description: 'Generate commission invoice or receipt' },
  { id: 'management-office', label: 'Management Office', shortLabel: 'Mgmt', icon: 'BuildingIcon', description: 'Arrange purchaser visit to management office for Octopus card form and details update' },
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
  onDelete: (doc: UploadedDoc) => Promise<void>;
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
          if (files) {
            Array.from(files).forEach((file) => onUpload(file, docType));
          }
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
                <button onClick={() => onDelete(doc)} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Delete">
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface SalesWorkflowProps {
  propertyRef?: string;
  initialAddress?: string;
  initialSalePrice?: string;
  initialVendorName?: string;
  initialPurchaserName?: string;
}

export default function SalesWorkflow({
  propertyRef = 'SALE-NEW',
  initialAddress = '',
  initialSalePrice = '',
  initialVendorName = '',
  initialPurchaserName = '',
}: SalesWorkflowProps) {
  const [activeStep, setActiveStep] = useState<SalesStep>('landsearch');
  const [stepStatuses, setStepStatuses] = useState<Record<SalesStep, StepStatus>>({
    'landsearch': 'in-progress',
    'rv': 'pending',
    'id-uploads': 'pending',
    'sale-details': 'pending',
    'form1': 'pending',
    'form3-4': 'pending',
    'pasp': 'pending',
    'stamp-duty': 'pending',
    'pre-completion': 'pending',
    'invoice': 'pending',
    'management-office': 'pending',
  });

  const [formData, setFormData] = useState<SalesFormData>({
    propertyAddress: initialAddress,
    salePrice: initialSalePrice,
    completionDate: '',
    vendorName: initialVendorName,
    vendorIdNumber: '',
    vendorAddress: '',
    vendorPhone: '',
    vendorEmail: '',
    purchaserName: initialPurchaserName,
    purchaserIdNumber: '',
    purchaserAddress: '',
    purchaserPhone: '',
    purchaserEmail: '',
    selectedAgentIndex: 0,
    depositAmount: '',
    depositMethod: '',
    agencyType: 'non-exclusive',
    isCoOp: false,
    isCompanyVendor: false,
    companyBRNumber: '',
    isCompanyPurchaser: false,
    purchaserCompanyBRNumber: '',
    vendorSolicitor: '',
    vendorSolicitorPhone: '',
    vendorSolicitorEmail: '',
    purchaserSolicitor: '',
    purchaserSolicitorPhone: '',
    purchaserSolicitorEmail: '',
    rvBulkAddresses: '',
    waterMeterNumber: '',
    waterMeterReading: '',
    clpMeterNumber: '',
    clpMeterReading: '',
    gasMeterNumber: '',
    gasMeterReading: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SalesFormData, string>>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<Record<string, UploadedDoc[]>>({});
  const [mgmtChecked, setMgmtChecked] = useState<Record<string, boolean>>({});
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [dbrcVendorSigned, setDbrcVendorSigned] = useState(false);
  const [dbrcPurchaserSigned, setDbrcPurchaserSigned] = useState(false);
  const [finalInspectionDone, setFinalInspectionDone] = useState(false);
  const [advertisingDate, setAdvertisingDate] = useState('');
  const [savingAdvertisingDate, setSavingAdvertisingDate] = useState(false);

  const MGMT_ITEMS = [
    'Purchaser accompanied to management office',
    'Octopus card form submitted',
    'Purchaser details updated with management',
    'Resident sticker / access card issued',
    'Car park registration updated (if applicable)',
    'Emergency contact details updated',
  ];

  const updateField = (field: keyof SalesFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof SalesFormData]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field as keyof SalesFormData]; return next; });
    }
  };

  const markStepComplete = (step: SalesStep) => {
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

  const sendWorkflowNotification = async (
    event: 'lease-signed' | 'stamp-duty-filed' | 'key-handover-scheduled' | 'invoice-ready',
    extra?: { completionDate?: string; invoiceAmount?: string }
  ) => {
    const agent = agentProfiles[formData.selectedAgentIndex];
    try {
      await fetch('/api/send-workflow-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowType: 'sales',
          event,
          propertyAddress: formData.propertyAddress,
          propertyRef,
          vendorName: formData.vendorName || undefined,
          vendorEmail: formData.vendorEmail || undefined,
          purchaserName: formData.purchaserName || undefined,
          purchaserEmail: formData.purchaserEmail || undefined,
          agentName: agent?.name || undefined,
          agentPhone: agent?.mobile || undefined,
          agentEmail: agent?.email || undefined,
          completionDate: formData.completionDate || undefined,
          ...extra,
        }),
      });
    } catch {
      // Silent — notification failure should not block workflow
    }
  };

  const navigateToStep = (step: SalesStep) => {
    const stepIdx = STEPS.findIndex((s) => s.id === step);
    const currentIdx = STEPS.findIndex((s) => s.id === activeStep);
    const targetStatus = stepStatuses[step];
    if (targetStatus !== 'pending' || stepIdx <= currentIdx) {
      setActiveStep(step);
    }
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
      const filePath = `sales-workflow/${propertyRef}/${docType}/${Date.now()}_${safeName}`;
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
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
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
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed');
    }
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateSaleDetails(): Partial<Record<keyof SalesFormData, string>> {
    const errors: Partial<Record<keyof SalesFormData, string>> = {};
    if (!formData.propertyAddress.trim()) errors.propertyAddress = 'Property address is required';
    if (!formData.salePrice.trim()) errors.salePrice = 'Sale price is required';
    else if (isNaN(Number(formData.salePrice)) || Number(formData.salePrice) <= 0) errors.salePrice = 'Sale price must be a positive number';
    if (!formData.vendorName.trim()) errors.vendorName = 'Vendor name is required';
    if (!formData.purchaserName.trim()) errors.purchaserName = 'Purchaser name is required';
    return errors;
  }

  // ── Form 3 generator ───────────────────────────────────────────────────────

  const selectedAgent = agentProfiles[formData.selectedAgentIndex] ?? agentProfiles[0];

  const buildForm3Data = (): Form3Data => ({
    vendorName: formData.vendorName,
    vendorIdNumber: formData.vendorIdNumber,
    vendorAddress: formData.vendorAddress,
    vendorPhone: formData.vendorPhone,
    agentName: selectedAgent.name,
    agentLicenceNumber: selectedAgent.licenceNumber,
    agentAddress: 'Room 527 Block D, DB Plaza, Discovery Bay',
    agentPhone: selectedAgent.mobile,
    propertyAddress: formData.propertyAddress,
    agencyType: formData.agencyType,
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: formData.completionDate || '',
    agencyRelationship: 'single',
    listPriceWords: '',
    listPriceHKD: formData.salePrice,
    commissionType: 'rate',
    commissionValue: '1%',
    commissionPayment: 'completion',
    allowViewingByAgent: true,
    allowViewingByPurchaser: true,
    passKeysToAgent: true,
    authorizePassKeysToOthers: false,
    authorizeSubListing: false,
    authorizeAdvertising: true,
    agentHasInterest: false,
    receivedPropertyInfoForm: true,
  });

  // ── Render helpers ─────────────────────────────────────────────────────────

  function InputField({ label, value, onChange, type = 'text', placeholder = '', required = false, errorKey }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; errorKey?: keyof SalesFormData;
  }) {
    const error = errorKey ? fieldErrors[errorKey] : undefined;
    return (
      <div>
        <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 transition-colors ${
            error
              ? 'border-red-400 focus:ring-red-200 focus:border-red-500' :'border-[hsl(214,20%,88%)] focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]'
          }`}
        />
        {error && (
          <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
            <Icon name="AlertCircleIcon" size={11} />
            {error}
          </p>
        )}
      </div>
    );
  }

  function PaymentMethodSelector({ label, value, onChange, errorKey }: {
    label: string;
    value: 'cash' | 'transfer' | 'cheque' | '';
    onChange: (v: 'cash' | 'transfer' | 'cheque') => void;
    errorKey?: keyof SalesFormData;
  }) {
    const error = errorKey ? fieldErrors[errorKey] : undefined;
    return (
      <div>
        <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">{label}</label>
        <div className="flex gap-2">
          {(['cash', 'transfer', 'cheque'] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => { onChange(method); if (errorKey) setFieldErrors((prev) => { const next = { ...prev }; delete next[errorKey]; return next; }); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                value === method
                  ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                  : error
                  ? 'bg-white text-[hsl(215,25%,18%)] border-red-400 hover:border-red-500'
                  : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]'
              }`}
            >
              {method === 'cash' ? '💵 Cash' : method === 'transfer' ? '🏦 Transfer' : '📄 Cheque'}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
            <Icon name="AlertCircleIcon" size={11} />
            {error}
          </p>
        )}
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
            <p className="text-xs text-blue-700 mt-1">
              Upload the official Land Search document from the Land Registry confirming ownership and encumbrances on the property.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Land Search</h3>
          <UploadSection
            label="Land Search Document"
            docType="landsearch"
            propertyRef={propertyRef}
            docs={docs['landsearch'] ?? []}
            uploading={uploading}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={(doc) => handleDelete(doc, 'landsearch')}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('landsearch'); setActiveStep('rv'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          {(docs['landsearch'] ?? []).length > 0 && (
            <button
              onClick={() => { markStepComplete('landsearch'); setActiveStep('rv'); }}
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Icon name="CheckIcon" size={14} />
              Confirm & Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderRV() {
    const parsedAddresses = formData.rvBulkAddresses
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean);

    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Rating & Valuation Document</p>
            <p className="text-xs text-blue-700 mt-1">
              Upload the R&V document. You can also paste multiple addresses below for bulk import — one address per line.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload R&V Document</h3>
          <UploadSection
            label="R&V Document"
            docType="rv"
            propertyRef={propertyRef}
            docs={docs['rv'] ?? []}
            uploading={uploading}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={(doc) => handleDelete(doc, 'rv')}
          />
        </div>

        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="ListIcon" size={15} className="text-[#1B4F8A]" />
            Bulk Address Import
          </h3>
          <p className="text-xs text-[hsl(215,15%,52%)]">Paste multiple property addresses (one per line) to auto-populate R&V records.</p>
          <textarea
            value={formData.rvBulkAddresses}
            onChange={(e) => updateField('rvBulkAddresses', e.target.value)}
            rows={5}
            placeholder={'Unit 12A, Block 3, Discovery Bay\nUnit 8B, Block 5, Discovery Bay\n...'}
            className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none font-mono"
          />
          {parsedAddresses.length > 0 && (
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">
                {parsedAddresses.length} address{parsedAddresses.length !== 1 ? 'es' : ''} detected
              </p>
              {parsedAddresses.map((addr, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[hsl(215,25%,18%)]">
                  <Icon name="MapPinIcon" size={11} className="text-[#1B4F8A] flex-shrink-0" />
                  {addr}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('rv'); setActiveStep('id-uploads'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          <button
            onClick={() => { markStepComplete('rv'); setActiveStep('id-uploads'); }}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Icon name="CheckIcon" size={14} />
            Confirm & Continue
          </button>
        </div>
      </div>
    );
  }

  function renderIDUploads() {
    return (
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Icon name="AlertTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Identity Document Requirements</p>
            <p className="text-xs text-amber-700 mt-1">
              Upload HKID or Passport for both vendor and purchaser. If either party is a company, upload the Company BR Number and CR copy as proof of signatory authority.
            </p>
          </div>
        </div>

        {/* Vendor ID */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="UserIcon" size={15} className="text-[#1B4F8A]" />
            Vendor Identity Documents
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => updateField('isCompanyVendor', !formData.isCompanyVendor)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.isCompanyVendor ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,78%)]'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formData.isCompanyVendor ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">Vendor is a Company</span>
          </div>

          {!formData.isCompanyVendor ? (
            <UploadSection
              label="Vendor HKID or Passport"
              docType="vendor-id"
              propertyRef={propertyRef}
              docs={docs['vendor-id'] ?? []}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'vendor-id')}
              accept="application/pdf,image/*"
              acceptLabel="PDF or image"
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Company BR Number</label>
                <input
                  type="text"
                  value={formData.companyBRNumber}
                  onChange={(e) => updateField('companyBRNumber', e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">CR Copy (Proof of Signatory)</p>
                <UploadSection
                  label="Company CR Copy"
                  docType="vendor-cr"
                  propertyRef={propertyRef}
                  docs={docs['vendor-cr'] ?? []}
                  uploading={uploading}
                  onUpload={handleUpload}
                  onDownload={handleDownload}
                  onDelete={(doc) => handleDelete(doc, 'vendor-cr')}
                  accept="application/pdf,image/*"
                  acceptLabel="PDF or image"
                />
              </div>
            </div>
          )}
        </div>

        {/* Purchaser ID */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="UserCheckIcon" size={15} className="text-[#1B4F8A]" />
            Purchaser Identity Documents
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => updateField('isCompanyPurchaser', !formData.isCompanyPurchaser)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.isCompanyPurchaser ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,78%)]'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${formData.isCompanyPurchaser ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">Purchaser is a Company</span>
          </div>

          {!formData.isCompanyPurchaser ? (
            <UploadSection
              label="Purchaser HKID or Passport"
              docType="purchaser-id"
              propertyRef={propertyRef}
              docs={docs['purchaser-id'] ?? []}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'purchaser-id')}
              accept="application/pdf,image/*"
              acceptLabel="PDF or image"
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Company BR Number</label>
                <input
                  type="text"
                  value={formData.purchaserCompanyBRNumber}
                  onChange={(e) => updateField('purchaserCompanyBRNumber', e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">CR Copy (Proof of Signatory)</p>
                <UploadSection
                  label="Company CR Copy"
                  docType="purchaser-cr"
                  propertyRef={propertyRef}
                  docs={docs['purchaser-cr'] ?? []}
                  uploading={uploading}
                  onUpload={handleUpload}
                  onDownload={handleDownload}
                  onDelete={(doc) => handleDelete(doc, 'purchaser-cr')}
                  accept="application/pdf,image/*"
                  acceptLabel="PDF or image"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('id-uploads'); setActiveStep('sale-details'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          <button
            onClick={() => { markStepComplete('id-uploads'); setActiveStep('sale-details'); }}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Icon name="CheckIcon" size={14} />
            Confirm & Continue
          </button>
        </div>
      </div>
    );
  }

  function renderSaleDetails() {
    const handleSubmit = () => {
      const errors = validateSaleDetails();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        toast.error('Please fix the highlighted errors before continuing');
        return;
      }
      setFieldErrors({});
      markStepComplete('sale-details');
      setActiveStep('form1');
    };

    return (
      <div className="space-y-6">
        {/* Property */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] mb-4 flex items-center gap-2">
            <Icon name="BuildingIcon" size={15} className="text-[#1B4F8A]" />
            Property Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InputField label="Property Address" value={formData.propertyAddress} onChange={(v) => updateField('propertyAddress', v)} required errorKey="propertyAddress" placeholder="Unit, Building, Street, District" />
            </div>
            <InputField label="Sale Price (HKD)" value={formData.salePrice} onChange={(v) => updateField('salePrice', v)} required errorKey="salePrice" placeholder="e.g. 8500000" />
            <InputField label="Expected Completion Date" value={formData.completionDate} onChange={(v) => updateField('completionDate', v)} type="date" />
          </div>
        </div>

        {/* Vendor */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] mb-4 flex items-center gap-2">
            <Icon name="UserIcon" size={15} className="text-[#1B4F8A]" />
            Vendor Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Vendor Full Name" value={formData.vendorName} onChange={(v) => updateField('vendorName', v)} required errorKey="vendorName" />
            <InputField label="HKID / Passport Number" value={formData.vendorIdNumber} onChange={(v) => updateField('vendorIdNumber', v)} placeholder="A123456(7)" />
            <div className="md:col-span-2">
              <InputField label="Vendor Address" value={formData.vendorAddress} onChange={(v) => updateField('vendorAddress', v)} />
            </div>
            <InputField label="Phone" value={formData.vendorPhone} onChange={(v) => updateField('vendorPhone', v)} />
            <InputField label="Email" value={formData.vendorEmail} onChange={(v) => updateField('vendorEmail', v)} type="email" />
          </div>
        </div>

        {/* Vendor Solicitor */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] mb-4 flex items-center gap-2">
            <Icon name="ScaleIcon" size={15} className="text-[#1B4F8A]" />
            Vendor&apos;s Solicitor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InputField label="Solicitor Firm / Name" value={formData.vendorSolicitor} onChange={(v) => updateField('vendorSolicitor', v)} placeholder="e.g. Deacons, 5/F Alexandra House" />
            </div>
            <InputField label="Phone" value={formData.vendorSolicitorPhone} onChange={(v) => updateField('vendorSolicitorPhone', v)} />
            <InputField label="Email" value={formData.vendorSolicitorEmail} onChange={(v) => updateField('vendorSolicitorEmail', v)} type="email" />
          </div>
        </div>

        {/* Purchaser */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] mb-4 flex items-center gap-2">
            <Icon name="UserCheckIcon" size={15} className="text-[#1B4F8A]" />
            Purchaser Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Purchaser Full Name" value={formData.purchaserName} onChange={(v) => updateField('purchaserName', v)} required errorKey="purchaserName" />
            <InputField label="HKID / Passport Number" value={formData.purchaserIdNumber} onChange={(v) => updateField('purchaserIdNumber', v)} placeholder="A123456(7)" />
            <div className="md:col-span-2">
              <InputField label="Purchaser Address" value={formData.purchaserAddress} onChange={(v) => updateField('purchaserAddress', v)} />
            </div>
            <InputField label="Phone" value={formData.purchaserPhone} onChange={(v) => updateField('purchaserPhone', v)} />
            <InputField label="Email" value={formData.purchaserEmail} onChange={(v) => updateField('purchaserEmail', v)} type="email" />
          </div>
        </div>

        {/* Purchaser Solicitor */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] mb-4 flex items-center gap-2">
            <Icon name="ScaleIcon" size={15} className="text-[#1B4F8A]" />
            Purchaser&apos;s Solicitor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InputField label="Solicitor Firm / Name" value={formData.purchaserSolicitor} onChange={(v) => updateField('purchaserSolicitor', v)} placeholder="e.g. Linklaters, 11/F One Exchange Square" />
            </div>
            <InputField label="Phone" value={formData.purchaserSolicitorPhone} onChange={(v) => updateField('purchaserSolicitorPhone', v)} />
            <InputField label="Email" value={formData.purchaserSolicitorEmail} onChange={(v) => updateField('purchaserSolicitorEmail', v)} type="email" />
          </div>
        </div>

        {/* Agent */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] mb-4 flex items-center gap-2">
            <Icon name="BriefcaseIcon" size={15} className="text-[#1B4F8A]" />
            Agent & Agency Type
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Handling Agent</label>
              <select
                value={formData.selectedAgentIndex}
                onChange={(e) => updateField('selectedAgentIndex', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              >
                {agentProfiles.map((agent, idx) => (
                  <option key={idx} value={idx}>{agent.name} — {agent.licenceNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Agency Type</label>
              <div className="flex gap-2">
                {(['exclusive', 'non-exclusive'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateField('agencyType', type)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      formData.agencyType === type
                        ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                        : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]'
                    }`}
                  >
                    {type === 'exclusive' ? 'Exclusive' : 'Non-exclusive'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] transition-colors flex items-center gap-2"
          >
            Save & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
        </div>
      </div>
    );
  }

  function renderForm1() {
    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Form 1 — Property Information Form</p>
            <p className="text-xs text-blue-700 mt-1">
              Required under the Estate Agents Ordinance (Cap. 511). The vendor must complete and sign Form 1 before the property is marketed for sale. Upload the signed copy here.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed Form 1</h3>
          <UploadSection
            label="Form 1 — Property Information Form"
            docType="form1"
            propertyRef={propertyRef}
            docs={docs['form1'] ?? []}
            uploading={uploading}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={(doc) => handleDelete(doc, 'form1')}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('form1'); setActiveStep('form3-4'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          {(docs['form1'] ?? []).length > 0 && (
            <button
              onClick={() => { markStepComplete('form1'); setActiveStep('form3-4'); }}
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Icon name="CheckIcon" size={14} />
              Confirm & Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderForm3And4() {
    return (
      <div className="space-y-5">
        {/* Co-op toggle */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Co-operative Sale</h3>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">If this is a co-op sale, Forms 3 and 4 can be bypassed.</p>
            </div>
            <button
              type="button"
              onClick={() => updateField('isCoOp', !formData.isCoOp)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isCoOp ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,78%)]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.isCoOp ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {formData.isCoOp ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
            <Icon name="CheckCircleIcon" size={20} className="text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Co-op Sale — Forms 3 & 4 Bypassed</p>
              <p className="text-xs text-emerald-700 mt-0.5">As this is a co-operative sale, Forms 3 and 4 are not required. You may proceed to the next step.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Form 3 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Form 3 — Estate Agency Agreement for Sale (Vendor)</p>
                <p className="text-xs text-blue-700 mt-1">Required under EAO Cap. 511 before marketing the property. Auto-populated with vendor and agent details.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-3">
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Form 3 — Pre-populated Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Vendor</p>
                  <p className="text-[hsl(215,25%,18%)] font-medium">{formData.vendorName || '—'}</p>
                </div>
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Agent</p>
                  <p className="text-[hsl(215,25%,18%)] font-medium">{selectedAgent.name}</p>
                </div>
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3 col-span-2">
                  <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Property</p>
                  <p className="text-[hsl(215,25%,18%)] font-medium">{formData.propertyAddress || '—'}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setGenerating('form3');
                  try {
                    await generateForm3PDF(buildForm3Data());
                    toast.success('Form 3 generated — print or save as PDF');
                  } catch {
                    toast.error('Failed to generate Form 3');
                  } finally {
                    setGenerating(null);
                  }
                }}
                disabled={generating === 'form3'}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] transition-colors disabled:opacity-60"
              >
                <Icon name={generating === 'form3' ? 'LoaderIcon' : 'PrinterIcon'} size={14} className={generating === 'form3' ? 'animate-spin' : ''} />
                {generating === 'form3' ? 'Generating…' : 'Generate & Print Form 3'}
              </button>
            </div>

            {/* Form 4 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Form 4 — Estate Agency Agreement for Purchase (Purchaser)</p>
                <p className="text-xs text-blue-700 mt-1">Required under EAO Cap. 511. Upload the signed Form 4 from the purchaser.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed Form 4</h3>
              <UploadSection
                label="Form 4 — Signed by Purchaser"
                docType="form4"
                propertyRef={propertyRef}
                docs={docs['form4'] ?? []}
                uploading={uploading}
                onUpload={handleUpload}
                onDownload={handleDownload}
                onDelete={(doc) => handleDelete(doc, 'form4')}
              />
            </div>
          </>
        )}

        {/* ── Advertising Date Box ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border-2 border-[#1B4F8A] p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon name="CalendarIcon" size={15} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Advertising Start Date</h3>
              <p className="text-xs text-[hsl(215,15%,52%)]">Set when Form 3 is signed and advertising begins. A 3-month review reminder will be sent to the listing agent if the property is still active.</p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5 uppercase tracking-wider">Date Advertising Started</label>
              <input
                type="date"
                value={advertisingDate}
                onChange={(e) => setAdvertisingDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] focus:border-transparent bg-white"
              />
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setAdvertisingDate(today);
              }}
              className="px-4 py-2.5 bg-[#1B4F8A] text-white text-xs font-semibold rounded-lg hover:bg-[#163f6e] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Icon name="CalendarIcon" size={12} />
              Set Today
            </button>
            <button
              disabled={!advertisingDate || savingAdvertisingDate}
              onClick={async () => {
                if (!advertisingDate) return;
                setSavingAdvertisingDate(true);
                try {
                  const supabase = createClient();
                  const reminderDue = new Date(advertisingDate);
                  reminderDue.setMonth(reminderDue.getMonth() + 3);
                  const agent = agentProfiles[formData.selectedAgentIndex];
                  await supabase.from('advertising_reminders').upsert({
                    property_ref: propertyRef,
                    property_address: formData.propertyAddress,
                    advertising_date: advertisingDate,
                    reminder_due_date: reminderDue.toISOString().split('T')[0],
                    agent_name: agent?.name ?? '',
                    agent_email: agent?.email ?? '',
                    workflow_type: 'sales',
                    reminder_sent: false,
                    property_status: 'active',
                  }, { onConflict: 'property_ref' });
                  toast.success(`Advertising date saved — reminder scheduled for ${reminderDue.toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })}`);
                } catch {
                  toast.error('Failed to save advertising date');
                } finally {
                  setSavingAdvertisingDate(false);
                }
              }}
              className="px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Icon name={savingAdvertisingDate ? 'LoaderIcon' : 'SaveIcon'} size={12} className={savingAdvertisingDate ? 'animate-spin' : ''} />
              {savingAdvertisingDate ? 'Saving…' : 'Save & Schedule Reminder'}
            </button>
          </div>
          {advertisingDate && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Icon name="BellIcon" size={13} className="text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">3-month review reminder</span> will be sent to <span className="font-semibold">{agentProfiles[formData.selectedAgentIndex]?.name ?? 'the listing agent'}</span> on{' '}
                <span className="font-semibold">
                  {(() => {
                    const d = new Date(advertisingDate);
                    d.setMonth(d.getMonth() + 3);
                    return d.toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' });
                  })()}
                </span>{' '}
                if the property is still active.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('form3-4'); setActiveStep('pasp'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          <button
            onClick={() => { markStepComplete('form3-4'); setActiveStep('pasp'); }}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Icon name="CheckIcon" size={14} />
            {formData.isCoOp ? 'Bypass & Continue' : 'Mark as Signed & Continue'}
          </button>
        </div>
      </div>
    );
  }

  function renderPASP() {
    const fivePercent = formData.salePrice
      ? `HK$${(Number(formData.salePrice) * 0.05).toLocaleString('en-HK')}`
      : '5% of sale price';

    return (
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Icon name="AlertTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">30-Day Stamp Duty Deadline</p>
            <p className="text-xs text-amber-700 mt-1">
              Once the PASP is signed, stamp duty must be submitted to the Inland Revenue Department within <strong>30 days</strong>.
            </p>
          </div>
        </div>

        {/* Deposit */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="BanknoteIcon" size={15} className="text-[#1B4F8A]" />
            5% Deposit
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <Icon name="InfoIcon" size={14} className="text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Standard deposit is <strong>5% of the sale price</strong> — {fivePercent}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Deposit Amount (HKD)</label>
              <input
                type="text"
                value={formData.depositAmount}
                onChange={(e) => updateField('depositAmount', e.target.value)}
                placeholder={formData.salePrice ? String(Math.round(Number(formData.salePrice) * 0.05)) : 'e.g. 425000'}
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
            </div>
            <div>
              <PaymentMethodSelector
                label="Paid By"
                value={formData.depositMethod}
                onChange={(v) => updateField('depositMethod', v)}
                errorKey="depositMethod"
              />
            </div>
          </div>
        </div>

        {/* Upload PASP */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Upload Signed PASP</h3>
          <UploadSection
            label="Provisional Agreement for Sale & Purchase"
            docType="pasp"
            propertyRef={propertyRef}
            docs={docs['pasp'] ?? []}
            uploading={uploading}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={(doc) => handleDelete(doc, 'pasp')}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('pasp'); setActiveStep('stamp-duty'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          {(docs['pasp'] ?? []).length > 0 && (
            <button
              onClick={() => { markStepComplete('pasp'); setActiveStep('stamp-duty'); }}
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Icon name="CheckIcon" size={14} />
              Confirm & Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderStampDuty() {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="ExternalLinkIcon" size={15} className="text-[#1B4F8A]" />
            IRD Stamp Duty Portal
          </h3>
          <p className="text-sm text-[hsl(215,15%,52%)]">
            Submit stamp duty for the Sale & Purchase Agreement via the Inland Revenue Department e-Stamping portal.
            Stamp duty must be paid within <strong className="text-[hsl(215,25%,18%)]">30 days</strong> of signing the PASP.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Property</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">{formData.propertyAddress || '—'}</p>
            </div>
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Sale Price</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">
                {formData.salePrice ? `HK$${Number(formData.salePrice).toLocaleString('en-HK')}` : '—'}
              </p>
            </div>
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Vendor</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">{formData.vendorName || '—'}</p>
            </div>
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Purchaser</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">{formData.purchaserName || '—'}</p>
            </div>
          </div>
          <a
            href="https://www.ird.gov.hk/eng/ese/stamping.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Icon name="ExternalLinkIcon" size={14} />
            Open IRD e-Stamping Portal
          </a>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => { markStepComplete('stamp-duty'); sendWorkflowNotification('stamp-duty-filed'); setActiveStep('pre-completion'); }}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Icon name="CheckIcon" size={14} />
            Stamp Duty Submitted — Continue
          </button>
        </div>
      </div>
    );
  }

  function renderPreCompletion() {
    return (
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Icon name="ClockIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Pre-Completion Checks — 1 Week Before Completion</p>
            <p className="text-xs text-amber-700 mt-1">
              Arrange a final inspection, record all utility meter numbers and readings, and prepare DBRC debenture transfer papers for both vendor and purchaser.
            </p>
          </div>
        </div>

        {/* Final Inspection */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="SearchIcon" size={15} className="text-[#1B4F8A]" />
            Final Inspection
          </h3>
          <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${finalInspectionDone ? 'bg-emerald-50 border-emerald-200' : 'bg-[hsl(210,20%,97%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/40'}`}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${finalInspectionDone ? 'bg-emerald-500 border-emerald-500' : 'border-[hsl(214,20%,78%)] bg-white'}`}>
              {finalInspectionDone && <Icon name="CheckIcon" size={11} className="text-white" />}
            </div>
            <input type="checkbox" className="hidden" checked={finalInspectionDone} onChange={(e) => setFinalInspectionDone(e.target.checked)} />
            <span className={`text-sm ${finalInspectionDone ? 'text-emerald-800' : 'text-[hsl(215,25%,18%)]'}`}>Final inspection arranged and completed</span>
          </label>
        </div>

        {/* Meter Readings */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="GaugeIcon" size={15} className="text-[#1B4F8A]" />
            Utility Meter Readings
          </h3>

          {/* Water */}
          <div className="border border-[hsl(214,20%,88%)] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                <Icon name="DropletIcon" size={13} className="text-blue-600" />
              </div>
              <span className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider">Water Meter</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Meter Number</label>
                <input type="text" value={formData.waterMeterNumber} onChange={(e) => updateField('waterMeterNumber', e.target.value)} placeholder="e.g. WM-123456" className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Reading (m³)</label>
                <input type="text" value={formData.waterMeterReading} onChange={(e) => updateField('waterMeterReading', e.target.value)} placeholder="e.g. 1234.5" className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]" />
              </div>
            </div>
          </div>

          {/* CLP Electric */}
          <div className="border border-[hsl(214,20%,88%)] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center">
                <Icon name="ZapIcon" size={13} className="text-yellow-600" />
              </div>
              <span className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider">CLP Electricity Meter</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Meter Number</label>
                <input type="text" value={formData.clpMeterNumber} onChange={(e) => updateField('clpMeterNumber', e.target.value)} placeholder="e.g. CLP-789012" className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Reading (kWh)</label>
                <input type="text" value={formData.clpMeterReading} onChange={(e) => updateField('clpMeterReading', e.target.value)} placeholder="e.g. 5678.9" className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]" />
              </div>
            </div>
          </div>

          {/* Gas */}
          <div className="border border-[hsl(214,20%,88%)] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
                <Icon name="FlameIcon" size={13} className="text-orange-600" />
              </div>
              <span className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider">Gas Meter</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Meter Number</label>
                <input type="text" value={formData.gasMeterNumber} onChange={(e) => updateField('gasMeterNumber', e.target.value)} placeholder="e.g. GAS-345678" className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Reading (MJ)</label>
                <input type="text" value={formData.gasMeterReading} onChange={(e) => updateField('gasMeterReading', e.target.value)} placeholder="e.g. 2345.6" className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]" />
              </div>
            </div>
          </div>
        </div>

        {/* DBRC Debenture Transfer */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="FileSignatureIcon" size={15} className="text-[#1B4F8A]" />
            DBRC Debenture Transfer Papers
          </h3>
          <p className="text-xs text-[hsl(215,15%,52%)]">
            Arrange DBRC debenture transfer papers for both vendor and purchaser. Track signing status below and upload completed documents.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor DBRC */}
            <div className="border border-[hsl(214,20%,88%)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[hsl(215,25%,18%)]">Vendor DBRC Papers</p>
                <label className={`flex items-center gap-2 cursor-pointer`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${dbrcVendorSigned ? 'bg-emerald-500 border-emerald-500' : 'border-[hsl(214,20%,78%)] bg-white'}`}>
                    {dbrcVendorSigned && <Icon name="CheckIcon" size={9} className="text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={dbrcVendorSigned} onChange={(e) => setDbrcVendorSigned(e.target.checked)} />
                  <span className="text-xs text-[hsl(215,25%,18%)]">Signed</span>
                </label>
              </div>
              <UploadSection
                label="Vendor DBRC Transfer"
                docType="dbrc-vendor"
                propertyRef={propertyRef}
                docs={docs['dbrc-vendor'] ?? []}
                uploading={uploading}
                onUpload={handleUpload}
                onDownload={handleDownload}
                onDelete={(doc) => handleDelete(doc, 'dbrc-vendor')}
              />
            </div>

            {/* Purchaser DBRC */}
            <div className="border border-[hsl(214,20%,88%)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[hsl(215,25%,18%)]">Purchaser DBRC Papers</p>
                <label className={`flex items-center gap-2 cursor-pointer`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${dbrcPurchaserSigned ? 'bg-emerald-500 border-emerald-500' : 'border-[hsl(214,20%,78%)] bg-white'}`}>
                    {dbrcPurchaserSigned && <Icon name="CheckIcon" size={9} className="text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={dbrcPurchaserSigned} onChange={(e) => setDbrcPurchaserSigned(e.target.checked)} />
                  <span className="text-xs text-[hsl(215,25%,18%)]">Signed</span>
                </label>
              </div>
              <UploadSection
                label="Purchaser DBRC Transfer"
                docType="dbrc-purchaser"
                propertyRef={propertyRef}
                docs={docs['dbrc-purchaser'] ?? []}
                uploading={uploading}
                onUpload={handleUpload}
                onDownload={handleDownload}
                onDelete={(doc) => handleDelete(doc, 'dbrc-purchaser')}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { markStepComplete('pre-completion'); setActiveStep('invoice'); }}
            className="px-6 py-2.5 bg-[hsl(215,15%,52%)] text-white text-sm font-semibold rounded-lg hover:bg-[hsl(215,25%,40%)] transition-colors flex items-center gap-2"
          >
            Skip & Continue
            <Icon name="ArrowRightIcon" size={14} />
          </button>
          <button
            onClick={() => { markStepComplete('pre-completion'); sendWorkflowNotification('key-handover-scheduled'); setActiveStep('invoice'); }}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Icon name="CheckIcon" size={14} />
            Pre-Completion Done — Continue
          </button>
        </div>
      </div>
    );
  }

  function renderInvoice() {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="ReceiptIcon" size={15} className="text-[#1B4F8A]" />
            Generate Sale Invoice or Receipt
          </h3>
          <p className="text-sm text-[hsl(215,15%,52%)]">
            Generate a commission invoice or receipt for this sale transaction. Pre-populated with vendor and purchaser details.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Vendor</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">{formData.vendorName || '—'}</p>
            </div>
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Purchaser</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">{formData.purchaserName || '—'}</p>
            </div>
            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3 col-span-2">
              <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Property</p>
              <p className="text-[hsl(215,25%,18%)] font-medium">{formData.propertyAddress || '—'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowInvoiceGenerator(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Icon name="ReceiptIcon" size={14} />
            Generate Invoice / Receipt
          </button>
        </div>

        {stepStatuses['invoice'] !== 'completed' && (
          <div className="flex justify-end">
            <button
              onClick={() => { markStepComplete('invoice'); sendWorkflowNotification('invoice-ready'); setActiveStep('management-office'); }}
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Icon name="CheckIcon" size={14} />
              Invoice Done — Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderManagementOffice() {
    const checkedCount = Object.values(mgmtChecked).filter(Boolean).length;
    const allChecked = checkedCount === MGMT_ITEMS.length;

    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Management Office Visit</p>
            <p className="text-xs text-blue-700 mt-1">
              Arrange to take the purchaser to the management office to submit the Octopus card form and update their resident details.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(215,25%,18%)] flex items-center gap-2">
              <Icon name="BuildingIcon" size={15} className="text-[#1B4F8A]" />
              Management Office Checklist
            </h3>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${allChecked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'}`}>
              {checkedCount} / {MGMT_ITEMS.length} completed
            </span>
          </div>

          <div className="space-y-2">
            {MGMT_ITEMS.map((item) => (
              <label
                key={item}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mgmtChecked[item]
                    ? 'bg-emerald-50 border-emerald-200' :'bg-[hsl(210,20%,97%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/40'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${mgmtChecked[item] ? 'bg-emerald-500 border-emerald-500' : 'border-[hsl(214,20%,78%)] bg-white'}`}>
                  {mgmtChecked[item] && <Icon name="CheckIcon" size={11} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={!!mgmtChecked[item]}
                  onChange={(e) => setMgmtChecked((prev) => ({ ...prev, [item]: e.target.checked }))}
                />
                <span className={`text-sm ${mgmtChecked[item] ? 'text-emerald-800 line-through' : 'text-[hsl(215,25%,18%)]'}`}>{item}</span>
              </label>
            ))}
          </div>

          {!allChecked && (
            <button
              onClick={() => {
                const all: Record<string, boolean> = {};
                MGMT_ITEMS.forEach((item) => { all[item] = true; });
                setMgmtChecked(all);
              }}
              className="text-xs text-[#1B4F8A] hover:underline flex items-center gap-1"
            >
              <Icon name="CheckSquareIcon" size={12} />
              Mark all as complete
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => markStepComplete('management-office')}
            disabled={!allChecked}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="CheckCircleIcon" size={14} />
            Complete Sale Workflow
          </button>
        </div>

        {stepStatuses['management-office'] === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Icon name="CheckCircleIcon" size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Sale Workflow Complete 🎉</p>
              <p className="text-xs text-emerald-700 mt-0.5">All steps have been completed for this sale transaction.</p>
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
      case 'id-uploads': return renderIDUploads();
      case 'sale-details': return renderSaleDetails();
      case 'form1': return renderForm1();
      case 'form3-4': return renderForm3And4();
      case 'pasp': return renderPASP();
      case 'stamp-duty': return renderStampDuty();
      case 'pre-completion': return renderPreCompletion();
      case 'invoice': return renderInvoice();
      case 'management-office': return renderManagementOffice();
    }
  }

  const completedCount = Object.values(stepStatuses).filter((s) => s === 'completed').length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
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
            <Icon name={STEPS.find((s) => s.id === activeStep)?.icon as Parameters<typeof Icon>[0]['name'] ?? 'FileTextIcon'} size={28} className="text-[hsl(214,20%,88%)] flex-shrink-0" />
          </div>
        </div>

        {renderStepContent()}
      </div>

      {/* Invoice Generator Modal */}
      {showInvoiceGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <InvoiceGenerator
              invoiceType="sale"
              ownerName={formData.vendorName}
              counterpartyName={formData.purchaserName}
              propertyAddress={formData.propertyAddress}
              salePrice={formData.salePrice}
              onClose={() => setShowInvoiceGenerator(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
