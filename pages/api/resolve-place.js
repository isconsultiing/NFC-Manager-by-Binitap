// Résout un lien Google Maps (court ou long) en une vraie fiche Google Place.
// Ne renvoie JAMAIS de Place ID inventé : soit Google le confirme, soit on
// renvoie une erreur explicite.
//
// Étapes :
// 1. Si le lien est court (maps.app.goo.gl / goo.gl/maps), on suit les
//    redirections côté serveur pour obtenir l'URL longue (pas de souci CORS
//    ici car on est côté serveur).
// 2. On extrait un texte de recherche exploitable (nom + coordonnées si
//    présentes) depuis l'URL longue.
// 3. On appelle Google Places "Find Place From Text" pour obtenir un
//    place_id fiable.
// 4. On appelle Google Places "Place Details" pour récupérer adresse,
//    téléphone, ville, pays, etc.

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function followRedirects(url) {
  // fetch() suit les redirections par défaut et expose l'URL finale.
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  return res.url || url;
}

function extractSearchText(longUrl) {
  try {
    const u = new URL(longUrl);

    // Cas fréquent : /maps/place/NOM+DU+LIEU/@lat,lng,...
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch && placeMatch[1]) {
      const name = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      return name;
    }

    // Cas avec paramètre ?q=
    const q = u.searchParams.get("q");
    if (q) return q;

    const query = u.searchParams.get("query");
    if (query) return query;

    return null;
  } catch {
    return null;
  }
}

function extractCoords(longUrl) {
  const match = longUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

function pickComponent(components, type) {
  const found = (components || []).find((c) => c.types.includes(type));
  return found ? found.long_name : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: true, message: "Méthode non autorisée" });
  }

  if (!API_KEY) {
    return res.status(500).json({
      error: true,
      message:
        "GOOGLE_MAPS_API_KEY manquante côté serveur. Configurez-la dans les variables d'environnement.",
    });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: true, message: "Lien Google Maps manquant." });
  }

  try {
    // 1. Résoudre le lien court en lien long.
    let longUrl = url;
    if (/goo\.gl|maps\.app\.goo\.gl/i.test(url)) {
      longUrl = await followRedirects(url);
    }

    const searchText = extractSearchText(longUrl);
    const coords = extractCoords(longUrl);

    if (!searchText && !coords) {
      return res.status(422).json({
        error: true,
        message: "Impossible d'identifier automatiquement cet établissement.",
      });
    }

    // 2. Find Place From Text -> place_id fiable.
    const findParams = new URLSearchParams({
      input: searchText || `${coords.lat},${coords.lng}`,
      inputtype: "textquery",
      fields: "place_id,name,formatted_address,geometry",
      key: API_KEY,
    });
    if (coords) {
      findParams.set("locationbias", `point:${coords.lat},${coords.lng}`);
    }

    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${findParams.toString()}`
    );
    const findData = await findRes.json();

    if (findData.status !== "OK" || !findData.candidates || findData.candidates.length === 0) {
      return res.status(422).json({
        error: true,
        message: "Impossible d'identifier automatiquement cet établissement.",
      });
    }

    const placeId = findData.candidates[0].place_id;
    if (!placeId) {
      return res.status(422).json({
        error: true,
        message: "Google n'a pas confirmé de Place ID pour cet établissement.",
      });
    }

    // 3. Place Details -> infos complètes.
    const detailsParams = new URLSearchParams({
      place_id: placeId,
      fields:
        "name,formatted_address,formatted_phone_number,international_phone_number,url,address_component",
      key: API_KEY,
    });

    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams.toString()}`
    );
    const detailsData = await detailsRes.json();

    if (detailsData.status !== "OK" || !detailsData.result) {
      return res.status(422).json({
        error: true,
        message: "Google n'a pas confirmé les détails de cet établissement.",
      });
    }

    const result = detailsData.result;
    const components = result.address_components;

    return res.status(200).json({
      error: false,
      name: result.name || searchText || "",
      address: result.formatted_address || "",
      city: pickComponent(components, "locality") || pickComponent(components, "postal_town"),
      country: pickComponent(components, "country"),
      phone: result.formatted_phone_number || result.international_phone_number || "",
      googleMapsUrl: result.url || longUrl,
      placeId,
    });
  } catch (err) {
    console.error("resolve-place error:", err);
    return res.status(500).json({
      error: true,
      message: "Erreur lors de l'analyse du lien. Réessayez.",
    });
  }
}
