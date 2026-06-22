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

// Build the shared appointment context (clinic record plus the chosen
// date/time) from the request query. Used by the check, confirm and
// appointment pages so they all show the same values.
function appointmentContext(req) {
	const clinicsList = loadClinicsList();
	return {
		clinic: clinicsList.find(x => x.id === req.query.clinic) || {},
		postcode: req.query.postcode || '',
		date: req.query.date || '',
		time: req.query.time || ''
	};
}

// Check your answers page for a chosen appointment slot. The clinic name and
// address are looked up from clinics.json; the date and time come from the
// slot button the user selected on the availability page.
router.get('/pages/your-health/check', (req, res) => {
	res.render('pages/your-health/check', appointmentContext(req));
});

// Appointment confirmation page, reached from the check page's
// "Confirm appointment" button. Shows the booked details.
router.get('/pages/your-health/confirm', (req, res) => {
	res.render('pages/your-health/confirm', appointmentContext(req));
});

// Appointment detail page, reached from the "View appointment" button on the
// confirmation page. Shows the same details plus tasks and other actions.
router.get('/pages/your-health/your-appointment', (req, res) => {
	res.render('pages/your-health/your-appointment', appointmentContext(req));
});

module.exports = router;
