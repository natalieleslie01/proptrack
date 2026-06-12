'use client';

import React from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';

type IconVariant = 'outline' | 'solid';

interface IconProps {
    name: string;
    variant?: IconVariant;
    size?: number;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: any;
}

/**
 * Maps Lucide React icon names (and other common aliases) to HeroIcons v2 names.
 * Add entries here whenever a new alias is needed.
 */
const ICON_ALIAS_MAP: Record<string, string> = {
    // Close / X
    XIcon: 'XMarkIcon',
    CloseIcon: 'XMarkIcon',

    // Loader / Spinner
    LoaderIcon: 'ArrowPathIcon',
    SpinnerIcon: 'ArrowPathIcon',
    RefreshCwIcon: 'ArrowPathIcon',
    RefreshIcon: 'ArrowPathIcon',

    // Alerts / Status
    AlertTriangleIcon: 'ExclamationTriangleIcon',
    AlertCircleIcon: 'ExclamationCircleIcon',
    AlertIcon: 'ExclamationCircleIcon',
    InfoIcon: 'InformationCircleIcon',
    HelpCircleIcon: 'QuestionMarkCircleIcon',

    // Trending
    TrendingUpIcon: 'ArrowTrendingUpIcon',
    TrendingDownIcon: 'ArrowTrendingDownIcon',

    // User actions
    UserXIcon: 'UserMinusIcon',
    UserCheckIcon: 'UserPlusIcon',
    UserPlusIcon: 'UserPlusIcon',

    // Edit / Pencil
    PencilIcon: 'PencilIcon',
    EditIcon: 'PencilSquareIcon',

    // Save / Download / Upload
    SaveIcon: 'BookmarkIcon',
    DownloadIcon: 'ArrowDownTrayIcon',
    UploadIcon: 'ArrowUpTrayIcon',
    UploadCloudIcon: 'CloudArrowUpIcon',

    // Database
    DatabaseIcon: 'CircleStackIcon',

    // Search
    SearchIcon: 'MagnifyingGlassIcon',

    // Send / Mail
    SendIcon: 'PaperAirplaneIcon',
    MailIcon: 'EnvelopeIcon',

    // Shield (no exact match — use ShieldCheckIcon as closest)
    ShieldIcon: 'ShieldCheckIcon',

    // Building
    BuildingIcon: 'BuildingOffice2Icon',

    // Briefcase
    BriefcaseIcon: 'BriefcaseIcon',

    // Scale / Balance
    ScaleIcon: 'ScaleIcon',

    // Banknote / Money
    BanknoteIcon: 'BanknotesIcon',

    // List
    ListIcon: 'ListBulletIcon',

    // External link
    ExternalLinkIcon: 'ArrowTopRightOnSquareIcon',

    // Zap / Lightning
    ZapIcon: 'BoltIcon',

    // File icons
    FileTextIcon: 'DocumentTextIcon',
    FileSearchIcon: 'DocumentMagnifyingGlassIcon',

    // Image
    ImageIcon: 'PhotoIcon',

    // Tag
    TagIcon: 'TagIcon',

    // Phone
    PhoneCallIcon: 'PhoneArrowUpRightIcon',

    // Check square
    CheckSquareIcon: 'CheckBadgeIcon',

    // Chevrons up-down (sort)
    ChevronsUpDownIcon: 'ChevronUpDownIcon',

    // Trash
    Trash2Icon: 'TrashIcon',
    TrashIcon: 'TrashIcon',

    // Map pin
    MapPinIcon: 'MapPinIcon',

    // Printer
    PrinterIcon: 'PrinterIcon',

    // Play
    PlayIcon: 'PlayIcon',

    // Minus
    MinusIcon: 'MinusIcon',

    // Eye
    EyeOffIcon: 'EyeSlashIcon',

    // Arrow right/left
    ArrowRightIcon: 'ArrowRightIcon',
    ArrowLeftIcon: 'ArrowLeftIcon',

    // Folder
    FolderOpenIcon: 'FolderOpenIcon',

    // Bell
    BellIcon: 'BellIcon',

    // Calendar
    CalendarIcon: 'CalendarDaysIcon',
};

function Icon({
    name,
    variant = 'outline',
    size = 24,
    className = '',
    onClick,
    disabled = false,
    ...props
}: IconProps) {
    const iconSet = variant === 'solid' ? HeroIconsSolid : HeroIcons;

    // Resolve alias first, then look up in icon set
    const resolvedName = ICON_ALIAS_MAP[name] ?? name;
    const IconComponent = iconSet[resolvedName as keyof typeof iconSet] as React.ComponentType<any>;

    if (!IconComponent) {
        // Last-resort fallback: render a neutral dash so nothing shows as "?"
        const FallbackIcon = HeroIcons['MinusCircleIcon'] as React.ComponentType<any>;
        return (
            <FallbackIcon
                width={size}
                height={size}
                className={`text-gray-300 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
                onClick={disabled ? undefined : onClick}
                {...props}
            />
        );
    }

    return (
        <IconComponent
            width={size}
            height={size}
            className={`${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
            onClick={disabled ? undefined : onClick}
            {...props}
        />
    );
}

export default Icon;