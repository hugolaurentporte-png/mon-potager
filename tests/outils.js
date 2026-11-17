// Fabrique une réponse Open-Meteo factice (même format que l'API réelle).
// jours : [{ date:'YYYY-MM-DD', tmin, tmax, pluie }] ; pluiesHoraires : { 'YYYY-MM-DDTHH:00': mm }
function reponseOpenMeteo(jours, pluiesHoraires) {
  pluiesHoraires = pluiesHoraires || {};
  var heures = [], pluie = [], temp = [], proba = [], nuages = [], vent = [], codes = [];
  jours.forEach(function (j) {
    // Pluie du jour sans détail horaire : répartie de 13 h à 16 h (comme l'API, où l'horaire et le journalier concordent)
    var aDetail = Object.keys(pluiesHoraires).some(function (k) { return k.indexOf(j.date) === 0; });
    if (!aDetail && j.pluie) for (var k = 13; k <= 16; k++) pluiesHoraires[j.date + 'T' + k + ':00'] = j.pluie / 4;
    for (var h = 0; h < 24; h++) {
      var t = j.date + 'T' + (h < 10 ? '0' : '') + h + ':00';
      heures.push(t); pluie.push(pluiesHoraires[t] || 0);
      // Courbe journalière : minimum vers 6 h, maximum vers 15 h
      var x = h <= 6 ? 0.4 * (6 - h) / 6 : h <= 15 ? (h - 6) / 9 : 1 - (h - 15) / 15;
      temp.push(Math.round((j.tmin + (j.tmax - j.tmin) * Math.max(0, Math.min(1, x))) * 10) / 10);
      proba.push(pluiesHoraires[t] ? 80 : 5); nuages.push(j.nuages == null ? 50 : j.nuages); vent.push(10); codes.push(pluiesHoraires[t] ? 61 : (j.code == null ? 2 : j.code));
    }
  });
  return {
    latitude: 48.85, longitude: 2.35, elevation: 42, timezone: 'Europe/Paris',
    daily: { time: jours.map(function (j) { return j.date; }), temperature_2m_min: jours.map(function (j) { return j.tmin; }), temperature_2m_max: jours.map(function (j) { return j.tmax; }), precipitation_sum: jours.map(function (j) { return j.pluie || 0; }), precipitation_probability_max: jours.map(function (j) { return j.proba == null ? 10 : j.proba; }), wind_gusts_10m_max: jours.map(function (j) { return j.rafales == null ? 25 : j.rafales; }), weather_code: jours.map(function (j) { return j.code == null ? 2 : j.code; }), et0_fao_evapotranspiration: jours.map(function (j) { return j.et0 === undefined ? Math.round((0.15 * j.tmax - 0.5) * 10) / 10 : j.et0; }) },
    hourly: { time: heures, precipitation: pluie, temperature_2m: temp, precipitation_probability: proba, cloud_cover: nuages, wind_speed_10m: vent, weather_code: codes }
  };
}
// Série de jours à partir d'une date avec des températures données (tableau de [tmin, tmax])
function serie(debutISO, temps) {
  var p = debutISO.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2], 12);
  return temps.map(function (t, i) {
    var x = new Date(d.getTime() + i * 86400000);
    var m = x.getMonth() + 1, j = x.getDate();
    return { date: x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j, tmin: t[0], tmax: t[1], pluie: t[2] || 0, rafales: t[3], code: t[4], et0: t[5] };
  });
}
module.exports = { reponseOpenMeteo: reponseOpenMeteo, serie: serie };
