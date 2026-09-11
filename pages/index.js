import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import {
  loadCommunes,
  loadEtablissements,
  addCommune,
  renameCommune,
  deleteCommune,
  addEtablissement,
  updateEtablissement,
  deleteEtablissement,
  exportData,
  importData,
  reviewUrlFromPlaceId,
} from "../lib/store";

function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const show = (text) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1800);
  };
  return [msg, show];
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Repli pour Safari plus ancien / contexte non sécurisé.
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(el);
    return ok;
  }
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [communes, setCommunes] = useState([]);
  const [etabs, setEtabs] = useState([]);

  // view: home | commune | add | confirm | fiche | edit | editCommune
  const [view, setView] = useState("home");
  const [activeCommuneId, setActiveCommuneId] = useState(null);
  const [activeEtabId, setActiveEtabId] = useState(null);

  const [search, setSearch] = useState("");
  const [newCommuneName, setNewCommuneName] = useState("");
  const [showAddCommune, setShowAddCommune] = useState(false);

  const [toast, showToast] = useToast();
  const fileInputRef = useRef(null);

  useEffect(() => {
    setCommunes(loadCommunes());
    setEtabs(loadEtablissements());
    setReady(true);
  }, []);

  const refresh = () => {
    setCommunes(loadCommunes());
    setEtabs(loadEtablissements());
  };

  const communeById = (id) => communes.find((c) => c.id === id);
  const etabById = (id) => etabs.find((e) => e.id === id);

  const etabsForCommune = (communeId) =>
    etabs
      .filter((e) => e.communeId === communeId)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return etabs.filter((e) => {
      const commune = communeById(e.communeId);
      return (
        e.nom?.toLowerCase().includes(q) ||
        e.adresse?.toLowerCase().includes(q) ||
        commune?.nom?.toLowerCase().includes(q)
      );
    });
  }, [search, etabs, communes]);

  const goHome = () => {
    setView("home");
    setActiveCommuneId(null);
    setActiveEtabId(null);
    setSearch("");
  };

  const openCommune = (id) => {
    setActiveCommuneId(id);
    setView("commune");
  };

  const openFiche = (id) => {
    setActiveEtabId(id);
    setView("fiche");
  };

  const handleAddCommune = () => {
    const name = newCommuneName.trim();
    if (!name) return;
    addCommune(name);
    setNewCommuneName("");
    setShowAddCommune(false);
    refresh();
  };

  const handleDeleteCommune = (id) => {
    const commune = communeById(id);
    const count = etabsForCommune(id).length;
    const warn =
      count > 0
        ? `Supprimer "${commune?.nom}" et ses ${count} établissement(s) ?`
        : `Supprimer "${commune?.nom}" ?`;
    if (!confirm(warn)) return;
    deleteCommune(id);
    refresh();
    goHome();
  };

  return (
    <div className="app">
      <Head>
        <title>NFC Manager</title>
      </Head>

      {view === "home" && (
        <HomeView
          communes={communes}
          etabsForCommune={etabsForCommune}
          search={search}
          setSearch={setSearch}
          searchResults={searchResults}
          onOpenCommune={openCommune}
          onOpenEtab={openFiche}
          communeById={communeById}
          showAddCommune={showAddCommune}
          setShowAddCommune={setShowAddCommune}
          newCommuneName={newCommuneName}
          setNewCommuneName={setNewCommuneName}
          onAddCommune={handleAddCommune}
          onExport={() => {
            const data = exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `nfc-manager-export-${new Date()
              .toISOString()
              .slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onImportClick={() => fileInputRef.current?.click()}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            importData(JSON.parse(text));
            refresh();
            showToast("Données importées");
          } catch {
            alert("Fichier invalide, import annulé.");
          }
          e.target.value = "";
        }}
      />

      {view === "commune" && (
        <CommuneView
          commune={communeById(activeCommuneId)}
          etablissements={etabsForCommune(activeCommuneId)}
          onBack={goHome}
          onOpenEtab={openFiche}
          onAdd={() => setView("add")}
          onRename={(name) => {
            renameCommune(activeCommuneId, name);
            refresh();
          }}
          onDelete={() => handleDeleteCommune(activeCommuneId)}
        />
      )}

      {view === "add" && (
        <AddEtablissementView
          communes={communes}
          defaultCommuneId={activeCommuneId}
          onCancel={() => setView(activeCommuneId ? "commune" : "home")}
          onCreated={(etab) => {
            refresh();
            setActiveEtabId(etab.id);
            setActiveCommuneId(etab.communeId);
            setView("fiche");
          }}
        />
      )}

      {view === "fiche" && activeEtabId && (
        <FicheView
          etab={etabById(activeEtabId)}
          commune={communeById(etabById(activeEtabId)?.communeId)}
          onBack={() =>
            setView(activeCommuneId ? "commune" : "home")
          }
          onEdit={() => setView("edit")}
          onDelete={() => {
            if (!confirm("Voulez-vous vraiment supprimer cet établissement ?"))
              return;
            deleteEtablissement(activeEtabId);
            refresh();
            setView(activeCommuneId ? "commune" : "home");
          }}
          onCopy={async (text, label) => {
            const ok = await copyText(text);
            showToast(ok ? `✓ ${label} copié` : "Échec de la copie");
          }}
        />
      )}

      {view === "edit" && activeEtabId && (
        <EditEtablissementView
          etab={etabById(activeEtabId)}
          communes={communes}
          onCancel={() => setView("fiche")}
          onSaved={() => {
            refresh();
            setView("fiche");
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ---------- HOME ----------

function HomeView({
  communes,
  etabsForCommune,
  search,
  setSearch,
  searchResults,
  onOpenCommune,
  onOpenEtab,
  communeById,
  showAddCommune,
  setShowAddCommune,
  newCommuneName,
  setNewCommuneName,
  onAddCommune,
  onExport,
  onImportClick,
}) {
  return (
    <>
      <div className="topbar">
        <h1>NFC Manager</h1>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Rechercher un établissement, une commune..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="content">
        {searchResults ? (
          <>
            {searchResults.length === 0 ? (
              <div className="empty">Aucun résultat pour "{search}".</div>
            ) : (
              <div className="list">
                {searchResults.map((e) => (
                  <button
                    key={e.id}
                    className="list-item"
                    onClick={() => onOpenEtab(e.id)}
                  >
                    <div>
                      <div className="name">{e.nom}</div>
                      <div className="meta">
                        {communeById(e.communeId)?.nom || "—"}
                        {e.adresse ? ` · ${e.adresse}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {communes.length === 0 ? (
              <div className="empty">
                Aucune commune. Créez-en une pour commencer.
              </div>
            ) : (
              <div className="list">
                {communes.map((c) => (
                  <button
                    key={c.id}
                    className="list-item"
                    onClick={() => onOpenCommune(c.id)}
                  >
                    <div>
                      <span className="folder-icon">📁 </span>
                      <span className="name">{c.nom}</span>
                    </div>
                    <span className="count">
                      {etabsForCommune(c.id).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showAddCommune ? (
              <div style={{ marginTop: 14 }}>
                <input
                  type="text"
                  placeholder="Nom de la commune"
                  value={newCommuneName}
                  onChange={(e) => setNewCommuneName(e.target.value)}
                  autoFocus
                />
                <button className="btn-primary" onClick={onAddCommune}>
                  Créer la commune
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setShowAddCommune(false)}
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                className="btn-primary"
                onClick={() => setShowAddCommune(true)}
              >
                + Ajouter une commune
              </button>
            )}

            <div style={{ marginTop: 28, display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={onExport}>
                Exporter mes données
              </button>
              <button className="btn-secondary" onClick={onImportClick}>
                Importer mes données
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------- COMMUNE ----------

function CommuneView({
  commune,
  etablissements,
  onBack,
  onOpenEtab,
  onAdd,
  onRename,
  onDelete,
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(commune?.nom || "");

  if (!commune) {
    return (
      <div className="content">
        <div className="empty">Commune introuvable.</div>
        <button className="btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>
          ‹ Communes
        </button>
      </div>
      <div className="content">
        {renaming ? (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button
              className="btn-primary"
              onClick={() => {
                if (name.trim()) onRename(name.trim());
                setRenaming(false);
              }}
            >
              Enregistrer
            </button>
            <button className="btn-ghost" onClick={() => setRenaming(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <div className="topbar" style={{ padding: 0, marginBottom: 12 }}>
            <h1>{commune.nom}</h1>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setRenaming(true)}>
                ✎
              </button>
              <button className="icon-btn" onClick={onDelete}>
                🗑
              </button>
            </div>
          </div>
        )}

        {etablissements.length === 0 ? (
          <div className="empty">Aucun établissement dans cette commune.</div>
        ) : (
          <div className="list">
            {etablissements.map((e) => (
              <button
                key={e.id}
                className="list-item"
                onClick={() => onOpenEtab(e.id)}
              >
                <div>
                  <div className="name">{e.nom}</div>
                  {e.adresse && <div className="meta">{e.adresse}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

        <button className="btn-primary" onClick={onAdd}>
          + Ajouter un établissement
        </button>
      </div>
    </>
  );
}

// ---------- ADD ----------

function AddEtablissementView({ communes, defaultCommuneId, onCancel, onCreated }) {
  const [communeId, setCommuneId] = useState(
    defaultCommuneId || communes[0]?.id || ""
  );
  const [nom, setNom] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [found, setFound] = useState(null); // résultat de l'analyse

  const canAnalyse = communeId && link.trim().length > 0 && !loading;

  const handleAnalyse = async () => {
    setError(null);
    setFound(null);
    setLoading(true);
    try {
      const res = await fetch("/api/resolve-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.message || "Impossible d'identifier automatiquement cet établissement.");
      } else {
        setFound(data);
      }
    } catch {
      setError("Erreur réseau lors de l'analyse. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const etab = addEtablissement({
      communeId,
      nom: nom.trim() || found.name,
      googleMapsUrl: found.googleMapsUrl,
      lienOriginal: link.trim(),
      adresse: found.address,
      ville: found.city,
      pays: found.country,
      telephone: found.phone,
      placeId: found.placeId,
      reviewUrl: reviewUrlFromPlaceId(found.placeId),
    });
    onCreated(etab);
  };

  if (communes.length === 0) {
    return (
      <div className="content">
        <div className="empty">Créez d'abord une commune.</div>
        <button className="btn-secondary" onClick={onCancel}>
          Retour
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <button className="back-btn" onClick={onCancel}>
          ‹ Annuler
        </button>
        <h1>Ajouter</h1>
      </div>
      <div className="content">
        {!found ? (
          <>
            <label>Commune</label>
            <select
              value={communeId}
              onChange={(e) => setCommuneId(e.target.value)}
            >
              {communes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>

            <label>Nom de l'établissement (facultatif)</label>
            <input
              type="text"
              placeholder="Ex : Restaurant ABC"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />

            <label>Lien Google Maps</label>
            <textarea
              rows={3}
              placeholder="Coller ici le lien copié depuis Google Maps"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />

            {error && <div className="error-box">{error}</div>}

            <button
              className="btn-primary"
              disabled={!canAnalyse}
              onClick={handleAnalyse}
              style={!canAnalyse ? { opacity: 0.4 } : undefined}
            >
              {loading ? "Analyse en cours..." : "Analyser"}
            </button>

            {error && (
              <a
                className="btn-secondary"
                style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                href={`https://www.google.com/search?q=${encodeURIComponent(
                  nom || link
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Rechercher sur Google
              </a>
            )}
          </>
        ) : (
          <>
            <div className="card">
              <span className="commune-tag">ÉTABLISSEMENT TROUVÉ</span>
              <h2>{nom.trim() || found.name}</h2>

              <div className="field">
                <div className="field-label">Adresse</div>
                <div className="field-value">{found.address || "—"}</div>
              </div>
              <div className="field">
                <div className="field-label">Ville</div>
                <div className="field-value">{found.city || "—"}</div>
              </div>
              <div className="field">
                <div className="field-label">Google Place ID</div>
                <div className="field-value mono">{found.placeId}</div>
              </div>
            </div>

            <button className="btn-primary" onClick={handleConfirm}>
              Confirmer
            </button>
            <button className="btn-secondary" onClick={() => setFound(null)}>
              Annuler
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ---------- FICHE ----------

function FicheView({ etab, commune, onBack, onEdit, onDelete, onCopy }) {
  if (!etab) {
    return (
      <div className="content">
        <div className="empty">Établissement introuvable.</div>
        <button className="btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>
          ‹ {commune?.nom || "Retour"}
        </button>
      </div>
      <div className="content">
        <div className="card">
          <h2>{etab.nom}</h2>
          {commune && <span className="commune-tag">📍 {commune.nom}</span>}

          {etab.adresse && (
            <div className="field">
              <div className="field-label">Adresse</div>
              <div className="field-value">{etab.adresse}</div>
            </div>
          )}

          {etab.telephone && (
            <div className="field">
              <div className="field-label">Téléphone</div>
              <div className="field-value">{etab.telephone}</div>
            </div>
          )}

          <div className="field">
            <div className="field-label">Google Place ID</div>
            <div className="field-value mono">{etab.placeId}</div>
          </div>
          <button
            className="btn-secondary"
            onClick={() => onCopy(etab.placeId, "Place ID")}
          >
            Copier Place ID
          </button>

          <div className="field" style={{ marginTop: 18 }}>
            <div className="field-label">Lien Google Review</div>
            <div className="field-value mono">{etab.reviewUrl}</div>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => onCopy(etab.reviewUrl, "Lien copié")}
        >
          Copier lien NFC
        </button>

        <div className="row-gap" style={{ marginTop: 10 }}>
          <a
            className="btn-secondary"
            style={{ textAlign: "center", textDecoration: "none" }}
            href={etab.reviewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Tester
          </a>
          {etab.googleMapsUrl && (
            <a
              className="btn-secondary"
              style={{ textAlign: "center", textDecoration: "none" }}
              href={etab.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Google Maps
            </a>
          )}
        </div>

        <button className="btn-secondary" onClick={onEdit}>
          Modifier
        </button>
        <button className="btn-danger" onClick={onDelete}>
          Supprimer l'établissement
        </button>
      </div>
    </>
  );
}

// ---------- EDIT ----------

function EditEtablissementView({ etab, communes, onCancel, onSaved }) {
  const [nom, setNom] = useState(etab.nom || "");
  const [communeId, setCommuneId] = useState(etab.communeId);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(etab.googleMapsUrl || "");
  const [placeId, setPlaceId] = useState(etab.placeId || "");
  const [confirmPlaceIdChange, setConfirmPlaceIdChange] = useState(false);

  const placeIdChanged = placeId.trim() !== etab.placeId;

  const handleSave = () => {
    if (placeIdChanged && !confirmPlaceIdChange) {
      alert("Cochez la confirmation avant de modifier le Place ID.");
      return;
    }
    updateEtablissement(etab.id, {
      nom: nom.trim(),
      communeId,
      googleMapsUrl: googleMapsUrl.trim(),
      placeId: placeId.trim(),
      reviewUrl: reviewUrlFromPlaceId(placeId.trim()),
    });
    onSaved();
  };

  return (
    <>
      <div className="topbar">
        <button className="back-btn" onClick={onCancel}>
          ‹ Annuler
        </button>
        <h1>Modifier</h1>
      </div>
      <div className="content">
        <label>Nom</label>
        <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} />

        <label>Commune</label>
        <select value={communeId} onChange={(e) => setCommuneId(e.target.value)}>
          {communes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>

        <label>Lien Google Maps</label>
        <textarea
          rows={2}
          value={googleMapsUrl}
          onChange={(e) => setGoogleMapsUrl(e.target.value)}
        />

        <label>Google Place ID</label>
        <input
          type="text"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
        />

        {placeIdChanged && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={confirmPlaceIdChange}
              onChange={(e) => setConfirmPlaceIdChange(e.target.checked)}
            />
            <span style={{ fontWeight: 400, fontSize: 14 }}>
              Je confirme vouloir changer le Place ID manuellement.
            </span>
          </label>
        )}

        <button className="btn-primary" onClick={handleSave}>
          Enregistrer
        </button>
      </div>
    </>
  );
}
