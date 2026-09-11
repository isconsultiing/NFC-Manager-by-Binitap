// Couche de stockage très simple basée sur localStorage.
// Deux clés : nfc_communes (array) et nfc_etablissements (array).
// Tout reste sur l'appareil, pas de serveur / base de données.

const COMMUNES_KEY = "nfc_communes_v1";
const ETABS_KEY = "nfc_etablissements_v1";

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadCommunes() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(COMMUNES_KEY), []);
}

export function saveCommunes(list) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMMUNES_KEY, JSON.stringify(list));
}

export function loadEtablissements() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(ETABS_KEY), []);
}

export function saveEtablissements(list) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ETABS_KEY, JSON.stringify(list));
}

export function addCommune(nom) {
  const communes = loadCommunes();
  const commune = { id: uid(), nom: nom.trim() };
  const next = [...communes, commune].sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr")
  );
  saveCommunes(next);
  return commune;
}

export function renameCommune(id, nom) {
  const communes = loadCommunes().map((c) =>
    c.id === id ? { ...c, nom: nom.trim() } : c
  );
  saveCommunes(communes);
}

export function deleteCommune(id) {
  saveCommunes(loadCommunes().filter((c) => c.id !== id));
  // Les établissements liés restent mais ne seront plus rattachés à une
  // commune visible ; on les supprime aussi pour rester cohérent.
  saveEtablissements(loadEtablissements().filter((e) => e.communeId !== id));
}

export function addEtablissement(data) {
  const etabs = loadEtablissements();
  const etab = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...data,
  };
  saveEtablissements([...etabs, etab]);
  return etab;
}

export function updateEtablissement(id, patch) {
  const etabs = loadEtablissements().map((e) =>
    e.id === id ? { ...e, ...patch } : e
  );
  saveEtablissements(etabs);
}

export function deleteEtablissement(id) {
  saveEtablissements(loadEtablissements().filter((e) => e.id !== id));
}

export function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    communes: loadCommunes(),
    etablissements: loadEtablissements(),
  };
}

export function importData(json) {
  if (!json || !Array.isArray(json.communes) || !Array.isArray(json.etablissements)) {
    throw new Error("Fichier invalide");
  }
  saveCommunes(json.communes);
  saveEtablissements(json.etablissements);
}

export function reviewUrlFromPlaceId(placeId) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}
