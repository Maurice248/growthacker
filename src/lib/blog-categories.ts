export interface BlogCategory {
  id: number;
  category: string;
  /** Service name shown in the Create Post tag. */
  service: string;
  /** @deprecated Use `service`. Kept for backward-compatible webhook payloads. */
  type: string;
  seed_keyword: string;
  keywords: string[];
}

/** Default blog service categories for new companies. */
export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    id: 1,
    service: 'Tenant Screening',
    category: 'Tenant Screening: Find Reliable Tenants with Confidence',
    type: 'Tenant Screening',
    seed_keyword: 'tenant screening',
    keywords: [
      'tenant screening',
      'how to screen a tenant',
      'tenant background check Toronto',
      'screen tenants Toronto',
      'tenant check Toronto',
      'background check for renters',
      'how to find a good tenant',
      'rental screening Toronto',
    ],
  },
  {
    id: 2,
    service: 'AI Document Analysis',
    category: 'AI Document Analysis: Automatically Verify Tenant Documents',
    type: 'AI Document Analysis',
    seed_keyword: 'tenant document verification',
    keywords: [
      'verify tenant documents',
      'fake rental application',
      'how to spot fake pay stubs',
      'tenant document check',
      'rental application fraud',
      'how to verify tenant income',
      'fake ID rental application',
      'verify proof of income tenant',
    ],
  },
  {
    id: 3,
    service: 'Rent Collection',
    category: 'Rent Collection: Automate Payments and Never Miss a Payment',
    type: 'Rent Collection',
    seed_keyword: 'rent collection',
    keywords: [
      'online rent collection',
      'collect rent online Toronto',
      'rent payment app',
      'tenant not paying rent',
      'how to collect rent online',
      'late rent payment',
      'rent payment reminder',
      'easiest way to collect rent',
    ],
  },
  {
    id: 4,
    service: 'Lease Management',
    category: 'Lease Management: Create, Send and Track Leases Digitally',
    type: 'Lease Management',
    seed_keyword: 'rental lease agreement',
    keywords: [
      'rental lease agreement Toronto',
      'lease agreement Ontario',
      'online lease signing',
      'digital lease agreement',
      'standard lease Ontario',
      'lease renewal Ontario',
      'rental contract Toronto',
      'how to write a lease agreement',
    ],
  },
  {
    id: 5,
    service: 'Maintenance Management',
    category: 'Maintenance Management: Track Every Repair from Start to Finish',
    type: 'Maintenance Management',
    seed_keyword: 'rental property maintenance',
    keywords: [
      'rental property maintenance Toronto',
      'tenant maintenance request',
      'landlord repair responsibilities',
      'property repairs Toronto',
      'tenant submitted repair request',
      'how to handle tenant repairs',
      'landlord fix it Toronto',
      'rental unit repairs Ontario',
    ],
  },
  {
    id: 6,
    service: 'Property Management',
    category: 'Property Management: Track Occupancy, Expenses and Performance',
    type: 'Property Management',
    seed_keyword: 'property management Toronto',
    keywords: [
      'property management Toronto',
      'landlord software Toronto',
      'manage rental property Toronto',
      'rental property management app',
      'small landlord Toronto',
      'track rental income',
      'landlord tools Ontario',
      'best app for landlords',
    ],
  },
  {
    id: 7,
    service: 'In-App Messaging',
    category: 'In-App Messaging: Communicate Directly with Tenants and Applicants',
    type: 'In-App Messaging',
    seed_keyword: 'landlord tenant communication',
    keywords: [
      'landlord tenant communication',
      'message tenant online',
      'talk to landlord app',
      'landlord tenant chat',
      'best way to communicate with tenants',
      'tenant messaging app',
      'landlord communication tools',
      'contact tenant online',
    ],
  },
  {
    id: 8,
    service: 'Automated Notifications',
    category: 'Automated Notifications: Real-Time Alerts for Applications and Payments',
    type: 'Automated Notifications',
    seed_keyword: 'landlord alerts',
    keywords: [
      'landlord alerts',
      'rent due reminder',
      'tenant payment notification',
      'rent overdue notice',
      'how to remind tenant to pay rent',
      'landlord reminder app',
      'late rent notice',
      'rent alert app',
    ],
  },
];

export function getBlogCategoryById(
  id: number,
  categories: BlogCategory[] = BLOG_CATEGORIES
): BlogCategory | undefined {
  return categories.find((item) => item.id === id);
}
