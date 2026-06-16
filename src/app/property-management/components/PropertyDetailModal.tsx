'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';

import StatusBadge from '@/components/ui/StatusBadge';
import { Property, transactions, agentNames, agentProfiles, PropertyContact, AgentCommission, PropertyComment, HistoryEntry, ALL_ADDITIONAL_FEATURES, ALL_DIRECTIONS, ALL_VIEWS, ALL_DECORATIONS, ALL_FURNISHINGS, AdditionalFeature, DirectionType, ViewType, DecorationType, FurnishingType, BuildingType, FloorType, FloorNumber, ALL_FLOOR_TYPES, ALL_FLOOR_NUMBERS } from './mockData';
import { toast } from 'sonner';
import ViewingSchedule from './ViewingSchedule';
import { generateForm3PDF, Form3Data } from '@/lib/generateForm3';
import { generateForm5PDF, Form5Data } from '@/lib/generateForm5';
import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/eventTracker';
import { useViewingsRealtime, usePropertyDocumentsRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';
import TenancyWorkflow from './TenancyWorkflow';
import InvoiceGenerator from './InvoiceGenerator';
import PhotoGalleryV2 from './PhotoGalleryV2';

interface PropertyDetailModalProps {
  property: Property;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Formats a floor value for display.
 * If the value is a 3-digit number (e.g. "309"), it is interpreted as
 * Block <first digit>, Floor <remaining digits stripped of leading zeros>.
 * e.g. "309" → "Block 3, Floor 9" *"308"→ "Block 3, Floor 8" *"212"→ "Block 2, Floor 12" * Other values (e.g."9", "G", "LG") are returned as-is.
 */
function formatFloorDisplay(floor?: string | null): string {
  if (!floor) return '—';
  const trimmed = floor.trim();
  // Match exactly 3 digits where first digit is non-zero (block number)
  if (/^[1-9]\d{2}$/.test(trimmed)) {
    const block = trimmed[0];
    const floorNum = String(parseInt(trimmed.slice(1), 10));
    return `Block ${block}, Floor ${floorNum}`;
  }
  return trimmed;
}

type Tab = 'overview' | 'tenancy' | 'documents' | 'transactions' | 'hk-forms' | 'history';

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: 'HomeIcon' },
  { id: 'tenancy', label: 'Tenancy', icon: 'KeyIcon' },
  { id: 'documents', label: 'Documents', icon: 'FolderIcon' },
  { id: 'transactions', label: 'Transactions', icon: 'ArrowLeftRightIcon' },
  { id: 'hk-forms', label: 'HK Forms', icon: 'FileTextIcon' },
  { id: 'history', label: 'History', icon: 'ClockIcon' },
];

const commissionCategories: Array<{ key: keyof AgentCommission; label: string; code: string; percentage: string }> = [
  { key: 'newListing', label: 'New Listing', code: 'NL', percentage: '2.5%' },
  { key: 'eaaForm', label: 'EAA Form 3/5', code: 'EF', percentage: '2.5%' },
  { key: 'newPhotos', label: 'New Photos', code: 'NP', percentage: '3%' },
  { key: 'newMatterport', label: 'New Matterport', code: 'NM', percentage: '3.5%' },
  { key: 'newKey', label: 'New Key', code: 'NK', percentage: '3.5%' },
  { key: 'newTelephone', label: 'New Telephone', code: 'NT', percentage: '5%' },
];

const emptyContact = (): PropertyContact => ({
  id: `c-new-${Date.now()}`,
  name: '',
  relationship: '',
  mobile: '',
  email: '',
  telephone: '',
});

interface GovValuationDoc {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number | null;
  uploaded_at: string;
  notes: string | null;
}

interface TenancyAgreementDoc {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  uploaded_at: string;
  notes?: string;
}

