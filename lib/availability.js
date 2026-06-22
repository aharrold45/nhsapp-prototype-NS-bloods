// deterministic times generator for prototype
const DAYS_TO_MS = 24 * 60 * 60 * 1000;

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

function formatDateLabel(daysFromToday) {
  const d = new Date(Date.now() + daysFromToday * DAYS_TO_MS);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function formatTime(h, m) {
  const hour = ((h + 11) % 12) + 1; // 12-hour
  const minute = pad(m);
  return `${hour}:${minute} ${h < 12 ? 'am' : 'pm'}`;
}

// Returns array of 5 pages; each page: { dateLabel, slots: ["9:00 am", ...] }
function generateTimes(postcodeKey, clinicId) {
  const seed = hashStringToSeed((postcodeKey || 'DEFAULT') + '|' + clinicId);
  const rng = mulberry32(seed);
  const pages = [];
  for (let p = 0; p < 5; p++) {
    const dateLabel = formatDateLabel(p);
    const slots = [];
    // choose a base start hour between 8..15
    const baseHour = 8 + Math.floor(rng() * 8);
    for (let i = 0; i < 6; i++) {
      // spacing 30 or 60 minutes depending on rng
      const add = (i * 30);
      const hour = baseHour + Math.floor((add) / 60);
      const minute = add % 60;
      slots.push(formatTime(hour, minute));
    }
    pages.push({ dateLabel, slots });
  }
  return pages;
}

module.exports = { generateTimes };
