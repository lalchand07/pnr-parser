import type { GdsFormat, ParseResult } from 'pnr-parser';
import { parsePnr, segmentsToCsv, toSimpleItinerary } from 'pnr-parser';
import type * as EnrichNs from 'pnr-parser/enrich';

type EnrichModule = typeof EnrichNs;

// Synthetic fixtures double as samples. Front matter (`# …` lines up to `---`)
// is stripped.
const rawSamples = import.meta.glob('../../test/fixtures/**/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface Sample {
  label: string;
  group: string;
  text: string;
  referenceDate?: string;
}

const samples: Sample[] = Object.entries(rawSamples)
  .map(([path, content]) => {
    const rel = path.replace(/^.*fixtures\//, '');
    const [group = '', file = ''] = rel.split('/');
    const lines = content.split('\n');
    const sep = lines.indexOf('---');
    const front = lines.slice(0, Math.max(sep, 0));
    const ref = front.map((l) => /^#\s*referenceDate:\s*(\S+)/.exec(l)?.[1]).find(Boolean);
    const sample: Sample = {
      group,
      label: file
        .replace(/^\d+-/, '')
        .replace(/\.txt$/, '')
        .replace(/-/g, ' '),
      text: lines
        .slice(sep + 1)
        .join('\n')
        .replace(/\n+$/, ''),
    };
    if (ref) sample.referenceDate = ref;
    return sample;
  })
  .filter((s) => s.group !== 'mixed' || !/empty/.test(s.label));

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

const input = $<HTMLTextAreaElement>('#input');
const sampleSelect = $<HTMLSelectElement>('#sample');
const formatSelect = $<HTMLSelectElement>('#format');
const refInput = $<HTMLInputElement>('#reference-date');
const enrichBox = $<HTMLInputElement>('#enrich');
const badges = $('#badges');
const warningsBox = $('#warnings');
const passengersBox = $('#passengers');
const itineraryTable = $<HTMLTableElement>('#itinerary');
const unparsedTable = $<HTMLTableElement>('#unparsed');
const unparsedCount = $('#unparsed-count');
const jsonPre = $('#json');
const csvPre = $('#csv');

const FORMAT_LABEL: Record<string, string> = {
  galileo: 'Galileo / Travelport',
  sabre: 'Sabre',
  amadeus: 'Amadeus',
  unknown: 'Unknown format',
};

let enrichModule: EnrichModule | undefined;
let lastJson = '';
let lastCsv = '';

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Small DOM helper: element with text and attributes. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string | null,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function populateSamples(): void {
  const groups = new Map<string, HTMLOptGroupElement>();
  samples.forEach((s, i) => {
    let group = groups.get(s.group);
    if (!group) {
      group = el('optgroup', null, { label: FORMAT_LABEL[s.group] ?? 'Edge cases' });
      groups.set(s.group, group);
    }
    group.append(el('option', s.label, { value: String(i) }));
  });
  for (const key of ['amadeus', 'sabre', 'galileo', 'mixed']) {
    const g = groups.get(key);
    if (g) sampleSelect.append(g);
  }
}

async function render(): Promise<void> {
  const format = formatSelect.value as GdsFormat | 'auto';
  const result: ParseResult = parsePnr(input.value, {
    format,
    referenceDate: refInput.value || todayIso(),
  });

  let output: unknown = result;
  let airportNames: Map<string, string> | undefined;
  if (enrichBox.checked) {
    enrichModule ??= await import('pnr-parser/enrich');
    const enriched = enrichModule.enrich(result);
    output = enriched;
    airportNames = new Map();
    for (const s of enriched.segments) {
      if (s.originAirport) airportNames.set(s.origin, airportLabel(s.originAirport));
      if (s.destinationAirport) airportNames.set(s.destination, airportLabel(s.destinationAirport));
    }
  }

  renderBadges(result);
  renderWarnings(result);
  renderPassengers(result);
  renderItinerary(result, airportNames);
  renderUnparsed(result);
  lastJson = JSON.stringify(output, null, 2);
  lastCsv = segmentsToCsv(result);
  jsonPre.textContent = lastJson;
  csvPre.textContent = lastCsv;
}

function airportLabel(a: { name: string; city: string; country?: string }): string {
  return [a.name, a.city, a.country].filter(Boolean).join(', ');
}

function renderBadges(r: ParseResult): void {
  badges.replaceChildren();
  if (input.value.trim() === '') return;
  const fmt = el('span', FORMAT_LABEL[r.format] ?? r.format, { class: `badge fmt-${r.format}` });
  const pct = Math.round(r.confidence * 100);
  const level = r.confidence >= 0.75 ? 'high' : r.confidence >= 0.5 ? 'medium' : 'low';
  const conf = el('span', `${pct}% confidence${r.formatForced ? ' (forced)' : ''}`, {
    class: `badge conf-${level}`,
    title: 'How strongly the text matches the format',
  });
  const counts = el(
    'span',
    `${r.segments.length} segment${r.segments.length === 1 ? '' : 's'} · ${r.passengers.length} passenger${r.passengers.length === 1 ? '' : 's'}`,
    { class: 'badge neutral' },
  );
  badges.append(fmt, conf, counts);
  if (r.recordLocator)
    badges.append(el('span', `Ref ${r.recordLocator}`, { class: 'badge locator' }));
}

function renderWarnings(r: ParseResult): void {
  warningsBox.replaceChildren();
  if (r.warnings.length === 0 || input.value.trim() === '') return;
  const details = el('details');
  details.open = r.warnings.length <= 4;
  details.append(
    el('summary', `${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'}`),
  );
  const list = el('ul');
  for (const w of r.warnings) {
    const li = el('li');
    li.append(el('code', w.code), document.createTextNode(` ${w.message}`));
    list.append(li);
  }
  details.append(list);
  warningsBox.append(details);
}

function renderPassengers(r: ParseResult): void {
  passengersBox.replaceChildren();
  if (r.passengers.length === 0) return;
  const list = el('ul', null, { class: 'pax' });
  for (const p of r.passengers) {
    const li = el('li');
    const name = [p.title, p.givenName, p.surname].filter(Boolean).join(' ');
    li.append(el('span', name, { class: 'pax-name' }));
    const typeText = p.type === 'ADT' ? 'Adult' : p.type === 'CHD' ? 'Child' : 'Infant';
    const extra = [
      p.age !== undefined ? `age ${p.age}` : '',
      p.dateOfBirth ? `born ${p.dateOfBirth}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    li.append(
      el('span', `${typeText}${extra ? ` (${extra})` : ''}`, {
        class: `pax-type t-${p.type}`,
        title: `Type source: ${p.typeSource}`,
      }),
    );
    list.append(li);
  }
  passengersBox.append(list);
}

function renderItinerary(r: ParseResult, airports?: Map<string, string>): void {
  itineraryTable.replaceChildren();
  const simple = toSimpleItinerary(r);
  if (simple.segments.length === 0) {
    const row = el('tr');
    row.append(
      el('td', input.value.trim() ? 'No flights found.' : 'Paste text or load a sample.', {
        class: 'empty',
      }),
    );
    itineraryTable.append(row);
    return;
  }
  const head = el('thead');
  const hr = el('tr');
  for (const h of ['#', 'Flight', 'Date', 'From', 'To', 'Departs', 'Arrives', 'Class', 'Status']) {
    hr.append(el('th', h, { scope: 'col' }));
  }
  head.append(hr);
  const body = el('tbody');
  simple.segments.forEach((row, i) => {
    const seg = r.segments[i]!;
    const tr = el('tr', null, { class: `status-${seg.statusCategory}` });
    tr.append(el('td', String(row.segment)));
    const flight = el('td');
    flight.append(el('span', row.flight, { class: 'flight' }));
    if (row.note) flight.append(el('small', row.note));
    if (seg.equipment) flight.append(el('small', `Aircraft ${seg.equipment}`));
    tr.append(flight, el('td', row.date, { class: 'nowrap' }));
    for (const code of [row.from, row.to]) {
      const td = el('td', code, { class: 'airport' });
      const name = airports?.get(code);
      if (name) {
        td.title = name;
        td.append(el('small', name));
      }
      tr.append(td);
    }
    tr.append(
      el('td', row.departs || '—', { class: 'nowrap' }),
      el('td', row.arrives || '—', { class: 'nowrap' }),
      el('td', row.bookingClass),
    );
    tr.append(el('td', row.status, { class: 'status' }));
    body.append(tr);
  });
  itineraryTable.append(head, body);
}

function renderUnparsed(r: ParseResult): void {
  unparsedTable.replaceChildren();
  unparsedCount.textContent = r.unparsedLines.length ? String(r.unparsedLines.length) : '';
  if (r.unparsedLines.length === 0) return;
  const head = el('thead');
  const hr = el('tr');
  for (const h of ['Line', 'Category', 'Text']) hr.append(el('th', h, { scope: 'col' }));
  head.append(hr);
  const body = el('tbody');
  for (const u of r.unparsedLines) {
    const tr = el('tr');
    tr.append(el('td', String(u.line)), el('td', u.category, { class: `cat cat-${u.category}` }));
    const text = el('td');
    text.append(el('code', u.text));
    tr.append(text);
    body.append(tr);
  }
  unparsedTable.append(head, body);
}

// ---- Wiring --------------------------------------------------------------

let timer: number | undefined;
function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void render(), 120);
}

input.addEventListener('input', schedule);
formatSelect.addEventListener('change', schedule);
refInput.addEventListener('change', schedule);
enrichBox.addEventListener('change', schedule);

sampleSelect.addEventListener('change', () => {
  const sample = samples[Number(sampleSelect.value)];
  if (!sample) return;
  input.value = sample.text;
  // Samples are written against a fixed date so their output is stable.
  refInput.value = sample.referenceDate ?? '2026-10-15';
  formatSelect.value = 'auto';
  sampleSelect.value = '';
  void render();
});

$('#clear').addEventListener('click', () => {
  input.value = '';
  refInput.value = todayIso();
  input.focus();
  void render();
});

for (const tab of document.querySelectorAll<HTMLButtonElement>('[role=tab]')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll<HTMLButtonElement>('[role=tab]')) {
      t.setAttribute('aria-selected', String(t === tab));
    }
    for (const panel of document.querySelectorAll<HTMLElement>('[data-panel]')) {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    }
  });
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  btn.addEventListener('click', () => {
    const text = btn.dataset.copy === 'csv' ? lastCsv : lastJson;
    void navigator.clipboard?.writeText(text).then(
      () => flash(btn, 'Copied'),
      () => flash(btn, 'Copy failed'),
    );
  });
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-download]')) {
  btn.addEventListener('click', () => {
    const csv = btn.dataset.download === 'csv';
    const blob = new Blob([csv ? lastCsv : lastJson], {
      type: csv ? 'text/csv' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = el('a', null, { href: url, download: csv ? 'segments.csv' : 'pnr.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function flash(btn: HTMLButtonElement, text: string): void {
  const original = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = original), 1200);
}

populateSamples();
refInput.value = todayIso();
void render();
