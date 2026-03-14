'use client';

import { useEffect, useState } from 'react';
import {
  DASHBOARD_PREF_EVENT,
  DASHBOARD_SHOW_COMPLETED_KEY,
  DASHBOARD_THEME_KEY,
  parseShowCompleted,
  parseThemePreference,
  type DashboardThemePreference,
} from '@/app/components/dashboard-preferences';

function applyTheme(theme: DashboardThemePreference): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = prefersDark ? 'dark' : 'light';
    return;
  }
  root.dataset.theme = theme;
}

export function DashboardPreferences(): React.ReactElement {
  const [theme, setTheme] = useState<DashboardThemePreference>('system');
  const [showCompleted, setShowCompleted] = useState(true);

  useEffect(() => {
    const storedTheme = parseThemePreference(localStorage.getItem(DASHBOARD_THEME_KEY));
    const storedShowCompleted = parseShowCompleted(localStorage.getItem(DASHBOARD_SHOW_COMPLETED_KEY));
    setTheme(storedTheme);
    setShowCompleted(storedShowCompleted);
    applyTheme(storedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_THEME_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent(DASHBOARD_PREF_EVENT, { detail: { theme } }));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_SHOW_COMPLETED_KEY, String(showCompleted));
    window.dispatchEvent(new CustomEvent(DASHBOARD_PREF_EVENT, { detail: { showCompleted } }));
  }, [showCompleted]);

  return (
    <section className="card" aria-label="Display preferences">
      <h3>Display Preferences</h3>
      <div className="pref-grid">
        <label>
          Theme
          <select value={theme} onChange={(event) => setTheme(parseThemePreference(event.target.value))}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="pref-checkbox">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          <span>Show completed tasks</span>
        </label>
      </div>
    </section>
  );
}
