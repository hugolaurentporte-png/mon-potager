// Fabrique une réponse Open-Meteo factice (même format que l'API réelle).
// jours : [{ date:'YYYY-MM-DD', tmin, tmax, pluie }] ; pluiesHoraires : { 'YYYY-MM-DDTHH:00': mm }
function reponseOpenMeteo(jours, pluiesHoraires) {
  pluiesHoraires = pluiesHoraires || {};
  var heures = [], pluie = [];
  jours.forEach(function (j) {
    for (var h = 0; h < 24; h++) {
      var t = j.date + 'T' + (h < 10 ? '0' : '') + h + ':00';
      heures.push(t); pluie.push(pluiesHoraires[t] || 0);
    }
  });
  return {
    latitude: 48.85, longitude: 2.35, elevation: 42, timezone: 'Europe/Paris',
    daily: { time: jours.map(function (j) { return j.date; }), temperature_2m_min: jours.map(function (j) { return j.tmin; }), temperature_2m_max: jours.map(function (j) { return j.tmax; }), precipitation_sum: jours.map(function (j) { return j.pluie || 0; }) },
    hourly: { time: heures, precipitation: pluie }
  };
}
// Série de jours à partir d'une date avec des températures données (tableau de [tmin, tmax])
function serie(debutISO, temps) {
  var p = debutISO.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2], 12);
  return temps.map(function (t, i) {
    var x = new Date(d.getTime() + i * 86400000);
    var m = x.getMonth() + 1, j = x.getDate();
    return { date: x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j, tmin: t[0], tmax: t[1], pluie: t[2] || 0 };
  });
}
module.exports = { reponseOpenMeteo: reponseOpenMeteo, serie: serie };
