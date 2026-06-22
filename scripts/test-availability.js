const path = require('path');
const fs = require('fs');
const clinicsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'data', 'clinics.json'), 'utf8'));
const postcodeMap = require(path.join(__dirname, '..', 'app', 'data', 'postcode-map.json'));
const availability = require(path.join(__dirname, '..', 'lib', 'availability'));

function findClinicsForPostcode(rawPostcode) {
  const raw = (rawPostcode || '').toUpperCase().replace(/\s+/g, '');
  let key = raw;
  if (!key || !postcodeMap[key]) {
    key = raw.slice(0,5);
    if (!postcodeMap[key]) key = raw.slice(0,3);
    if (!postcodeMap[key]) key = raw.slice(0,2);
    if (!postcodeMap[key]) key = 'DEFAULT';
  }

  const clinicIds = postcodeMap[key] || postcodeMap['DEFAULT'] || [];

  let clinicsList = [];
  if (Array.isArray(clinicsData)) {
    clinicsList = clinicsData;
  } else if (clinicsData && clinicsData.clinics) {
    if (Array.isArray(clinicsData.clinics)) clinicsList = clinicsData.clinics;
    else if (typeof clinicsData.clinics === 'object') clinicsList = Object.values(clinicsData.clinics);
  }

  const clinics = clinicIds.slice(0,5).map(id => {
    const c = clinicsList.find(x => x.id === id) || { id, name: id };
    const times = availability.generateTimes(key, id);
    return Object.assign({}, c, { times });
  });

  return { key, clinicIds, clinics };
}

const out = findClinicsForPostcode('SE77HX');
console.log(JSON.stringify(out, null, 2));
