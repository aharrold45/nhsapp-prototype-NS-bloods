// External dependencies
const express = require('express');

const router = express.Router();

// Add your routes here - above the module.exports line

const fs = require('fs');
const path = require('path');
const postcodeMap = require('./data/postcode-map.json');
const availability = require('../lib/availability');

// Resolve a raw postcode to a key in postcode-map.json, trying progressively
// shorter prefixes and falling back to DEFAULT. Shared by both availability
// routes so the same postcode always seeds the same (matching) times.
function resolvePostcodeKey(rawPostcode) {
	const raw = (rawPostcode || '').toUpperCase().replace(/\s+/g, '');
	let key = raw;
	if (!key || !postcodeMap[key]) {
		key = raw.slice(0, 5);
		if (!postcodeMap[key]) key = raw.slice(0, 3);
		if (!postcodeMap[key]) key = raw.slice(0, 2);
		if (!postcodeMap[key]) key = 'DEFAULT';
	}
	return key;
}

// Read clinics.json fresh each call so edits are reflected without a restart.
// Normalises the shape: supports either an array or an object with a `clinics` map.
function loadClinicsList() {
	let clinicsData = {};
	try {
		clinicsData = JSON.parse(
			fs.readFileSync(path.join(__dirname, 'data', 'clinics.json'), 'utf8')
		);
	} catch (e) {
		clinicsData = {};
	}
	if (Array.isArray(clinicsData)) return clinicsData;
	if (clinicsData && clinicsData.clinics) {
		if (Array.isArray(clinicsData.clinics)) return clinicsData.clinics;
		if (typeof clinicsData.clinics === 'object') return Object.values(clinicsData.clinics);
	}
	return [];
}

// Render the P9 home page at the site root
router.get('/', (req, res) => {
	res.render('pages/home-p9');
});

// View availability search results
router.get('/pages/your-health/view-availability-results', (req, res) => {
	const key = resolvePostcodeKey(req.query.postcode);
	const clinicIds = postcodeMap[key] || postcodeMap['DEFAULT'] || [];
	const clinicsList = loadClinicsList();

	const clinics = clinicIds.slice(0, 5).map(id => {
		const c = clinicsList.find(x => x.id === id) || { id, name: id };
		// If the clinic entry includes its own `times` (from JSON), prefer that.
		const times = (c && c.times) ? c.times : availability.generateTimes(key, id, c.openingHours);
		return Object.assign({}, c, { times });
	});

	res.render('pages/your-health/view-availability-results', {
		postcode: req.query.postcode || '',
		clinics,
		clinicsJson: JSON.stringify(clinics, null, 2),
		debug: req.query.debug || ''
	});
});

// Full availability for a single clinic (reached from the "See full clinic
// availability" CTA on the results page). Times for the first 5 days match
// the suggested times shown on the results page for the same postcode.
router.get('/pages/your-health/clinic-availability', (req, res) => {
	const key = resolvePostcodeKey(req.query.postcode);
	const clinicId = req.query.clinic;
	const clinicsList = loadClinicsList();
	const clinic = clinicsList.find(x => x.id === clinicId);

	// Unknown clinic - send the user back to the results list rather than
	// rendering an empty page (the path matches a real template, so falling
	// through to auto-routing would render this template with no data).
	if (!clinic) {
		return res.redirect('/pages/your-health/view-availability-results?postcode=' + encodeURIComponent(req.query.postcode || ''));
	}

	const days = availability.generateFullAvailability(key, clinicId, clinic.openingHours, 14);

	res.render('pages/your-health/clinic-availability', {
		clinic,
		days,
		postcode: req.query.postcode || ''
	});
});

module.exports = router;
