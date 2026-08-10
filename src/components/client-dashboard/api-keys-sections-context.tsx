'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ApiKeysSectionId =
  | 'meta'
  | 'wordpress'
  | 'dataforseo'
  | 'apify'
  | 'aiGateways'
  | 'aiRouting'
  | 'apiTokens';

const SECTION_IDS: ApiKeysSectionId[] = [
  'meta',
  'wordpress',
  'dataforseo',
  'apify',
  'aiGateways',
  'aiRouting',
  'apiTokens',
];

const DEFAULT_EXPANDED_SECTIONS: Record<ApiKeysSectionId, boolean> = {
  meta: true,
  wordpress: false,
  dataforseo: false,
  apify: false,
  aiGateways: false,
  aiRouting: false,
  apiTokens: false,
};

const ALL_EXPANDED: Record<ApiKeysSectionId, boolean> = {
  meta: true,
  wordpress: true,
  dataforseo: true,
  apify: true,
  aiGateways: true,
  aiRouting: true,
  apiTokens: true,
};

const ALL_COLLAPSED: Record<ApiKeysSectionId, boolean> = {
  meta: false,
  wordpress: false,
  dataforseo: false,
  apify: false,
  aiGateways: false,
  aiRouting: false,
  apiTokens: false,
};

type ApiKeysSectionsContextValue = {
  sectionsExpanded: Record<ApiKeysSectionId, boolean>;
  toggleSection: (section: ApiKeysSectionId) => void;
  allExpanded: boolean;
  toggleAll: () => void;
};

const ApiKeysSectionsContext = createContext<ApiKeysSectionsContextValue | null>(null);

export function ApiKeysSectionsProvider({ children }: { children: ReactNode }) {
  const [sectionsExpanded, setSectionsExpanded] = useState(DEFAULT_EXPANDED_SECTIONS);

  const toggleSection = useCallback((section: ApiKeysSectionId) => {
    setSectionsExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const allExpanded = useMemo(
    () => SECTION_IDS.every((id) => sectionsExpanded[id]),
    [sectionsExpanded]
  );

  const toggleAll = useCallback(() => {
    setSectionsExpanded((prev) =>
      SECTION_IDS.every((id) => prev[id]) ? { ...ALL_COLLAPSED } : { ...ALL_EXPANDED }
    );
  }, []);

  const value = useMemo(
    () => ({ sectionsExpanded, toggleSection, allExpanded, toggleAll }),
    [sectionsExpanded, toggleSection, allExpanded, toggleAll]
  );

  return (
    <ApiKeysSectionsContext.Provider value={value}>{children}</ApiKeysSectionsContext.Provider>
  );
}

export function useApiKeysSections() {
  const ctx = useContext(ApiKeysSectionsContext);
  if (!ctx) {
    throw new Error('useApiKeysSections must be used within ApiKeysSectionsProvider');
  }
  return ctx;
}

export function useApiKeysSectionsOptional() {
  return useContext(ApiKeysSectionsContext);
}
