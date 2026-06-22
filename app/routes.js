// External dependencies
const express = require('express');

const router = express.Router();

// Add your routes here - above the module.exports line

const fs = require('fs');
const path = require('path');
const postcodeMap = require('./data/postcode-map.json');
const availability = require('../lib/availability');

// Render the P9 home page at the site root
router.get('/', (req, res) => {
	res.render('pages/home-p9');
});

// View availability search results
router.get('/pages/your-health/view-availability-results', (req, res) => {
	const raw = (req.query.postcode || '').toUpperCase().replace(/\s+/g, '');
	let key = raw;
	if (!key || !postcodeMap[key]) {
		// try progressively shorter keys
		key = raw.slice(0, 5);
		if (!postcodeMap[key]) key = raw.slice(0, 3);
		if (!postcodeMap[key]) key = raw.slice(0, 2);
		if (!postcodeMap[key]) key = 'DEFAULT';
	}

	const clinicIds = postcodeMap[key] || postcodeMap['DEFAULT'] || [];

	// Read clinics.json fresh each request so edits are reflected immediately
	const clinicsRaw = fs.readFileSync(path.join(__dirname, 'data', 'clinics.json'), 'utf8');
	let clinicsData = {};
	try {
		clinicsData = JSON.parse(clinicsRaw);
	} catch (e) {
		clinicsData = {};
	}

	// Normalise clinics data shape: support either an array or an object with a `clinics` map
	let clinicsList = [];
	if (Array.isArray(clinicsData)) {
		clinicsList = clinicsData;
	} else if (clinicsData && clinicsData.clinics) {
		if (Array.isArray(clinicsData.clinics)) clinicsList = clinicsData.clinics;
		else if (typeof clinicsData.clinics === 'object') clinicsList = Object.values(clinicsData.clinics);
	}

	const clinics = clinicIds.slice(0, 5).map(id => {
		const c = clinicsList.find(x => x.id === id) || { id, name: id };
		// If the clinic entry includes its own `times` (from JSON), prefer that.
		const times = (c && c.times) ? c.times : availability.generateTimes(key, id);
		return Object.assign({}, c, { times });
	});

	res.render('pages/your-health/view-availability-results', {
		postcode: req.query.postcode || '',
		clinics,
		clinicsJson: JSON.stringify(clinics, null, 2),
		debug: req.query.debug || ''
	});
});

module.exports = router;