export default function PropertyDetailModal({ property, onClose, onSaved }: PropertyDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [generatingForm, setGeneratingForm] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [commission, setCommission] = useState<AgentCommission>(property.agentCommission ?? {});
  const [contacts, setContacts] = useState<PropertyContact[]>(property.contacts ?? []);
  const [editingContact, setEditingContact] = useState<PropertyContact | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<PropertyContact>(emptyContact());

  // Decision Maker state
  const [decisionMaker, setDecisionMaker] = useState<{ name: string; phone: string; email: string }>(() => {
    const dm = (property.contacts ?? []).find((c) => c.isDecisionMaker);
    return { name: dm?.name ?? '', phone: dm?.mobile ?? '', email: dm?.email ?? '' };
  });
  const [editingDecisionMaker, setEditingDecisionMaker] = useState(false);
  const [decisionMakerDraft, setDecisionMakerDraft] = useState<{ name: string; phone: string; email: string }>({ name: '', phone: '', email: '' });

  // Imported contacts from property_contacts table (CSV-uploaded)
  const [importedContacts, setImportedContacts] = useState<Array<{ id: string; contact_role: string; contact_person: string; contact_number: string; contact_email: string; short_code: string | null; property_ref: string | null }>>([]);
  const [importedContactsLoading, setImportedContactsLoading] = useState(false);
  const [editingImportedContactId, setEditingImportedContactId] = useState<string | null>(null);
  const [importedContactDraft, setImportedContactDraft] = useState<{ contact_person: string; contact_number: string; contact_email: string; contact_role: string }>({ contact_person: '', contact_number: '', contact_email: '', contact_role: '' });
  const [savingImportedContact, setSavingImportedContact] = useState(false);

  // Add Owner / Add Landlord inline form state
  const [showAddOwnerForm, setShowAddOwnerForm] = useState(false);
  const [showAddLandlordForm, setShowAddLandlordForm] = useState(false);
  const [newOwnerDraft, setNewOwnerDraft] = useState({ contact_person: '', contact_number: '', contact_email: '', id_cr_no: '' });
  const [newLandlordDraft, setNewLandlordDraft] = useState({ contact_person: '', contact_number: '', contact_email: '', id_cr_no: '' });
  const [savingNewOwner, setSavingNewOwner] = useState(false);
  const [savingNewLandlord, setSavingNewLandlord] = useState(false);

  // Gross sqft state
  const [grossSqft, setGrossSqft] = useState<string>(property.grossSqft ? String(property.grossSqft) : '');
  // Net sqft state
  const [netSqft, setNetSqft] = useState<string>(property.sqft ? String(property.sqft) : '');
  // Owner bubble state
  const [showOwnerBubble, setShowOwnerBubble] = useState(false);

  // Pricing & dates state
  const [salePrice, setSalePrice] = useState<string>(property.salePrice ? String(property.salePrice) : '');
  const [rentalPrice, setRentalPrice] = useState<string>(property.monthlyRent ? String(property.monthlyRent) : '');
  const [listingDate, setListingDate] = useState<string>(property.listingDate ?? '');
  const [vacantDate, setVacantDate] = useState<string>(property.vacantDate ?? '');
  const [showListingCalendar, setShowListingCalendar] = useState(false);
  const [showVacantCalendar, setShowVacantCalendar] = useState(false);
  const [listingCalMonth, setListingCalMonth] = useState<Date>(() => {
    if (property.listingDate) {
      const parts = property.listingDate.split('/');
      if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, 1);
    }
    return new Date();
  });
  const [vacantCalMonth, setVacantCalMonth] = useState<Date>(() => {
    if (property.vacantDate) {
      const parts = property.vacantDate.split('/');
      if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, 1);
    }
    return new Date();
  });
  const [publishToWebsite, setPublishToWebsite] = useState<string>((property as any).publishDt ?? '');
  const [editingPricing, setEditingPricing] = useState(false);
  const [publishingSaving, setPublishingSaving] = useState(false);

  // Sync price fields when the parent re-passes a freshly-fetched property prop
  useEffect(() => {
    setSalePrice(property.salePrice ? String(property.salePrice) : '');
  }, [property.salePrice]);

  useEffect(() => {
    setRentalPrice(property.monthlyRent ? String(property.monthlyRent) : '');
  }, [property.monthlyRent]);

  // Matterport state
  const [matterportLink, setMatterportLink] = useState<string>(property.matterportLink ?? '');
  const [editingMatterport, setEditingMatterport] = useState(false);
  const [matterportDraft, setMatterportDraft] = useState<string>(property.matterportLink ?? '');

  // Photo gallery state
  const [galleryPhotos, setGalleryPhotos] = useState<Array<{ id: string; url: string }>>(
    property.photos && property.photos.length > 0
      ? property.photos.map((url, i) => ({ id: `local-${i}`, url }))
      : []
  );
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);
  const listingCalBtnRef = useRef<HTMLButtonElement>(null);
  const vacantCalBtnRef = useRef<HTMLButtonElement>(null);
  const [listingCalPos, setListingCalPos] = useState<{top: number; left: number} | null>(null);
  const [vacantCalPos, setVacantCalPos] = useState<{top: number; left: number} | null>(null);

  // Fetch photos from Supabase on mount (property_photos table + storage fallback)
  useEffect(() => {
    let cancelled = false;
    async function fetchPhotos() {
      try {
        const supabase = createClient();
        const propertyRef = property.ref || property.unit;

        // Primary: property_photos table (populated by ZIP bulk import)
        if (propertyRef) {
          const { data: rows } = await supabase
            .from('property_photos')
            .select('id, public_url')
            .eq('property_ref', propertyRef)
            .order('display_order', { ascending: true });
          if (!cancelled && rows && rows.length > 0) {
            const photos = rows
              .filter((r: { id: string; public_url: string }) => r.public_url)
              .map((r: { id: string; public_url: string }) => ({ id: r.id, url: r.public_url }));
            if (photos.length > 0) {
              setGalleryPhotos(photos);
              setActivePhotoIndex(0);
              return;
            }
          }
        }

        // Fallback: property-documents storage bucket (manually uploaded photos)
        const { data: files } = await supabase.storage
          .from('property-photos')
          .list(`property-photos/${property.id}`, { sortBy: { column: 'created_at', order: 'asc' } });
        if (!cancelled && files && files.length > 0) {
          const photos = files
            .map((f, i) => {
              const { data: urlData } = supabase.storage
                .from('property-photos')
                .getPublicUrl(`property-photos/${property.id}/${f.name}`);
              return urlData?.publicUrl ? { id: `storage-${i}`, url: urlData.publicUrl } : null;
            })
            .filter(Boolean) as Array<{ id: string; url: string }>;
          if (photos.length > 0) {
            setGalleryPhotos(photos);
            setActivePhotoIndex(0);
          }
        }
      } catch {
        // silently ignore — gallery stays empty
      }
    }
    // Only fetch from Supabase if property.photos is empty (avoid overwriting manually set photos)
    if (!property.photos || property.photos.length === 0) {
      fetchPhotos();
    }
    return () => { cancelled = true; };
  }, [property.id, property.ref, property.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Photo drag-and-drop reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Save new photo order to Supabase (display_order)
  const savePhotoOrder = useCallback(async (photos: Array<{ id: string; url: string }>) => {
    try {
      const supabase = createClient();
      // Only update rows that have real DB IDs (not local- or storage- prefixed)
      const updates = photos
        .map((p, i) => ({ id: p.id, display_order: i }))
        .filter((u) => !u.id.startsWith('local-') && !u.id.startsWith('storage-'));
      if (updates.length === 0) return;
      await Promise.all(
        updates.map(({ id, display_order }) =>
          supabase
            .from('property_photos')
            .update({ display_order })
            .eq('id', id)
        )
      );
    } catch {
      // silently ignore save errors — local order is still updated
    }
  }, []);

  const handlePhotoDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handlePhotoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handlePhotoDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const sourceIndex = !isNaN(fromIndex) ? fromIndex : dragIndex;
    if (sourceIndex === null || sourceIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setGalleryPhotos((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(dropIndex, 0, moved);
      // Save new order to Supabase
      savePhotoOrder(updated);
      return updated;
    });
    setActivePhotoIndex(dropIndex);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handlePhotoDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Comments state
  const [comments, setComments] = useState<PropertyComment[]>(property.comments ?? []);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentAgent, setNewCommentAgent] = useState(agentNames[0]);

  // History state
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>(property.historyLog ?? []);

  // Highlight state
  const [highlight, setHighlight] = useState<string>(property.highlight ?? '');
  const [editingHighlight, setEditingHighlight] = useState(false);
  const [highlightDraft, setHighlightDraft] = useState(property.highlight ?? '');

  // Property details state (new fields)
  const [bedrooms, setBedrooms] = useState<string>(
    property.bedrooms === 0 ? 'Studio' : property.bedrooms != null ? String(property.bedrooms) : ''
  );
  const [bathrooms, setBathrooms] = useState<string>(property.bathrooms != null ? String(property.bathrooms) : '');
  const [direction, setDirection] = useState<DirectionType | ''>(property.direction ?? '');
  const [view, setView] = useState<ViewType | ''>(property.view ?? '');
  const [decoration, setDecoration] = useState<DecorationType | ''>(property.decoration ?? '');
  const [originalFurnishing, setOriginalFurnishing] = useState<FurnishingType | ''>(property.originalFurnishing ?? '');
  const [outdoorArea, setOutdoorArea] = useState<string>(property.outdoorArea ?? '');
  const [additionalFeatures, setAdditionalFeatures] = useState<AdditionalFeature[]>(property.additionalFeatures ?? []);
  const [websiteLink, setWebsiteLink] = useState<string>(property.websiteLink ?? '');
  const [engRemark, setEngRemark] = useState<string>((property as any).engRemark ?? '');
  const [chiRemark, setChiRemark] = useState<string>((property as any).chiRemark ?? '');
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [engRemarkDraft, setEngRemarkDraft] = useState<string>((property as any).engRemark ?? '');
  const [chiRemarkDraft, setChiRemarkDraft] = useState<string>((property as any).chiRemark ?? '');
  // Feature tick-boxes — initialize from additionalFeatures array (set by dbRowToProperty)
  const [hasBalcony, setHasBalcony] = useState<boolean>(
    (property as any).hasBalcony ?? (property.additionalFeatures?.includes('Balcony') ?? false)
  );
  const [hasCombined, setHasCombined] = useState<boolean>(
    (property as any).hasCombined ?? (property.additionalFeatures?.includes('Combined Unit') ?? false)
  );
  const [hasDuplex, setHasDuplex] = useState<boolean>(
    (property as any).hasDuplex ?? (property.additionalFeatures?.includes('Duplex') ?? false)
  );
  const [hasGarden, setHasGarden] = useState<boolean>(
    (property as any).hasGarden ?? (property.additionalFeatures?.includes('Garden') ?? false)
  );
  const [hasOpenkitch, setHasOpenkitch] = useState<boolean>(
    (property as any).hasOpenkitch ?? (property.additionalFeatures?.includes('Open Kitchen') ?? false)
  );
  const [hasPool, setHasPool] = useState<boolean>(
    (property as any).hasPool ?? (property.additionalFeatures?.includes('Pool') ?? false)
  );
  const [hasRoof, setHasRoof] = useState<boolean>(
    (property as any).hasRoof ?? (property.additionalFeatures?.includes('Roof Top') ?? false)
  );
  const [hasTerrace, setHasTerrace] = useState<boolean>(
    (property as any).hasTerrace ?? (property.additionalFeatures?.includes('Terrace') ?? false)
  );
  const [buildingType, setBuildingType] = useState<BuildingType | ''>(property.buildingType ?? '');
  const [floorType, setFloorType] = useState<FloorType | ''>(property.floorType ?? '');
  const [floorNumber, setFloorNumber] = useState<FloorNumber | ''>(() => {
    const raw = (property.floorNumber ?? '') as string;
    if (raw && /^[1-9]\d{2}$/.test(raw.trim())) {
      return String(parseInt(raw.trim().slice(1), 10)) as FloorNumber;
    }
    return raw as FloorNumber | '';
  });
  const [listingType, setListingType] = useState<string>((property as any).listingType ?? '');
  const [propertyStatusCode, setPropertyStatusCode] = useState<string>(
    (property as any).contactStatusCode != null ? String((property as any).contactStatusCode) : ''
  );
  const [editingPropertyDetails, setEditingPropertyDetails] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState(false);
  const [websiteDraft, setWebsiteDraft] = useState<string>(property.websiteLink ?? '');

  // Key Location state
  const [keyLocation, setKeyLocation] = useState<import('./mockData').KeyLocation | undefined>(property.keyLocation);
  const [editingKeyLocation, setEditingKeyLocation] = useState(false);
  const [keyLocationDraft, setKeyLocationDraft] = useState<{
    type: import('./mockData').KeyLocationType;
    keyNumber: string;
    agentName: string;
    agentPhone: string;
  }>({
    type: property.keyLocation?.type ?? 'office',
    keyNumber: property.keyLocation?.keyNumber ?? '',
    agentName: property.keyLocation?.agentName ?? '',
    agentPhone: property.keyLocation?.agentPhone ?? '',
  });
  const [savingKeyLocation, setSavingKeyLocation] = useState(false);

  // Key Log state
  interface KeyLogEntry {
    id: string;
    key_status: string;
    key_number: string;
    sole_agent: string;
    sole_agent_name: string;
    sole_agent_valid_from: string;
    sole_agent_valid_to: string;
    property_ref: string;
  }
  const [keyLog, setKeyLog] = useState<KeyLogEntry | null>(null);
  const [keyLogLoading, setKeyLogLoading] = useState(false);
  const [keyLogSaving, setKeyLogSaving] = useState(false);
  const [showKeyLogValidFromCal, setShowKeyLogValidFromCal] = useState(false);
  const [showKeyLogValidToCal, setShowKeyLogValidToCal] = useState(false);
  const [keyLogValidFromMonth, setKeyLogValidFromMonth] = useState<Date>(() => new Date());
  const [keyLogValidToMonth, setKeyLogValidToMonth] = useState<Date>(() => new Date());

  // Load key log on mount
  useEffect(() => {
    const propRef = property.ref || property.unit;
    if (!propRef) return;
    setKeyLogLoading(true);
    const supabase = createClient();
    supabase
      .from('key_log')
      .select('id, key_status, key_number, sole_agent, sole_agent_name, sole_agent_valid_from, sole_agent_valid_to, property_ref')
      .eq('property_ref', propRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const row = data[0];
          setKeyLog({
            id: row.id,
            key_status: row.key_status ?? '',
            key_number: row.key_number ?? '',
            sole_agent: row.sole_agent ?? '',
            sole_agent_name: row.sole_agent_name ?? '',
            sole_agent_valid_from: row.sole_agent_valid_from ?? '',
            sole_agent_valid_to: row.sole_agent_valid_to ?? '',
            property_ref: row.property_ref ?? propRef,
          });
        } else {
          setKeyLog({
            id: '',
            key_status: '',
            key_number: '',
            sole_agent: '',
            sole_agent_name: '',
            sole_agent_valid_from: '',
            sole_agent_valid_to: '',
            property_ref: propRef,
          });
        }
        setKeyLogLoading(false);
      });
  }, [property.ref, property.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  async function autoSaveKeyLog(updates: Partial<KeyLogEntry>) {
    if (!keyLog) return;
    const propRef = property.ref || property.unit;
    if (!propRef) return;
    setKeyLogSaving(true);
    const merged = { ...keyLog, ...updates };
    setKeyLog(merged);
    try {
      const supabase = createClient();
      if (merged.id) {
        await supabase.from('key_log').update({
          key_status: merged.key_status || null,
          key_number: merged.key_number || null,
          sole_agent: merged.sole_agent || null,
          sole_agent_name: merged.sole_agent_name || null,
          sole_agent_valid_from: merged.sole_agent_valid_from || null,
          sole_agent_valid_to: merged.sole_agent_valid_to || null,
        } as any).eq('id', merged.id);
      } else {
        const { data } = await supabase.from('key_log').insert({
          property_ref: propRef,
          property_label: `${property.unit}, ${property.building}`,
          key_status: merged.key_status || null,
          key_number: merged.key_number || null,
          sole_agent: merged.sole_agent || null,
          sole_agent_name: merged.sole_agent_name || null,
          sole_agent_valid_from: merged.sole_agent_valid_from || null,
          sole_agent_valid_to: merged.sole_agent_valid_to || null,
          key_type: 'Main Door',
          status: 'held',
        } as any).select('id').single();
        if (data) setKeyLog((prev) => prev ? { ...prev, id: data.id } : prev);
      }
    } catch {
      // silently ignore
    } finally {
      setKeyLogSaving(false);
    }
  }

  // Viewing schedule state
  const [showViewingSchedule, setShowViewingSchedule] = useState(false);
  const [showSaleInvoice, setShowSaleInvoice] = useState(false);

  // Collapsible sections state — all expanded by default
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function SectionHeader({
    sectionKey,
    icon,
    iconColor,
    title,
    rightContent,
  }: {
    sectionKey: string;
    icon?: string;
    iconColor?: string;
    title: string;
    rightContent?: React.ReactNode;
  }) {
    const isCollapsed = !!collapsedSections[sectionKey];
    return (
      <div className="flex items-center justify-between mb-0">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center gap-2 flex-1 min-w-0 group py-1"
          aria-expanded={!isCollapsed}
        >
          <Icon
            name="ChevronRightIcon"
            size={15}
            className={`text-[hsl(215,15%,52%)] transition-transform duration-200 flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
          />
          {icon && (
            <Icon
              name={icon as Parameters<typeof Icon>[0]['name']}
              size={14}
              className={iconColor ?? 'text-[#1B4F8A]'}
            />
          )}
          <span className="section-label group-hover:text-[#1B4F8A] transition-colors">{title}</span>
        </button>
        {rightContent && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">{rightContent}</div>
        )}
      </div>
    );
  }

  const propTransactions = transactions.filter((t) => t.propId === property.id);

  // ── Derive rich transaction history from property data ─────────────────────
  interface TransactionRecord {
    id: string;
    type: 'Sale' | 'Lease' | 'Lease Renewal' | 'Lease Ended';
    date: string;
    endDate?: string;
    amountHKD: number;
    amountLabel: string;
    seller?: string;
    buyer?: string;
    landlord?: string;
    tenant?: string;
    agent: string;
    status: 'Completed' | 'Active' | 'Expired' | 'Pending';
    notes?: string;
  }

  const derivedTransactions: TransactionRecord[] = useMemo(() => {
    const records: TransactionRecord[] = [];
    let agentName = agentProfiles[0]?.name ?? 'Natalie Leslie';

    // Lease record from current tenant
    if (property.tenant) {
      const t = property.tenant;
      const leaseStart = t.leaseStart;
      const leaseEnd = t.leaseEnd;
      const now = new Date();
      const endDate = leaseEnd ? new Date(leaseEnd) : null;
      const isActive = endDate ? endDate >= now : true;
      const rent = property.monthlyRent ?? 0;
      records.push({
        id: `lease-current-${property.id}`,
        type: 'Lease',
        date: leaseStart,
        endDate: leaseEnd,
        amountHKD: rent,
        amountLabel: `HK$${rent.toLocaleString()}/mo`,
        landlord: property.landlord?.name ?? property.owner ?? '—',
        tenant: t.name,
        agent: agentName,
        status: isActive ? 'Active' : 'Expired',
        notes: `Deposit: HK$${(t.deposit ?? 0).toLocaleString()}${t.stampDutyPaid ? ' · Stamp duty paid' : ''}${t.cr109Filed ? ' · CR109 filed' : ''}`,
      });
    }

    // Sale record
    if (property.status === 4 && property.salePrice) {
      records.push({
        id: `sale-${property.id}`,
        type: 'Sale',
        date: property.listingDate ?? property.lastUpdated ?? '',
        amountHKD: property.salePrice,
        amountLabel: property.salePrice >= 1000000
          ? `HK$${(property.salePrice / 1000000).toFixed(2)}M`
          : `HK$${property.salePrice.toLocaleString()}`,
        seller: property.landlord?.name ?? property.owner ?? '—',
        buyer: property.tenant?.name ?? '—',
        agent: agentName,
        status: 'Completed',
        notes: property.agentNotes ? property.agentNotes.slice(0, 80) : undefined,
      });
    }

    // Supplement with any mock transactions for this property
    propTransactions.forEach((txn) => {
      const isSale = txn.type === 'Sale';
      records.push({
        id: txn.id,
        type: txn.type as TransactionRecord['type'],
        date: txn.date,
        amountHKD: txn.amount,
        amountLabel: isSale
          ? txn.amount >= 1000000 ? `HK$${(txn.amount / 1000000).toFixed(2)}M` : `HK$${txn.amount.toLocaleString()}`
          : `HK$${txn.amount.toLocaleString()}/mo`,
        landlord: isSale ? undefined : property.landlord?.name,
        tenant: isSale ? undefined : txn.party,
        seller: isSale ? property.landlord?.name : undefined,
        buyer: isSale ? txn.party : undefined,
        agent: txn.agent,
        status: 'Completed',
        notes: txn.notes,
      });
    });

    // Sort newest first
    return records.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
  }, [property, propTransactions, agentProfiles]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatTxnDate(dateStr?: string) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function txnStatusColor(status: TransactionRecord['status']) {
    switch (status) {
      case 'Active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Completed': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Expired': return 'bg-[hsl(210,20%,95%)] text-[hsl(215,15%,45%)] border-[hsl(214,20%,85%)]';
      case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  }

  function txnTypeColor(type: TransactionRecord['type']) {
    switch (type) {
      case 'Sale': return { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-l-violet-500' };
      case 'Lease': return { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-l-blue-500' };
      case 'Lease Renewal': return { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-l-teal-500' };
      case 'Lease Ended': return { bg: 'bg-[hsl(210,20%,95%)]', icon: 'text-[hsl(215,15%,45%)]', border: 'border-l-[hsl(214,20%,75%)]' };
    }
  }

  // Government Valuation Documents state
  const [govValDocs, setGovValDocs] = useState<GovValuationDoc[]>([]);
  const [govValLoading, setGovValLoading] = useState(false);
  const [govValUploading, setGovValUploading] = useState(false);
  const [govValError, setGovValError] = useState<string | null>(null);
  const govValInputRef = useRef<HTMLInputElement>(null);

  // Company Tenancy Agreement Upload state
  const [tenancyAgreementDocs, setTenancyAgreementDocs] = useState<TenancyAgreementDoc[]>([]);
  const [tenancyAgreementLoading, setTenancyAgreementLoading] = useState(false);
  const [tenancyAgreementUploading, setTenancyAgreementUploading] = useState(false);
  const [tenancyAgreementError, setTenancyAgreementError] = useState<string | null>(null);
  const tenancyAgreementInputRef = useRef<HTMLInputElement>(null);

  // ── Lease Agreement docs (Documents tab) ─────────────────────────────────
  const [leaseAgreementDocs, setLeaseAgreementDocs] = useState<TenancyAgreementDoc[]>([]);
  const [leaseAgreementLoading, setLeaseAgreementLoading] = useState(false);
  const [leaseAgreementUploading, setLeaseAgreementUploading] = useState(false);
  const [leaseAgreementError, setLeaseAgreementError] = useState<string | null>(null);
  const leaseAgreementInputRef = useRef<HTMLInputElement>(null);

  // ── Inspection Report docs (Documents tab) ────────────────────────────────
  const [inspectionDocs, setInspectionDocs] = useState<TenancyAgreementDoc[]>([]);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionUploading, setInspectionUploading] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const inspectionInputRef = useRef<HTMLInputElement>(null);

  // ── Compliance docs (Documents tab) ──────────────────────────────────────
  const [complianceDocs, setComplianceDocs] = useState<TenancyAgreementDoc[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceUploading, setComplianceUploading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const complianceInputRef = useRef<HTMLInputElement>(null);

  // ── Tenancy Forms docs (Documents tab) ───────────────────────────────────
  const [tenancyFormDocs, setTenancyFormDocs] = useState<TenancyAgreementDoc[]>([]);
  const [tenancyFormLoading, setTenancyFormLoading] = useState(false);
  const [tenancyFormUploading, setTenancyFormUploading] = useState(false);
  const [tenancyFormError, setTenancyFormError] = useState<string | null>(null);
  const tenancyFormInputRef = useRef<HTMLInputElement>(null);

  // ── Utility Bills docs (Documents tab) ───────────────────────────────────
  const [utilityBillDocs, setUtilityBillDocs] = useState<TenancyAgreementDoc[]>([]);
  const [utilityBillLoading, setUtilityBillLoading] = useState(false);
  const [utilityBillUploading, setUtilityBillUploading] = useState(false);
  const [utilityBillError, setUtilityBillError] = useState<string | null>(null);
  const utilityBillInputRef = useRef<HTMLInputElement>(null);

  // ── Image preview state ───────────────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');

  // ── Real-time: viewings for this property ─────────────────────────────────
  const [viewingsSyncBadge, setViewingsSyncBadge] = useState<string | null>(null);

  const handleViewingChange = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    const dateStr = (row.viewing_date as string) ?? '';
    if (event === 'INSERT') {
      const msg = `New viewing scheduled${dateStr ? ` on ${dateStr}` : ''}`;
      toast.info(msg, { id: `modal-viewing-insert-${row.id}` });
      setViewingsSyncBadge('New viewing added');
    } else if (event === 'UPDATE') {
      const msg = `Viewing updated${dateStr ? ` (${dateStr})` : ''}`;
      toast.success(msg, { id: `modal-viewing-update-${row.id}` });
      setViewingsSyncBadge('Viewing updated');
    } else if (event === 'DELETE') {
      toast.warning('A viewing was cancelled', { id: `modal-viewing-delete-${row.id}` });
      setViewingsSyncBadge('Viewing cancelled');
    }
    // Auto-clear badge after 4 s
    setTimeout(() => setViewingsSyncBadge(null), 4000);
  }, []);

  // ── Real-time: property documents for this property ───────────────────────
  const handleDocumentChange = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    if (event === 'INSERT') {
      toast.info(`Document added: ${(row.file_name as string) ?? ''}`, { id: `modal-doc-insert-${row.id}` });
      if (activeTab === 'documents') {
        loadGovValDocs();
        loadLeaseAgreementDocs();
        loadInspectionDocs();
        loadComplianceDocs();
        loadTenancyFormDocs();
        loadUtilityBillDocs();
      }
    } else if (event === 'DELETE') {
      toast.warning('A document was removed', { id: `modal-doc-delete-${row.id}` });
      if (activeTab === 'documents') {
        loadGovValDocs();
        loadLeaseAgreementDocs();
        loadInspectionDocs();
        loadComplianceDocs();
        loadTenancyFormDocs();
        loadUtilityBillDocs();
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useViewingsRealtime(handleViewingChange, property.id, true);
  usePropertyDocumentsRealtime(property.ref, handleDocumentChange, true);

  // ── Load imported contacts from property_contacts table ───────────────────
  const loadImportedContacts = useCallback(async () => {
    setImportedContactsLoading(true);
    try {
      const supabase = createClient();
      // property.ref holds the full property_ref (e.g. "DB-PH1-001-01A")
      // property.shortCode holds the short_code (e.g. "WGC0011C")
      const propertyRef = property.ref || property.unit;
      const shortCode = (property as Record<string, unknown>).shortCode as string | undefined;

      let query = supabase
        .from('property_contacts')
        .select('id, contact_role, contact_person, contact_number, contact_email, short_code, property_ref')
        .order('contact_role', { ascending: true });

      if (propertyRef && shortCode) {
        query = query.or(`property_ref.eq.${propertyRef},short_code.eq.${shortCode}`);
      } else if (propertyRef) {
        query = query.eq('property_ref', propertyRef);
      } else if (shortCode) {
        query = query.eq('short_code', shortCode);
      } else {
        // No identifier available — return empty
        setImportedContacts([]);
        setImportedContactsLoading(false);
        return;
      }

      const { data } = await query;
      setImportedContacts((data ?? []).map((c: any) => ({
        id: c.id,
        contact_role: c.contact_role,
        contact_person: c.contact_person,
        contact_number: c.contact_number,
        contact_email: c.contact_email || '',
        short_code: c.short_code,
        property_ref: c.property_ref,
      })));
    } catch {
      // silently fail
    } finally {
      setImportedContactsLoading(false);
    }
  }, [property.ref, property.unit, (property as Record<string, unknown>).shortCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadImportedContacts();
  }, [loadImportedContacts]);

  async function saveImportedContactEdit() {
    if (!editingImportedContactId) return;
    setSavingImportedContact(true);
    try {
      const supabase = createClient();
      await supabase
        .from('property_contacts')
        .update({
          contact_person: importedContactDraft.contact_person,
          contact_number: importedContactDraft.contact_number,
          contact_email: importedContactDraft.contact_email,
          contact_role: importedContactDraft.contact_role,
        })
        .eq('id', editingImportedContactId);
      setImportedContacts((prev) =>
        prev.map((c) =>
          c.id === editingImportedContactId
            ? { ...c, ...importedContactDraft }
            : c
        )
      );
      setEditingImportedContactId(null);
      toast.success('Contact updated');
    } catch {
      toast.error('Failed to save contact');
    } finally {
      setSavingImportedContact(false);
    }
  }

  async function deleteImportedContact(id: string) {
    try {
      const supabase = createClient();
      await supabase.from('property_contacts').delete().eq('id', id);
      setImportedContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success('Owner removed');
    } catch {
      toast.error('Failed to remove owner');
    }
  }

  async function saveNewOwner() {
    setSavingNewOwner(true);
    try {
      const supabase = createClient();
      const propertyRef = property.ref || property.unit;
      const shortCode = (property as Record<string, unknown>).shortCode as string | undefined;
      const { data, error } = await supabase
        .from('property_contacts')
        .insert({
          contact_role: 'Owner',
          contact_person: newOwnerDraft.contact_person,
          contact_number: newOwnerDraft.contact_number,
          contact_email: newOwnerDraft.contact_email,
          property_ref: propertyRef || null,
          short_code: shortCode || null,
        })
        .select('id, contact_role, contact_person, contact_number, contact_email, short_code, property_ref')
        .single();
      if (error) throw error;
      if (data) {
        setImportedContacts((prev) => [...prev, {
          id: data.id,
          contact_role: data.contact_role || 'Owner',
          contact_person: data.contact_person || '',
          contact_number: data.contact_number || '',
          contact_email: data.contact_email || '',
          short_code: data.short_code,
          property_ref: data.property_ref,
        }]);
      }
      setNewOwnerDraft({ contact_person: '', contact_number: '', contact_email: '', id_cr_no: '' });
      setShowAddOwnerForm(false);
      toast.success('Owner added');
    } catch {
      toast.error('Failed to add owner');
    } finally {
      setSavingNewOwner(false);
    }
  }

  async function saveNewLandlord() {
    setSavingNewLandlord(true);
    try {
      const supabase = createClient();
      const propertyRef = property.ref || property.unit;
      const shortCode = (property as Record<string, unknown>).shortCode as string | undefined;
      const { data, error } = await supabase
        .from('property_contacts')
        .insert({
          contact_role: 'Landlord',
          contact_person: newLandlordDraft.contact_person,
          contact_number: newLandlordDraft.contact_number,
          contact_email: newLandlordDraft.contact_email,
          property_ref: propertyRef || null,
          short_code: shortCode || null,
        })
        .select('id, contact_role, contact_person, contact_number, contact_email, short_code, property_ref')
        .single();
      if (error) throw error;
      if (data) {
        setImportedContacts((prev) => [...prev, {
          id: data.id,
          contact_role: data.contact_role || 'Landlord',
          contact_person: data.contact_person || '',
          contact_number: data.contact_number || '',
          contact_email: data.contact_email || '',
          short_code: data.short_code,
          property_ref: data.property_ref,
        }]);
      }
      setNewLandlordDraft({ contact_person: '', contact_number: '', contact_email: '', id_cr_no: '' });
      setShowAddLandlordForm(false);
      toast.success('Landlord added');
    } catch {
      toast.error('Failed to add landlord');
    } finally {
      setSavingNewLandlord(false);
    }
  }

  const loadGovValDocs = useCallback(async () => {
    setGovValLoading(true);
    setGovValError(null);
    try {
      const supabase = createClient();
      const propRef = property.ref || property.unit;
      if (!propRef) {
        setGovValDocs([]);
        return;
      }
      const { data, error } = await supabase
        .from('property_documents')
        .select('id, file_name, file_path, file_size_bytes, uploaded_at, notes')
        .eq('property_ref', propRef)
        .eq('document_type', 'government-valuation')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setGovValDocs(data ?? []);
    } catch (err: any) {
      setGovValError(err?.message ?? 'Failed to load documents');
    } finally {
      setGovValLoading(false);
    }
  }, [property.ref, property.unit]);

  // ── Lease Agreement (Documents tab) ──────────────────────────────────────
  const loadLeaseAgreementDocs = useCallback(
    makeDocLoader('lease-agreement', setLeaseAgreementDocs, setLeaseAgreementLoading, setLeaseAgreementError),
    [property.ref, property.unit], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleLeaseAgreementDelete = makeDocDeleter(setLeaseAgreementDocs);

  // ── Inspection Report (Documents tab) ────────────────────────────────────
  const loadInspectionDocs = useCallback(
    makeDocLoader('inspection-report', setInspectionDocs, setInspectionLoading, setInspectionError),
    [property.ref, property.unit], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleInspectionDelete = makeDocDeleter(setInspectionDocs);

  // ── Compliance Doc (Documents tab) ───────────────────────────────────────
  const loadComplianceDocs = useCallback(
    makeDocLoader('compliance-doc', setComplianceDocs, setComplianceLoading, setComplianceError),
    [property.ref, property.unit], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleComplianceDelete = makeDocDeleter(setComplianceDocs);

  // ── Tenancy Forms (Documents tab) ─────────────────────────────────────────
  const loadTenancyFormDocs = useCallback(
    makeDocLoader('tenancy-form', setTenancyFormDocs, setTenancyFormLoading, setTenancyFormError),
    [property.ref, property.unit], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleTenancyFormDelete = makeDocDeleter(setTenancyFormDocs);

  // ── Utility Bills (Documents tab) ─────────────────────────────────────────
  const loadUtilityBillDocs = useCallback(
    makeDocLoader('utility-bill', setUtilityBillDocs, setUtilityBillLoading, setUtilityBillError),
    [property.ref, property.unit], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleUtilityBillDelete = makeDocDeleter(setUtilityBillDocs);

  // ── Image/PDF preview helper ───────────────────────────────────────────────
  async function handleDocPreview(doc: TenancyAgreementDoc) {
    try {
      const supabase = createClient();
      // Try documents bucket first (PDFs/Word), then property-photos bucket (images)
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
      const bucket = isImage ? 'property-photos' : 'documents';
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 120);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
      setPreviewFileName(doc.file_name);
    } catch {
      toast.error('Could not generate preview link');
    }
  }

  useEffect(() => {
    if (activeTab === 'documents') {
      loadGovValDocs();
      loadLeaseAgreementDocs();
      loadInspectionDocs();
      loadComplianceDocs();
      loadTenancyFormDocs();
      loadUtilityBillDocs();
    }
  }, [activeTab, loadGovValDocs, loadLeaseAgreementDocs, loadInspectionDocs, loadComplianceDocs, loadTenancyFormDocs, loadUtilityBillDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGovValUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const propRef = property.ref || property.unit;
    if (!propRef) {
      toast.error('Cannot upload: property reference is missing');
      return;
    }
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted for R&V documents');
      return;
    }
    if (file.size > 52428800) {
      toast.error('File size must be under 50 MB');
      return;
    }
    setGovValUploading(true);
    setGovValError(null);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `gov-valuation/${propRef}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('property_documents').insert({
        property_ref: propRef,
        document_type: 'government-valuation',
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
      });
      if (dbError) throw dbError;
      toast.success('R&V document uploaded successfully');
      await loadGovValDocs();
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
      setGovValError(err?.message ?? 'Upload failed');
    } finally {
      setGovValUploading(false);
      if (govValInputRef.current) govValInputRef.current.value = '';
    }
  }

  async function handleGovValDownload(doc: GovValuationDoc) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Could not generate download link');
    }
  }

  async function handleGovValDelete(doc: GovValuationDoc) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    try {
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase
        .from('property_documents')
        .delete()
        .eq('id', doc.id);
      if (dbError) throw dbError;
      toast.success('Document deleted');
      setGovValDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed');
    }
  }

  // ── Company Tenancy Agreement functions ───────────────────────────────────
  const loadTenancyAgreementDocs = useCallback(async () => {
    setTenancyAgreementLoading(true);
    setTenancyAgreementError(null);
    try {
      const supabase = createClient();
      const propRef = property.ref || property.unit;
      if (!propRef) {
        setTenancyAgreementDocs([]);
        return;
      }
      const { data, error } = await supabase
        .from('property_documents')
        .select('id, file_name, file_path, file_size_bytes, uploaded_at, notes')
        .eq('property_ref', propRef)
        .eq('document_type', 'company-tenancy-agreement')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setTenancyAgreementDocs(data ?? []);
    } catch (err: any) {
      setTenancyAgreementError(err?.message ?? 'Failed to load tenancy agreements');
    } finally {
      setTenancyAgreementLoading(false);
    }
  }, [property.ref, property.unit]);

  useEffect(() => {
    if (activeTab === 'hk-forms') {
      loadTenancyAgreementDocs();
    }
  }, [activeTab, loadTenancyAgreementDocs]);

  async function handleTenancyAgreementUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const propRef = property.ref || property.unit;
    if (!propRef) {
      toast.error('Cannot upload: property reference is missing');
      return;
    }
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted for tenancy agreements');
      return;
    }
    if (file.size > 52428800) {
      toast.error('File size must be under 50 MB');
      return;
    }
    setTenancyAgreementUploading(true);
    setTenancyAgreementError(null);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `company-tenancy-agreements/${propRef}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('property_documents').insert({
        property_ref: propRef,
        document_type: 'company-tenancy-agreement',
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
      });
      if (dbError) throw dbError;
      toast.success('Tenancy agreement uploaded successfully');
      await loadTenancyAgreementDocs();
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
      setTenancyAgreementError(err?.message ?? 'Upload failed');
    } finally {
      setTenancyAgreementUploading(false);
      if (tenancyAgreementInputRef.current) tenancyAgreementInputRef.current.value = '';
    }
  }

  async function handleTenancyAgreementDownload(doc: TenancyAgreementDoc) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Could not generate download link');
    }
  }

  async function handleTenancyAgreementDelete(doc: TenancyAgreementDoc) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    try {
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase
        .from('property_documents')
        .delete()
        .eq('id', doc.id);
      if (dbError) throw dbError;
      toast.success('Tenancy agreement deleted');
      setTenancyAgreementDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed');
    }
  }

  // ── Generic doc helpers ───────────────────────────────────────────────────
  function makeDocLoader(
    docType: string,
    setDocs: React.Dispatch<React.SetStateAction<TenancyAgreementDoc[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
  ) {
    return async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const propRef = property.ref || property.unit;
        if (!propRef) { setDocs([]); return; }
        const { data, error } = await supabase
          .from('property_documents')
          .select('id, file_name, file_path, file_size_bytes, uploaded_at, notes')
          .eq('property_ref', propRef)
          .eq('document_type', docType)
          .order('uploaded_at', { ascending: false });
        if (error) throw error;
        setDocs(data ?? []);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
  }

  function makeDocUploader(
    docType: string,
    storagePath: string,
    setDocs: React.Dispatch<React.SetStateAction<TenancyAgreementDoc[]>>,
    setUploading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    inputRef: React.RefObject<HTMLInputElement>,
    loadDocs: () => Promise<void>,
  ) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const propRef = property.ref || property.unit;
      if (!propRef) { toast.error('Cannot upload: property reference is missing'); return; }
      const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowed.includes(file.type)) {
        toast.error('Only PDF or Word documents are accepted');
        return;
      }
      if (file.size > 52428800) { toast.error('File size must be under 50 MB'); return; }
      setUploading(true);
      setError(null);
      try {
        const supabase = createClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${storagePath}/${propRef}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from('property_documents').insert({
          property_ref: propRef,
          document_type: docType,
          file_name: file.name,
          file_path: filePath,
          file_size_bytes: file.size,
        });
        if (dbError) throw dbError;
        toast.success('Document uploaded successfully');
        await loadDocs();
      } catch (err: any) {
        toast.error(err?.message ?? 'Upload failed');
        setError(err?.message ?? 'Upload failed');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    };
  }

  // ── Image+PDF capable uploader (for utility bills, tenancy forms) ─────────
  function makeMediaUploader(
    docType: string,
    storagePath: string,
    setDocs: React.Dispatch<React.SetStateAction<TenancyAgreementDoc[]>>,
    setUploading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    inputRef: React.RefObject<HTMLInputElement>,
    loadDocs: () => Promise<void>,
  ) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const propRef = property.ref || property.unit;
      if (!propRef) { toast.error('Cannot upload: property reference is missing'); return; }
      const allowedPdf = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const isImage = allowedImages.includes(file.type);
      const isPdf = allowedPdf.includes(file.type);
      if (!isImage && !isPdf) {
        toast.error('Only PDF, Word documents, or images (JPG, PNG, WebP) are accepted');
        return;
      }
      if (file.size > 52428800) { toast.error('File size must be under 50 MB'); return; }
      setUploading(true);
      setError(null);
      try {
        const supabase = createClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const bucket = isImage ? 'property-photos' : 'documents';
        const filePath = `${storagePath}/${propRef}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: dbError } = await supabase.from('property_documents').insert({
          property_ref: propRef,
          document_type: docType,
          file_name: file.name,
          file_path: filePath,
          file_size_bytes: file.size,
        });
        if (dbError) throw dbError;
        toast.success('File uploaded successfully');
        await loadDocs();
      } catch (err: any) {
        toast.error(err?.message ?? 'Upload failed');
        setError(err?.message ?? 'Upload failed');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    };
  }

  // ── Media-aware delete (checks both buckets) ──────────────────────────────
  function makeMediaDeleter(
    setDocs: React.Dispatch<React.SetStateAction<TenancyAgreementDoc[]>>,
  ) {
    return async (doc: TenancyAgreementDoc) => {
      if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
      try {
        const supabase = createClient();
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
        const bucket = isImage ? 'property-photos' : 'documents';
        const { error: storageError } = await supabase.storage.from(bucket).remove([doc.file_path]);
        if (storageError) throw storageError;
        await supabase.from('property_documents').delete().eq('id', doc.id);
        toast.success('File deleted');
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } catch (err: any) {
        toast.error(err?.message ?? 'Delete failed');
      }
    };
  }

  async function handleGenericDocDownload(doc: TenancyAgreementDoc) {
    try {
      const supabase = createClient();
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
      const bucket = isImage ? 'property-photos' : 'documents';
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Could not generate download link');
    }
  }

  function makeDocDeleter(
    setDocs: React.Dispatch<React.SetStateAction<TenancyAgreementDoc[]>>,
  ) {
    return async (doc: TenancyAgreementDoc) => {
      if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
      try {
        const supabase = createClient();
        const { error: storageError } = await supabase.storage.from('documents').remove([doc.file_path]);
        if (storageError) throw storageError;
        const { error: dbError } = await supabase.from('property_documents').delete().eq('id', doc.id);
        if (dbError) throw dbError;
        toast.success('Document deleted');
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } catch (err: any) {
        toast.error(err?.message ?? 'Delete failed');
      }
    };
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  async function handleGenerateForm(formType: string) {
    setGeneratingForm(formType);
    await new Promise((r) => setTimeout(r, 1500));
    setGeneratingForm(null);
    toast.success(`${formType} generated successfully — ready for landlord signature`);
  }

  function handleCommissionChange(key: keyof AgentCommission, value: string) {
    setCommission((prev) => ({ ...prev, [key]: value || undefined }));
    // Log to history
    const entry: HistoryEntry = {
      id: `hl-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB').replace(/\//g, '/'),
      agent: value || 'System',
      action: `Commission category ${key} assigned to ${value || 'unassigned'}`,
    };
    setHistoryLog((prev) => [entry, ...prev]);
    toast.success('Commission assignment saved');
  }

  function handleSaveContact() {
    if (!newContact.name.trim()) {
      toast.error('Contact name is required');
      return;
    }
    setContacts((prev) => [...prev, { ...newContact, id: `c-new-${Date.now()}` }]);
    setNewContact(emptyContact());
    setShowAddContact(false);
    toast.success('Contact added');
  }

  function handleDeleteContact(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success('Contact removed');
  }

  function handleUpdateContact(updated: PropertyContact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingContact(null);
    toast.success('Contact updated');
  }

  function handleAddComment() {
    if (!newCommentText.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const comment: PropertyComment = {
      id: `cmt-new-${Date.now()}`,
      date: today,
      agent: newCommentAgent,
      text: newCommentText.trim(),
    };
    setComments((prev) => [comment, ...prev]);
    // Also log to history
    const entry: HistoryEntry = {
      id: `hl-cmt-${Date.now()}`,
      date: today,
      agent: newCommentAgent,
      action: `Added comment: "${newCommentText.trim().substring(0, 60)}${newCommentText.length > 60 ? '…' : ''}"`,
    };
    setHistoryLog((prev) => [entry, ...prev]);
    setNewCommentText('');
    toast.success('Comment added');
  }

  function handleSavePricing() {
    setEditingPricing(false);
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const parts: string[] = [];
    if (salePrice) parts.push(`Sale price: HK$${Number(salePrice).toLocaleString()}`);
    if (rentalPrice) parts.push(`Lease price: HK$${Number(rentalPrice).toLocaleString()}/mo`);
    if (listingDate) parts.push(`Listing date: ${listingDate}`);
    if (vacantDate) parts.push(`Vacant date: ${vacantDate}`);
    const entry: HistoryEntry = {
      id: `hl-pricing-${Date.now()}`,
      date: today,
      agent: agentNames[0],
      action: parts.length > 0 ? `Updated pricing — ${parts.join(', ')}` : 'Updated pricing & listing dates',
    };
    setHistoryLog((prev) => [entry, ...prev]);

    // Persist to Supabase
    const supabase = createClient();
    supabase
      .from('properties')
      .update({
        asking_price: salePrice ? Number(salePrice) : null,
        asking_rent: rentalPrice ? Number(rentalPrice) : null,
        publish_dt: publishToWebsite || null,
      })
      .eq('id', property.id)
      .then(({ error }) => {
        if (error) {
          toast.error('Failed to save pricing: ' + error.message);
        } else {
          toast.success('Pricing & dates saved');
        }
      });
  }

  async function autoSavePricingField(field: 'asking_price' | 'asking_rent', value: string) {
    try {
      const res = await fetch('/api/property-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: property.id, updates: { [field]: value ? Number(value) : null } }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Save failed');
      toast.success('Saved');
      onSaved?.();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err?.message ?? 'Unknown error'));
    }
  }

  async function autoSavePricingDate(field: 'listing_date' | 'vacant_date', value: string) {
    try {
      const dbField = field === 'listing_date' ? 'publish_dt' : 'vacant_date';
      // Convert DD/MM/YYYY to YYYY-MM-DD for date columns, or null if empty
      let dbValue: string | null = null;
      if (value) {
        const parts = value.split('/');
        if (parts.length === 3) {
          dbValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          dbValue = value;
        }
      }
      const res = await fetch('/api/property-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: property.id, updates: { [dbField]: dbValue } }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Save failed');
      toast.success('Date saved');
    } catch (err: any) {
      toast.error('Failed to save date: ' + (err?.message ?? 'Unknown error'));
    }
  }

  async function handleSavePublishToWebsite(dateValue: string) {
    if (!dateValue) return;
    setPublishingSaving(true);
    try {
      const supabase = createClient();

      // Determine workflow type from property status
      const workflowType = (property.status === 4 || (property as any).listType === 'sale') ? 'sales' : 'tenancy';

      // Save publish date to properties via server API (bypasses RLS)
      const saveRes = await fetch('/api/property-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: property.id, updates: { publish_dt: dateValue } }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok || saveJson.error) throw new Error(saveJson.error ?? 'Failed to save publish date');

      // Build property address
      const propertyAddress = [property.building, property.village, property.district].filter(Boolean).join(', ');

      // Calculate 3-month reminder date
      const publishDate = new Date(dateValue);
      const reminderDate = new Date(publishDate);
      reminderDate.setMonth(reminderDate.getMonth() + 3);
      const reminderDueDate = reminderDate.toISOString().split('T')[0];

      // Get agent info from user_profiles
      const { data: { user } } = await supabase.auth.getUser();
      let agentName = agentNames[0] ?? 'Agent';
      let agentEmail = '';
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        if (profile) {
          agentName = profile.full_name || agentName;
          agentEmail = profile.email || user.email || '';
        } else {
          agentEmail = user.email || '';
        }
      }

      // Upsert advertising reminder (3-month check)
      await supabase
        .from('advertising_reminders')
        .upsert({
          property_ref: property.ref || property.unit,
          property_address: propertyAddress,
          advertising_date: dateValue,
          reminder_due_date: reminderDueDate,
          agent_name: agentName,
          agent_email: agentEmail,
          workflow_type: workflowType,
          reminder_sent: false,
          property_status: 'active',
        }, { onConflict: 'property_ref' });

      setPublishToWebsite(dateValue);
      toast.success(`Published to website from ${dateValue} — 3-month review reminder set for ${reminderDueDate}`);
    } catch (err: any) {
      toast.error('Failed to save publish date: ' + (err?.message ?? 'Unknown error'));
    } finally {
      setPublishingSaving(false);
    }
  }

  function handleSaveHighlight() {
    setHighlight(highlightDraft);
    setEditingHighlight(false);
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const entry: HistoryEntry = {
      id: `hl-hi-${Date.now()}`,
      date: today,
      agent: agentNames[0],
      action: highlightDraft ? `Updated highlight note` : 'Cleared highlight note',
    };
    setHistoryLog((prev) => [entry, ...prev]);
    toast.success('Highlight saved');
  }

  async function handleSaveKeyLocation() {
    setSavingKeyLocation(true);
    const newKeyLocation: import('./mockData').KeyLocation = {
      type: keyLocationDraft.type,
      keyNumber: keyLocationDraft.keyNumber.trim() || undefined,
      agentName: keyLocationDraft.agentName.trim() || undefined,
      agentPhone: keyLocationDraft.agentPhone.trim() || undefined,
    };
    const supabase = createClient();
    const { error } = await supabase
      .from('properties')
      .update({ key_location: newKeyLocation })
      .eq('id', property.id);
    setSavingKeyLocation(false);
    if (error) {
      toast.error('Failed to save key location: ' + error.message);
      return;
    }
    setKeyLocation(newKeyLocation);
    setEditingKeyLocation(false);
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const entry: HistoryEntry = {
      id: `hl-keyloc-${Date.now()}`,
      date: today,
      agent: agentNames[0],
      action: `Key location updated — ${newKeyLocation.type}${newKeyLocation.keyNumber ? ` #${newKeyLocation.keyNumber}` : ''}${newKeyLocation.agentName ? ` (${newKeyLocation.agentName})` : ''}`,
    };
    setHistoryLog((prev) => [entry, ...prev]);
    toast.success('Key location saved');
  }

  function handleSavePropertyDetails() {
    setEditingPropertyDetails(false);
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const entry: HistoryEntry = {
      id: `hl-propdetails-${Date.now()}`,
      date: today,
      agent: agentNames[0],
      action: 'Updated property details (bedrooms, bathrooms, direction, outdoor area, features)',
    };
    setHistoryLog((prev) => [entry, ...prev]);

    // Persist to Supabase
    // Map FloorType label → DB value (reverse of floorTypeMap in PropertyManagementClient)
    const floorTypeToDb: Record<string, string> = {
      'Ground': 'ground floor', 'Low': 'low floor', 'Medium': 'middle floor', 'High': 'high floor',
    };
    // Derive boolean feature flags from additionalFeatures array (single source of truth)
    const balconyVal = additionalFeatures.includes('Balcony');
    const combinedVal = additionalFeatures.includes('Combined Unit');
    const duplexVal = additionalFeatures.includes('Duplex');
    const gardenVal = additionalFeatures.includes('Garden');
    const openkitchVal = additionalFeatures.includes('Open Kitchen');
    const poolVal = additionalFeatures.includes('Pool');
    const roofVal = additionalFeatures.includes('Roof Top');
    const terraceVal = additionalFeatures.includes('Terrace');
    // Sync boolean states to match additionalFeatures
    setHasBalcony(balconyVal);
    setHasCombined(combinedVal);
    setHasDuplex(duplexVal);
    setHasGarden(gardenVal);
    setHasOpenkitch(openkitchVal);
    setHasPool(poolVal);
    setHasRoof(roofVal);
    setHasTerrace(terraceVal);
    const supabase = createClient();
    supabase
      .from('properties')
      .update({
        bedrooms: bedrooms === 'Studio' ? 0 : bedrooms ? Number(bedrooms) : null,
        bathrooms: bathrooms ? Number(bathrooms) : null,
        direction_id: direction || null,
        view_id: view || null,
        decor_id: decoration || null,
        outside_sc: outdoorArea ? Number(outdoorArea) : null,
        saleable_area: netSqft ? Number(netSqft) : null,
        gross_area: grossSqft ? Number(grossSqft) : null,
        prop_types: buildingType || null,
        prop_type: buildingType || null,
        floor_type: floorType ? (floorTypeToDb[floorType] ?? floorType) : null,
        floor: floorNumber || null,
        balcony: balconyVal,
        combined: combinedVal,
        duplex: duplexVal,
        garden: gardenVal,
        openkitch: openkitchVal,
        pool: poolVal,
        roof: roofVal,
        terrace: terraceVal,
      } as any)
      .eq('id', property.id)
      .then(({ error }) => {
        if (error) {
          toast.error('Failed to save property details: ' + error.message);
        } else {
          toast.success('Property details saved');
        }
      });
  }

  async function autoSaveSpecsField(updates: Record<string, unknown>) {
    try {
      const res = await fetch('/api/property-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: property.id, updates }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Save failed');
      toast.success('Saved');
    } catch (err: any) {
      toast.error('Failed to save: ' + (err?.message ?? 'Unknown error'));
    }
  }

  function toggleAdditionalFeature(feat: AdditionalFeature) {
    setAdditionalFeatures((prev) => {
      const next = prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat];
      // Keep boolean states in sync
      setHasBalcony(next.includes('Balcony'));
      setHasCombined(next.includes('Combined Unit'));
      setHasDuplex(next.includes('Duplex'));
      setHasGarden(next.includes('Garden'));
      setHasOpenkitch(next.includes('Open Kitchen'));
      setHasPool(next.includes('Pool'));
      setHasRoof(next.includes('Roof Top'));
      setHasTerrace(next.includes('Terrace'));
      // Auto-save features via server API
      const featureUpdates = {
        balcony: next.includes('Balcony'),
        combined: next.includes('Combined Unit'),
        duplex: next.includes('Duplex'),
        garden: next.includes('Garden'),
        openkitch: next.includes('Open Kitchen'),
        pool: next.includes('Pool'),
        roof: next.includes('Roof Top'),
        terrace: next.includes('Terrace'),
      };
      fetch('/api/property-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: property.id, updates: featureUpdates }),
      }).then((res) => res.json()).then((json) => {
        if (json.error) toast.error('Failed to save feature: ' + json.error);
        else toast.success('Feature saved');
      }).catch((err) => toast.error('Failed to save feature: ' + err.message));
      return next;
    });
  }

  function buildPropertyAddress() {
    return `${property.unit}, ${property.building}, ${property.street}, ${property.district}`;
  }

  function getDefaultAgent() {
    return agentProfiles[0];
  }

  async function handleDownloadForm3() {
    const agent = getDefaultAgent();
    const data: Form3Data = {
      vendorName: property.landlord.name,
      vendorIdNumber: property.landlord.idNumber,
      vendorAddress: `${property.unit}, ${property.building}, ${property.street}, ${property.district}`,
      vendorPhone: property.landlord.phone,
      agentName: agent.name,
      agentLicenceNumber: agent.licenceNumber,
      agentAddress: 'PropTrack Real Estate, Discovery Bay, Lantau Island, Hong Kong',
      agentPhone: agent.mobile,
      propertyAddress: buildPropertyAddress(),
      agencyType: 'non-exclusive',
      startDate: listingDate || new Date().toLocaleDateString('en-GB'),
      expiryDate: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return d.toLocaleDateString('en-GB');
      })(),
      agencyRelationship: 'single',
      listPriceWords: '',
      listPriceHKD: salePrice || (property.salePrice ? String(property.salePrice) : ''),
      commissionType: 'rate',
      commissionValue: '1',
      commissionPayment: 'completion',
      allowViewingByAgent: true,
      allowViewingByPurchaser: true,
      passKeysToAgent: property.keyLocation?.type === 'office' || property.keyLocation?.type === 'agent',
      authorizePassKeysToOthers: true,
      authorizeSubListing: true,
      authorizeAdvertising: true,
      agentHasInterest: false,
      receivedPropertyInfoForm: true,
    };
    await generateForm3PDF(data);
    toast.success('Form 3 downloaded — ready for vendor signature');
  }

  async function handleDownloadForm5() {
    const agent = getDefaultAgent();
    const data: Form5Data = {
      landlordName: property.landlord.name,
      landlordIdNumber: property.landlord.idNumber,
      landlordAddress: `${property.unit}, ${property.building}, ${property.street}, ${property.district}`,
      landlordPhone: property.landlord.phone,
      agentName: agent.name,
      agentLicenceNumber: agent.licenceNumber,
      agentAddress: 'PropTrack Real Estate, Discovery Bay, Lantau Island, Hong Kong',
      agentPhone: agent.mobile,
      propertyAddress: buildPropertyAddress(),
      agencyType: 'non-exclusive',
      startDate: listingDate || new Date().toLocaleDateString('en-GB'),
      expiryDate: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return d.toLocaleDateString('en-GB');
      })(),
      agencyRelationship: 'single',
      listRentalWords: '',
      listRentalHKD: rentalPrice || (property.monthlyRent ? String(property.monthlyRent) : ''),
      rentalIncludes: 'exclusive',
      commissionType: 'rate',
      commissionValue: '1',
      commissionPayment: 'signing',
      allowViewingByAgent: true,
      allowViewingByTenant: true,
      passKeysToAgent: property.keyLocation?.type === 'office' || property.keyLocation?.type === 'agent',
      authorizePassKeysToOthers: true,
      authorizeSubListing: true,
      authorizeAdvertising: true,
      agentHasInterest: false,
      receivedLeasingInfoForm: true,
    };
    await generateForm5PDF(data);
    toast.success('Form 5 downloaded — ready for landlord signature');
  }

  // ── PDF Download helper ────────────────────────────────────────────────────
  async function generatePropertyPDF(
    property: Property,
    govValDocs: GovValuationDoc[],
    tenancyAgreementDocs: TenancyAgreementDoc[],
    bedroomsState: string,
    bathroomsState: string,
    rentalPriceState: string,
    salePriceState: string,
    engRemark: string,
    chiRemark: string,
  ) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function checkPageBreak(needed = 8) {
      if (y + needed > 280) {
        doc.addPage();
        y = margin;
      }
    }

    function sectionTitle(text: string) {
      checkPageBreak(12);
      doc.setFillColor(27, 79, 138);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(text.toUpperCase(), margin + 3, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    function row(label: string, value: string, indent = 0) {
      checkPageBreak(7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 100, 130);
      doc.text(label, margin + indent, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 40, 55);
      const lines = doc.splitTextToSize(value || '—', contentW - 55 - indent);
      doc.text(lines, margin + 55 + indent, y);
      y += Math.max(6, lines.length * 5);
    }

    function divider() {
      checkPageBreak(4);
      doc.setDrawColor(210, 220, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentW, y);
      y += 3;
    }

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(27, 79, 138);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPERTY INFORMATION REPORT', margin, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' })}`, margin, 17);
    doc.text('Homes R Us Property Management', pageW - margin, 17, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y = 28;

    // ── Property Information ─────────────────────────────────────────────────
    sectionTitle('Property Information');
    row('Address', `${property.unit}, ${property.building}, ${property.street}, ${property.district}`);
    if (property.shortCode) row('Short Code', property.shortCode);
    if (property.ref) row('PID', property.ref);
    row('Type', property.type ?? '—');
    row('Status', (() => {
      const labels: Record<number, string> = { 0: 'Active', 1: 'Leased', 2: 'Self Occupy', 3: 'No Contact', 4: 'Sold', 9: 'Unknown', 99: 'Blank' };
      return labels[property.status as number] ?? '—';
    })());
    row('Floor', formatFloorDisplay(property.floor));
    row('Bedrooms', bedroomsState || (property.bedrooms === 0 ? 'Studio' : property.bedrooms != null ? String(property.bedrooms) : '—'));
    row('Bathrooms', bathroomsState || (property.bathrooms != null ? String(property.bathrooms) : '—'));
    row('Saleable Area', `${property.sqft?.toLocaleString() ?? '—'} sq ft`);
    if (property.grossSqft) row('Gross Area', `${property.grossSqft.toLocaleString()} sq ft`);
    row('Year Built', property.yearBuilt ? String(property.yearBuilt) : '—');
    if (property.direction) row('Direction', property.direction);
    if (property.view) row('View', property.view);
    if (property.decoration) row('Decoration', property.decoration);
    if (property.originalFurnishing) row('Furnishing', property.originalFurnishing);
    if (property.buildingType) row('Building Type', property.buildingType);
    if (property.additionalFeatures?.length) row('Features', property.additionalFeatures.join(', '));
    divider();

    // ── Pricing ──────────────────────────────────────────────────────────────
    sectionTitle('Pricing');
    const rentVal = rentalPriceState || (property.monthlyRent ? String(property.monthlyRent) : '');
    const saleVal = salePriceState || (property.salePrice ? String(property.salePrice) : '');
    if (rentVal) row('Monthly Rent', `HK$${Number(rentVal).toLocaleString()}`);
    if (saleVal) row('Sale Price', `HK$${Number(saleVal).toLocaleString()}`);
    if (property.listingDate) row('Listing Date', property.listingDate);
    if (property.vacantDate) row('Vacant Date', property.vacantDate);
    divider();

    // ── Landlord / Owner ─────────────────────────────────────────────────────
    sectionTitle('Landlord / Owner');
    row('Name', property.landlord?.name ?? property.owner ?? '—');
    row('Phone', property.landlord?.phone ?? '—');
    row('Email', property.landlord?.email ?? '—');
    divider();

    // ── Lease Terms ──────────────────────────────────────────────────────────
    sectionTitle('Lease Terms');
    if (property.tenant) {
      const t = property.tenant;
      row('Tenant Name', t.name ?? '—');
      row('Tenant Phone', t.phone ?? '—');
      row('Tenant Email', t.email ?? '—');
      row('Lease Start', t.leaseStart ?? '—');
      row('Lease End', t.leaseEnd ?? '—');
      row('Deposit', t.deposit ? `HK$${t.deposit.toLocaleString()}` : '—');
      row('Stamp Duty Paid', t.stampDutyPaid ? 'Yes' : 'No');
      row('CR109 Filed', t.cr109Filed ? 'Yes' : 'No');
    } else {
      checkPageBreak(7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 140, 160);
      doc.text('No active lease on record.', margin + 3, y);
      doc.setTextColor(0, 0, 0);
      y += 7;
    }
    divider();

    // ── Advertising Remarks ──────────────────────────────────────────────────
    if (engRemark || chiRemark) {
      sectionTitle('Advertising Remarks');
      if (engRemark) {
        checkPageBreak(10);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 100, 130);
        doc.text('English:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 40, 55);
        y += 5;
        const engLines = doc.splitTextToSize(engRemark, contentW - 6);
        engLines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin + 3, y);
          y += 5;
        });
      }
      if (chiRemark) {
        checkPageBreak(10);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 100, 130);
        doc.text('Chinese:', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 40, 55);
        y += 5;
        const chiLines = doc.splitTextToSize(chiRemark, contentW - 6);
        chiLines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin + 3, y);
          y += 5;
        });
      }
      divider();
    }

    // ── Documents ────────────────────────────────────────────────────────────
    const allDocs = [
      ...govValDocs.map((d) => ({ name: d.file_name, type: 'R&V / Gov. Valuation', date: d.uploaded_at })),
      ...tenancyAgreementDocs.map((d) => ({ name: d.file_name, type: 'Tenancy Agreement', date: d.uploaded_at })),
    ];

    sectionTitle('Documents on File');
    if (allDocs.length === 0) {
      checkPageBreak(7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 140, 160);
      doc.text('No documents uploaded.', margin + 3, y);
      doc.setTextColor(0, 0, 0);
      y += 7;
    } else {
      allDocs.forEach((d, i) => {
        checkPageBreak(7);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 40, 55);
        const dateStr = d.date ? new Date(d.date).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        doc.text(`${i + 1}. ${d.name}`, margin + 3, y);
        doc.setTextColor(100, 120, 150);
        doc.text(`${d.type} · ${dateStr}`, margin + 3, y + 4.5);
        doc.setTextColor(0, 0, 0);
        y += 10;
      });
    }

    // ── Footer on each page ──────────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 160, 175);
      doc.text('Homes R Us · Confidential Property Report', margin, 292);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, 292, { align: 'right' });
    }

    const safeName = `${property.unit}_${property.building}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Property_Report_${safeName}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      {showViewingSchedule && (
        <ViewingSchedule
          property={{ ...property, bedrooms: bedrooms ? Number(bedrooms) : property.bedrooms, bathrooms: bathrooms ? Number(bathrooms) : property.bathrooms, direction: direction || property.direction, outdoorArea: outdoorArea || property.outdoorArea, additionalFeatures: additionalFeatures.length > 0 ? additionalFeatures : property.additionalFeatures, websiteLink: websiteLink || property.websiteLink }}
          onClose={() => setShowViewingSchedule(false)}
        />
      )}
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-modal w-full sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[hsl(214,20%,88%)] flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center flex-shrink-0">
              <Icon name="BuildingIcon" size={20} className="text-[#1B4F8A]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[hsl(215,25%,18%)] truncate">
                  {property.unit}, {property.building}
                </h2>
                <StatusBadge status={property.status as Parameters<typeof StatusBadge>[0]['status']} />
                <StatusBadge status={property.occupancyStatus as Parameters<typeof StatusBadge>[0]['status']} />
                {/* Live sync indicator */}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
                {viewingsSyncBadge && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-semibold animate-pulse">
                    <Icon name="RefreshCwIcon" size={9} />
                    {viewingsSyncBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 line-clamp-2 sm:line-clamp-1">
                {formatFloorDisplay(property.floor)} · {property.street}, {property.district} ·{' '}
                <span className="font-mono">{(property.sqft ?? 0).toLocaleString()} sq ft</span> ·
                Built {property.yearBuilt ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <button
              onClick={() => setShowViewingSchedule(true)}
              className="hidden sm:flex btn-primary py-1.5 text-xs"
            >
              <Icon name="CalendarIcon" size={13} />
              Viewing Schedule
            </button>
            <button
              onClick={() => setShowViewingSchedule(true)}
              className="sm:hidden p-2.5 rounded-lg bg-[#1B4F8A] text-white min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Viewing Schedule"
            >
              <Icon name="CalendarIcon" size={16} />
            </button>
            {/* Download PDF button */}
            <button
              onClick={async () => {
                setDownloadingPdf(true);
                try {
                  await generatePropertyPDF(
                    property,
                    govValDocs,
                    tenancyAgreementDocs,
                    bedrooms,
                    bathrooms,
                    rentalPrice,
                    salePrice,
                    engRemark,
                    chiRemark,
                  );
                  toast.success('Property report downloaded');
                  trackEvent('pdf_download', {
                    property_ref: property.property_ref,
                    property_id: property.id,
                    document_type: 'property_report',
                  });
                } catch {
                  toast.error('Failed to generate PDF');
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              disabled={downloadingPdf}
              className="hidden sm:flex btn-secondary py-1.5 text-xs disabled:opacity-60"
              title="Download property report as PDF"
            >
              {downloadingPdf ? (
                <Icon name="LoaderIcon" size={13} className="animate-spin" />
              ) : (
                <Icon name="DownloadIcon" size={13} />
              )}
              {downloadingPdf ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              onClick={async () => {
                setDownloadingPdf(true);
                try {
                  await generatePropertyPDF(
                    property,
                    govValDocs,
                    tenancyAgreementDocs,
                    bedrooms,
                    bathrooms,
                    rentalPrice,
                    salePrice,
                    engRemark,
                    chiRemark,
                  );
                  toast.success('Property report downloaded');
                  trackEvent('pdf_download', {
                    property_ref: property.property_ref,
                    property_id: property.id,
                    document_type: 'property_report',
                  });
                } catch {
                  toast.error('Failed to generate PDF');
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              disabled={downloadingPdf}
              className="sm:hidden p-2.5 rounded-lg bg-white border border-[hsl(214,20%,85%)] text-[hsl(215,25%,30%)] hover:bg-[hsl(210,15%,94%)] min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-60"
              title="Download PDF"
            >
              {downloadingPdf ? (
                <Icon name="LoaderIcon" size={16} className="animate-spin" />
              ) : (
                <Icon name="DownloadIcon" size={16} />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <Icon name="XIcon" size={18} className="text-[hsl(215,15%,52%)]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[hsl(214,20%,88%)] px-2 sm:px-6 flex-shrink-0 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-[44px] min-h-[44px] relative ${
                activeTab === tab.id
                  ? 'border-[#1B4F8A] text-[#1B4F8A]'
                  : 'border-transparent text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={16} className="sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-[10px] font-semibold">{tab.label.split(' ')[0]}</span>
              {tab.id === 'hk-forms' && !property.tenant?.cr109Filed && (
                <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
              {tab.id === 'history' && historyLog.length > 0 && (
                <span className="hidden sm:inline ml-1 text-[10px] bg-[#1B4F8A]/10 text-[#1B4F8A] rounded-full px-1.5 py-0.5 font-bold">{historyLog.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 sm:p-4">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-1.5">
              {/* 0. Property Identity — building name, phase, building type, floor/flat */}
              <div className="border border-[#1B4F8A]/25 rounded-lg overflow-hidden bg-[#1B4F8A]/4">
                <div className="px-3 pt-1.5 pb-1.5 bg-[#1B4F8A]/8">
                  <SectionHeader
                    sectionKey="identity"
                    icon="BuildingIcon"
                    iconColor="text-[#1B4F8A]"
                    title="Property Identity"
                  />
                </div>
                {!collapsedSections['identity'] && (
                  <div className="px-3 pb-2 pt-1">
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {/* Building Name — spans 2 cols */}
                      <div className="col-span-2 bg-white border border-[#1B4F8A]/20 rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[#1B4F8A] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <Icon name="BuildingIcon" size={8} className="text-[#1B4F8A]" />
                          Building Name
                        </p>
                        <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] truncate">
                          {(property as any).buildingName || property.building || '—'}
                        </p>
                      </div>
                      {/* PID */}
                      {property.ref && (
                        <div className="bg-white border border-[#1B4F8A]/20 rounded-md px-2 py-1">
                          <p className="text-[8px] font-semibold text-[#1B4F8A] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            <Icon name="IdentificationIcon" size={8} className="text-[#1B4F8A]" />
                            PID
                          </p>
                          <p className="text-[11px] font-semibold font-mono text-[hsl(215,25%,18%)] truncate">
                            {property.ref}
                          </p>
                        </div>
                      )}
                      {/* Short Code */}
                      {(property as any).shortCode && (
                        <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                          <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Short Code</p>
                          <p className="text-[11px] font-semibold font-mono text-[#1B4F8A] truncate">
                            {(property as any).shortCode}
                          </p>
                        </div>
                      )}
                      {/* Property Type */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Type</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)] truncate">{property.type || '—'}</p>
                      </div>
                      {/* Phase */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Phase</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)] truncate">{(property as any).phase || '—'}</p>
                      </div>
                      {/* Village */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Village</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)] truncate">{(property as any).village || '—'}</p>
                      </div>
                      {/* Build Year */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Built</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{property.yearBuilt || '—'}</p>
                      </div>
                      {/* Building Type */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Bldg Type</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)] truncate">{buildingType || (property as any).buildingType || '—'}</p>
                      </div>
                      {/* Floor Number */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Floor</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{floorNumber || (() => { const f = property.floor?.trim(); if (!f) return '—'; if (/^[1-9]\d{2}$/.test(f)) return String(parseInt(f.slice(1), 10)); return f; })()}</p>
                      </div>
                      {/* Flat / Unit Number */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Flat/Unit</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{property.unit || '—'}</p>
                      </div>
                      {/* Outdoor Area */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Outdoor ft²</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{outdoorArea || '—'}</p>
                      </div>
                      {/* Net Sqft */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Net ft²</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">{netSqft ? `${Number(netSqft).toLocaleString()}` : '—'}</p>
                      </div>
                      {/* Gross Sqft */}
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-md px-2 py-1">
                        <p className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Gross ft²</p>
                        <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">{grossSqft ? `${Number(grossSqft).toLocaleString()}` : '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Pricing & Listing + Key Log — side by side */}
              <div className="flex flex-col sm:flex-row gap-1.5">
                {/* Pricing & Listing Dates */}
                <div className="flex-1 border border-[hsl(214,20%,88%)] rounded-lg overflow-visible">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)] rounded-t-lg overflow-hidden">
                  <SectionHeader
                    sectionKey="pricing"
                    icon="TagIcon"
                    title="Pricing & Listing Dates"
                  />
                </div>
                {!collapsedSections['pricing'] && (
                  <div className="px-3 pb-2 pt-1">
                    {/* Status & Listing Type — compact row */}
                    <div className="grid grid-cols-2 gap-1 mb-1.5">
                      <div>
                        <label className="text-[8px] font-semibold text-[#1B4F8A] uppercase tracking-wider mb-0.5 block">Status</label>
                        <select
                          value={propertyStatusCode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPropertyStatusCode(val);
                            fetch('/api/property-save', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: property.id, updates: { contact_status_code: val !== '' ? parseInt(val, 10) : null } }),
                            }).then(() => toast.success('Status updated'));
                          }}
                          className="input-base text-xs w-full min-h-[28px] py-0.5"
                        >
                          <option value="">---</option>
                          <option value="0">Active</option>
                          <option value="1">Leased</option>
                          <option value="2">Self Occupy</option>
                          <option value="3">No Contact</option>
                          <option value="4">Sold</option>
                          <option value="9">Unknown</option>
                          <option value="99">---</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] font-semibold text-[#1B4F8A] uppercase tracking-wider mb-0.5 block">Listing Type</label>
                        <select
                          value={listingType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setListingType(val);
                            fetch('/api/property-save', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: property.id, updates: { list_type: val || null } }),
                            }).then(() => toast.success('Listing type updated'));
                          }}
                          className="input-base text-xs w-full min-h-[28px] py-0.5"
                        >
                          <option value="">----</option>
                          <option value="Sale">Sale</option>
                          <option value="Rent">Rent</option>
                          <option value="Rent & Sale">Rent &amp; Sale</option>
                        </select>
                      </div>
                    </div>
                    {/* Pricing fields — 5 per row */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-1.5">
                      <div className="sm:col-span-2">
                        <label className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Sale Price (HKD)</label>
                        <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} onBlur={(e) => { const raw = e.target.value; if (raw) { const full = String(Number(raw) * 1000000); setSalePrice(full); autoSavePricingField('asking_price', full); } else { autoSavePricingField('asking_price', ''); } }} placeholder="e.g. 8.5 → 8,500,000" className="input-base w-full font-mono text-xs min-h-[28px] py-0.5" />
                        {salePrice && <p className="text-[8px] text-[hsl(215,15%,52%)] mt-0.5">≈ HK${(Number(salePrice) / 1000000).toFixed(2)}M (enter millions: 8.5 = 8,500,000)</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Rental / Month</label>
                        <input type="number" value={rentalPrice} onChange={(e) => setRentalPrice(e.target.value)} onBlur={(e) => { const raw = e.target.value; if (raw) { const full = String(Number(raw) * 1000); setRentalPrice(full); autoSavePricingField('asking_rent', full); } else { autoSavePricingField('asking_rent', ''); } }} placeholder="e.g. 28 → 28,000" className="input-base w-full font-mono text-xs min-h-[28px] py-0.5" />
                        {rentalPrice && <p className="text-[8px] text-[hsl(215,15%,52%)] mt-0.5">HK${Number(rentalPrice).toLocaleString()}/mo (enter thousands: 28 = 28,000)</p>}
                      </div>
                      <div>
                        <label className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Gross ft²</label>
                        <input type="number" value={grossSqft} onChange={(e) => setGrossSqft(e.target.value)} placeholder="e.g. 1200" className="input-base w-full font-mono text-xs min-h-[28px] py-0.5" />
                      </div>
                      <div className="relative sm:col-span-2">
                        <label className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Listing Date</label>
                        <div className="flex items-center gap-1">
                          <input type="text" value={listingDate} onChange={(e) => setListingDate(e.target.value)} onBlur={(e) => autoSavePricingDate('listing_date', e.target.value)} placeholder="DD/MM/YYYY" className="input-base w-full font-mono text-xs min-h-[28px] py-0.5" />
                          <button
                            ref={listingCalBtnRef}
                            type="button"
                            onClick={() => {
                              const next = !showListingCalendar;
                              setShowVacantCalendar(false);
                              if (next && listingCalBtnRef.current) {
                                const rect = listingCalBtnRef.current.getBoundingClientRect();
                                setListingCalPos({ top: rect.bottom + 4, left: rect.left });
                              }
                              setShowListingCalendar(next);
                            }}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded border border-[hsl(214,20%,88%)] bg-white hover:bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]"
                            title="Open calendar"
                          >
                            <Icon name="CalendarIcon" size={11} />
                          </button>
                        </div>
                        {showListingCalendar && (
                          <div className="fixed z-[9999] bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-lg p-3" style={{width: '280px', top: listingCalPos?.top, left: listingCalPos?.left}}>
                            <div className="flex items-center justify-between mb-2">
                              <button type="button" onClick={() => setListingCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1 rounded hover:bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]"><Icon name="ChevronLeftIcon" size={14} /></button>
                              <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{listingCalMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                              <button type="button" onClick={() => setListingCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1 rounded hover:bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]"><Icon name="ChevronRightIcon" size={14} /></button>
                            </div>
                            <div className="grid grid-cols-7 mb-1">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (<div key={d} className="text-center text-[9px] font-semibold text-[hsl(215,15%,52%)] py-0.5">{d}</div>))}</div>
                            <div className="grid grid-cols-7 gap-0.5">
                              {(() => {
                                const year = listingCalMonth.getFullYear(); const month = listingCalMonth.getMonth();
                                const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const cells: React.ReactNode[] = [];
                                for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} style={{height:'32px'}} />);
                                for (let day = 1; day <= daysInMonth; day++) {
                                  const dd = String(day).padStart(2, '0'); const mm = String(month + 1).padStart(2, '0');
                                  const dateStr = `${dd}/${mm}/${year}`; const isSelected = listingDate === dateStr;
                                  cells.push(<button key={day} type="button" onClick={() => { setListingDate(dateStr); setShowListingCalendar(false); autoSavePricingDate('listing_date', dateStr); }} style={{height:'32px'}} className={`text-[11px] w-full rounded-md flex items-center justify-center transition-colors ${isSelected ? 'bg-[hsl(215,70%,45%)] text-white font-semibold' : 'hover:bg-[hsl(210,20%,94%)] text-[hsl(215,25%,18%)]'}`}>{day}</button>);
                                }
                                return cells;
                              })()}
                            </div>
                            {listingDate && (<button type="button" onClick={() => { setListingDate(''); setShowListingCalendar(false); autoSavePricingDate('listing_date', ''); }} className="mt-2 w-full text-[10px] text-[hsl(215,15%,52%)] hover:text-red-500 text-center transition-colors">Clear date</button>)}
                          </div>
                        )}
                      </div>
                      <div className="relative sm:col-span-2">
                        <label className="text-[8px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Vacant Date</label>
                        <div className="flex items-center gap-1">
                          <input type="text" value={vacantDate} onChange={(e) => setVacantDate(e.target.value)} onBlur={(e) => autoSavePricingDate('vacant_date', e.target.value)} placeholder="DD/MM/YYYY" className="input-base w-full font-mono text-xs min-h-[28px] py-0.5" />
                          <button
                            ref={vacantCalBtnRef}
                            type="button"
                            onClick={() => {
                              const next = !showVacantCalendar;
                              setShowListingCalendar(false);
                              if (next && vacantCalBtnRef.current) {
                                const rect = vacantCalBtnRef.current.getBoundingClientRect();
                                setVacantCalPos({ top: rect.bottom + 4, left: rect.left });
                              }
                              setShowVacantCalendar(next);
                            }}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded border border-[hsl(214,20%,88%)] bg-white hover:bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]"
                            title="Open calendar"
                          >
                            <Icon name="CalendarIcon" size={11} />
                          </button>
                        </div>
                        {showVacantCalendar && (
                          <div className="fixed z-[9999] bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-lg p-3" style={{width: '280px', top: vacantCalPos?.top, left: vacantCalPos?.left}}>
                            <div className="flex items-center justify-between mb-2">
                              <button type="button" onClick={() => setVacantCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1 rounded hover:bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]"><Icon name="ChevronLeftIcon" size={14} /></button>
                              <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{vacantCalMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                              <button type="button" onClick={() => setVacantCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1 rounded hover:bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]"><Icon name="ChevronRightIcon" size={14} /></button>
                            </div>
                            <div className="grid grid-cols-7 mb-1">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (<div key={d} className="text-center text-[9px] font-semibold text-[hsl(215,15%,52%)] py-0.5">{d}</div>))}</div>
                            <div className="grid grid-cols-7 gap-0.5">
                              {(() => {
                                const year = vacantCalMonth.getFullYear(); const month = vacantCalMonth.getMonth();
                                const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const cells: React.ReactNode[] = [];
                                for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} style={{height:'32px'}} />);
                                for (let day = 1; day <= daysInMonth; day++) {
                                  const dd = String(day).padStart(2, '0'); const mm = String(month + 1).padStart(2, '0');
                                  const dateStr = `${dd}/${mm}/${year}`; const isSelected = vacantDate === dateStr;
                                  cells.push(<button key={day} type="button" onClick={() => { setVacantDate(dateStr); setShowVacantCalendar(false); autoSavePricingDate('vacant_date', dateStr); }} style={{height:'32px'}} className={`text-[11px] w-full rounded-md flex items-center justify-center transition-colors ${isSelected ? 'bg-[hsl(215,70%,45%)] text-white font-semibold' : 'hover:bg-[hsl(210,20%,94%)] text-[hsl(215,25%,18%)]'}`}>{day}</button>);
                                }
                                return cells;
                              })()}
                            </div>
                            {vacantDate && (<button type="button" onClick={() => { setVacantDate(''); setShowVacantCalendar(false); autoSavePricingDate('vacant_date', ''); }} className="mt-2 w-full text-[10px] text-[hsl(215,15%,52%)] hover:text-red-500 text-center transition-colors">Clear date</button>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Publish to Website — always visible */}
                    <div className={`rounded-lg border-2 overflow-hidden ${publishToWebsite ? 'border-emerald-300 bg-emerald-50' : 'border-dashed border-[hsl(214,20%,80%)] bg-[hsl(210,20%,98%)]'}`}>
                      <div className="px-3 py-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${publishToWebsite ? 'bg-emerald-500' : 'bg-[hsl(214,20%,85%)]'}`}>
                            <Icon name="GlobeIcon" size={11} className={publishToWebsite ? 'text-white' : 'text-[hsl(215,15%,52%)]'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${publishToWebsite ? 'text-emerald-700' : 'text-[hsl(215,15%,52%)]'}`}>
                              Publish to Website
                            </p>
                            {publishToWebsite ? (
                              <p className="text-[9px] text-emerald-600">
                                Live from <span className="font-semibold font-mono">{publishToWebsite}</span> · 3-month review reminder set
                              </p>
                            ) : (
                              <p className="text-[9px] text-[hsl(215,15%,52%)]">
                                Set a date to publish this property to the Homes R Us website
                              </p>
                            )}
                          </div>
                          {publishToWebsite && (
                            <button
                              onClick={() => {
                                if (confirm('Remove the publish date? This will unpublish the property from the website.')) {
                                  setPublishToWebsite('');
                                  fetch('/api/property-save', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: property.id, updates: { publish_dt: null } }),
                                  }).then(() => toast.success('Property unpublished from website'));
                                }
                              }}
                              className="flex-shrink-0 text-[9px] text-emerald-600 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={publishToWebsite}
                            onChange={(e) => setPublishToWebsite(e.target.value)}
                            className="input-base flex-1 font-mono text-xs min-h-[28px]"
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <button
                            onClick={() => handleSavePublishToWebsite(publishToWebsite)}
                            disabled={!publishToWebsite || publishingSaving}
                            className="btn-primary py-1 px-3 text-xs min-h-[28px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            {publishingSaving ? (
                              <><Icon name="LoaderIcon" size={11} className="animate-spin" />Saving…</>
                            ) : (
                              <><Icon name="GlobeIcon" size={11} />Publish</>
                            )}
                          </button>
                        </div>
                        {publishToWebsite && (
                          <p className="text-[9px] text-emerald-600 mt-1 flex items-center gap-1">
                            <Icon name="BellIcon" size={9} />
                            A 3-month review reminder will be sent to the listing agent on {(() => {
                              try {
                                const d = new Date(publishToWebsite);
                                d.setMonth(d.getMonth() + 3);
                                return d.toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' });
                              } catch { return ''; }
                            })()}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Key Location inline within Pricing & Listing Dates */}
                    {property.keyLocation && (
                      <div className={`mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 border ${
                        property.keyLocation.type === 'office' ? 'bg-[#1B4F8A]/8 border-[#1B4F8A]/25'
                          : property.keyLocation.type === 'agent' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          property.keyLocation.type === 'office' ? 'bg-[#1B4F8A]/15'
                            : property.keyLocation.type === 'agent' ? 'bg-amber-100' : 'bg-emerald-100'
                        }`}>
                          <Icon name="KeyIcon" size={11} className={property.keyLocation.type === 'office' ? 'text-[#1B4F8A]' : property.keyLocation.type === 'agent' ? 'text-amber-600' : 'text-emerald-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Key Location</p>
                          {property.keyLocation.type === 'office' && (
                            <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                              Key in office
                              {property.keyLocation.keyNumber && (
                                <span className="ml-2 font-mono font-bold text-[#1B4F8A]">#{property.keyLocation.keyNumber}</span>
                              )}
                            </p>
                          )}
                          {property.keyLocation.type === 'agent' && (
                            <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                              Key held by agent — <span className="font-semibold">{property.keyLocation.agentName}</span>
                              {property.keyLocation.agentPhone && <span className="text-amber-700 ml-1">· {property.keyLocation.agentPhone}</span>}
                            </p>
                          )}
                          {property.keyLocation.type === 'landlord' && (
                            <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                              Landlord will open — contact <span className="font-semibold">{property.landlord.name}</span>
                              <span className="text-emerald-700 ml-1">· {property.landlord.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

                {/* Key Log section — next to Pricing & Listing */}
                <div className="sm:w-72 border border-amber-200 rounded-lg overflow-hidden bg-amber-50/30">
                  <div className="px-3 pt-1.5 pb-1.5 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <Icon name="KeyIcon" size={13} className="text-amber-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-amber-800">Key Log</span>
                      {keyLogSaving && (
                        <span className="ml-auto flex items-center gap-1 text-[9px] text-amber-600">
                          <Icon name="LoaderIcon" size={9} className="animate-spin" />
                          Saving…
                        </span>
                      )}
                      {!keyLogSaving && keyLog?.id && (
                        <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-600">
                          <Icon name="CheckIcon" size={9} />
                          Saved
                        </span>
                      )}
                    </div>
                  </div>
                  {keyLogLoading ? (
                    <div className="px-3 py-4 flex items-center justify-center">
                      <Icon name="LoaderIcon" size={16} className="animate-spin text-amber-500" />
                    </div>
                  ) : keyLog !== null ? (
                    <div className="px-3 py-2 space-y-2">
                      {/* Key */}
                      <div>
                        <label className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5 block">Key</label>
                        <select
                          value={keyLog.key_status}
                          onChange={(e) => autoSaveKeyLog({ key_status: e.target.value })}
                          className="input-base w-full text-xs min-h-[28px] py-0.5 border-amber-200 focus:ring-amber-400"
                        >
                          <option value="">— Select —</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      {/* Key Number */}
                      <div>
                        <label className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5 block">Key Number</label>
                        <input
                          type="text"
                          value={keyLog.key_number}
                          onChange={(e) => setKeyLog((prev) => prev ? { ...prev, key_number: e.target.value } : prev)}
                          onBlur={(e) => autoSaveKeyLog({ key_number: e.target.value })}
                          placeholder="e.g. K-001"
                          className="input-base w-full text-xs font-mono min-h-[28px] py-0.5 border-amber-200 focus:ring-amber-400"
                        />
                      </div>
                      {/* Sole Agent */}
                      <div>
                        <label className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5 block">Sole Agent</label>
                        <select
                          value={keyLog.sole_agent}
                          onChange={(e) => autoSaveKeyLog({ sole_agent: e.target.value })}
                          className="input-base w-full text-xs min-h-[28px] py-0.5 border-amber-200 focus:ring-amber-400"
                        >
                          <option value="">— Select —</option>
                          <option value="Homes R Us">Homes R Us</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      {/* Sole Agent Name */}
                      <div>
                        <label className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5 block">Sole Agent Name</label>
                        <input
                          type="text"
                          value={keyLog.sole_agent_name}
                          onChange={(e) => setKeyLog((prev) => prev ? { ...prev, sole_agent_name: e.target.value } : prev)}
                          onBlur={(e) => autoSaveKeyLog({ sole_agent_name: e.target.value })}
                          placeholder="Agent name"
                          className="input-base w-full text-xs min-h-[28px] py-0.5 border-amber-200 focus:ring-amber-400"
                        />
                      </div>
                      {/* Sole Agent Valid From */}
                      <div className="relative">
                        <label className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5 block">Valid From</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={keyLog.sole_agent_valid_from}
                            onChange={(e) => autoSaveKeyLog({ sole_agent_valid_from: e.target.value })}
                            className="input-base w-full text-xs font-mono min-h-[28px] py-0.5 border-amber-200 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                      {/* Sole Agent Valid To */}
                      <div className="relative">
                        <label className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5 block">Valid To</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={keyLog.sole_agent_valid_to}
                            onChange={(e) => autoSaveKeyLog({ sole_agent_valid_to: e.target.value })}
                            className="input-base w-full text-xs font-mono min-h-[28px] py-0.5 border-amber-200 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 2. Property Specifications — compact */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="specs"
                    icon="HomeIcon"
                    title="Property Specifications"
                  />
                </div>
                {!collapsedSections['specs'] && (
                  <div className="px-3 pb-2 pt-1">
                    {/* Property specs — always editable */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Bedrooms</label>
                            <select value={bedrooms} onChange={(e) => { const val = e.target.value; setBedrooms(val); autoSaveSpecsField({ bedrooms: val === 'Studio' ? 0 : val ? Number(val) : null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              <option value="Studio">Studio</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="6">6</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Bathrooms</label>
                            <select value={bathrooms} onChange={(e) => { const val = e.target.value; setBathrooms(val); autoSaveSpecsField({ bathrooms: val ? Number(val) : null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4+</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Direction</label>
                            <select value={direction} onChange={(e) => { const val = e.target.value as DirectionType | ''; setDirection(val); autoSaveSpecsField({ direction_id: val || null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              {ALL_DIRECTIONS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">View</label>
                            <select value={view} onChange={(e) => { const val = e.target.value as ViewType | ''; setView(val); autoSaveSpecsField({ view_id: val || null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              {ALL_VIEWS.map((v) => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Decoration</label>
                            <select value={decoration} onChange={(e) => { const val = e.target.value as DecorationType | ''; setDecoration(val); autoSaveSpecsField({ decor_id: val || null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              {ALL_DECORATIONS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Original Furnishing</label>
                            <select value={originalFurnishing} onChange={(e) => setOriginalFurnishing(e.target.value as FurnishingType | '')} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              {ALL_FURNISHINGS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Building Type</label>
                            <select value={buildingType} onChange={(e) => { const val = e.target.value as BuildingType | ''; setBuildingType(val); autoSaveSpecsField({ prop_types: val || null, prop_type: val || null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              <option value="House">House</option>
                              <option value="Low Rise">Low Rise</option>
                              <option value="High Rise">High Rise</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Floor Type</label>
                            <select value={floorType} onChange={(e) => { const val = e.target.value as FloorType | ''; setFloorType(val); const floorTypeToDb: Record<string, string> = { 'Ground': 'ground floor', 'Low': 'low floor', 'Medium': 'middle floor', 'High': 'high floor' }; autoSaveSpecsField({ floor_type: val ? (floorTypeToDb[val] ?? val) : null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              {ALL_FLOOR_TYPES.map((ft) => (
                                <option key={ft} value={ft}>{ft}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Floor Number</label>
                            <select value={floorNumber} onChange={(e) => { const val = e.target.value as FloorNumber | ''; setFloorNumber(val); autoSaveSpecsField({ floor: val || null }); }} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select —</option>
                              <option value="LG">LG (Lower Ground)</option>
                              <option value="G">G (Ground)</option>
                              <option value="UG">UG (Upper Ground)</option>
                              {ALL_FLOOR_NUMBERS.filter((fn) => !['LG', 'G', 'UG'].includes(fn)).map((fn) => (
                                <option key={fn} value={fn}>{fn}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Net Sqft</label>
                            <input type="number" value={netSqft} onChange={(e) => setNetSqft(e.target.value)} onBlur={(e) => autoSaveSpecsField({ saleable_area: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 950" className="input-base w-full font-mono text-xs" />
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5 block">Gross Sqft</label>
                            <input type="number" value={grossSqft} onChange={(e) => setGrossSqft(e.target.value)} onBlur={(e) => autoSaveSpecsField({ gross_area: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 1100" className="input-base w-full font-mono text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1 block">Additional Features</label>
                          <div className="flex flex-wrap gap-1">
                            {ALL_ADDITIONAL_FEATURES.map((feat) => (
                              <button
                                key={feat}
                                type="button"
                                onClick={() => toggleAdditionalFeature(feat)}
                                className={`px-2 py-1 rounded-full text-xs font-medium border-2 transition-all min-h-[28px] ${
                                  additionalFeatures.includes(feat)
                                    ? 'border-[#1B4F8A] bg-[#1B4F8A]/10 text-[#1B4F8A]'
                                    : 'border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-[#1B4F8A]/40'
                                }`}
                              >
                                {additionalFeatures.includes(feat) && <span className="mr-1">✓</span>}
                                {feat}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              {/* 3. Agent Comments */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader sectionKey="agentnotes" icon="FileTextIcon" iconColor="text-amber-600" title="Agent Comments" />
                </div>
                {!collapsedSections['agentnotes'] && (
                  <div className="px-3 pb-2 pt-1 flex gap-2">
                    {/* Left half: input box + Add Comment button */}
                    <div className="w-1/2 flex flex-col gap-1.5">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                        <p className="text-xs text-amber-800">{property.agentNotes}</p>
                        <p className="text-[9px] text-amber-600 mt-0.5">Last updated {property.lastUpdated} by {property.updatedBy}</p>
                      </div>
                      <textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        rows={2}
                        className="w-full text-xs border border-[hsl(214,20%,88%)] rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                      />
                      <div className="flex items-center gap-1.5">
                        <select
                          value={newCommentAgent}
                          onChange={(e) => setNewCommentAgent(e.target.value)}
                          className="text-xs border border-[hsl(214,20%,88%)] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 flex-1"
                        >
                          {agentNames.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddComment}
                          className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <Icon name="PlusIcon" size={11} />
                          Add
                        </button>
                      </div>
                    </div>
                    {/* Right half: recent updates (all history entries) */}
                    <div className="w-1/2 border border-[hsl(214,20%,88%)] rounded-lg bg-white overflow-hidden flex flex-col">
                      <div className="px-2.5 py-1.5 bg-[hsl(210,20%,98%)] border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
                        <p className="text-[9px] font-semibold text-[hsl(215,25%,35%)] uppercase tracking-wide">Recent Updates</p>
                        {historyLog.length > 0 && (
                          <span className="text-[9px] bg-[#1B4F8A]/10 text-[#1B4F8A] rounded-full px-1.5 py-0.5 font-bold">{historyLog.length}</span>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto max-h-32 divide-y divide-[hsl(214,20%,93%)]">
                        {historyLog.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-4 text-center">
                            <Icon name="ClockIcon" size={16} className="text-[hsl(215,15%,72%)] mb-1" />
                            <p className="text-[9px] text-[hsl(215,15%,55%)]">No updates yet</p>
                          </div>
                        ) : (
                          historyLog.map((entry) => {
                            const isComment = entry.id.startsWith('hl-cmt-');
                            const isPricing = entry.id.startsWith('hl-pricing-');
                            const dotColor = isComment
                              ? 'bg-amber-400'
                              : isPricing
                              ? 'bg-emerald-500' :'bg-[#1B4F8A]';
                            return (
                              <div key={entry.id} className="px-2.5 py-1.5 flex items-start gap-1.5">
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between mb-0.5 gap-1">
                                    <span className="text-[9px] font-medium text-[hsl(215,25%,35%)] truncate">{entry.agent}</span>
                                    <span className="text-[9px] text-[hsl(215,15%,55%)] flex-shrink-0">{entry.date}</span>
                                  </div>
                                  <p className="text-[11px] text-[hsl(215,25%,25%)] leading-relaxed break-words">{entry.action}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Highlight */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="highlight"
                    icon="StarIcon"
                    iconColor="text-yellow-500"
                    title="Highlight"
                    rightContent={
                      !collapsedSections['highlight'] && !editingHighlight ? (
                        <button
                          onClick={() => { setHighlightDraft(highlight); setEditingHighlight(true); }}
                          className="btn-ghost py-0.5 px-2 text-xs min-h-[28px]"
                        >
                          <Icon name="PencilIcon" size={11} />
                          <span className="hidden sm:inline">{highlight ? 'Edit' : 'Add Highlight'}</span>
                          <span className="sm:hidden">{highlight ? 'Edit' : 'Add'}</span>
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['highlight'] && (
                  <div className="px-3 pb-2 pt-1">
                    {editingHighlight ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={highlightDraft}
                          onChange={(e) => setHighlightDraft(e.target.value)}
                          rows={2}
                          placeholder="Add an important note or highlight for this property…"
                          className="input-base w-full resize-none text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={handleSaveHighlight} className="btn-primary py-1 px-3 text-xs min-h-[30px]"><Icon name="CheckIcon" size={11} />Save</button>
                          <button onClick={() => setEditingHighlight(false)} className="btn-ghost py-1 px-3 text-xs min-h-[30px]">Cancel</button>
                        </div>
                      </div>
                    ) : highlight ? (
                      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-2">
                        <Icon name="StarIcon" size={13} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-800 leading-relaxed">{highlight}</p>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-yellow-200 rounded-lg p-2.5 text-center bg-yellow-50/40">
                        <Icon name="StarIcon" size={16} className="text-yellow-300 mx-auto mb-0.5" />
                        <p className="text-xs text-[hsl(215,15%,52%)]">No highlight set — click "Add Highlight" to add an important note</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Owner & Landlord Details — combined */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader sectionKey="owner-landlord" icon="UserIcon" iconColor="text-violet-600" title="Owner Details" />
                </div>
                {!collapsedSections['owner-landlord'] && (
                  <div className="px-3 pb-2 pt-1 space-y-1.5">
                    {/* Add Owner button */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowAddOwnerForm((v) => !v); setShowAddLandlordForm(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Icon name="PlusIcon" size={13} className="text-white" />
                        Add Owner
                      </button>
                    </div>

                    {/* Inline Add Owner Form */}
                    {showAddOwnerForm && (
                      <div className="card p-2 border border-violet-200 bg-violet-50/40 space-y-1.5">
                        <p className="text-[9px] font-semibold text-violet-600 uppercase tracking-wider">New Owner</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name</label>
                            <input
                              className="input-field text-xs py-1 px-2 w-full"
                              value={newOwnerDraft.contact_person}
                              onChange={(e) => setNewOwnerDraft((prev) => ({ ...prev, contact_person: e.target.value }))}
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Phone</label>
                            <input
                              className="input-field text-xs py-1 px-2 w-full"
                              value={newOwnerDraft.contact_number}
                              onChange={(e) => setNewOwnerDraft((prev) => ({ ...prev, contact_number: e.target.value }))}
                              placeholder="Phone number"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                            <input
                              className="input-field text-xs py-1 px-2 w-full"
                              value={newOwnerDraft.contact_email}
                              onChange={(e) => setNewOwnerDraft((prev) => ({ ...prev, contact_email: e.target.value }))}
                              placeholder="Email address"
                            />
                          </div>
                        </div>
                        <div className="flex gap-1.5 justify-end pt-0.5">
                          <button
                            onClick={() => { setShowAddOwnerForm(false); setNewOwnerDraft({ contact_person: '', contact_number: '', contact_email: '', id_cr_no: '' }); }}
                            className="btn-ghost py-0.5 px-2 text-xs min-h-[26px]"
                            disabled={savingNewOwner}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveNewOwner}
                            className="btn-primary py-0.5 px-2 text-xs min-h-[26px]"
                            disabled={savingNewOwner}
                          >
                            {savingNewOwner ? <Icon name="LoaderIcon" size={11} className="animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Add Landlord Form */}
                    {showAddLandlordForm && (
                      <div className="card p-2 border border-violet-200 bg-violet-50/40 space-y-1.5">
                        <p className="text-[9px] font-semibold text-violet-600 uppercase tracking-wider">New Landlord</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name</label>
                            <input
                              className="input-field text-xs py-1 px-2 w-full"
                              value={newLandlordDraft.contact_person}
                              onChange={(e) => setNewLandlordDraft((prev) => ({ ...prev, contact_person: e.target.value }))}
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Phone</label>
                            <input
                              className="input-field text-xs py-1 px-2 w-full"
                              value={newLandlordDraft.contact_number}
                              onChange={(e) => setNewLandlordDraft((prev) => ({ ...prev, contact_number: e.target.value }))}
                              placeholder="Phone number"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                            <input
                              className="input-field text-xs py-1 px-2 w-full"
                              value={newLandlordDraft.contact_email}
                              onChange={(e) => setNewLandlordDraft((prev) => ({ ...prev, contact_email: e.target.value }))}
                              placeholder="Email address"
                            />
                          </div>
                        </div>
                        <div className="flex gap-1.5 justify-end pt-0.5">
                          <button
                            onClick={() => { setShowAddLandlordForm(false); setNewLandlordDraft({ contact_person: '', contact_number: '', contact_email: '', id_cr_no: '' }); }}
                            className="btn-ghost py-0.5 px-2 text-xs min-h-[26px]"
                            disabled={savingNewLandlord}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveNewLandlord}
                            className="btn-primary py-0.5 px-2 text-xs min-h-[26px]"
                            disabled={savingNewLandlord}
                          >
                            {savingNewLandlord ? <Icon name="LoaderIcon" size={11} className="animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Owner contacts from CSV — shown inline within Owner & Landlord Details */}
                    {importedContacts
                      .filter((c) => c.contact_role?.toLowerCase() === 'owner')
                      .map((c) => (
                        <div key={`owner-csv-${c.id}`} className="card p-2 border border-violet-200 bg-violet-50/40">
                          {editingImportedContactId === c.id ? (
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name</label>
                                  <input
                                    className="input-field text-xs py-1 px-2 w-full"
                                    value={importedContactDraft.contact_person}
                                    onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_person: e.target.value }))}
                                    placeholder="Full name"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Phone</label>
                                  <input
                                    className="input-field text-xs py-1 px-2 w-full"
                                    value={importedContactDraft.contact_number}
                                    onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_number: e.target.value }))}
                                    placeholder="Phone number"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                                  <input
                                    className="input-field text-xs py-1 px-2 w-full"
                                    value={importedContactDraft.contact_email}
                                    onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_email: e.target.value }))}
                                    placeholder="Email address"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Role</label>
                                  <select
                                    className="input-field text-xs py-1 px-2 w-full"
                                    value={importedContactDraft.contact_role}
                                    onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_role: e.target.value }))}
                                  >
                                    <option value="">Select role...</option>
                                    <option value="Owner">Owner</option>
                                    <option value="Tenant">Tenant</option>
                                    <option value="Decision Maker">Decision Maker</option>
                                    <option value="Landlord">Landlord</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex gap-1.5 justify-end pt-0.5">
                                <button
                                  onClick={() => setEditingImportedContactId(null)}
                                  className="btn-ghost py-0.5 px-2 text-xs min-h-[26px]"
                                  disabled={savingImportedContact}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveImportedContactEdit}
                                  className="btn-primary py-0.5 px-2 text-xs min-h-[26px]"
                                  disabled={savingImportedContact}
                                >
                                  {savingImportedContact ? <Icon name="LoaderIcon" size={11} className="animate-spin" /> : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[9px] font-semibold text-violet-600 uppercase tracking-wider">Owner Details</p>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setImportedContactDraft({
                                        contact_person: c.contact_person,
                                        contact_number: c.contact_number,
                                        contact_email: c.contact_email,
                                        contact_role: c.contact_role,
                                      });
                                      setEditingImportedContactId(c.id);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-[hsl(215,15%,52%)] hover:bg-violet-100 hover:text-violet-700 transition-colors"
                                    title="Edit owner contact"
                                  >
                                    <Icon name="PencilSquareIcon" size={11} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteImportedContact(c.id)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    title="Delete owner"
                                  >
                                    <Icon name="Trash2Icon" size={11} />
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                {[
                                  { label: 'Name', value: c.contact_person || '—' },
                                  { label: 'Phone', value: c.contact_number || '—' },
                                  { label: 'Email', value: c.contact_email || '—' },
                                  { label: 'ID / CR No.', value: '—' },
                                ].map((item) => (
                                  <div key={`owner-csv-field-${item.label}`} className="bg-violet-50 rounded-lg px-2 py-1">
                                    <p className="text-[9px] text-violet-500 mb-0.5">{item.label}</p>
                                    <p className="text-xs font-medium text-violet-900 break-all">{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 6. Contacts */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="contacts"
                    icon="UsersIcon"
                    title="Contacts"
                    rightContent={
                      !collapsedSections['contacts'] ? (
                        <button
                          onClick={() => { setShowAddContact(true); setNewContact(emptyContact()); }}
                          className="btn-primary py-0.5 px-2 text-xs min-h-[28px]"
                        >
                          <Icon name="PlusIcon" size={11} />
                          <span className="hidden sm:inline">Add Contact</span>
                          <span className="sm:hidden">Add</span>
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['contacts'] && (
                  <div className="px-3 pb-2 pt-1">
                    {/* Decision Maker Sub-section */}
                    <div className="mb-3 border border-amber-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-50">
                        <div className="flex items-center gap-1.5">
                          <Icon name="StarIcon" size={11} className="text-amber-500" />
                          <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Decision Maker</span>
                        </div>
                        {!editingDecisionMaker && (
                          <button
                            onClick={() => {
                              setDecisionMakerDraft({ ...decisionMaker });
                              setEditingDecisionMaker(true);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-600 hover:bg-amber-100 transition-colors"
                          >
                            <Icon name="PencilSquareIcon" size={10} />
                            {decisionMaker.name ? 'Edit' : 'Add'}
                          </button>
                        )}
                      </div>
                      <div className="px-2.5 py-2 bg-white">
                        {editingDecisionMaker ? (
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                              <div>
                                <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name *</label>
                                <input
                                  type="text"
                                  value={decisionMakerDraft.name}
                                  onChange={(e) => setDecisionMakerDraft({ ...decisionMakerDraft, name: e.target.value })}
                                  className="input-base w-full min-h-[30px] text-xs"
                                  placeholder="Full name"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Phone</label>
                                <input
                                  type="text"
                                  value={decisionMakerDraft.phone}
                                  onChange={(e) => setDecisionMakerDraft({ ...decisionMakerDraft, phone: e.target.value })}
                                  className="input-base w-full min-h-[30px] text-xs"
                                  placeholder="+852 9xxx xxxx"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                                <input
                                  type="email"
                                  value={decisionMakerDraft.email}
                                  onChange={(e) => setDecisionMakerDraft({ ...decisionMakerDraft, email: e.target.value })}
                                  className="input-base w-full min-h-[30px] text-xs"
                                  placeholder="email@example.com"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (!decisionMakerDraft.name.trim()) {
                                    toast.error('Decision maker name is required');
                                    return;
                                  }
                                  setDecisionMaker({ ...decisionMakerDraft });
                                  setEditingDecisionMaker(false);
                                  toast.success('Decision maker saved');
                                }}
                                className="btn-primary py-0.5 px-2.5 text-xs min-h-[28px]"
                              >
                                <Icon name="CheckIcon" size={10} />
                                Save
                              </button>
                              <button
                                onClick={() => setEditingDecisionMaker(false)}
                                className="btn-ghost py-0.5 px-2.5 text-xs min-h-[28px]"
                              >
                                Cancel
                              </button>
                              {decisionMaker.name && (
                                <button
                                  onClick={() => {
                                    setDecisionMaker({ name: '', phone: '', email: '' });
                                    setDecisionMakerDraft({ name: '', phone: '', email: '' });
                                    setEditingDecisionMaker(false);
                                    toast.success('Decision maker removed');
                                  }}
                                  className="ml-auto text-[9px] text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ) : decisionMaker.name ? (
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Icon name="StarIcon" size={12} className="text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{decisionMaker.name}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {decisionMaker.phone && (
                                  <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1">
                                    <Icon name="PhoneIcon" size={9} className="text-amber-400 flex-shrink-0" />
                                    {decisionMaker.phone}
                                  </p>
                                )}
                                {decisionMaker.email && (
                                  <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1 break-all">
                                    <Icon name="MailIcon" size={9} className="text-amber-400 flex-shrink-0" />
                                    {decisionMaker.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[9px] text-[hsl(215,15%,62%)] italic">No decision maker assigned yet</p>
                        )}
                      </div>
                    </div>

                    {contacts.length === 0 && importedContacts.filter((c) => c.contact_role?.toLowerCase() !== 'owner').length === 0 && !showAddContact && (
                      <div className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-lg p-3 text-center">
                        <Icon name="UsersIcon" size={20} className="text-[hsl(215,15%,62%)] mx-auto mb-1" />
                        <p className="text-xs font-medium text-[hsl(215,25%,18%)]">No contacts added yet</p>
                        <p className="text-[9px] text-[hsl(215,15%,52%)] mb-2">Add family members, company contacts, or other people associated with this property</p>
                        <button
                          onClick={() => { setShowAddContact(true); setNewContact(emptyContact()); }}
                          className="btn-secondary py-1 px-3 text-xs min-h-[30px]"
                        >
                          <Icon name="PlusIcon" size={11} />
                          Add First Contact
                        </button>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {contacts.map((contact) => (
                        <div key={contact.id}>
                          {editingContact?.id === contact.id ? (
                            <div className="card p-2.5 border-2 border-[#1B4F8A]/30 space-y-2">
                              <p className="text-[9px] font-semibold text-[#1B4F8A] uppercase tracking-wider">Editing Contact</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name *</label>
                                  <input type="text" value={editingContact.name} onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="Full name" />
                                </div>
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Relationship to Owner</label>
                                  <input type="text" value={editingContact.relationship} onChange={(e) => setEditingContact({ ...editingContact, relationship: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="e.g. Wife, Son, Company Director" />
                                </div>
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Mobile</label>
                                  <input type="text" value={editingContact.mobile} onChange={(e) => setEditingContact({ ...editingContact, mobile: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="+852 9xxx xxxx" />
                                </div>
                                <div>
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Telephone</label>
                                  <input type="text" value={editingContact.telephone} onChange={(e) => setEditingContact({ ...editingContact, telephone: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="+852 2xxx xxxx" />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                                  <input type="email" value={editingContact.email} onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="email@example.com" />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block flex items-center gap-1">
                                    <Icon name="TagIcon" size={9} className="text-amber-600" />
                                    Customer Code
                                    <span className="text-[9px] text-[hsl(215,15%,62%)] font-normal ml-1">— identifies contacts managing multiple properties</span>
                                  </label>
                                  <input type="text" value={editingContact.customerCode ?? ''} onChange={(e) => setEditingContact({ ...editingContact, customerCode: e.target.value })} className="input-base w-full min-h-[34px] font-mono text-xs" placeholder="e.g. CUST-001" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleUpdateContact(editingContact)} className="btn-primary py-1 px-3 text-xs min-h-[30px]"><Icon name="CheckIcon" size={11} />Save</button>
                                <button onClick={() => setEditingContact(null)} className="btn-ghost py-1 px-3 text-xs min-h-[30px]">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="card p-2 flex items-start gap-2 hover:shadow-card-hover transition-shadow">
                              <div className="w-7 h-7 rounded-full bg-[#1B4F8A]/10 flex items-center justify-center flex-shrink-0">
                                <Icon name="UserIcon" size={13} className="text-[#1B4F8A]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{contact.name}</p>
                                  {contact.relationship && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)]">
                                      {contact.relationship}
                                    </span>
                                  )}
                                  {contact.customerCode && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono font-semibold flex items-center gap-0.5">
                                      <Icon name="TagIcon" size={8} />
                                      {contact.customerCode}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {contact.mobile && (
                                    <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1">
                                      <Icon name="SmartphoneIcon" size={9} />
                                      {contact.mobile}
                                    </p>
                                  )}
                                  {contact.telephone && (
                                    <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1">
                                      <Icon name="PhoneIcon" size={9} />
                                      {contact.telephone}
                                    </p>
                                  )}
                                  {contact.email && (
                                    <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1 break-all">
                                      <Icon name="MailIcon" size={9} className="flex-shrink-0" />
                                      {contact.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button onClick={() => setEditingContact(contact)} className="p-1 rounded hover:bg-[hsl(210,15%,94%)] transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center" title="Edit contact">
                                  <Icon name="PencilIcon" size={11} className="text-[hsl(215,15%,52%)]" />
                                </button>
                                <button onClick={() => handleDeleteContact(contact.id)} className="p-1 rounded hover:bg-red-50 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center" title="Remove contact">
                                  <Icon name="Trash2Icon" size={11} className="text-red-400" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {showAddContact && (
                      <div className="card p-2.5 border-2 border-[#1B4F8A]/30 space-y-2 mt-1.5">
                        <p className="text-[9px] font-semibold text-[#1B4F8A] uppercase tracking-wider">New Contact</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name *</label>
                            <input type="text" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="Full name" />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Relationship to Owner</label>
                            <input type="text" value={newContact.relationship} onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="e.g. Wife, Son, Company Director" />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Mobile</label>
                            <input type="text" value={newContact.mobile} onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="+852 9xxx xxxx" />
                          </div>
                          <div>
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Telephone</label>
                            <input type="text" value={newContact.telephone} onChange={(e) => setNewContact({ ...newContact, telephone: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="+852 2xxx xxxx" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                            <input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="input-base w-full min-h-[34px] text-xs" placeholder="email@example.com" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block flex items-center gap-1">
                              <Icon name="TagIcon" size={9} className="text-amber-600" />
                              Customer Code
                              <span className="text-[9px] text-[hsl(215,15%,62%)] font-normal ml-1">— identifies contacts managing multiple properties</span>
                            </label>
                            <input type="text" value={newContact.customerCode ?? ''} onChange={(e) => setNewContact({ ...newContact, customerCode: e.target.value })} className="input-base w-full min-h-[34px] font-mono text-xs" placeholder="e.g. CUST-001" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleSaveContact} className="btn-primary py-1 px-3 text-xs min-h-[30px]"><Icon name="PlusIcon" size={11} />Add Contact</button>
                          <button onClick={() => setShowAddContact(false)} className="btn-ghost py-1 px-3 text-xs min-h-[30px]">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Imported contacts from CSV upload — merged into main contacts list */}
                    {importedContactsLoading && (
                      <div className="flex items-center gap-2 text-xs text-[hsl(215,15%,52%)] py-1.5">
                        <Icon name="LoaderIcon" size={12} className="animate-spin" />
                        Loading…
                      </div>
                    )}
                    {!importedContactsLoading && importedContacts.filter((c) => c.contact_role?.toLowerCase() !== 'owner').length > 0 && (
                      <div className="space-y-1.5 mt-1.5">
                        {importedContacts.filter((c) => c.contact_role?.toLowerCase() !== 'owner').map((c) => (
                          <div key={c.id} className="card p-2 border border-purple-100">
                            {editingImportedContactId === c.id ? (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Name</label>
                                    <input
                                      className="input-field text-xs py-1 px-2 w-full"
                                      value={importedContactDraft.contact_person}
                                      onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_person: e.target.value }))}
                                      placeholder="Full name"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Role</label>
                                    <select
                                      className="input-field text-xs py-1 px-2 w-full"
                                      value={importedContactDraft.contact_role}
                                      onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_role: e.target.value }))}
                                    >
                                      <option value="">Select role...</option>
                                      <option value="Owner">Owner</option>
                                      <option value="Tenant">Tenant</option>
                                      <option value="Decision Maker">Decision Maker</option>
                                      <option value="Landlord">Landlord</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Phone</label>
                                    <input
                                      className="input-field text-xs py-1 px-2 w-full"
                                      value={importedContactDraft.contact_number}
                                      onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_number: e.target.value }))}
                                      placeholder="Phone number"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-[hsl(215,15%,52%)] mb-0.5 block">Email</label>
                                    <input
                                      className="input-field text-xs py-1 px-2 w-full"
                                      value={importedContactDraft.contact_email}
                                      onChange={(e) => setImportedContactDraft((prev) => ({ ...prev, contact_email: e.target.value }))}
                                      placeholder="Email address"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-1.5 justify-end pt-0.5">
                                  <button
                                    onClick={() => setEditingImportedContactId(null)}
                                    className="btn-ghost py-0.5 px-2 text-xs min-h-[26px]"
                                    disabled={savingImportedContact}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={saveImportedContactEdit}
                                    className="btn-primary py-0.5 px-2 text-xs min-h-[26px]"
                                    disabled={savingImportedContact}
                                  >
                                    {savingImportedContact ? (
                                      <Icon name="LoaderIcon" size={11} className="animate-spin" />
                                    ) : (
                                      'Save'
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Icon name="UserIcon" size={12} className="text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{c.contact_person || '—'}</p>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 capitalize">
                                      {c.contact_role}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                                    {c.contact_number && (
                                      <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1">
                                        <Icon name="PhoneIcon" size={9} className="flex-shrink-0 text-purple-400" />
                                        <span>{c.contact_number}</span>
                                      </p>
                                    )}
                                    {c.contact_email && (
                                      <p className="text-[9px] text-[hsl(215,15%,52%)] flex items-center gap-1 break-all">
                                        <Icon name="MailIcon" size={9} className="flex-shrink-0 text-purple-400" />
                                        <span>{c.contact_email}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setImportedContactDraft({
                                        contact_person: c.contact_person,
                                        contact_number: c.contact_number,
                                        contact_email: c.contact_email,
                                        contact_role: c.contact_role,
                                      });
                                      setEditingImportedContactId(c.id);
                                    }}
                                    className="p-1 rounded hover:bg-purple-50 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                                    title="Edit contact"
                                  >
                                    <Icon name="PencilSquareIcon" size={12} className="text-purple-400" />
                                  </button>
                                  <button
                                    onClick={() => deleteImportedContact(c.id)}
                                    className="p-1 rounded hover:bg-red-50 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                                    title="Delete contact"
                                  >
                                    <Icon name="Trash2Icon" size={11} className="text-red-400" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 7. Key Location Banner */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="keylocation"
                    icon="KeyIcon"
                    title="Key Location"
                    rightContent={
                      !collapsedSections['keylocation'] && !editingKeyLocation ? (
                        <button
                          onClick={() => {
                            setKeyLocationDraft({
                              type: keyLocation?.type ?? 'office',
                              keyNumber: keyLocation?.keyNumber ?? '',
                              agentName: keyLocation?.agentName ?? '',
                              agentPhone: keyLocation?.agentPhone ?? '',
                            });
                            setEditingKeyLocation(true);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,92%)] hover:text-[#1B4F8A] transition-colors"
                        >
                          <Icon name="PencilSquareIcon" size={11} />
                          Edit
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['keylocation'] && (
                  <div className="px-3 pb-2 pt-1">
                    {editingKeyLocation ? (
                      <div className="space-y-2">
                        {/* Type selector */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">Key Location Type</label>
                          <div className="flex gap-1.5">
                            {(['office', 'agent', 'landlord'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setKeyLocationDraft((prev) => ({ ...prev, type: t }))}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                                  keyLocationDraft.type === t
                                    ? t === 'office' ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                                      : t === 'agent'? 'bg-amber-500 text-white border-amber-500' :'bg-emerald-500 text-white border-emerald-500' :'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,96%)]'
                                }`}
                              >
                                {t === 'office' ? '🏢 Office' : t === 'agent' ? '👤 Agent' : '🏠 Landlord'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Key Number */}
                        <div>
                          <label className="block text-[10px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-0.5">Key Number</label>
                          <input
                            type="text"
                            value={keyLocationDraft.keyNumber}
                            onChange={(e) => setKeyLocationDraft((prev) => ({ ...prev, keyNumber: e.target.value }))}
                            placeholder="e.g. K-042"
                            className="input-base w-full text-xs"
                          />
                        </div>
                        {/* Agent fields — only when type is 'agent' */}
                        {keyLocationDraft.type === 'agent' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-0.5">Agent Name</label>
                              <input
                                type="text"
                                value={keyLocationDraft.agentName}
                                onChange={(e) => setKeyLocationDraft((prev) => ({ ...prev, agentName: e.target.value }))}
                                placeholder="e.g. Natalie Leslie"
                                className="input-base w-full text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-0.5">Agent Phone</label>
                              <input
                                type="text"
                                value={keyLocationDraft.agentPhone}
                                onChange={(e) => setKeyLocationDraft((prev) => ({ ...prev, agentPhone: e.target.value }))}
                                placeholder="e.g. +852 9123 4567"
                                className="input-base w-full text-xs"
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveKeyLocation}
                            disabled={savingKeyLocation}
                            className="btn-primary py-1 px-3 text-xs min-h-[30px] flex items-center gap-1 disabled:opacity-50"
                          >
                            {savingKeyLocation ? <Icon name="LoaderIcon" size={11} className="animate-spin" /> : <Icon name="CheckIcon" size={11} />}
                            Save
                          </button>
                          <button onClick={() => setEditingKeyLocation(false)} className="btn-ghost py-1 px-3 text-xs min-h-[30px]">Cancel</button>
                        </div>
                      </div>
                    ) : keyLocation ? (
                      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border ${
                        keyLocation.type === 'office' ? 'bg-[#1B4F8A]/8 border-[#1B4F8A]/25'
                          : keyLocation.type === 'agent' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          keyLocation.type === 'office' ? 'bg-[#1B4F8A]/15'
                            : keyLocation.type === 'agent' ? 'bg-amber-100' : 'bg-emerald-100'
                        }`}>
                          <Icon name="KeyIcon" size={13} className={keyLocation.type === 'office' ? 'text-[#1B4F8A]' : keyLocation.type === 'agent' ? 'text-amber-600' : 'text-emerald-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {keyLocation.type === 'office' && (
                            <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                              Key in office
                              {keyLocation.keyNumber && (
                                <span className="ml-2 font-mono font-bold text-[#1B4F8A]">#{keyLocation.keyNumber}</span>
                              )}
                            </p>
                          )}
                          {keyLocation.type === 'agent' && (
                            <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                              Key held by agent — <span className="font-semibold">{keyLocation.agentName}</span>
                              {keyLocation.agentPhone && <span className="text-amber-700 ml-1">· {keyLocation.agentPhone}</span>}
                            </p>
                          )}
                          {keyLocation.type === 'landlord' && (
                            <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                              Landlord will open — contact <span className="font-semibold">{property.landlord.name}</span>
                              <span className="text-emerald-700 ml-1">· {property.landlord.phone}</span>
                            </p>
                          )}
                          {keyLocation.keyNumber && keyLocation.type !== 'office' && (
                            <p className="text-[9px] text-[hsl(215,15%,52%)] mt-0.5">Key #{keyLocation.keyNumber}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-3 gap-1.5 border-2 border-dashed border-[hsl(214,20%,88%)] rounded-lg">
                        <Icon name="KeyIcon" size={18} className="text-[hsl(215,15%,72%)]" />
                        <p className="text-xs text-[hsl(215,15%,52%)]">No key location recorded</p>
                        <button
                          onClick={() => {
                            setKeyLocationDraft({ type: 'office', keyNumber: '', agentName: '', agentPhone: '' });
                            setEditingKeyLocation(true);
                          }}
                          className="text-[11px] text-[#1B4F8A] font-medium hover:underline"
                        >
                          Add key location
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 8. Agent Commission */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="commission"
                    title="Agent Commission (% per category)"
                    rightContent={
                      !collapsedSections['commission'] ? (
                        <span className="text-[9px] text-[hsl(215,15%,52%)] bg-[hsl(210,20%,97%)] px-2 py-0.5 rounded-md hidden sm:inline">Rates vary per category</span>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['commission'] && (
                  <div className="px-3 pb-2 pt-1">
                    <div className="card p-2 space-y-1.5">
                      {commissionCategories.map((cat) => (
                        <div key={cat.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <div className="flex items-center gap-1.5 sm:w-36 flex-shrink-0">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-bold flex-shrink-0">
                              {cat.code}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{cat.label}</p>
                              <p className="text-[9px] text-[hsl(215,15%,52%)]">{cat.percentage}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <select value={commission[cat.key] ?? ''} onChange={(e) => handleCommissionChange(cat.key, e.target.value)} className="input-base w-full min-h-[34px] text-xs">
                              <option value="">— Select Agent —</option>
                              {agentNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                            {commission[cat.key] && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[9px] text-emerald-700 font-medium hidden sm:inline">Assigned</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 9. Property Photos */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="photos"
                    icon="ImageIcon"
                    title="Property Photos"
                    rightContent={
                      !collapsedSections['photos'] ? (
                        editingMatterport ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="url"
                              value={matterportDraft}
                              onChange={(e) => setMatterportDraft(e.target.value)}
                              placeholder="https://my.matterport.com/show/?m=..."
                              className="input-base text-xs font-mono w-40 sm:w-64 min-h-[32px]"
                              autoFocus
                            />
                            <button className="btn-primary py-1 px-2.5 text-xs min-h-[32px]" onClick={() => { setMatterportLink(matterportDraft); setEditingMatterport(false); }}>Save</button>
                            <button className="btn-secondary py-1 px-2.5 text-xs min-h-[32px]" onClick={() => { setMatterportDraft(matterportLink); setEditingMatterport(false); }}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {matterportLink ? (
                              <a href={matterportLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-semibold hover:bg-[#1B4F8A]/20 transition-colors min-h-[32px]">
                                <Icon name="VideoIcon" size={11} />
                                <span className="hidden sm:inline">Matterport Tour</span>
                                <span className="sm:hidden">Tour</span>
                              </a>
                            ) : (
                              <span className="text-xs text-[hsl(215,15%,62%)] italic hidden sm:inline">No virtual tour</span>
                            )}
                            <button className="btn-secondary py-1 px-2.5 text-xs min-h-[32px]" onClick={() => { setMatterportDraft(matterportLink); setEditingMatterport(true); }}>
                              <Icon name="LinkIcon" size={11} />
                              <span className="hidden sm:inline">{matterportLink ? 'Edit Link' : 'Add Matterport'}</span>
                              <span className="sm:hidden">{matterportLink ? 'Edit' : 'Add'}</span>
                            </button>
                          </div>
                        )
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['photos'] && (
                  <div className="px-3 pb-2 pt-1">
                    {/* Hidden file input */}
                    <input
                      ref={photoUploadRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        setPhotoUploading(true);
                        try {
                          const supabase = createClient();
                          const newPhotos: Array<{ id: string; url: string }> = [];
                          for (const file of files) {
                            const MAX_SIZE = 10 * 1024 * 1024; // 10MB limit
                            if (file.size > MAX_SIZE) {
                              toast.error(`"${file.name}" exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB). Please compress or resize the image before uploading.`);
                              continue;
                            }
                            const ext = file.name.split('.').pop();
                            const path = `property-photos/${property.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                            const { error } = await supabase.storage.from('property-photos').upload(path, file, { upsert: false });
                            if (!error) {
                              const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(path);
                              newPhotos.push({ id: `storage-${Date.now()}-${Math.random().toString(36).slice(2)}`, url: urlData.publicUrl });
                            } else {
                              toast.error(`Failed to upload "${file.name}": ${error.message}`);
                            }
                          }
                          if (newPhotos.length) {
                            setGalleryPhotos((prev) => [...prev, ...newPhotos]);
                            toast.success(`${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} uploaded`);
                          }
                        } catch {
                          toast.error('Upload failed');
                        } finally {
                          setPhotoUploading(false);
                          if (photoUploadRef.current) photoUploadRef.current.value = '';
                        }
                      }}
                    />

                    <PhotoGalleryV2
                      photos={galleryPhotos}
                      propertyLabel={`${property.building} unit ${property.unit}`}
                      onPhotosChange={setGalleryPhotos}
                      onUploadClick={() => photoUploadRef.current?.click()}
                      uploading={photoUploading}
                      onSaveOrder={savePhotoOrder}
                    />

                    {/* Upload button when photos exist */}
                    {galleryPhotos.length > 0 && (
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          onClick={() => photoUploadRef.current?.click()}
                          disabled={photoUploading}
                          className="btn-secondary py-1 px-2.5 text-xs min-h-[28px]"
                        >
                          <Icon name="UploadIcon" size={11} />
                          {photoUploading ? 'Uploading…' : 'Upload Photos'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 10. Website Link */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="website"
                    icon="GlobeIcon"
                    title="Website Link"
                    rightContent={
                      !collapsedSections['website'] && !editingWebsite ? (
                        <button className="btn-secondary py-1 px-2.5 text-xs min-h-[32px]" onClick={() => { setWebsiteDraft(websiteLink); setEditingWebsite(true); }}>
                          <Icon name="LinkIcon" size={11} />
                          <span className="hidden sm:inline">{websiteLink ? 'Edit Link' : 'Add Website'}</span>
                          <span className="sm:hidden">{websiteLink ? 'Edit' : 'Add'}</span>
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['website'] && (
                  <div className="px-3 pb-2 pt-1">
                    {editingWebsite ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input type="url" value={websiteDraft} onChange={(e) => setWebsiteDraft(e.target.value)} placeholder="https://www.example.com/property/..." className="input-base text-xs font-mono flex-1 min-h-[40px]" autoFocus />
                        <div className="flex gap-2">
                          <button className="btn-primary py-1.5 px-3 text-xs flex-1 sm:flex-none min-h-[40px]" onClick={() => { setWebsiteLink(websiteDraft); setEditingWebsite(false); toast.success('Website link saved'); }}>Save</button>
                          <button className="btn-secondary py-1.5 px-3 text-xs flex-1 sm:flex-none min-h-[40px]" onClick={() => { setWebsiteDraft(websiteLink); setEditingWebsite(false); }}>Cancel</button>
                        </div>
                      </div>
                    ) : websiteLink ? (
                      <a href={websiteLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1B4F8A]/8 text-[#1B4F8A] text-xs font-medium hover:bg-[#1B4F8A]/15 transition-colors border border-[#1B4F8A]/20 max-w-full truncate min-h-[40px]">
                        <Icon name="ExternalLinkIcon" size={13} />
                        {websiteLink}
                      </a>
                    ) : (
                      <div className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-lg p-3 text-center bg-[hsl(210,20%,98%)]">
                        <Icon name="GlobeIcon" size={18} className="text-[hsl(215,15%,62%)] mx-auto mb-1" />
                        <p className="text-xs text-[hsl(215,15%,52%)]">No website link — click "Add Website" to link this property to a website listing</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 10b. Advertising Remarks */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="remarks"
                    icon="FileTextIcon"
                    title="Advertising Remarks"
                    rightContent={
                      !collapsedSections['remarks'] && !editingRemarks ? (
                        <button
                          className="btn-secondary py-1 px-2.5 text-xs min-h-[32px]"
                          onClick={() => { setEngRemarkDraft(engRemark); setChiRemarkDraft(chiRemark); setEditingRemarks(true); }}
                        >
                          <Icon name="PencilIcon" size={11} />
                          <span className="hidden sm:inline">{engRemark || chiRemark ? 'Edit Remarks' : 'Add Remarks'}</span>
                          <span className="sm:hidden">{engRemark || chiRemark ? 'Edit' : 'Add'}</span>
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['remarks'] && (
                  <div className="px-3 pb-2 pt-1">
                    {editingRemarks ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-[hsl(215,25%,35%)] mb-1">English Description (p_eng_remark)</label>
                          <textarea
                            value={engRemarkDraft}
                            onChange={(e) => setEngRemarkDraft(e.target.value)}
                            placeholder="Enter English advertising description..."
                            rows={4}
                            className="input-base text-xs w-full resize-y min-h-[80px]"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[hsl(215,25%,35%)] mb-1">Chinese Description (中文廣告備注)</label>
                          <textarea
                            value={chiRemarkDraft}
                            onChange={(e) => setChiRemarkDraft(e.target.value)}
                            placeholder="輸入中文廣告描述..."
                            rows={4}
                            className="input-base text-xs w-full resize-y min-h-[80px]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn-primary py-1.5 px-3 text-xs min-h-[36px]"
                            onClick={() => { setEngRemark(engRemarkDraft); setChiRemark(chiRemarkDraft); setEditingRemarks(false); toast.success('Remarks saved'); }}
                          >Save</button>
                          <button
                            className="btn-secondary py-1.5 px-3 text-xs min-h-[36px]"
                            onClick={() => { setEngRemarkDraft(engRemark); setChiRemarkDraft(chiRemark); setEditingRemarks(false); }}
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (engRemark || chiRemark) ? (
                      <div className="space-y-2.5">
                        {engRemark && (
                          <div className="rounded-lg bg-[hsl(210,20%,98%)] border border-[hsl(214,20%,88%)] p-3">
                            <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-1">English</p>
                            <p className="text-xs text-[hsl(215,25%,18%)] whitespace-pre-wrap leading-relaxed">{engRemark}</p>
                          </div>
                        )}
                        {chiRemark && (
                          <div className="rounded-lg bg-[hsl(210,20%,98%)] border border-[hsl(214,20%,88%)] p-3">
                            <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-1">中文</p>
                            <p className="text-xs text-[hsl(215,25%,18%)] whitespace-pre-wrap leading-relaxed">{chiRemark}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-lg p-3 text-center bg-[hsl(210,20%,98%)]">
                        <Icon name="FileTextIcon" size={18} className="text-[hsl(215,15%,62%)] mx-auto mb-1" />
                        <p className="text-xs text-[hsl(215,15%,52%)]">No advertising remarks — click "Add Remarks" to add English and Chinese descriptions</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 11. Floor Plan */}
              <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
                <div className="px-3 pt-1.5 pb-1.5 bg-[hsl(210,20%,98%)]">
                  <SectionHeader sectionKey="floorplan" icon="LayoutIcon" title="Floor Plan" />
                </div>
                {!collapsedSections['floorplan'] && (
                  <div className="px-3 pb-2 pt-1">
                    {property.hasFloorPlan ? (
                      <div className="card p-3 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
                          <Icon name="LayoutIcon" size={16} className="text-[#1B4F8A]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[hsl(215,25%,18%)]">Floor Plan — {property.unit} {property.building}</p>
                          <p className="text-[10px] text-[hsl(215,15%,52%)]">PDF · Uploaded 15/04/2026</p>
                        </div>
                        <button className="btn-secondary py-1.5 px-2.5 text-xs min-h-[36px]"><Icon name="DownloadIcon" size={12} />Download</button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-lg p-5 text-center">
                        <Icon name="LayoutIcon" size={24} className="text-[hsl(215,15%,62%)] mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-[hsl(215,25%,18%)]">No floor plan uploaded</p>
                        <p className="text-[10px] text-[hsl(215,15%,52%)] mb-2.5">Upload a PDF or image of the floor plan</p>
                        <button className="btn-secondary py-1.5 px-3 text-xs min-h-[36px]"><Icon name="UploadIcon" size={12} />Upload Floor Plan</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TENANCY TAB */}
          {activeTab === 'tenancy' && (
            <div className="space-y-3 sm:space-y-4">

              {/* ── No Tenant State ─────────────────────────────────────────── */}
              {!property.tenant && (
                <div className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[hsl(210,20%,96%)] flex items-center justify-center mx-auto mb-3">
                    <Icon name="KeyIcon" size={22} className="text-[hsl(215,15%,52%)]" />
                  </div>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No Active Tenancy</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-1">This property is currently vacant or has no tenant on record.</p>
                </div>
              )}

              {property.tenant && (() => {
                const t = property.tenant;
                const rent = property.monthlyRent ?? 0;
                const depositMonths = rent > 0 ? Math.round(t.deposit / rent) : 0;
                const leaseEndDate = t.leaseEnd ? new Date(t.leaseEnd) : null;
                const now = new Date();
                const isActive = leaseEndDate ? leaseEndDate >= now : true;
                const daysToExpiry = leaseEndDate ? Math.ceil((leaseEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const isExpiringSoon = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 90;
                const isExpired = daysToExpiry !== null && daysToExpiry < 0;

                // Derive rent history from derivedTransactions
                const rentHistory = derivedTransactions.filter((tx) => tx.type === 'Lease' || tx.type === 'Lease Renewal' || tx.type === 'Lease Ended');

                return (
                  <>
                    {/* ── 1. Tenant Contact Details ─────────────────────────── */}
                    <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                      <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                        <SectionHeader
                          sectionKey="ten-contact"
                          icon="UserIcon"
                          title="Tenant Contact Details"
                          rightContent={!collapsedSections['ten-contact'] ? <StatusBadge status={isActive ? 'active' : 'expired'} /> : undefined}
                        />
                      </div>
                      {!collapsedSections['ten-contact'] && (
                        <div className="px-3 sm:px-4 pb-4 pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Name */}
                            <div className="flex items-start gap-3 bg-[hsl(210,20%,97%)] rounded-lg p-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon name="UserIcon" size={14} className="text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Full Name</p>
                                <p className="text-sm font-semibold text-[hsl(215,25%,18%)] break-words">{t.name || '—'}</p>
                              </div>
                            </div>
                            {/* HKID / CR */}
                            <div className="flex items-start gap-3 bg-[hsl(210,20%,97%)] rounded-lg p-3">
                              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon name="IdentificationIcon" size={14} className="text-violet-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">HKID / CR No.</p>
                                <p className="text-sm font-semibold text-[hsl(215,25%,18%)] font-mono break-all">{t.idNumber || '—'}</p>
                              </div>
                            </div>
                            {/* Phone */}
                            <div className="flex items-start gap-3 bg-[hsl(210,20%,97%)] rounded-lg p-3">
                              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon name="PhoneIcon" size={14} className="text-green-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Phone</p>
                                {t.phone ? (
                                  <a href={`tel:${t.phone}`} className="text-sm font-semibold text-blue-600 hover:underline break-all">{t.phone}</a>
                                ) : (
                                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">—</p>
                                )}
                              </div>
                            </div>
                            {/* Email */}
                            <div className="flex items-start gap-3 bg-[hsl(210,20%,97%)] rounded-lg p-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon name="MailIcon" size={14} className="text-amber-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Email</p>
                                {t.email ? (
                                  <a href={`mailto:${t.email}`} className="text-sm font-semibold text-blue-600 hover:underline break-all">{t.email}</a>
                                ) : (
                                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">—</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── 2. Lease Dates & Renewal Status ───────────────────── */}
                    <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                      <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                        <SectionHeader
                          sectionKey="ten-lease"
                          icon="CalendarIcon"
                          title="Lease Dates & Renewal Status"
                          rightContent={
                            !collapsedSections['ten-lease'] ? (
                              isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
                                  <Icon name="AlertCircleIcon" size={10} /> Expired
                                </span>
                              ) : isExpiringSoon ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Icon name="ClockIcon" size={10} /> Expiring in {daysToExpiry}d
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                  <Icon name="CheckCircleIcon" size={10} /> Active
                                </span>
                              )
                            ) : undefined
                          }
                        />
                      </div>
                      {!collapsedSections['ten-lease'] && (
                        <div className="px-3 sm:px-4 pb-4 pt-3 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Lease Start */}
                            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                              <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Lease Start</p>
                              <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{t.leaseStart || '—'}</p>
                            </div>
                            {/* Lease End */}
                            <div className={`rounded-lg p-3 ${isExpired ? 'bg-red-50 border border-red-100' : isExpiringSoon ? 'bg-amber-50 border border-amber-100' : 'bg-[hsl(210,20%,97%)]'}`}>
                              <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Lease End</p>
                              <p className={`text-sm font-semibold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-700' : 'text-[hsl(215,25%,18%)]'}`}>
                                {t.leaseEnd || '—'}
                              </p>
                            </div>
                            {/* Duration */}
                            <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                              <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Duration</p>
                              <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                                {t.leaseStart && t.leaseEnd ? (() => {
                                  const start = new Date(t.leaseStart);
                                  const end = new Date(t.leaseEnd);
                                  const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                                  return months >= 12 ? `${Math.floor(months / 12)} yr${Math.floor(months / 12) > 1 ? 's' : ''} ${months % 12 > 0 ? `${months % 12} mo` : ''}`.trim() : `${months} months`;
                                })() : '—'}
                              </p>
                            </div>
                          </div>

                          {/* Renewal Status */}
                          <div className="rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
                            <div className="px-3 py-2 bg-[hsl(210,20%,96%)] border-b border-[hsl(214,20%,88%)]">
                              <p className="text-xs font-semibold text-[hsl(215,25%,18%)] flex items-center gap-1.5">
                                <Icon name="RefreshCwIcon" size={12} className="text-teal-600" />
                                Renewal Status
                              </p>
                            </div>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.stampDutyPaid ? 'bg-green-500' : 'bg-[hsl(214,20%,80%)]'}`} />
                                <span className="text-xs text-[hsl(215,25%,18%)]">Stamp Duty</span>
                                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${t.stampDutyPaid ? 'bg-green-50 text-green-700' : 'bg-[hsl(210,20%,96%)] text-[hsl(215,15%,52%)]'}`}>
                                  {t.stampDutyPaid ? 'Paid' : 'Pending'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.cr109Filed ? 'bg-green-500' : 'bg-amber-400'}`} />
                                <span className="text-xs text-[hsl(215,25%,18%)]">CR109 Filed</span>
                                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${t.cr109Filed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {t.cr109Filed ? 'Filed' : 'Pending'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-500' : 'bg-red-400'}`} />
                                <span className="text-xs text-[hsl(215,25%,18%)]">Lease Status</span>
                                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                  {isActive ? 'Active' : 'Expired'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── 3. Deposit Amount & Status ────────────────────────── */}
                    <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                      <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                        <SectionHeader
                          sectionKey="ten-deposit"
                          icon="BanknoteIcon"
                          iconColor="text-emerald-600"
                          title="Deposit & Rent"
                        />
                      </div>
                      {!collapsedSections['ten-deposit'] && (
                        <div className="px-3 sm:px-4 pb-4 pt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Monthly Rent */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1">Monthly Rent</p>
                              <p className="text-lg font-bold text-blue-700">HK${rent.toLocaleString()}</p>
                              <p className="text-[10px] text-blue-500 mt-0.5">per month</p>
                            </div>
                            {/* Security Deposit */}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Security Deposit</p>
                              <p className="text-lg font-bold text-emerald-700">HK${t.deposit.toLocaleString()}</p>
                              <p className="text-[10px] text-emerald-500 mt-0.5">{depositMonths} month{depositMonths !== 1 ? 's' : ''} rent</p>
                            </div>
                            {/* Deposit Status */}
                            <div className="bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Deposit Status</p>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                <Icon name="CheckCircleIcon" size={11} /> Held
                              </span>
                              <p className="text-[10px] text-[hsl(215,15%,52%)] mt-1">In trust</p>
                            </div>
                            {/* Annual Rent */}
                            <div className="bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Annual Rent</p>
                              <p className="text-lg font-bold text-[hsl(215,25%,18%)]">HK${(rent * 12).toLocaleString()}</p>
                              <p className="text-[10px] text-[hsl(215,15%,52%)] mt-0.5">per year</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── 4. Rent History ───────────────────────────────────── */}
                    <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                      <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                        <SectionHeader
                          sectionKey="ten-rent-history"
                          icon="ClockIcon"
                          title="Rent History"
                          rightContent={
                            !collapsedSections['ten-rent-history'] ? (
                              <span className="text-xs text-[hsl(215,15%,52%)] bg-[hsl(210,20%,97%)] px-2 py-1 rounded-md border border-[hsl(214,20%,88%)]">
                                {rentHistory.length} record{rentHistory.length !== 1 ? 's' : ''}
                              </span>
                            ) : undefined
                          }
                        />
                      </div>
                      {!collapsedSections['ten-rent-history'] && (
                        <div className="px-3 sm:px-4 pb-4 pt-3">
                          {rentHistory.length === 0 ? (
                            <div className="border-2 border-dashed border-[hsl(214,20%,88%)] rounded-xl p-6 text-center">
                              <Icon name="ClockIcon" size={20} className="text-[hsl(215,15%,65%)] mx-auto mb-2" />
                              <p className="text-sm text-[hsl(215,15%,52%)]">No rent history available</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {rentHistory.map((tx) => {
                                const colors = txnTypeColor(tx.type);
                                return (
                                  <div key={tx.id} className={`rounded-xl border-l-4 p-3 sm:p-4 ${colors.bg} ${colors.border} border border-[hsl(214,20%,88%)]`}>
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.bg} ${colors.icon} border-current`}>
                                          <Icon name="KeyIcon" size={9} />
                                          {tx.type}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          tx.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200' :
                                          tx.status === 'Expired' ? 'bg-red-50 text-red-600 border border-red-200' :
                                          tx.status === 'Completed'? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                          {tx.status}
                                        </span>
                                      </div>
                                      <p className="text-sm font-bold text-[hsl(215,25%,18%)]">{tx.amountLabel}</p>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                                      <div>
                                        <p className="text-[10px] text-[hsl(215,15%,52%)] uppercase tracking-wider">Start</p>
                                        <p className="text-xs font-medium text-[hsl(215,25%,18%)]">{tx.date || '—'}</p>
                                      </div>
                                      {tx.endDate && (
                                        <div>
                                          <p className="text-[10px] text-[hsl(215,15%,52%)] uppercase tracking-wider">End</p>
                                          <p className="text-xs font-medium text-[hsl(215,25%,18%)]">{tx.endDate}</p>
                                        </div>
                                      )}
                                      {tx.tenant && (
                                        <div>
                                          <p className="text-[10px] text-[hsl(215,15%,52%)] uppercase tracking-wider">Tenant</p>
                                          <p className="text-xs font-medium text-[hsl(215,25%,18%)] truncate">{tx.tenant}</p>
                                        </div>
                                      )}
                                      {tx.agent && (
                                        <div>
                                          <p className="text-[10px] text-[hsl(215,15%,52%)] uppercase tracking-wider">Agent</p>
                                          <p className="text-xs font-medium text-[hsl(215,25%,18%)] truncate">{tx.agent}</p>
                                        </div>
                                      )}
                                    </div>
                                    {tx.notes && (
                                      <p className="mt-2 text-xs text-[hsl(215,15%,52%)] border-t border-[hsl(214,20%,88%)] pt-2">{tx.notes}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* ── Tenancy Workflow ──────────────────────────────────────── */}
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader sectionKey="tenancy-workflow" icon="ClipboardListIcon" iconColor="text-[#1B4F8A]" title="Tenancy Workflow" />
                </div>
                {!collapsedSections['tenancy-workflow'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2">
                    <TenancyWorkflow property={property} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="space-y-3 sm:space-y-4">
              {/* ── Lease Agreements ─────────────────────────────────────── */}
              {(() => {
                const handleUpload = makeDocUploader(
                  'lease-agreement', 'lease-agreements',
                  setLeaseAgreementDocs, setLeaseAgreementUploading, setLeaseAgreementError,
                  leaseAgreementInputRef, loadLeaseAgreementDocs,
                );
                return (
                  <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                    <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                      <SectionHeader
                        sectionKey="docs-lease"
                        icon="FileTextIcon"
                        iconColor="text-blue-600"
                        title="Lease Agreements"
                        rightContent={
                          !collapsedSections['docs-lease'] ? (
                            <div className="flex items-center gap-1.5">
                              <input ref={leaseAgreementInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" id="lease-agreement-upload" onChange={handleUpload} disabled={leaseAgreementUploading} />
                              <label htmlFor="lease-agreement-upload" className={`btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 min-h-[36px] ${leaseAgreementUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {leaseAgreementUploading ? (
                                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg><span className="hidden sm:inline">Uploading…</span></>
                                ) : (
                                  <><Icon name="UploadIcon" size={13} /><span className="hidden sm:inline">Upload</span></>
                                )}
                              </label>
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                    {!collapsedSections['docs-lease'] && (
                      <div className="px-3 sm:px-4 pb-4 pt-2">
                        {leaseAgreementError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                            <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-600">{leaseAgreementError}</p>
                          </div>
                        )}
                        {leaseAgreementLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-[hsl(215,15%,52%)]">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                            <span className="text-sm">Loading…</span>
                          </div>
                        ) : leaseAgreementDocs.length === 0 ? (
                          <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center bg-blue-50/40">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                              <Icon name="FileTextIcon" size={18} className="text-blue-500" />
                            </div>
                            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No lease agreements uploaded</p>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload signed lease agreements for {property.ref}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {leaseAgreementDocs.map((doc) => (
                              <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-blue-400">
                                <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                  <Icon name="FileTextIcon" size={16} className="text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                                  <p className="text-xs text-[hsl(215,15%,52%)]">{formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDocPreview(doc)} className="p-2 rounded hover:bg-blue-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Preview"><Icon name="EyeIcon" size={14} className="text-blue-500" /></button>
                                  <button onClick={() => handleGenericDocDownload(doc)} className="p-2 rounded hover:bg-blue-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Download"><Icon name="DownloadIcon" size={14} className="text-blue-600" /></button>
                                  <button onClick={() => handleLeaseAgreementDelete(doc)} className="p-2 rounded hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete"><Icon name="TrashIcon" size={14} className="text-red-400" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Inspection Reports ───────────────────────────────────── */}
              {(() => {
                const handleUpload = makeDocUploader(
                  'inspection-report', 'inspection-reports',
                  setInspectionDocs, setInspectionUploading, setInspectionError,
                  inspectionInputRef, loadInspectionDocs,
                );
                return (
                  <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                    <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                      <SectionHeader
                        sectionKey="docs-inspection"
                        icon="ClipboardListIcon"
                        iconColor="text-emerald-600"
                        title="Inspection Reports"
                        rightContent={
                          !collapsedSections['docs-inspection'] ? (
                            <div className="flex items-center gap-1.5">
                              <input ref={inspectionInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" id="inspection-upload" onChange={handleUpload} disabled={inspectionUploading} />
                              <label htmlFor="inspection-upload" className={`btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 min-h-[36px] ${inspectionUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {inspectionUploading ? (
                                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg><span className="hidden sm:inline">Uploading…</span></>
                                ) : (
                                  <><Icon name="UploadIcon" size={13} /><span className="hidden sm:inline">Upload</span></>
                                )}
                              </label>
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                    {!collapsedSections['docs-inspection'] && (
                      <div className="px-3 sm:px-4 pb-4 pt-2">
                        {inspectionError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                            <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-600">{inspectionError}</p>
                          </div>
                        )}
                        {inspectionLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-[hsl(215,15%,52%)]">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                            <span className="text-sm">Loading…</span>
                          </div>
                        ) : inspectionDocs.length === 0 ? (
                          <div className="border-2 border-dashed border-emerald-200 rounded-xl p-6 text-center bg-emerald-50/40">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                              <Icon name="ClipboardListIcon" size={18} className="text-emerald-500" />
                            </div>
                            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No inspection reports uploaded</p>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload property inspection reports for {property.ref}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {inspectionDocs.map((doc) => (
                              <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-emerald-400">
                                <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                  <Icon name="ClipboardListIcon" size={16} className="text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                                  <p className="text-xs text-[hsl(215,15%,52%)]">{formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDocPreview(doc)} className="p-2 rounded hover:bg-emerald-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Preview"><Icon name="EyeIcon" size={14} className="text-emerald-500" /></button>
                                  <button onClick={() => handleGenericDocDownload(doc)} className="p-2 rounded hover:bg-emerald-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Download"><Icon name="DownloadIcon" size={14} className="text-emerald-600" /></button>
                                  <button onClick={() => handleInspectionDelete(doc)} className="p-2 rounded hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete"><Icon name="TrashIcon" size={14} className="text-red-400" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Compliance Documents ─────────────────────────────────── */}
              {(() => {
                const handleUpload = makeDocUploader(
                  'compliance-doc', 'compliance-docs',
                  setComplianceDocs, setComplianceUploading, setComplianceError,
                  complianceInputRef, loadComplianceDocs,
                );
                return (
                  <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                    <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                      <SectionHeader
                        sectionKey="docs-compliance"
                        icon="ShieldCheckIcon"
                        iconColor="text-violet-600"
                        title="Compliance Documents"
                        rightContent={
                          !collapsedSections['docs-compliance'] ? (
                            <div className="flex items-center gap-1.5">
                              <input ref={complianceInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" id="compliance-upload" onChange={handleUpload} disabled={complianceUploading} />
                              <label htmlFor="compliance-upload" className={`btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 min-h-[36px] ${complianceUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {complianceUploading ? (
                                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg><span className="hidden sm:inline">Uploading…</span></>
                                ) : (
                                  <><Icon name="UploadIcon" size={13} /><span className="hidden sm:inline">Upload</span></>
                                )}
                              </label>
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                    {!collapsedSections['docs-compliance'] && (
                      <div className="px-3 sm:px-4 pb-4 pt-2">
                        {complianceError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                            <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-600">{complianceError}</p>
                          </div>
                        )}
                        {complianceLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-[hsl(215,15%,52%)]">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                            <span className="text-sm">Loading…</span>
                          </div>
                        ) : complianceDocs.length === 0 ? (
                          <div className="border-2 border-dashed border-violet-200 rounded-xl p-6 text-center bg-violet-50/40">
                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-2">
                              <Icon name="ShieldCheckIcon" size={18} className="text-violet-500" />
                            </div>
                            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No compliance documents uploaded</p>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload compliance certificates and regulatory docs for {property.ref}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {complianceDocs.map((doc) => (
                              <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-violet-400">
                                <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                                  <Icon name="ShieldCheckIcon" size={16} className="text-violet-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                                  <p className="text-xs text-[hsl(215,15%,52%)]">{formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDocPreview(doc)} className="p-2 rounded hover:bg-violet-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Preview"><Icon name="EyeIcon" size={14} className="text-violet-500" /></button>
                                  <button onClick={() => handleGenericDocDownload(doc)} className="p-2 rounded hover:bg-violet-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Download"><Icon name="DownloadIcon" size={14} className="text-violet-600" /></button>
                                  <button onClick={() => handleComplianceDelete(doc)} className="p-2 rounded hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete"><Icon name="TrashIcon" size={14} className="text-red-400" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Tenancy Forms ─────────────────────────────────────────── */}
              {(() => {
                const handleUpload = makeMediaUploader(
                  'tenancy-form', 'tenancy-forms',
                  setTenancyFormDocs, setTenancyFormUploading, setTenancyFormError,
                  tenancyFormInputRef, loadTenancyFormDocs,
                );
                const handleDelete = makeMediaDeleter(setTenancyFormDocs);
                return (
                  <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                    <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                      <SectionHeader
                        sectionKey="docs-tenancy-form"
                        icon="FileSignatureIcon"
                        iconColor="text-indigo-600"
                        title="Tenancy Forms"
                        rightContent={
                          !collapsedSections['docs-tenancy-form'] ? (
                            <div className="flex items-center gap-1.5">
                              <input ref={tenancyFormInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" id="tenancy-form-upload" onChange={handleUpload} disabled={tenancyFormUploading} />
                              <label htmlFor="tenancy-form-upload" className={`btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 min-h-[36px] ${tenancyFormUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {tenancyFormUploading ? (
                                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg><span className="hidden sm:inline">Uploading…</span></>
                                ) : (
                                  <><Icon name="UploadIcon" size={13} /><span className="hidden sm:inline">Upload</span></>
                                )}
                              </label>
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                    {!collapsedSections['docs-tenancy-form'] && (
                      <div className="px-3 sm:px-4 pb-4 pt-2">
                        {tenancyFormError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                            <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-600">{tenancyFormError}</p>
                          </div>
                        )}
                        {tenancyFormLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-[hsl(215,15%,52%)]">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                            <span className="text-sm">Loading…</span>
                          </div>
                        ) : tenancyFormDocs.length === 0 ? (
                          <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center bg-indigo-50/40">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2">
                              <Icon name="FileSignatureIcon" size={18} className="text-indigo-500" />
                            </div>
                            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No tenancy forms uploaded</p>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload tenancy forms (PDF, Word, or images) for {property.ref}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {tenancyFormDocs.map((doc) => {
                              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
                              return (
                                <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-indigo-400">
                                  <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <Icon name={isImage ? 'ImageIcon' : 'FileSignatureIcon'} size={16} className="text-indigo-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                                    <p className="text-xs text-[hsl(215,15%,52%)]">{isImage ? 'Image' : 'PDF/Doc'} · {formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDocPreview(doc)} className="p-2 rounded hover:bg-indigo-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Preview"><Icon name="EyeIcon" size={14} className="text-indigo-500" /></button>
                                    <button onClick={() => handleGenericDocDownload(doc)} className="p-2 rounded hover:bg-indigo-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Download"><Icon name="DownloadIcon" size={14} className="text-indigo-600" /></button>
                                    <button onClick={() => handleDelete(doc)} className="p-2 rounded hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete"><Icon name="TrashIcon" size={14} className="text-red-400" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Utility Bills ─────────────────────────────────────────── */}
              {(() => {
                const handleUpload = makeMediaUploader(
                  'utility-bill', 'utility-bills',
                  setUtilityBillDocs, setUtilityBillUploading, setUtilityBillError,
                  utilityBillInputRef, loadUtilityBillDocs,
                );
                const handleDelete = makeMediaDeleter(setUtilityBillDocs);
                return (
                  <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                    <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                      <SectionHeader
                        sectionKey="docs-utility-bills"
                        icon="ZapIcon"
                        iconColor="text-orange-600"
                        title="Utility Bills"
                        rightContent={
                          !collapsedSections['docs-utility-bills'] ? (
                            <div className="flex items-center gap-1.5">
                              <input ref={utilityBillInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" id="utility-bill-upload" onChange={handleUpload} disabled={utilityBillUploading} />
                              <label htmlFor="utility-bill-upload" className={`btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 min-h-[36px] ${utilityBillUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                {utilityBillUploading ? (
                                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg><span className="hidden sm:inline">Uploading…</span></>
                                ) : (
                                  <><Icon name="UploadIcon" size={13} /><span className="hidden sm:inline">Upload</span></>
                                )}
                              </label>
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                    {!collapsedSections['docs-utility-bills'] && (
                      <div className="px-3 sm:px-4 pb-4 pt-2">
                        {utilityBillError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                            <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                            <p className="text-xs text-red-600">{utilityBillError}</p>
                          </div>
                        )}
                        {utilityBillLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-[hsl(215,15%,52%)]">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                            <span className="text-sm">Loading…</span>
                          </div>
                        ) : utilityBillDocs.length === 0 ? (
                          <div className="border-2 border-dashed border-orange-200 rounded-xl p-6 text-center bg-orange-50/40">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
                              <Icon name="ZapIcon" size={18} className="text-orange-500" />
                            </div>
                            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No utility bills uploaded</p>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload electricity, water, gas bills (PDF or images) for {property.ref}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {utilityBillDocs.map((doc) => {
                              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
                              return (
                                <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-orange-400">
                                  <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                                    <Icon name={isImage ? 'ImageIcon' : 'ZapIcon'} size={16} className="text-orange-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                                    <p className="text-xs text-[hsl(215,15%,52%)]">{isImage ? 'Image' : 'PDF/Doc'} · {formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleDocPreview(doc)} className="p-2 rounded hover:bg-orange-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Preview"><Icon name="EyeIcon" size={14} className="text-orange-500" /></button>
                                    <button onClick={() => handleGenericDocDownload(doc)} className="p-2 rounded hover:bg-orange-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Download"><Icon name="DownloadIcon" size={14} className="text-orange-600" /></button>
                                    <button onClick={() => handleDelete(doc)} className="p-2 rounded hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center" title="Delete"><Icon name="TrashIcon" size={14} className="text-red-400" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Government Valuation (R&V) */}
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="docs-govval"
                    icon="FileTextIcon"
                    iconColor="text-amber-600"
                    title="Government Valuation (R&V)"
                    rightContent={
                      !collapsedSections['docs-govval'] ? (
                        <div className="flex items-center gap-1.5">
                          <span className="badge bg-amber-50 text-amber-700 border border-amber-200 text-[10px] hidden sm:inline-flex">Rating &amp; Valuation Dept.</span>
                          <input
                            ref={govValInputRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            id="gov-val-upload"
                            onChange={handleGovValUpload}
                            disabled={govValUploading}
                          />
                          <label
                            htmlFor="gov-val-upload"
                            className={`btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1.5 min-h-[36px] ${govValUploading ? 'opacity-60 pointer-events-none' : ''}`}
                          >
                            {govValUploading ? (
                              <>
                                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                <span className="hidden sm:inline">Uploading…</span>
                              </>
                            ) : (
                              <>
                                <Icon name="UploadIcon" size={13} />
                                <span className="hidden sm:inline">Upload R&amp;V PDF</span>
                                <span className="sm:hidden">Upload</span>
                              </>
                            )}
                          </label>
                        </div>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['docs-govval'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <Icon name="InfoIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          Upload the Rating &amp; Valuation Department assessment PDF for this property. Accepted format: PDF only (max 50 MB). Documents are stored securely and accessible to authorised team members.
                        </p>
                      </div>
                    </div>

                    {govValError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-center gap-2">
                        <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-600">{govValError}</p>
                      </div>
                    )}

                    {govValLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-[hsl(215,15%,52%)]">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span className="text-sm">Loading R&amp;V documents…</span>
                      </div>
                    ) : govValDocs.length === 0 ? (
                      <div className="border-2 border-dashed border-amber-200 rounded-xl p-6 text-center bg-amber-50/40">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                          <Icon name="FileTextIcon" size={18} className="text-amber-500" />
                        </div>
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No R&amp;V documents uploaded</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload the government valuation PDF for {property.ref}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {govValDocs.map((doc) => (
                          <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-amber-400">
                            <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                              <Icon name="FileTextIcon" size={16} className="text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)]">
                                PDF · {formatFileSize(doc.file_size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleGovValDownload(doc)}
                                className="p-2 rounded hover:bg-amber-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="Download"
                              >
                                <Icon name="DownloadIcon" size={14} className="text-amber-600" />
                              </button>
                              <button
                                onClick={() => handleGovValDelete(doc)}
                                className="p-2 rounded hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="Delete"
                              >
                                <Icon name="TrashIcon" size={14} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRANSACTIONS TAB */}
          {activeTab === 'transactions' && (
            <div className="space-y-3 sm:space-y-4">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                {(['Sale', 'Lease', 'Lease Renewal', 'Lease Ended'] as const).map((type) => {
                  const count = derivedTransactions.filter((t) => t.type === type).length;
                  if (count === 0) return null;
                  const colors = txnTypeColor(type);
                  return (
                    <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${colors.bg} ${colors.icon} border-current`}>
                      <Icon name={type === 'Sale' ? 'TagIcon' : 'KeyIcon'} size={11} />
                      {count} {type}
                    </span>
                  );
                })}
                {derivedTransactions.length === 0 && (
                  <span className="text-xs text-[hsl(215,15%,52%)]">No transactions recorded for this property</span>
                )}
              </div>

              {/* Transaction History list */}
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="txn-history"
                    icon="ArrowLeftRightIcon"
                    title="Sale & Lease History"
                    rightContent={
                      !collapsedSections['txn-history'] ? (
                        <span className="text-xs text-[hsl(215,15%,52%)] bg-[hsl(210,20%,97%)] px-2 py-1 rounded-md border border-[hsl(214,20%,88%)]">
                          {derivedTransactions.length} record{derivedTransactions.length !== 1 ? 's' : ''}
                        </span>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['txn-history'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2">
                    {derivedTransactions.length === 0 ? (
                      <div className="text-center py-10">
                        <Icon name="ArrowLeftRightIcon" size={28} className="text-[hsl(215,15%,62%)] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No transactions recorded</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">Sale and lease transactions will appear here once recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {derivedTransactions.map((txn) => {
                          const colors = txnTypeColor(txn.type);
                          const isSale = txn.type === 'Sale';
                          return (
                            <div key={txn.id} className={`rounded-xl border border-[hsl(214,20%,88%)] border-l-4 ${colors.border} bg-white overflow-hidden`}>
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-3 px-3 sm:px-4 pt-3 pb-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                                    <Icon name={isSale ? 'TagIcon' : 'KeyIcon'} size={14} className={colors.icon} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">{txn.type}</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${txnStatusColor(txn.status)}`}>
                                        {txn.status}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                                      Agent: <span className="font-medium text-[hsl(215,25%,30%)]">{txn.agent}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-bold font-mono tabular-nums text-[hsl(215,25%,18%)]">{txn.amountLabel}</p>
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono mt-0.5">{formatTxnDate(txn.date)}</p>
                                </div>
                              </div>

                              {/* Details grid */}
                              <div className="px-3 sm:px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-[hsl(214,20%,92%)] pt-2.5">
                                {/* Date */}
                                <div className="bg-[hsl(210,20%,98%)] rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5 uppercase tracking-wide">
                                    {isSale ? 'Sale Date' : 'Lease Start'}
                                  </p>
                                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{formatTxnDate(txn.date)}</p>
                                </div>

                                {/* End date (lease only) */}
                                {!isSale && (
                                  <div className="bg-[hsl(210,20%,98%)] rounded-lg px-2.5 py-2">
                                    <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5 uppercase tracking-wide">Lease End</p>
                                    <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{formatTxnDate(txn.endDate)}</p>
                                  </div>
                                )}

                                {/* Amount */}
                                <div className="bg-[hsl(210,20%,98%)] rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5 uppercase tracking-wide">
                                    {isSale ? 'Sale Price' : 'Monthly Rent'}
                                  </p>
                                  <p className="text-xs font-bold font-mono tabular-nums text-[hsl(215,25%,18%)]">{txn.amountLabel}</p>
                                </div>

                                {/* Seller / Landlord */}
                                <div className="bg-[hsl(210,20%,98%)] rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5 uppercase tracking-wide">
                                    {isSale ? 'Seller' : 'Landlord'}
                                  </p>
                                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">
                                    {isSale ? (txn.seller ?? '—') : (txn.landlord ?? '—')}
                                  </p>
                                </div>

                                {/* Buyer / Tenant */}
                                <div className="bg-[hsl(210,20%,98%)] rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5 uppercase tracking-wide">
                                    {isSale ? 'Buyer' : 'Tenant'}
                                  </p>
                                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">
                                    {isSale ? (txn.buyer ?? '—') : (txn.tenant ?? '—')}
                                  </p>
                                </div>

                                {/* Status */}
                                <div className="bg-[hsl(210,20%,98%)] rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5 uppercase tracking-wide">Status</p>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${txnStatusColor(txn.status)}`}>
                                    {txn.status}
                                  </span>
                                </div>
                              </div>

                              {/* Notes */}
                              {txn.notes && (
                                <div className="px-3 sm:px-4 pb-3">
                                  <p className="text-[11px] text-[hsl(215,15%,45%)] bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 border border-[hsl(214,20%,90%)]">
                                    <span className="font-medium text-[hsl(215,15%,38%)]">Notes: </span>{txn.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invoice / Receipt generator for sale transactions */}
              {(property.status === 4 || property.salePrice) && (
                <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                  <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                    <SectionHeader sectionKey="sale-invoice" icon="FileTextIcon" iconColor="text-violet-600" title="Sale Invoice / Receipt" />
                  </div>
                  {!collapsedSections['sale-invoice'] && (
                    <div className="px-3 sm:px-4 pb-4 pt-2">
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-violet-800">Generate Sale Invoice or Receipt</p>
                          <p className="text-xs text-violet-600 mt-0.5">
                            Includes commission, stamp duty, and additional rechargeable items. Payable to Homes R Us Limited.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowSaleInvoice(true)}
                          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#1B4F8A] text-white rounded-xl text-sm font-semibold hover:bg-[#163d6e] transition-colors shadow-md"
                        >
                          <Icon name="FileTextIcon" size={14} />
                          Generate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* HK FORMS TAB */}
          {activeTab === 'hk-forms' && (
            <div className="space-y-3 sm:space-y-4">
              {/* Legal Info Banner */}
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader sectionKey="hkforms-info" icon="InfoIcon" iconColor="text-blue-600" title="HK Legal Form Requirements" />
                </div>
                {!collapsedSections['hkforms-info'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <Icon name="InfoIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800">HK Legal Form Requirements</p>
                          <p className="text-xs text-blue-600 mt-0.5">
                            Under the Landlord and Tenant (Consolidation) Ordinance (Cap. 7), Form CR109 must be submitted to the Commissioner of Rating and Valuation within 30 days of tenancy execution.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Estate Agency Agreement Forms */}
              {(property.status === 0 || property.status === 1 || property.status === 4) && (
                <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                  <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                    <SectionHeader sectionKey="hkforms-agency" icon="FileSignatureIcon" title="Estate Agency Agreements" />
                  </div>
                  {!collapsedSections['hkforms-agency'] && (
                    <div className="px-3 sm:px-4 pb-4 pt-2 space-y-3">
                      {/* Form 3 — For Sale */}
                      {(property.status === 4) && (
                        <div className="card p-3 sm:p-4 border-l-4 border-l-violet-500">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-50">
                                <Icon name="FileTextIcon" size={18} className="text-violet-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Form 3</p>
                                  <span className="badge bg-violet-50 text-violet-700 border border-violet-200">For Sale</span>
                                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">Auto-populated</span>
                                </div>
                                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Estate Agency Agreement for Sale of Residential Properties</p>
                                <p className="text-xs text-[hsl(215,15%,52%)]">Authority: Estate Agents Authority (EAA) · Cap. 511</p>
                              </div>
                            </div>
                            <button onClick={handleDownloadForm3} className="btn-primary py-2 px-4 text-xs min-h-[40px] self-start sm:self-auto flex-shrink-0">
                              <Icon name="DownloadIcon" size={13} />
                              Download Form 3
                            </button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-[hsl(214,20%,88%)]">
                            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">Auto-populated fields:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { field: 'Vendor', value: property.landlord.name },
                                { field: 'Property', value: `${property.unit}, ${property.building}` },
                                { field: 'List Price', value: salePrice ? `HK$${Number(salePrice).toLocaleString()}` : property.salePrice ? `HK$${property.salePrice.toLocaleString()}` : '—' },
                                { field: 'Agency Type', value: 'Non-exclusive' },
                                { field: 'Vendor HKID', value: property.landlord.idNumber },
                                { field: 'Vendor Phone', value: property.landlord.phone },
                                { field: 'Agent', value: agentProfiles[0].name },
                                { field: 'Licence No.', value: agentProfiles[0].licenceNumber },
                              ].map((f) => (
                                <div key={`f3-${f.field}`} className="bg-[hsl(210,20%,97%)] rounded px-2.5 py-1.5">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.field}</p>
                                  <p className="text-xs font-medium text-[hsl(215,25%,18%)] truncate">{f.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Form 5 — For Rent */}
                      {(property.status === 0 || property.status === 1) && (
                        <div className="card p-3 sm:p-4 border-l-4 border-l-emerald-500">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50">
                                <Icon name="FileTextIcon" size={18} className="text-emerald-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Form 5</p>
                                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">For Rent</span>
                                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">Auto-populated</span>
                                </div>
                                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Estate Agency Agreement for Leasing of Residential Properties</p>
                                <p className="text-xs text-[hsl(215,15%,52%)]">Authority: Estate Agents Authority (EAA) · Cap. 511</p>
                              </div>
                            </div>
                            <button onClick={handleDownloadForm5} className="btn-primary py-2 px-4 text-xs min-h-[40px] self-start sm:self-auto flex-shrink-0">
                              <Icon name="DownloadIcon" size={13} />
                              Download Form 5
                            </button>
                          </div>
                          <div className="mt-3 pt-3 border-t border-[hsl(214,20%,88%)]">
                            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">Auto-populated fields:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { field: 'Landlord', value: property.landlord.name },
                                { field: 'Property', value: `${property.unit}, ${property.building}` },
                                { field: 'List Rental', value: rentalPrice ? `HK$${Number(rentalPrice).toLocaleString()}/mo` : property.monthlyRent ? `HK$${property.monthlyRent.toLocaleString()}/mo` : '—' },
                                { field: 'Agency Type', value: 'Non-exclusive' },
                                { field: 'Landlord HKID', value: property.landlord.idNumber },
                                { field: 'Landlord Phone', value: property.landlord.phone },
                                { field: 'Agent', value: agentProfiles[0].name },
                                { field: 'Licence No.', value: agentProfiles[0].licenceNumber },
                              ].map((f) => (
                                <div key={`f5-${f.field}`} className="bg-[hsl(210,20%,97%)] rounded px-2.5 py-1.5">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.field}</p>
                                  <p className="text-xs font-medium text-[hsl(215,25%,18%)] truncate">{f.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Available Forms */}
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader sectionKey="hkforms-available" icon="FileCheckIcon" title="Available Forms" />
                </div>
                {!collapsedSections['hkforms-available'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2 space-y-3">
                    {[
                      {
                        id: 'form-cr109',
                        name: 'Form CR109',
                        fullName: 'Notice of New Letting or Renewal Agreement',
                        authority: 'Rating and Valuation Department',
                        deadline: '30 days from tenancy execution',
                        filed: property.tenant?.cr109Filed ?? false,
                        filedDate: '12/06/2024',
                        required: !!property.tenant,
                      },
                      {
                        id: 'form-spa',
                        name: 'Provisional S&P Agreement',
                        fullName: 'Provisional Sale and Purchase Agreement',
                        authority: 'Inland Revenue Department (Stamp Duty)',
                        deadline: '30 days for stamp duty',
                        filed: property.status === 4,
                        filedDate: null,
                        required: property.status === 4,
                      },
                    ].map((form) => (
                      <div key={form.id} className={`card p-3 sm:p-4 ${!form.required ? 'opacity-60' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${form.filed ? 'bg-emerald-50' : form.required ? 'bg-amber-50' : 'bg-gray-50'}`}>
                              <Icon
                                name={form.filed ? 'FileCheckIcon' : 'FileTextIcon'}
                                size={18}
                                className={form.filed ? 'text-emerald-600' : form.required ? 'text-amber-600' : 'text-gray-400'}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-[hsl(215,25%,18%)]">{form.name}</p>
                                {form.filed ? (
                                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">Filed {form.filedDate}</span>
                                ) : form.required ? (
                                  <span className="badge bg-amber-50 text-amber-700 border border-amber-200">Pending</span>
                                ) : (
                                  <span className="badge bg-gray-100 text-gray-500 border border-gray-200">Not Required</span>
                                )}
                              </div>
                              <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{form.fullName}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)]">Authority: {form.authority}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)]">Deadline: {form.deadline}</p>
                            </div>
                          </div>
                          {form.required && (
                            <div className="flex items-center gap-2 flex-shrink-0 self-start">
                              <button
                                onClick={() => handleGenerateForm(form.name)}
                                disabled={generatingForm === form.name}
                                className="btn-primary py-2 px-3 text-xs min-h-[40px]"
                              >
                                {generatingForm === form.name ? (
                                  <>
                                    <Icon name="Loader2Icon" size={13} className="animate-spin" />
                                    <span className="hidden sm:inline">Generating…</span>
                                  </>
                                ) : (
                                  <>
                                    <Icon name="ZapIcon" size={13} />
                                    <span className="hidden sm:inline">Auto-Generate</span>
                                    <span className="sm:hidden">Generate</span>
                                  </>
                                )}
                              </button>
                              {form.filed && (
                                <button className="btn-secondary py-2 px-3 text-xs min-h-[40px]">
                                  <Icon name="DownloadIcon" size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {form.required && property.tenant && (
                          <div className="mt-3 pt-3 border-t border-[hsl(214,20%,88%)]">
                            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">Auto-populated fields:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { field: 'Landlord', value: property.landlord.name },
                                { field: 'Tenant', value: property.tenant.name },
                                { field: 'Premises', value: `${property.unit}, ${property.building}, ${property.street}` },
                                { field: 'Monthly Rent', value: `HK$${property.monthlyRent?.toLocaleString()}` },
                                { field: 'Lease Start', value: property.tenant.leaseStart },
                                { field: 'Lease End', value: property.tenant.leaseEnd },
                                { field: 'Deposit', value: `HK$${property.tenant.deposit.toLocaleString()}` },
                                { field: 'Landlord HKID', value: property.landlord.idNumber },
                              ].map((f) => (
                                <div key={`field-${f.field}`} className="bg-[hsl(210,20%,97%)] rounded px-2.5 py-1.5">
                                  <p className="text-[10px] text-[hsl(215,15%,52%)]">{f.field}</p>
                                  <p className="text-xs font-medium text-[hsl(215,25%,18%)] truncate">{f.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Company Tenancy Agreement Upload */}
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="hkforms-tenancy-upload"
                    icon="FileSignatureIcon"
                    iconColor="text-indigo-600"
                    title="Company Tenancy Agreement"
                    rightContent={
                      !collapsedSections['hkforms-tenancy-upload'] ? (
                        <div className="flex items-center gap-1.5">
                          <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] hidden sm:inline-flex">Company Template</span>
                          <input
                            ref={tenancyAgreementInputRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={handleTenancyAgreementUpload}
                          />
                          <button
                            onClick={() => tenancyAgreementInputRef.current?.click()}
                            disabled={tenancyAgreementUploading}
                            className="btn-primary py-1.5 px-3 text-xs min-h-[32px]"
                          >
                            {tenancyAgreementUploading ? (
                              <>
                                <Icon name="Loader2Icon" size={12} className="animate-spin" />
                                <span className="hidden sm:inline">Uploading…</span>
                              </>
                            ) : (
                              <>
                                <Icon name="UploadIcon" size={12} />
                                <span className="hidden sm:inline">Upload PDF</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['hkforms-tenancy-upload'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2">
                    {tenancyAgreementError && (
                      <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-700">{tenancyAgreementError}</p>
                      </div>
                    )}
                    {tenancyAgreementLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2">
                        <Icon name="Loader2Icon" size={18} className="animate-spin text-[hsl(215,15%,52%)]" />
                        <span className="text-sm text-[hsl(215,15%,52%)]">Loading…</span>
                      </div>
                    ) : tenancyAgreementDocs.length === 0 ? (
                      <div
                        className="border-2 border-dashed border-indigo-200 rounded-xl p-8 text-center bg-indigo-50/40 cursor-pointer hover:bg-indigo-50/70 transition-colors"
                        onClick={() => tenancyAgreementInputRef.current?.click()}
                      >
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                          <Icon name="UploadIcon" size={22} className="text-indigo-500" />
                        </div>
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Upload Company Tenancy Agreement</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Click to upload your company&apos;s tenancy agreement PDF for {property.ref}</p>
                        <p className="text-xs text-[hsl(215,15%,62%)] mt-1">PDF only · Max 50 MB</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tenancyAgreementDocs.map((doc) => (
                          <div key={doc.id} className="card p-3 sm:p-4 flex items-center gap-3 hover:shadow-card-hover transition-shadow border-l-4 border-l-indigo-400">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              <Icon name="FileTextIcon" size={16} className="text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{doc.file_name}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)]">
                                {formatFileSize(doc.file_size_bytes)} · Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleTenancyAgreementDownload(doc)}
                                className="btn-secondary py-1.5 px-2.5 text-xs min-h-[32px]"
                                title="Download"
                              >
                                <Icon name="DownloadIcon" size={13} />
                              </button>
                              <button
                                onClick={() => handleTenancyAgreementDelete(doc)}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Icon name="Trash2Icon" size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div
                          className="border-2 border-dashed border-indigo-200 rounded-xl p-4 text-center bg-indigo-50/30 cursor-pointer hover:bg-indigo-50/60 transition-colors mt-2"
                          onClick={() => tenancyAgreementInputRef.current?.click()}
                        >
                          <p className="text-xs text-indigo-600 font-medium flex items-center justify-center gap-1.5">
                            <Icon name="UploadIcon" size={13} />
                            Upload another version
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-3 sm:space-y-4">
              <div className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-3 sm:px-4 pt-3 pb-3 bg-[hsl(210,20%,98%)]">
                  <SectionHeader
                    sectionKey="history-log"
                    icon="ClockIcon"
                    title="Change Log & History"
                    rightContent={
                      !collapsedSections['history-log'] ? (
                        <span className="text-xs text-[hsl(215,15%,52%)] bg-[hsl(210,20%,97%)] px-2 py-1 rounded-md">
                          {historyLog.length} entries
                        </span>
                      ) : undefined
                    }
                  />
                </div>
                {!collapsedSections['history-log'] && (
                  <div className="px-3 sm:px-4 pb-4 pt-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2 mb-4">
                      <Icon name="InfoIcon" size={14} className="text-blue-600 flex-shrink-0" />
                      <p className="text-xs text-blue-700">All property detail changes, comments, and commission assignments are automatically logged here.</p>
                    </div>
                    {historyLog.length === 0 ? (
                      <div className="text-center py-10">
                        <Icon name="ClockIcon" size={28} className="text-[hsl(215,15%,62%)] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No history yet</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">Changes to this property will be logged here automatically</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-[hsl(214,20%,88%)]" />
                        <div className="space-y-3 pl-10">
                          {historyLog.map((item) => (
                            <div key={item.id} className="relative">
                              <div className={`absolute -left-6 w-3 h-3 rounded-full border-2 border-white shadow-sm ${item.field ? 'bg-violet-500' : 'bg-[#1B4F8A]'}`} />
                              <div className="card p-3 sm:p-3.5">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <p className="text-xs font-semibold text-[#1B4F8A] truncate">{item.agent}</p>
                                    {item.field && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 font-medium flex-shrink-0">
                                        Field change
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-mono text-[hsl(215,15%,52%)] flex-shrink-0">{item.date}</p>
                                </div>
                                <p className="text-sm text-[hsl(215,25%,18%)]">{item.action}</p>
                                {item.field && item.oldValue && item.newValue && (
                                  <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">{item.oldValue}</span>
                                    <Icon name="ArrowRightIcon" size={12} className="text-[hsl(215,15%,52%)]" />
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">{item.newValue}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sale Invoice Generator Modal */}
        {showSaleInvoice && (
          <InvoiceGenerator
            invoiceType="sale"
            ownerName={property.landlord.name}
            counterpartyName={property.tenant?.name ?? ''}
            propertyAddress={`${property.unit}, ${property.building}, ${property.street}, ${property.district}`}
            salePrice={property.salePrice ? String(property.salePrice) : ''}
            onClose={() => setShowSaleInvoice(false)}
          />
        )}

        {/* Document Preview Modal */}
        {previewUrl && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setPreviewUrl(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)] flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="EyeIcon" size={15} className="text-[#1B4F8A] flex-shrink-0" />
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{previewFileName}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                    <Icon name="ExternalLinkIcon" size={12} />
                    Open in new tab
                  </a>
                  <button onClick={() => setPreviewUrl(null)} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                    <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-[hsl(210,20%,96%)]">
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(previewFileName) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={previewFileName}
                    className="w-full h-full object-contain max-h-[75vh]"
                  />
                ) : (
                  <iframe
                    src={previewUrl}
                    title={previewFileName}
                    className="w-full h-full min-h-[60vh]"
                    style={{ border: 'none' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(215,15%,52%)] hidden sm:inline">Property ID:</span>
            <span className="text-xs font-mono font-semibold text-[hsl(215,25%,18%)]">{property.id.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost py-2 px-3 text-xs min-h-[40px] hidden sm:flex">
              <Icon name="PrinterIcon" size={13} />
              Print Details
            </button>
            <button onClick={onClose} className="btn-secondary py-2 px-4 text-xs min-h-[40px]">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}