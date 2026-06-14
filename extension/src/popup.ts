import { AlertConfig, AlertId, DEFAULT_ALERT_CONFIG } from '../../src/engine/alerts';

const RULES: { id: AlertId; label: string }[] = [
  { id: 'energyOverflow', label: 'Energy almost full' },
  { id: 'happyJumped', label: 'Happy is jumped' },
  { id: 'drugReady', label: 'Drug cooldown clear' },
  { id: 'lowHappyHighEnergy', label: 'Low happy, high energy' },
  { id: 'educationDone', label: 'Education idle' },
];

async function load() {
  const r = await chrome.storage.local.get(['apiKey', 'config']);
  const apiKey: string = r.apiKey ?? '';
  const config: AlertConfig = { ...DEFAULT_ALERT_CONFIG, ...(r.config ?? {}) };

  (document.getElementById('key') as HTMLInputElement).value = apiKey;

  const list = document.getElementById('rules')!;
  list.innerHTML = '';
  for (const rule of RULES) {
    const row = document.createElement('label');
    row.className = 'rule';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = config.enabled[rule.id] !== false;
    cb.dataset.id = rule.id;
    row.appendChild(cb);
    row.appendChild(document.createTextNode(rule.label));
    list.appendChild(row);
  }
}

async function save() {
  const apiKey = (document.getElementById('key') as HTMLInputElement).value.trim();
  const enabled = { ...DEFAULT_ALERT_CONFIG.enabled };
  document.querySelectorAll<HTMLInputElement>('#rules input[type=checkbox]').forEach((cb) => {
    enabled[cb.dataset.id as AlertId] = cb.checked;
  });
  const config: AlertConfig = { ...DEFAULT_ALERT_CONFIG, enabled };
  await chrome.storage.local.set({ apiKey, config });
  const status = document.getElementById('status')!;
  status.textContent = 'Saved.';
  setTimeout(() => (status.textContent = ''), 1500);
}

document.getElementById('save')!.addEventListener('click', () => void save());
void load();
