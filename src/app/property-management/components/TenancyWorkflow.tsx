'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { Property, agentProfiles } from './mockData';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { generateForm2PDF, Form2Data } from '@/lib/generateForm2';
import { generateForm5PDF, Form5Data } from '@/lib/generateForm5';
import { generateForm6PDF, Form6Data } from '@/lib/generateForm6';
import { generateCR109PDF, CR109Data } from '@/lib/generateCR109';
import InvoiceGenerator from './InvoiceGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowStep =
  | 'landsearch' |'rv' |'id-uploads' |'front-page' |'form2' |'forms56' |'provisional-ta' |'tenancy-agreement' |'stamp-duty' |'cr109' |'handover';

export type StepStatus = 'pending' | 'in-progress' | 'completed';

export interface TenancyFormData {
  // Property
  propertyAddress: string;
  monthlyRent: string;
  leaseStart: string;
  leaseEnd: string;
  // Tenant
  tenantName: string;
  tenantIdNumber: string;
  tenantAddress: string;
  tenantPhone: string;
  tenantEmail: string;
  // Landlord
  landlordName: string;
  landlordIdNumber: string;
  landlordAddress: string;
  landlordPhone: string;
  landlordEmail: string;
  landlordBankDetails: string;
  // Agent
  selectedAgentIndex: number;
  // Deposit
  depositMethod: 'cheque' | 'transfer' | 'cash' | '';
  firstMonthMethod: 'cheque' | 'transfer' | 'cash' | '';
  // PTA deposit
  ptaDepositMethod: 'cheque' | 'transfer' | 'cash' | '';
  // Template
  templateVersion: 'with-pets' | 'without-pets';
  // Inventory
  inventoryItems: string[];
  // Co-op flag
  isCoOp: boolean;
  // Company landlord
  isCompanyLandlord: boolean;
  companyBRNumber: string;
  // R&V bulk addresses
  rvBulkAddresses: string;
}

interface UploadedDoc {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  uploaded_at: string;
}

interface StepConfig {
  id: WorkflowStep;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: 'landsearch', label: 'Landsearch', shortLabel: 'Land', icon: 'SearchIcon', description: 'Upload Land Search document' },
  { id: 'rv', label: 'R&V', shortLabel: 'R&V', icon: 'MapPinIcon', description: 'Upload R&V document — bulk address import available' },
  { id: 'id-uploads', label: 'ID Documents', shortLabel: 'IDs', icon: 'IdCardIcon', description: 'Upload HKID / Passport for landlord and tenants; Company BR & CR if applicable' },
  { id: 'front-page', label: 'Tenancy Details', shortLabel: 'Details', icon: 'ClipboardListIcon', description: 'Enter property, tenant, landlord and agent details' },
  { id: 'form2', label: 'Form 2', shortLabel: 'Form 2', icon: 'FileTextIcon', description: 'Leasing Information Form for Prospective Tenants' },
  { id: 'forms56', label: 'Forms 5 & 6', shortLabel: 'F5 & F6', icon: 'FilesIcon', description: 'Estate Agency Agreements — auto-populated (bypass if co-op)' },
  { id: 'provisional-ta', label: 'Provisional TA', shortLabel: 'Prov. TA', icon: 'FileSignatureIcon', description: 'Upload signed Provisional Tenancy Agreement with 1-month deposit' },
  { id: 'tenancy-agreement', label: 'Tenancy Agreement', shortLabel: 'TA', icon: 'HomeIcon', description: 'Generate, review inventory, upload signed TA' },
  { id: 'stamp-duty', label: 'Stamp Duty', shortLabel: 'Stamp', icon: 'ExternalLinkIcon', description: 'Submit stamp duty via IRD government portal' },
  { id: 'cr109', label: 'CR109', shortLabel: 'CR109', icon: 'CheckSquareIcon', description: 'Notice of New Letting — Rating & Valuation Dept.' },
  { id: 'handover', label: 'Handover', shortLabel: 'Handover', icon: 'KeyIcon', description: 'Upload handover photos, form, invoice and receipt' },
];

const DEFAULT_INVENTORY = [
  'Air conditioning units',
  'Ventilation fans',
  'Water heaters',
  'Refrigerator',
  'Washing machine',
  'Dryer',
  'Dishwasher',
  'Cooker / Oven',
  'Range hood',
  'Kitchen cabinets',
  'Microwave',
  'Light fittings',
  'Built-in wardrobes',
];

// ─── Helper ───────────────────────────────────────────────────────────────────

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

// ─── Upload Section (PDF) ─────────────────────────────────────────────────────

