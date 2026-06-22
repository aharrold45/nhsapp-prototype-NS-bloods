// Deterministic availability generator for the prototype.
//
// Both the search-results page (suggested times) and the full clinic
// availability page are derived from a single hourly model so they always
// agree: the FULL availability for a day is every hourly slot within the
// clinic's opening hours, and the SUGGESTED times shown on the results page
// are a deterministic subset of those same hours. This guarantees that for
// any day shown on both pages, the full page includes the suggested options
// (plus additional ones).
const DAY_MS = 24 * 60 * 60 * 1000;

function hashStringToSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Parse a free-text opening hours string into integer open/close hours (24h).
// Falls back to 9am-5pm when the string can't be understood (e.g. walk-in).
function parseOpeningHours(openingHours) {
  const m = /(\d{1,2})(?::\d{2})?\s*(am|pm)\b.*?(\d{1,2})(?::\d{2})?\s*(am|pm)\b/i.exec(openingHours || '');
  if (!m) return { open: 9, close: 17 };
  let open = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[2])) open += 12;
  let close = parseInt(m[3], 10) % 12;
  if (/pm/i.test(m[4])) close += 12;
  if (close <= open) return { open: 9, close: 17 };
  return { open, close };
}

// Format an integer hour (0-23) as a 12-hour label, e.g. 9 -> "9:00 am".
function formatHour(h) {
  const period = h < 12 || h === 24 ? 'am' : 'pm';
  let hour = h % 12;
  if (hour === 0) hour = 12;
  return `${hour}:00 ${period}`;
}

// Calendar metadata for the day that is `dayOffset` days from today.
function dayMeta(dayOffset) {
  const d = new Date(Date.now() + dayOffset * DAY_MS);
  return {
    index: dayOffset,
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'long' }),
    monthYear: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    dateLabel: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  };
}

// Every bookable hour for a clinic on any day (the full availability set).
function fullDayHours(open, close) {
  const hours = [];
  for (let h = open; h < close; h++) hours.push(h);
  return hours;
}

// Deterministic subset of the full hours, used for the "suggested" times.
// Always a subset of fullDayHours(open, close), so the full availability
// page is guaranteed to contain every suggested option for the same day.
function suggestedHoursForDay(key, clinicId, open, close, dayOffset) {
  const all = fullDayHours(open, close);
  if (!all.length) return [];
  const rng = mulberry32(hashStringToSeed(`${key || 'DEFAULT'}|${clinicId}|${dayOffset}`));
  const pool = all.slice();
  // Deterministic Fisher-Yates shuffle, then take the first few and re-sort.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.min(6, pool.length);
  return pool.slice(0, count).sort((a, b) => a - b);
}

// Suggested times for the search-results page.
// Returns 5 pages (today + next 4 days), each: { dateLabel, slots: [string] }.
function generateTimes(postcodeKey, clinicId, openingHours) {
  const { open, close } = parseOpeningHours(openingHours);
  const pages = [];
  for (let p = 0; p < 5; p++) {
    const meta = dayMeta(p);
    const hours = suggestedHoursForDay(postcodeKey, clinicId, open, close, p);
    pages.push({ dateLabel: meta.dateLabel, slots: hours.map(formatHour) });
  }
  return pages;
}

// Full availability for the clinic detail page.
// Returns `numDays` day objects, each with calendar metadata and slots
// grouped into morning / afternoon / evening. Each slot is a start-finish
// range, e.g. { start: "9:00 am", finish: "10:00 am", label: "9:00 am - 10:00 am" }.
function generateFullAvailability(postcodeKey, clinicId, openingHours, numDays) {
  numDays = numDays || 14;
  const { open, close } = parseOpeningHours(openingHours);
  const days = [];
  for (let p = 0; p < numDays; p++) {
    const meta = dayMeta(p);
    const morning = [];
    const afternoon = [];
    const evening = [];
    fullDayHours(open, close).forEach((h) => {
      const slot = {
        start: formatHour(h),
        finish: formatHour(h + 1),
        label: `${formatHour(h)} - ${formatHour(h + 1)}`
      };
      if (h < 12) morning.push(slot);
      else if (h < 17) afternoon.push(slot);
      else evening.push(slot);
    });
    days.push({
      index: meta.index,
      weekday: meta.weekday,
      day: meta.day,
      month: meta.month,
      monthYear: meta.monthYear,
      dateLabel: meta.dateLabel,
      iso: meta.iso,
      morning,
      afternoon,
      evening,
      hasSlots: morning.length + afternoon.length + evening.length > 0
    });
  }
  return days;
}

module.exports = { generateTimes, generateFullAvailability, parseOpeningHours };
