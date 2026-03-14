export type DashboardThemePreference = 'system' | 'light' | 'dark';

export const DASHBOARD_THEME_KEY = 'openspec-dashboard-theme';
export const DASHBOARD_SHOW_COMPLETED_KEY = 'openspec-dashboard-show-completed';
export const DASHBOARD_PREF_EVENT = 'openspec-dashboard-preferences';

export function parseThemePreference(value: string | null): DashboardThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

export function parseShowCompleted(value: string | null): boolean {
  return value !== 'false';
}
