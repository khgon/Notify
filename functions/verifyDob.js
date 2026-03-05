function normalize(value) {
  return String(value || "").trim();
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function verifyBirthDate(input, allowedPeople) {
  const name = normalize(input?.name);
  const birthDate = normalize(input?.birthDate);

  if (!name || !birthDate) {
    return { ok: false, reason: "name_and_birthDate_required" };
  }

  if (!isIsoDate(birthDate)) {
    return { ok: false, reason: "birthDate_must_be_iso_format" };
  }

  const matchedPerson = allowedPeople.find((person) => {
    return normalize(person.name) === name && normalize(person.birthDate) === birthDate;
  });

  if (!matchedPerson) {
    return { ok: false, reason: "person_not_allowed" };
  }

  return { ok: true, person: { name: matchedPerson.name } };
}

module.exports = {
  verifyBirthDate,
};