function UploadSection({
  label,
  docType,
  propertyRef,
  docs,
  uploading,
  onUpload,
  onDownload,
  onDelete,
  acceptImages = false,
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
  acceptImages?: boolean;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = acceptImages ? 'application/pdf,image/*' : 'application/pdf';

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
          <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
            {acceptImages ? 'PDF or image' : 'PDF only'} · Max 50 MB · {multiple ? 'Multiple files allowed' : 'Click to browse'}
          </p>
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

interface TenancyWorkflowProps {
  property: Property;
}

export default function TenancyWorkflow({ property }: TenancyWorkflowProps) {
  const [activeStep, setActiveStep] = useState<WorkflowStep>('landsearch');
  const [stepStatuses, setStepStatuses] = useState<Record<WorkflowStep, StepStatus>>({
    'landsearch': 'in-progress',
    'rv': 'pending',
    'id-uploads': 'pending',
    'front-page': 'pending',
    'form2': 'pending',
    'forms56': 'pending',
    'provisional-ta': 'pending',
    'tenancy-agreement': 'pending',
    'stamp-duty': 'pending',
    'cr109': 'pending',
    'handover': 'pending',
  });

  const [formData, setFormData] = useState<TenancyFormData>({
    propertyAddress: `${property.unit}, ${property.building}, ${property.street}, ${property.district}`,
    monthlyRent: property.monthlyRent ? String(property.monthlyRent) : '',
    leaseStart: property.tenant?.leaseStart ?? '',
    leaseEnd: property.tenant?.leaseEnd ?? '',
    tenantName: property.tenant?.name ?? '',
    tenantIdNumber: property.tenant?.idNumber ?? '',
    tenantAddress: '',
    tenantPhone: property.tenant?.phone ?? '',
    tenantEmail: property.tenant?.email ?? '',
    landlordName: property.landlord.name,
    landlordIdNumber: property.landlord.idNumber ?? '',
    landlordAddress: '',
    landlordPhone: property.landlord.phone,
    landlordEmail: property.landlord.email,
    landlordBankDetails: '',
    selectedAgentIndex: 0,
    depositMethod: '',
    firstMonthMethod: '',
    ptaDepositMethod: '',
    templateVersion: 'without-pets',
    inventoryItems: [...DEFAULT_INVENTORY],
    isCoOp: false,
    isCompanyLandlord: false,
    companyBRNumber: '',
    rvBulkAddresses: '',
  });

  // ── Validation state ───────────────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TenancyFormData | 'inventoryItems', string>>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const HKID_REGEX = /^[A-Z]{1,2}\d{6}\([0-9A]\)$/i;
  const BANK_DETAIL_REGEX = /^.{2,}\s+[\d\-]+$/;

  function validateHKID(value: string): string {
    if (!value.trim()) return '';
    const normalised = value.trim().toUpperCase().replace(/\s/g, '');
    if (!HKID_REGEX.test(normalised)) {
      return 'Invalid HKID format. Expected: A123456(7) or AB123456(7)';
    }
    return '';
  }

  function validateBankDetails(value: string): string {
    if (!value.trim()) return '';
    if (!BANK_DETAIL_REGEX.test(value.trim())) {
      return 'Invalid format. Expected: Bank Name followed by account number, e.g. HSBC 123-456789-001';
    }
    return '';
  }

  function validateInventoryItems(items: string[]): string {
    if (items.length === 0) return 'At least one inventory item is required';
    const emptyIdx = items.findIndex((item) => !item.trim());
    if (emptyIdx !== -1) return `Item ${emptyIdx + 1} cannot be empty — please fill in or remove it`;
    return '';
  }

  function validateFrontPage(): Partial<Record<keyof TenancyFormData | 'inventoryItems', string>> {
    const errors: Partial<Record<keyof TenancyFormData | 'inventoryItems', string>> = {};

    if (!formData.propertyAddress.trim()) errors.propertyAddress = 'Property address is required';
    if (!formData.monthlyRent.trim()) errors.monthlyRent = 'Monthly rent is required';
    else if (isNaN(Number(formData.monthlyRent)) || Number(formData.monthlyRent) <= 0) errors.monthlyRent = 'Monthly rent must be a positive number';
    if (!formData.leaseStart) errors.leaseStart = 'Lease start date is required';

    if (!formData.tenantName.trim()) errors.tenantName = 'Tenant name is required';
    if (!formData.tenantIdNumber.trim()) errors.tenantIdNumber = 'Tenant HKID is required';
    else {
      const hkidErr = validateHKID(formData.tenantIdNumber);
      if (hkidErr) errors.tenantIdNumber = hkidErr;
    }

    if (!formData.landlordName.trim()) errors.landlordName = 'Landlord name is required';
    if (formData.landlordIdNumber.trim()) {
      const hkidErr = validateHKID(formData.landlordIdNumber);
      if (hkidErr) errors.landlordIdNumber = hkidErr;
    }
    if (formData.landlordBankDetails.trim()) {
      const bankErr = validateBankDetails(formData.landlordBankDetails);
      if (bankErr) errors.landlordBankDetails = bankErr;
    }

    return errors;
  }

  function validateTenancyAgreementStep(): Partial<Record<keyof TenancyFormData | 'inventoryItems', string>> {
    const errors: Partial<Record<keyof TenancyFormData | 'inventoryItems', string>> = {};
    const invErr = validateInventoryItems(formData.inventoryItems);
    if (invErr) errors.inventoryItems = invErr;
    return errors;
  }

  function markFieldTouched(field: string) {
    setTouchedFields((prev) => new Set(prev).add(field));
  }

  const [generating, setGenerating] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<Record<string, UploadedDoc[]>>({
    'landsearch': [],
    'rv': [],
    'landlord-hkid': [],
    'tenant-hkid': [],
    'company-br': [],
    'company-cr': [],
    'provisional-ta': [],
    'tenancy-agreement': [],
    'handover-photos': [],
    'handover-form': [],
    'handover-invoice': [],
    'handover-receipt': [],
  });
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [rvParsedAddresses, setRvParsedAddresses] = useState<string[]>([]);
  const [advertisingDate, setAdvertisingDate] = useState('');
  const [savingAdvertisingDate, setSavingAdvertisingDate] = useState(false);

  // Inventory editing
  const [newInventoryItem, setNewInventoryItem] = useState('');

  const updateField = (field: keyof TenancyFormData, value: string | number | string[] | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[field as keyof typeof next]; return next; });
    }
  };

  const markStepComplete = (step: WorkflowStep) => {
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
          workflowType: 'tenancy',
          event,
          propertyAddress: formData.propertyAddress,
          propertyRef: property.ref,
          tenantName: formData.tenantName || undefined,
          tenantEmail: formData.tenantEmail || undefined,
          landlordName: formData.landlordName || undefined,
          landlordEmail: formData.landlordEmail || undefined,
          agentName: agent?.name || undefined,
          agentPhone: agent?.mobile || undefined,
          agentEmail: agent?.email || undefined,
          ...extra,
        }),
      });
    } catch {
      // Silent — notification failure should not block workflow
    }
  };

  const navigateToStep = (step: WorkflowStep) => {
    const stepIdx = STEPS.findIndex((s) => s.id === step);
    const currentIdx = STEPS.findIndex((s) => s.id === activeStep);
    const targetStatus = stepStatuses[step];
    if (targetStatus !== 'pending' || stepIdx <= currentIdx) {
      setActiveStep(step);
    }
  };

  // ── Upload helpers ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async (file: File, docType: string) => {
    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPDF && !isImage) { toast.error('Only PDF or image files accepted'); return; }
    if (file.size > 52428800) { toast.error('File must be under 50 MB'); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `tenancy-workflow/${property.ref}/${docType}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: dbData, error: dbError } = await supabase.from('property_documents').insert({
        property_ref: property.ref,
        document_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
      }).select('id, file_name, file_path, file_size_bytes, uploaded_at').single();
      if (dbError) throw dbError;
      setDocs((prev) => ({ ...prev, [docType]: [...(prev[docType] ?? []), dbData] }));
      toast.success(`${file.name} uploaded successfully`);
      if (docType === 'provisional-ta') markStepComplete('provisional-ta');
      if (docType === 'tenancy-agreement-signed') {
        markStepComplete('tenancy-agreement');
        sendWorkflowNotification('lease-signed');
      }
      if (docType === 'handover-invoice') {
        sendWorkflowNotification('invoice-ready');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [property.ref]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Form generators ────────────────────────────────────────────────────────

  const selectedAgent = agentProfiles[formData.selectedAgentIndex] ?? agentProfiles[0];

  const buildForm2Data = (): Form2Data => ({
    propertyAddress: formData.propertyAddress,
    monthlyRent: formData.monthlyRent,
    leaseStart: formData.leaseStart,
    leaseEnd: formData.leaseEnd,
    tenantName: formData.tenantName,
    tenantIdNumber: formData.tenantIdNumber,
    tenantAddress: formData.tenantAddress,
    tenantPhone: formData.tenantPhone,
    landlordName: formData.landlordName,
    landlordIdNumber: formData.landlordIdNumber,
    landlordAddress: formData.landlordAddress,
    agentName: selectedAgent.name,
    agentLicenceNumber: selectedAgent.licenceNumber,
    depositAmount: formData.monthlyRent ? String(Number(formData.monthlyRent) * 2) : '',
    depositMethod: formData.depositMethod as 'cheque' | 'transfer' | '',
    firstMonthMethod: formData.firstMonthMethod as 'cheque' | 'transfer' | '',
    agencyRelationship: 'single',
  });

  const buildForm5Data = (): Form5Data => ({
    landlordName: formData.landlordName,
    landlordIdNumber: formData.landlordIdNumber,
    landlordAddress: formData.landlordAddress,
    landlordPhone: formData.landlordPhone,
    agentName: selectedAgent.name,
    agentLicenceNumber: selectedAgent.licenceNumber,
    agentAddress: 'Room 527 Block D, DB Plaza, Discovery Bay',
    agentPhone: selectedAgent.mobile,
    propertyAddress: formData.propertyAddress,
    agencyType: 'non-exclusive',
    startDate: formData.leaseStart,
    expiryDate: formData.leaseEnd,
    agencyRelationship: 'single',
    listRentalWords: '',
    listRentalHKD: formData.monthlyRent,
    rentalIncludes: 'inclusive',
    commissionType: 'rate',
    commissionValue: '1 month',
    commissionPayment: 'signing',
    allowViewingByAgent: true,
    allowViewingByTenant: false,
    passKeysToAgent: true,
    authorizePassKeysToOthers: false,
    authorizeSubListing: false,
    authorizeAdvertising: true,
    agentHasInterest: false,
    receivedLeasingInfoForm: true,
  });

  const buildForm6Data = (): Form6Data => ({
    propertyAddress: formData.propertyAddress,
    district: property.district,
    floor: property.floor,
    sqft: String(property.sqft),
    yearBuilt: String(property.yearBuilt),
    monthlyRent: formData.monthlyRent,
    leaseStart: formData.leaseStart,
    leaseEnd: formData.leaseEnd,
    landlordName: formData.landlordName,
    landlordIdNumber: formData.landlordIdNumber,
    landlordAddress: formData.landlordAddress,
    landlordPhone: formData.landlordPhone,
    landlordBankDetails: formData.landlordBankDetails,
    agentName: selectedAgent.name,
    agentLicenceNumber: selectedAgent.licenceNumber,
    depositAmount: formData.monthlyRent ? String(Number(formData.monthlyRent) * 2) : '',
    depositMethod: formData.depositMethod as 'cheque' | 'transfer' | '',
    firstMonthMethod: formData.firstMonthMethod as 'cheque' | 'transfer' | '',
    petAllowed: formData.templateVersion === 'with-pets',
    includesRates: true,
    includesManagement: true,
    agencyRelationship: 'single',
  });

  const buildCR109Data = (): CR109Data => ({
    propertyAddress: formData.propertyAddress,
    district: property.district,
    floor: property.floor,
    sqft: String(property.sqft),
    landlordName: formData.landlordName,
    landlordIdNumber: formData.landlordIdNumber,
    landlordAddress: formData.landlordAddress,
    landlordPhone: formData.landlordPhone,
    tenantName: formData.tenantName,
    tenantIdNumber: formData.tenantIdNumber,
    tenantAddress: formData.tenantAddress,
    tenantPhone: formData.tenantPhone,
    monthlyRent: formData.monthlyRent,
    leaseStart: formData.leaseStart,
    leaseEnd: formData.leaseEnd,
    includesRates: true,
    includesManagement: true,
    depositAmount: formData.monthlyRent ? String(Number(formData.monthlyRent) * 2) : '',
    agentName: selectedAgent.name,
    agentLicenceNumber: selectedAgent.licenceNumber,
  });

  // ── Render helpers ─────────────────────────────────────────────────────────

  function InputField({ label, value, onChange, type = 'text', placeholder = '', required = false, errorKey }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; errorKey?: keyof TenancyFormData;
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
          onBlur={() => errorKey && markFieldTouched(errorKey)}
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

  function PaymentMethodSelector({ label, value, onChange, errorKey, includeCash = false }: {
    label: string;
    value: 'cheque' | 'transfer' | 'cash' | '';
    onChange: (v: 'cheque' | 'transfer' | 'cash') => void;
    errorKey?: keyof TenancyFormData;
    includeCash?: boolean;
  }) {
    const error = errorKey ? fieldErrors[errorKey] : undefined;
    const methods: Array<{ key: 'cheque' | 'transfer' | 'cash'; label: string; icon: string }> = [
      { key: 'cash', label: 'Cash', icon: 'BanknoteIcon' },
      { key: 'transfer', label: 'Transfer', icon: 'ArrowLeftRightIcon' },
      { key: 'cheque', label: 'Cheque', icon: 'CreditCardIcon' },
    ];
    const displayed = includeCash ? methods : methods.filter((m) => m.key !== 'cash');
    return (
      <div>
        <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">{label}</label>
        <div className="flex gap-2">
          {displayed.map((method) => (
            <button
              key={method.key}
              type="button"
              onClick={() => { onChange(method.key); if (errorKey) setFieldErrors((prev) => { const next = { ...prev }; delete next[errorKey]; return next; }); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                value === method.key
                  ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                  : error
                  ? 'bg-white text-[hsl(215,25%,18%)] border-red-400 hover:border-red-500'
                  : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]'
              }`}
            >
              <Icon name={method.icon as Parameters<typeof Icon>[0]['name']} size={12} className="inline mr-1" />
              {method.label}
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

  // ── Step content renderers ─────────────────────────────────────────────────

  function renderLandsearch() {
    const landDocs = docs['landsearch'] ?? [];
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Land Search Document</p>
              <p className="text-xs text-blue-600 mt-1">
                Upload the official Land Search document obtained from the Land Registry. This confirms ownership and encumbrances on the property.
              </p>
            </div>
          </div>
        </div>

        <UploadSection
          label="Land Search Document"
          docType="landsearch"
          propertyRef={property.ref}
          docs={landDocs}
          uploading={uploading}
          onUpload={handleUpload}
          onDownload={handleDownload}
          onDelete={(doc) => handleDelete(doc, 'landsearch')}
        />

        <button
          onClick={() => { markStepComplete('landsearch'); setActiveStep('rv'); }}
          className="w-full btn-secondary py-2.5 text-sm"
        >
          <Icon name="ArrowRightIcon" size={15} />
          {landDocs.length > 0 ? 'Continue to R&V' : 'Skip & Continue to R&V'}
        </button>
      </div>
    );
  }

  function renderRV() {
    const rvDocs = docs['rv'] ?? [];

    const handleBulkParse = () => {
      const lines = formData.rvBulkAddresses
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) {
        toast.error('Please enter at least one address');
        return;
      }
      setRvParsedAddresses(lines);
      toast.success(`${lines.length} address${lines.length > 1 ? 'es' : ''} parsed`);
    };

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Rating & Valuation (R&V) Document</p>
              <p className="text-xs text-blue-600 mt-1">
                Upload the R&V document from the Rating and Valuation Department. You can also paste multiple addresses below for bulk import — the system will extract the property information.
              </p>
            </div>
          </div>
        </div>

        {/* Bulk address import */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)]">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="ListIcon" size={13} className="text-[#1B4F8A]" />Bulk Address Import
            </p>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-[hsl(215,15%,52%)]">Paste one address per line. The system will parse and pull property information from each address.</p>
            <textarea
              value={formData.rvBulkAddresses}
              onChange={(e) => updateField('rvBulkAddresses', e.target.value)}
              rows={4}
              placeholder={"e.g.\nFlat A, 12/F, Block 1, Discovery Bay\nFlat B, 8/F, Block 2, Discovery Bay"}
              className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A] resize-none font-mono"
            />
            <button
              onClick={handleBulkParse}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#1B4F8A] text-white rounded-lg text-xs font-semibold hover:bg-[#163d6e] transition-colors"
            >
              <Icon name="SearchIcon" size={13} />
              Parse Addresses & Pull Property Info
            </button>

            {rvParsedAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Icon name="CheckCircleIcon" size={12} />
                  {rvParsedAddresses.length} address{rvParsedAddresses.length > 1 ? 'es' : ''} parsed
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {rvParsedAddresses.map((addr, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                      <Icon name="MapPinIcon" size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-800">{addr}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* R&V document upload */}
        <div>
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Upload R&V Document</p>
          <UploadSection
            label="R&V Document"
            docType="rv"
            propertyRef={property.ref}
            docs={rvDocs}
            uploading={uploading}
            onUpload={handleUpload}
            onDownload={handleDownload}
            onDelete={(doc) => handleDelete(doc, 'rv')}
          />
        </div>

        <button
          onClick={() => { markStepComplete('rv'); setActiveStep('id-uploads'); }}
          className="w-full btn-secondary py-2.5 text-sm"
        >
          <Icon name="ArrowRightIcon" size={15} />
          {rvDocs.length > 0 ? 'Continue to ID Documents' : 'Skip & Continue to ID Documents'}
        </button>
      </div>
    );
  }

  function renderIDUploads() {
    const landlordHKIDDocs = docs['landlord-hkid'] ?? [];
    const tenantHKIDDocs = docs['tenant-hkid'] ?? [];
    const companyBRDocs = docs['company-br'] ?? [];
    const companyCRDocs = docs['company-cr'] ?? [];

    return (
      <div className="space-y-5">
        {/* Co-op toggle */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="InfoIcon" size={16} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Co-operative Tenancy?</p>
                <p className="text-xs text-amber-700 mt-0.5">If this is a co-op, Forms 5 & 6 can be bypassed in the next steps.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateField('isCoOp', !formData.isCoOp)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isCoOp ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,88%)]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${formData.isCoOp ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {formData.isCoOp && (
            <p className="text-xs text-amber-700 mt-2 pl-7">
              <Icon name="CheckCircleIcon" size={11} className="inline mr-1 text-amber-600" />
              Co-op confirmed — Forms 5 & 6 will be marked as bypassed.
            </p>
          )}
        </div>

        {/* Company landlord toggle */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
                <Icon name="BuildingIcon" size={15} className="text-[#1B4F8A]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Company Landlord?</p>
                <p className="text-xs text-[hsl(215,15%,52%)]">Property is owned by a company — BR Number and CR copy required</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateField('isCompanyLandlord', !formData.isCompanyLandlord)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isCompanyLandlord ? 'bg-[#1B4F8A]' : 'bg-[hsl(214,20%,88%)]'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${formData.isCompanyLandlord ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {formData.isCompanyLandlord && (
            <div className="space-y-4 pt-2 border-t border-[hsl(214,20%,88%)]">
              <div className="mt-3">
                <InputField
                  label="Company BR Number"
                  value={formData.companyBRNumber}
                  onChange={(v) => updateField('companyBRNumber', v)}
                  placeholder="e.g. 12345678"
                  errorKey="companyBRNumber"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Business Registration (BR) Copy</p>
                <UploadSection
                  label="Company BR Copy"
                  docType="company-br"
                  propertyRef={property.ref}
                  docs={companyBRDocs}
                  uploading={uploading}
                  onUpload={handleUpload}
                  onDownload={handleDownload}
                  onDelete={(doc) => handleDelete(doc, 'company-br')}
                  acceptImages
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Certificate of Registration (CR) Copy — Proof of Signatory</p>
                <UploadSection
                  label="Company CR Copy"
                  docType="company-cr"
                  propertyRef={property.ref}
                  docs={companyCRDocs}
                  uploading={uploading}
                  onUpload={handleUpload}
                  onDownload={handleDownload}
                  onDelete={(doc) => handleDelete(doc, 'company-cr')}
                  acceptImages
                />
              </div>
            </div>
          )}
        </div>

        {/* Landlord HKID / Passport */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)]">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="UserIcon" size={13} className="text-[#1B4F8A]" />Landlord — HKID or Passport
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-[hsl(215,15%,52%)] mb-3">Upload a copy of the landlord's HKID. If the landlord does not have an HKID, upload their passport instead.</p>
            <UploadSection
              label="Landlord HKID / Passport"
              docType="landlord-hkid"
              propertyRef={property.ref}
              docs={landlordHKIDDocs}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'landlord-hkid')}
              acceptImages
            />
          </div>
        </div>

        {/* Tenant HKID / Passport */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)]">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="UsersIcon" size={13} className="text-[#1B4F8A]" />Tenant(s) — HKID or Passport
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-[hsl(215,15%,52%)] mb-3">Upload HKID copies for all tenants. If a tenant does not have an HKID, upload their passport. Multiple files are allowed for multiple tenants.</p>
            <UploadSection
              label="Tenant HKID / Passport"
              docType="tenant-hkid"
              propertyRef={property.ref}
              docs={tenantHKIDDocs}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'tenant-hkid')}
              acceptImages
              multiple
            />
          </div>
        </div>

        <button
          onClick={() => { markStepComplete('id-uploads'); setActiveStep('front-page'); }}
          className="w-full btn-secondary py-2.5 text-sm"
        >
          <Icon name="ArrowRightIcon" size={15} />
          Continue to Tenancy Details
        </button>
      </div>
    );
  }

  function renderFrontPage() {
    const handleSubmit = () => {
      const errors = validateFrontPage();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const touched = new Set(Object.keys(errors));
        setTouchedFields(touched);
        toast.error('Please fix the highlighted errors before continuing');
        return;
      }
      setFieldErrors({});
      markStepComplete('front-page');
      setActiveStep('form2');
    };

    return (
      <div className="space-y-5">
        {/* Template Selection */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-3 uppercase tracking-wider">Tenancy Agreement Template</p>
          <div className="grid grid-cols-2 gap-3">
            {(['without-pets', 'with-pets'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => updateField('templateVersion', v)}
                className={`py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all ${
                  formData.templateVersion === v
                    ? 'bg-[#1B4F8A] text-white border-[#1B4F8A] shadow-md'
                    : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]'
                }`}
              >
                <Icon name={v === 'with-pets' ? 'HeartIcon' : 'HomeIcon'} size={16} className="mx-auto mb-1" />
                {v === 'with-pets' ? 'With Pet Clause' : 'Without Pet Clause'}
              </button>
            ))}
          </div>
        </div>

        {/* Property Details */}
        <div>
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="HomeIcon" size={13} className="text-[#1B4F8A]" />Property Leased
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <InputField label="Property Address" value={formData.propertyAddress} onChange={(v) => updateField('propertyAddress', v)} required errorKey="propertyAddress" />
            </div>
            <InputField label="Monthly Rent (HK$)" value={formData.monthlyRent} onChange={(v) => updateField('monthlyRent', v)} type="number" placeholder="e.g. 25000" required errorKey="monthlyRent" />
            <InputField label="Lease Start Date" value={formData.leaseStart} onChange={(v) => updateField('leaseStart', v)} type="date" required errorKey="leaseStart" />
            <InputField label="Lease End Date" value={formData.leaseEnd} onChange={(v) => updateField('leaseEnd', v)} type="date" />
          </div>
        </div>

        {/* Tenant Info */}
        <div>
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="UserIcon" size={13} className="text-[#1B4F8A]" />Tenant Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Full Name" value={formData.tenantName} onChange={(v) => updateField('tenantName', v)} required errorKey="tenantName" />
            <InputField label="HKID Number" value={formData.tenantIdNumber} onChange={(v) => updateField('tenantIdNumber', v)} placeholder="e.g. A123456(7)" required errorKey="tenantIdNumber" />
            <InputField label="Phone" value={formData.tenantPhone} onChange={(v) => updateField('tenantPhone', v)} />
            <InputField label="Email" value={formData.tenantEmail} onChange={(v) => updateField('tenantEmail', v)} type="email" />
            <div className="sm:col-span-2">
              <InputField label="Current Address" value={formData.tenantAddress} onChange={(v) => updateField('tenantAddress', v)} />
            </div>
          </div>
        </div>

        {/* Landlord Info */}
        <div>
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="BuildingIcon" size={13} className="text-[#1B4F8A]" />Landlord Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Full Name" value={formData.landlordName} onChange={(v) => updateField('landlordName', v)} required errorKey="landlordName" />
            <InputField label="HKID Number" value={formData.landlordIdNumber} onChange={(v) => updateField('landlordIdNumber', v)} placeholder="e.g. B234567(8)" errorKey="landlordIdNumber" />
            <InputField label="Phone" value={formData.landlordPhone} onChange={(v) => updateField('landlordPhone', v)} />
            <InputField label="Email" value={formData.landlordEmail} onChange={(v) => updateField('landlordEmail', v)} type="email" />
            <div className="sm:col-span-2">
              <InputField label="Address" value={formData.landlordAddress} onChange={(v) => updateField('landlordAddress', v)} />
            </div>
            <div className="sm:col-span-2">
              <InputField label="Bank Details (for rent payment)" value={formData.landlordBankDetails} onChange={(v) => updateField('landlordBankDetails', v)} placeholder="e.g. HSBC 123-456789-001" errorKey="landlordBankDetails" />
            </div>
          </div>
        </div>

        {/* Agent Selector */}
        <div>
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="UserCheckIcon" size={13} className="text-[#1B4F8A]" />Handling Agent
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {agentProfiles.map((agent, idx) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => updateField('selectedAgentIndex', idx)}
                className={`p-3 rounded-xl text-left border-2 transition-all ${
                  formData.selectedAgentIndex === idx
                    ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                    : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]'
                }`}
              >
                <p className="text-xs font-bold truncate">{agent.name}</p>
                <p className={`text-[10px] truncate ${formData.selectedAgentIndex === idx ? 'text-blue-200' : 'text-[hsl(215,15%,52%)]'}`}>{agent.licenceNumber}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full btn-primary py-3 text-sm"
        >
          <Icon name="ArrowRightIcon" size={15} />
          Save Details & Continue to Form 2
        </button>
      </div>
    );
  }

  function renderForm2() {
    return (
      <div className="space-y-4">
        <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 border border-[hsl(214,20%,88%)]">
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-3">Auto-populated from Tenancy Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Tenant', value: formData.tenantName },
              { label: 'HKID', value: formData.tenantIdNumber },
              { label: 'Landlord', value: formData.landlordName },
              { label: 'Property', value: formData.propertyAddress },
              { label: 'Monthly Rent', value: formData.monthlyRent ? `HK$${Number(formData.monthlyRent).toLocaleString()}` : '—' },
              { label: 'Agent', value: selectedAgent.name },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-lg px-2.5 py-2 border border-[hsl(214,20%,88%)]">
                <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.label}</p>
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Form 2 — Agent Action Required</p>
              <p className="text-xs text-blue-600 mt-1">
                Download Form 2 and complete the remaining sections by hand. This form must be provided to the prospective tenant before signing the tenancy agreement.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            setGenerating('form2');
            try { await generateForm2PDF(buildForm2Data()); toast.success('Form 2 downloaded'); markStepComplete('form2'); }
            catch { toast.error('Failed to generate Form 2'); }
            finally { setGenerating(null); }
          }}
          disabled={generating === 'form2'}
          className="w-full btn-primary py-3 text-sm"
        >
          <Icon name={generating === 'form2' ? 'LoaderIcon' : 'DownloadIcon'} size={15} className={generating === 'form2' ? 'animate-spin' : ''} />
          {generating === 'form2' ? 'Generating...' : 'Download Form 2 (Auto-populated)'}
        </button>

        {stepStatuses['form2'] === 'completed' && (
          <button onClick={() => setActiveStep('forms56')} className="w-full btn-secondary py-2.5 text-sm">
            <Icon name="ArrowRightIcon" size={15} />Continue to Forms 5 & 6
          </button>
        )}
      </div>
    );
  }

  function renderForms56() {
    if (formData.isCoOp) {
      return (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Icon name="InfoIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Co-operative Tenancy — Forms 5 & 6 Bypassed</p>
                <p className="text-xs text-amber-700 mt-1">
                  Since this is a co-operative tenancy, Forms 5 and 6 are not required. You can proceed directly to the Provisional Tenancy Agreement.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <Icon name="CheckCircleIcon" size={18} className="text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Forms 5 & 6 bypassed for co-op tenancy</p>
          </div>
          {/* Advertising date box also shown for co-op path */}
          <div className="bg-white rounded-xl border-2 border-[#1B4F8A] p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon name="CalendarIcon" size={15} className="text-[#1B4F8A]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Advertising Start Date</h3>
                <p className="text-xs text-[hsl(215,15%,52%)]">Set when advertising begins. A 3-month review reminder will be sent to the listing agent if the property is still active.</p>
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
                onClick={() => setAdvertisingDate(new Date().toISOString().split('T')[0])}
                className="px-4 py-2.5 bg-[#1B4F8A] text-white text-xs font-semibold rounded-lg hover:bg-[#163f6e] transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Icon name="CalendarIcon" size={12} />Set Today
              </button>
            </div>
          </div>
          <button
            onClick={() => { markStepComplete('forms56'); setActiveStep('provisional-ta'); }}
            className="w-full btn-secondary py-2.5 text-sm"
          >
            <Icon name="ArrowRightIcon" size={15} />Continue to Provisional TA
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 border border-[hsl(214,20%,88%)]">
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-3">Auto-populated from Tenancy Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Landlord', value: formData.landlordName },
              { label: 'Landlord HKID', value: formData.landlordIdNumber },
              { label: 'Property', value: formData.propertyAddress },
              { label: 'Monthly Rent', value: formData.monthlyRent ? `HK$${Number(formData.monthlyRent).toLocaleString()}` : '—' },
              { label: 'Agent', value: selectedAgent.name },
              { label: 'Licence No.', value: selectedAgent.licenceNumber },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-lg px-2.5 py-2 border border-[hsl(214,20%,88%)]">
                <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.label}</p>
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Form 5 */}
          <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Icon name="FileTextIcon" size={15} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Form 5</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)]">Estate Agency Agreement for Leasing</p>
              </div>
            </div>
            <button
              onClick={async () => {
                setGenerating('form5');
                try { await generateForm5PDF(buildForm5Data()); toast.success('Form 5 downloaded'); }
                catch { toast.error('Failed to generate Form 5'); }
                finally { setGenerating(null); }
              }}
              disabled={generating === 'form5'}
              className="w-full btn-primary py-2 text-xs"
            >
              <Icon name={generating === 'form5' ? 'LoaderIcon' : 'DownloadIcon'} size={12} className={generating === 'form5' ? 'animate-spin' : ''} />
              {generating === 'form5' ? 'Generating...' : 'Download Form 5'}
            </button>
          </div>

          {/* Form 6 */}
          <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Icon name="FileTextIcon" size={15} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Form 6</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)]">Property Information Form for Leasing</p>
              </div>
            </div>
            <button
              onClick={async () => {
                setGenerating('form6');
                try { await generateForm6PDF(buildForm6Data()); toast.success('Form 6 downloaded'); }
                catch { toast.error('Failed to generate Form 6'); }
                finally { setGenerating(null); }
              }}
              disabled={generating === 'form6'}
              className="w-full btn-primary py-2 text-xs"
            >
              <Icon name={generating === 'form6' ? 'LoaderIcon' : 'DownloadIcon'} size={12} className={generating === 'form6' ? 'animate-spin' : ''} />
              {generating === 'form6' ? 'Generating...' : 'Download Form 6'}
            </button>
          </div>
        </div>

        {/* ── Advertising Date Box ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border-2 border-[#1B4F8A] p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon name="CalendarIcon" size={15} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Advertising Start Date</h3>
              <p className="text-xs text-[hsl(215,15%,52%)]">Set when Form 5 is signed and advertising begins. A 3-month review reminder will be sent to the listing agent if the property is still active.</p>
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
                    property_ref: property.ref,
                    property_address: formData.propertyAddress,
                    advertising_date: advertisingDate,
                    reminder_due_date: reminderDue.toISOString().split('T')[0],
                    agent_name: agent?.name ?? '',
                    agent_email: agent?.email ?? '',
                    workflow_type: 'tenancy',
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

        <button
          onClick={() => { markStepComplete('forms56'); setActiveStep('provisional-ta'); }}
          className="w-full btn-secondary py-2.5 text-sm"
        >
          <Icon name="ArrowRightIcon" size={15} />
          Continue to Provisional TA
        </button>
      </div>
    );
  }

  function renderProvisionalTA() {
    const ptaDocs = docs['provisional-ta'] ?? [];
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertCircleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Provisional Tenancy Agreement</p>
              <p className="text-xs text-amber-700 mt-1">
                The PTA must be physically signed by both parties. Once signed, scan and upload the PDF below. Record the 1-month deposit payment method.
              </p>
            </div>
          </div>
        </div>

        {/* 1-month deposit payment method */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4">
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon name="BanknoteIcon" size={13} className="text-[#1B4F8A]" />1-Month Deposit — Payment Method
          </p>
          {formData.monthlyRent && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">1 Month Deposit:</span> HK${Number(formData.monthlyRent).toLocaleString()}
              </p>
            </div>
          )}
          <PaymentMethodSelector
            label="Paid by"
            value={formData.ptaDepositMethod}
            onChange={(v) => updateField('ptaDepositMethod', v)}
            errorKey="ptaDepositMethod"
            includeCash
          />
        </div>

        <UploadSection
          label="Signed Provisional Tenancy Agreement"
          docType="provisional-ta"
          propertyRef={property.ref}
          docs={ptaDocs}
          uploading={uploading}
          onUpload={handleUpload}
          onDownload={handleDownload}
          onDelete={(doc) => handleDelete(doc, 'provisional-ta')}
        />

        {ptaDocs.length > 0 && (
          <button onClick={() => setActiveStep('tenancy-agreement')} className="w-full btn-secondary py-2.5 text-sm">
            <Icon name="ArrowRightIcon" size={15} />Continue to Tenancy Agreement
          </button>
        )}
      </div>
    );
  }

  function renderTenancyAgreement() {
    const signedDocs = docs['tenancy-agreement-signed'] ?? [];

    const handleGenerateTA = async () => {
      const errors = validateTenancyAgreementStep();
      if (Object.keys(errors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...errors }));
        toast.error('Please fix inventory errors before generating the Tenancy Agreement');
        return;
      }
      setFieldErrors((prev) => { const next = { ...prev }; delete next.inventoryItems; return next; });
      setGenerating('ta');
      try {
        const { generateTAPDF } = await import('@/lib/generateForm3');
        await generateTAPDF({
          ...formData,
          agentName: selectedAgent.name,
          agentLicenceNumber: selectedAgent.licenceNumber,
        });
        toast.success('Tenancy Agreement downloaded');
      } catch {
        toast.error('Failed to generate Tenancy Agreement');
      } finally {
        setGenerating(null);
      }
    };

    return (
      <div className="space-y-4">
        {/* Template info */}
        <div className="bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="FileTextIcon" size={16} className="text-[#1B4F8A]" />
              <div>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                  Template: {formData.templateVersion === 'with-pets' ? 'With Pet Clause' : 'Without Pet Clause'}
                </p>
                <p className="text-xs text-[hsl(215,15%,52%)]">Homes R Us Tenancy Agreement 2026</p>
              </div>
            </div>
            <button onClick={() => setActiveStep('front-page')} className="text-xs text-[#1B4F8A] hover:underline">Change</button>
          </div>
        </div>

        {/* Deposit & 1st month payment */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
            <Icon name="BanknoteIcon" size={13} className="text-[#1B4F8A]" />Formal TA — Deposit & First Month Rent
          </p>
          {formData.monthlyRent && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">1 Month Deposit:</span> HK${Number(formData.monthlyRent).toLocaleString()} &nbsp;·&nbsp;
                <span className="font-semibold">1st Month Rent:</span> HK${Number(formData.monthlyRent).toLocaleString()}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PaymentMethodSelector
              label="1 Month Deposit — Paid by *"
              value={formData.depositMethod}
              onChange={(v) => updateField('depositMethod', v)}
              errorKey="depositMethod"
              includeCash
            />
            <PaymentMethodSelector
              label="1st Month Rent — Paid by *"
              value={formData.firstMonthMethod}
              onChange={(v) => updateField('firstMonthMethod', v)}
              errorKey="firstMonthMethod"
              includeCash
            />
          </div>
        </div>

        {/* Auto-populated summary */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)]">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider">Auto-populated Fields</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Landlord', value: formData.landlordName },
              { label: 'Landlord HKID', value: formData.landlordIdNumber },
              { label: 'Landlord Address', value: formData.landlordAddress },
              { label: 'Bank Details', value: formData.landlordBankDetails },
              { label: 'Tenant', value: formData.tenantName },
              { label: 'Tenant HKID', value: formData.tenantIdNumber },
              { label: 'Monthly Rent', value: formData.monthlyRent ? `HK$${Number(formData.monthlyRent).toLocaleString()}` : '—' },
              { label: 'Lease Start', value: formData.leaseStart },
              { label: 'Lease End', value: formData.leaseEnd },
              { label: 'Deposit (1 mo.)', value: formData.monthlyRent ? `HK$${Number(formData.monthlyRent).toLocaleString()}` : '—' },
              { label: 'Deposit Method', value: formData.depositMethod || '—' },
              { label: '1st Month Method', value: formData.firstMonthMethod || '—' },
            ].map((f) => (
              <div key={f.label} className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2">
                <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.label}</p>
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Editable Inventory List */}
        <div className={`border rounded-xl overflow-hidden ${fieldErrors.inventoryItems ? 'border-red-400' : 'border-[hsl(214,20%,88%)]'}`}>
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="ListIcon" size={13} className="text-[#1B4F8A]" />Inventory List
            </p>
            <span className="text-[10px] text-[hsl(215,15%,52%)]">{formData.inventoryItems.length} items</span>
          </div>
          {fieldErrors.inventoryItems && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-1.5">
              <Icon name="AlertCircleIcon" size={12} className="text-red-500 flex-shrink-0" />
              <p className="text-[11px] text-red-600">{fieldErrors.inventoryItems}</p>
            </div>
          )}
          <div className="p-4 space-y-2">
            {formData.inventoryItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <Icon name="CheckCircleIcon" size={13} className={`flex-shrink-0 ${!item.trim() ? 'text-red-400' : 'text-emerald-500'}`} />
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const updated = [...formData.inventoryItems];
                    updated[idx] = e.target.value;
                    updateField('inventoryItems', updated);
                    const invErr = validateInventoryItems(updated);
                    setFieldErrors((prev) => ({ ...prev, inventoryItems: invErr || undefined }));
                  }}
                  placeholder="Enter item description..."
                  className={`flex-1 text-xs px-2 py-1.5 border rounded hover:border-[hsl(214,20%,88%)] focus:outline-none focus:ring-1 bg-transparent focus:bg-white transition-all ${
                    !item.trim()
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-200' :'border-transparent focus:border-[#1B4F8A] focus:ring-[#1B4F8A]/20'
                  }`}
                />
                <button
                  onClick={() => {
                    const updated = formData.inventoryItems.filter((_, i) => i !== idx);
                    updateField('inventoryItems', updated);
                    const invErr = validateInventoryItems(updated);
                    setFieldErrors((prev) => ({ ...prev, inventoryItems: invErr || undefined }));
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 transition-all"
                >
                  <Icon name="XIcon" size={12} className="text-red-400" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <Icon name="PlusCircleIcon" size={13} className="text-[hsl(215,15%,52%)] flex-shrink-0" />
              <input
                type="text"
                value={newInventoryItem}
                onChange={(e) => setNewInventoryItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newInventoryItem.trim()) {
                    updateField('inventoryItems', [...formData.inventoryItems, newInventoryItem.trim()]);
                    setNewInventoryItem('');
                  }
                }}
                placeholder="Add inventory item (press Enter)"
                className="flex-1 text-xs px-2 py-1.5 border border-dashed border-[hsl(214,20%,88%)] rounded focus:border-[#1B4F8A] focus:outline-none focus:ring-1 focus:ring-[#1B4F8A]/20 bg-transparent transition-all"
              />
              <button
                onClick={() => {
                  if (newInventoryItem.trim()) {
                    updateField('inventoryItems', [...formData.inventoryItems, newInventoryItem.trim()]);
                    setNewInventoryItem('');
                  }
                }}
                className="p-1.5 rounded bg-[#1B4F8A] text-white hover:bg-[#163d6e] transition-colors"
              >
                <Icon name="PlusIcon" size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Generate TA button */}
        <button
          onClick={handleGenerateTA}
          disabled={generating === 'ta'}
          className="w-full btn-primary py-3 text-sm"
        >
          <Icon name={generating === 'ta' ? 'LoaderIcon' : 'DownloadIcon'} size={15} className={generating === 'ta' ? 'animate-spin' : ''} />
          {generating === 'ta' ? 'Generating...' : 'Generate & Download Tenancy Agreement'}
        </button>

        {/* Physical signature upload */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)]">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider">Upload Physically Signed Agreement</p>
          </div>
          <div className="p-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-amber-800">
                <Icon name="AlertCircleIcon" size={12} className="inline mr-1" />
                Print the tenancy agreement, have both parties physically sign it, then scan and upload the signed PDF below.
              </p>
            </div>
            <UploadSection
              label="Signed Tenancy Agreement"
              docType="tenancy-agreement-signed"
              propertyRef={property.ref}
              docs={signedDocs}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'tenancy-agreement-signed')}
            />
          </div>
        </div>

        {signedDocs.length > 0 && (
          <button onClick={() => { markStepComplete('tenancy-agreement'); sendWorkflowNotification('lease-signed'); setActiveStep('stamp-duty'); }} className="w-full btn-secondary py-2.5 text-sm">
            <Icon name="ArrowRightIcon" size={15} />Continue to Stamp Duty
          </button>
        )}
      </div>
    );
  }

  function renderStampDuty() {
    return (
      <div className="space-y-4">
        <div className="bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center flex-shrink-0">
              <Icon name="ExternalLinkIcon" size={18} className="text-[#1B4F8A]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Stamp Duty — External Government Submission</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                Stamp duty must be submitted to the Inland Revenue Department via the government portal. Click the button below to open the IRD Stamp Duty portal.
              </p>
            </div>
          </div>
        </div>

        <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Reference Details for Submission</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Property', value: formData.propertyAddress },
              { label: 'Monthly Rent', value: formData.monthlyRent ? `HK$${Number(formData.monthlyRent).toLocaleString()}` : '—' },
              { label: 'Lease Start', value: formData.leaseStart },
              { label: 'Lease End', value: formData.leaseEnd },
              { label: 'Landlord', value: formData.landlordName },
              { label: 'Tenant', value: formData.tenantName },
            ].map((f) => (
              <div key={f.label} className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2">
                <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.label}</p>
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <a
          href="https://btp.etax.ird.gov.hk/fe/pw/reg/btp/btpstampingmenu?language=EN_US"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#1B4F8A] text-white rounded-xl text-sm font-semibold hover:bg-[#163d6e] transition-colors shadow-md"
        >
          <Icon name="ExternalLinkIcon" size={16} />
          Open IRD Stamp Duty Portal
        </a>

        <p className="text-[10px] text-center text-[hsl(215,15%,52%)]">
          Opens: btp.etax.ird.gov.hk — Inland Revenue Department, Hong Kong
        </p>

        <button
          onClick={() => { markStepComplete('stamp-duty'); sendWorkflowNotification('stamp-duty-filed'); setActiveStep('cr109'); }}
          className="w-full btn-secondary py-2.5 text-sm"
        >
          <Icon name="CheckIcon" size={15} />
          Mark Stamp Duty Submitted & Continue to CR109
        </button>
      </div>
    );
  }

  function renderCR109() {
    return (
      <div className="space-y-4">
        <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 border border-[hsl(214,20%,88%)]">
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-3">Auto-populated from Tenancy Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Property', value: formData.propertyAddress },
              { label: 'Landlord', value: formData.landlordName },
              { label: 'Tenant', value: formData.tenantName },
              { label: 'Monthly Rent', value: formData.monthlyRent ? `HK$${Number(formData.monthlyRent).toLocaleString()}` : '—' },
              { label: 'Lease Start', value: formData.leaseStart },
              { label: 'Lease End', value: formData.leaseEnd },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-lg px-2.5 py-2 border border-[hsl(214,20%,88%)]">
                <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.label}</p>
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="AlertCircleIcon" size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Submission Deadline</p>
              <p className="text-xs text-red-700 mt-1">
                CR109 must be submitted to the Commissioner of Rating and Valuation within <strong>30 days</strong> of tenancy commencement. Failure to submit may result in a fine.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            setGenerating('cr109');
            try { await generateCR109PDF(buildCR109Data()); toast.success('CR109 downloaded'); markStepComplete('cr109'); }
            catch { toast.error('Failed to generate CR109'); }
            finally { setGenerating(null); }
          }}
          disabled={generating === 'cr109'}
          className="w-full btn-primary py-3 text-sm"
        >
          <Icon name={generating === 'cr109' ? 'LoaderIcon' : 'DownloadIcon'} size={15} className={generating === 'cr109' ? 'animate-spin' : ''} />
          {generating === 'cr109' ? 'Generating...' : 'Download CR109 (Auto-populated)'}
        </button>

        {stepStatuses['cr109'] === 'completed' && (
          <button onClick={() => { setActiveStep('handover'); }} className="w-full btn-secondary py-2.5 text-sm">
            <Icon name="ArrowRightIcon" size={15} />Continue to Handover
          </button>
        )}
      </div>
    );
  }

  function renderHandover() {
    const handoverPhotos = docs['handover-photos'] ?? [];
    const handoverForm = docs['handover-form'] ?? [];
    const handoverInvoice = docs['handover-invoice'] ?? [];
    const handoverReceipt = docs['handover-receipt'] ?? [];

    const allHandoverComplete =
      handoverPhotos.length > 0 &&
      handoverForm.length > 0 &&
      handoverInvoice.length > 0 &&
      handoverReceipt.length > 0;

    return (
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon name="KeyIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Key Handover Documentation</p>
              <p className="text-xs text-blue-600 mt-1">
                Upload all handover documents: photos of the property condition, the signed handover form, and the invoice and receipt for the tenancy.
              </p>
            </div>
          </div>
        </div>

        {/* Handover Photos */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="CameraIcon" size={13} className="text-[#1B4F8A]" />Handover Photos
            </p>
            {handoverPhotos.length > 0 && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={11} />{handoverPhotos.length} uploaded
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs text-[hsl(215,15%,52%)] mb-3">Upload photos documenting the property condition at handover. Multiple photos allowed.</p>
            <UploadSection
              label="Handover Photos"
              docType="handover-photos"
              propertyRef={property.ref}
              docs={handoverPhotos}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'handover-photos')}
              acceptImages
              multiple
            />
          </div>
        </div>

        {/* Handover Form */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="ClipboardListIcon" size={13} className="text-[#1B4F8A]" />Handover Form
            </p>
            {handoverForm.length > 0 && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={11} />Uploaded
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs text-[hsl(215,15%,52%)] mb-3">Upload the signed handover form documenting the condition of the property and items handed over.</p>
            <UploadSection
              label="Signed Handover Form"
              docType="handover-form"
              propertyRef={property.ref}
              docs={handoverForm}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'handover-form')}
              acceptImages
            />
          </div>
        </div>

        {/* Invoice */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="FileTextIcon" size={13} className="text-[#1B4F8A]" />Invoice
            </p>
            {handoverInvoice.length > 0 && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={11} />Uploaded
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-[hsl(215,15%,52%)]">Generate an invoice using the system or upload an existing one.</p>
            <button
              onClick={() => setShowInvoiceGenerator(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1B4F8A] text-white rounded-xl text-sm font-semibold hover:bg-[#163d6e] transition-colors"
            >
              <Icon name="FileTextIcon" size={15} />
              Generate Invoice
            </button>
            <UploadSection
              label="Invoice (PDF)"
              docType="handover-invoice"
              propertyRef={property.ref}
              docs={handoverInvoice}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'handover-invoice')}
            />
          </div>
        </div>

        {/* Receipt */}
        <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="ReceiptIcon" size={13} className="text-[#1B4F8A]" />Receipt
            </p>
            {handoverReceipt.length > 0 && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={11} />Uploaded
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-[hsl(215,15%,52%)]">Upload the signed receipt confirming payment of deposit and first month rent.</p>
            <UploadSection
              label="Receipt (PDF)"
              docType="handover-receipt"
              propertyRef={property.ref}
              docs={handoverReceipt}
              uploading={uploading}
              onUpload={handleUpload}
              onDownload={handleDownload}
              onDelete={(doc) => handleDelete(doc, 'handover-receipt')}
            />
          </div>
        </div>

        {allHandoverComplete && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <Icon name="CheckCircleIcon" size={28} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-800">Tenancy Workflow Complete</p>
            <p className="text-xs text-emerald-600 mt-1">All steps have been completed. The tenancy has been fully processed.</p>
            <button
              onClick={() => { markStepComplete('handover'); sendWorkflowNotification('key-handover-scheduled'); }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Icon name="CheckIcon" size={15} />
              Mark Handover Complete
            </button>
          </div>
        )}

        {!allHandoverComplete && (
          <div className="bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] rounded-xl p-3">
            <p className="text-xs text-[hsl(215,15%,52%)] text-center">Upload all 4 items above to complete the handover step</p>
            <div className="flex justify-center gap-4 mt-2">
              {[
                { label: 'Photos', done: handoverPhotos.length > 0 },
                { label: 'Form', done: handoverForm.length > 0 },
                { label: 'Invoice', done: handoverInvoice.length > 0 },
                { label: 'Receipt', done: handoverReceipt.length > 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <Icon name={item.done ? 'CheckCircleIcon' : 'CircleIcon'} size={12} className={item.done ? 'text-emerald-500' : 'text-[hsl(215,15%,62%)]'} />
                  <span className={`text-[10px] font-medium ${item.done ? 'text-emerald-600' : 'text-[hsl(215,15%,52%)]'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showInvoiceGenerator && (
          <InvoiceGenerator
            invoiceType="tenancy"
            ownerName={formData.landlordName}
            counterpartyName={formData.tenantName}
            propertyAddress={formData.propertyAddress}
            monthlyRent={formData.monthlyRent}
            onClose={() => setShowInvoiceGenerator(false)}
          />
        )}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  const activeStepConfig = STEPS.find((s) => s.id === activeStep)!;

  return (
    <div className="space-y-4">
      {/* Progress tracker */}
      <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)]">
          <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider">Tenancy Workflow</p>
          <p className="text-[10px] text-[hsl(215,15%,52%)] mt-0.5">
            {Object.values(stepStatuses).filter((s) => s === 'completed').length} of {STEPS.length} steps completed
          </p>
        </div>
        <div className="p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STEPS.map((step, idx) => {
              const status = stepStatuses[step.id];
              const isActive = activeStep === step.id;
              const isClickable = status !== 'pending';
              return (
                <button
                  key={step.id}
                  onClick={() => navigateToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-center transition-all min-w-[64px] ${
                    isActive
                      ? 'bg-[#1B4F8A] text-white shadow-md'
                      : status === 'completed' ?'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : status === 'in-progress' ?'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' :'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,62%)] cursor-not-allowed'
                  }`}
                >
                  <div className="relative">
                    <Icon
                      name={status === 'completed' ? 'CheckCircleIcon' : step.icon as Parameters<typeof Icon>[0]['name']}
                      size={16}
                    />
                    <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-white text-[#1B4F8A]' : status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-[hsl(215,15%,52%)] text-white'
                    }`}>
                      {idx + 1}
                    </span>
                  </div>
                  <span className="text-[9px] font-semibold leading-tight">{step.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active step content */}
      <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name={activeStepConfig.icon as Parameters<typeof Icon>[0]['name']} size={15} className="text-[#1B4F8A]" />
            <div>
              <p className="text-sm font-bold text-[hsl(215,25%,18%)]">{activeStepConfig.label}</p>
              <p className="text-[10px] text-[hsl(215,15%,52%)]">{activeStepConfig.description}</p>
            </div>
          </div>
          <StepBadge status={stepStatuses[activeStep]} />
        </div>
        <div className="p-4">
          {activeStep === 'landsearch' && renderLandsearch()}
          {activeStep === 'rv' && renderRV()}
          {activeStep === 'id-uploads' && renderIDUploads()}
          {activeStep === 'front-page' && renderFrontPage()}
          {activeStep === 'form2' && renderForm2()}
          {activeStep === 'forms56' && renderForms56()}
          {activeStep === 'provisional-ta' && renderProvisionalTA()}
          {activeStep === 'tenancy-agreement' && renderTenancyAgreement()}
          {activeStep === 'stamp-duty' && renderStampDuty()}
          {activeStep === 'cr109' && renderCR109()}
          {activeStep === 'handover' && renderHandover()}
        </div>
      </div>
    </div>
  );
}
