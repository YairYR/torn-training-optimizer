import {
  evaluateAlerts,
  AlertConfig,
  AlertId,
  DEFAULT_ALERT_CONFIG,
} from '../../src/engine/alerts';
import { fetchSnapshot } from './api';

const ALARM = 'poll';
const POLL_MINUTES = 1; // chrome.alarms minimum is 1 minute

function ensureAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) void poll();
});

interface State {
  apiKey: string;
  config: AlertConfig;
  lastFired: Partial<Record<AlertId, boolean>>;
}

async function getState(): Promise<State> {
  const r = await chrome.storage.local.get(['apiKey', 'config', 'lastFired']);
  return {
    apiKey: r.apiKey ?? '',
    config: { ...DEFAULT_ALERT_CONFIG, ...(r.config ?? {}) },
    lastFired: r.lastFired ?? {},
  };
}

async function poll() {
  const { apiKey, config, lastFired } = await getState();
  if (!apiKey) return;

  let snap;
  try {
    snap = await fetchSnapshot(apiKey);
  } catch {
    return; // stay quiet on transient errors
  }

  const alerts = evaluateAlerts(snap, config);
  const nowFired: Partial<Record<AlertId, boolean>> = {};

  for (const alert of alerts) {
    nowFired[alert.id] = true;
    if (!lastFired[alert.id]) {
      // condition just turned on -> notify once
      chrome.notifications.create(`tta-${alert.id}-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: alert.title,
        message: alert.message,
        priority: 1,
      });
    }
  }

  // Conditions no longer active are dropped, so they can fire again next time.
  await chrome.storage.local.set({ lastFired: nowFired });
}
