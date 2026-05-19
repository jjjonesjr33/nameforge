import { useMemo } from 'react';
import ParamGroup, {
  Field,
  NumberInput,
  TextInput,
  Toggle,
  ColorInput,
  SelectInput,
} from './ParamGroup.jsx';

// ── Font quality metadata ─────────────────────────────────────────────────────
// rating: 'safe' | 'warn' | 'danger'
// safe   = bold strokes, prints well at any size ≥ 6mm
// warn   = medium strokes, fine above 12mm
// danger = thin strokes / serifs, needs large size (20mm+)

// ── Bundled Google Fonts (resources/fonts/) ───────────────────────────────────
// All fonts verified present as TTF in resources/fonts/.
// Variable fonts ([wght]) use style=Regular — safe across all OpenSCAD versions.
// Montserrat[wght] and Nunito[wght] excluded: base instance is Thin/ExtraLight → too fine for print.
const FONT_BASE_OPTIONS = [
  { value: 'Bebas Neue:style=Regular',   label: 'Bebas Neue',      rating: 'safe',   hint: 'Condensé tout-caps, strokes larges — parfait gravure' },
  { value: 'Anton:style=Regular',        label: 'Anton',            rating: 'safe',   hint: 'Impact-like, ultra bold — excellente lisibilité' },
  { value: 'Black Ops One:style=Regular', label: 'Black Ops One',  rating: 'safe',   hint: 'Stencil militaire, très épais — impression parfaite' },
  { value: 'Archivo Black:style=Regular', label: 'Archivo Black',  rating: 'safe',   hint: 'Géométrique ultra bold — strokes massifs' },
  { value: 'Russo One:style=Regular',    label: 'Russo One',        rating: 'safe',   hint: 'Industriel / militaire, sans-serif gras' },
  { value: 'Orbitron:style=Regular',     label: 'Orbitron',         rating: 'safe',   hint: 'Sci-fi / tech, excellent pour plaques gaming' },
  { value: 'Bungee:style=Regular',       label: 'Bungee',           rating: 'safe',   hint: 'Chunky display, conçu pour enseignes — top print' },
  { value: 'Oswald:style=Regular',       label: 'Oswald',           rating: 'safe',   hint: 'Condensé sans-serif, naturellement dense et lisible' },
  { value: 'Righteous:style=Regular',    label: 'Righteous',        rating: 'safe',   hint: 'Rétro sport, arrondis épais — strokes réguliers' },
  { value: 'STIX Two Math:style=Regular', label: 'STIX Two Math',   rating: 'danger', hint: 'Mathématique serif, strokes fins — grande taille requise (≥20mm)' },
];

const FONT_CORSIVO_OPTIONS = [
  { value: 'Pacifico:style=Regular',         label: 'Pacifico',         rating: 'safe',   hint: 'Cursive épaisse, parfaite pour l\'impression' },
  { value: 'Lobster:style=Regular',          label: 'Lobster',           rating: 'safe',   hint: 'Script stylisé, strokes bien définis' },
  { value: 'Kaushan Script:style=Regular',   label: 'Kaushan Script',    rating: 'safe',   hint: 'Cursive bold, excellente lisibilité en 3D' },
  { value: 'Permanent Marker:style=Regular', label: 'Permanent Marker',  rating: 'safe',   hint: 'Feutre épais, rendu organique et dynamique' },
  { value: 'Comfortaa:style=Regular',        label: 'Comfortaa',         rating: 'safe',   hint: 'Géométrique arrondie, moderne et lisible' },
  { value: 'Dancing Script:style=Regular',   label: 'Dancing Script',    rating: 'warn',   hint: 'Cursive élégante — préférer ≥ 12mm' },
];

const RATING_BADGE = {
  safe:   { icon: '✅', color: 'text-green-400',  bg: 'bg-green-400/10', label: 'Sûr pour impression' },
  warn:   { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Ok en grande taille (>12mm)' },
  danger: { icon: '❌', color: 'text-red-400',    bg: 'bg-red-400/10',   label: 'Strokes fins — augmenter la taille' },
};

function FontBadge({ options, value }) {
  const found = options.find((o) => o.value === value);
  if (!found) return null;
  const b = RATING_BADGE[found.rating];
  return (
    <div className={`mt-1 flex items-start gap-1.5 rounded px-2 py-1 ${b.bg}`}>
      <span className="text-[11px] leading-[1.4]">{b.icon}</span>
      <span className={`text-[11px] leading-[1.4] ${b.color}`}>
        {b.label}
        {found.hint && <span className="text-white/40"> — {found.hint}</span>}
      </span>
    </div>
  );
}

// Combined font list — module-level constant, avoids spreading on every render
const ALL_FONT_OPTIONS = [...FONT_BASE_OPTIONS, ...FONT_CORSIVO_OPTIONS];

// ── Text size warning logic ───────────────────────────────────────────────────
function getSizeWarning(dimensione_nome, layer_height, fontValue) {
  const font = ALL_FONT_OPTIONS.find((o) => o.value === fontValue);
  const rating = font?.rating ?? 'safe';

  const minSafe   = layer_height * 40; // e.g. 0.2 × 40 = 8mm
  const minDanger = layer_height * 20; // e.g. 0.2 × 20 = 4mm
  // thin-serif fonts need more space
  const minThinFont = layer_height * 60; // e.g. 0.2 × 60 = 12mm

  if (dimensione_nome < minDanger) {
    return {
      level: 'danger',
      msg: `⚠️ ${dimensione_nome}mm — trop petit (min recommandé : ${minDanger.toFixed(1)}mm à ${layer_height}mm layer)`,
    };
  }
  if (rating === 'danger' && dimensione_nome < minThinFont) {
    return {
      level: 'warn',
      msg: `⚠️ ${dimensione_nome}mm avec police à empattements fins — risque strokes < 0.4mm. Tenter ≥ ${minThinFont.toFixed(0)}mm ou changer de police.`,
    };
  }
  if (dimensione_nome < minSafe) {
    return {
      level: 'warn',
      msg: `⚠️ ${dimensione_nome}mm — petite taille à ${layer_height}mm layer height. Vérifier l'aperçu.`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Sidebar({ params, onUpdateParam, onGenerate, onDownload, onOpenInBambu, loading, bambuLoading, downloadingFormat }) {
  const p = params;
  const u = onUpdateParam;

  const sizeWarn = useMemo(
    () => getSizeWarning(p.dimensione_nome, p.layer_height, p.font_corsivo),
    [p.dimensione_nome, p.layer_height, p.font_corsivo]
  );

  return (
    <aside className="w-80 shrink-0 flex flex-col border-r border-app-border bg-app-panel">
      {/* Header sidebar */}
      <div className="px-4 py-3 border-b border-app-border">
        <span className="section-label">Paramètres du modèle</span>
      </div>

      {/* Scrollable param area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">

        {/* ── Texte ────────────────────────────────────────── */}
        <ParamGroup title="Texte" defaultOpen={true}>
          <Field label="Prénom / Texte">
            <TextInput
              value={p.nome}
              onChange={(v) => u('nome', v)}
              placeholder="Jason"
            />
          </Field>

          <Field label="Police — base (grande lettre)">
            <SelectInput
              value={p.font_base}
              onChange={(v) => u('font_base', v)}
              options={FONT_BASE_OPTIONS}
            />
            <FontBadge options={FONT_BASE_OPTIONS} value={p.font_base} />
          </Field>

          <Field label="Police — cursive (nom)">
            <SelectInput
              value={p.font_corsivo}
              onChange={(v) => u('font_corsivo', v)}
              options={FONT_CORSIVO_OPTIONS}
            />
            <FontBadge options={FONT_CORSIVO_OPTIONS} value={p.font_corsivo} />
          </Field>

          <Toggle
            value={p.iniziale_maiuscola}
            onChange={(v) => u('iniziale_maiuscola', v)}
            label="Majuscule initiale"
          />
          <Toggle
            value={p.mostra_base}
            onChange={(v) => u('mostra_base', v)}
            label="Afficher la base (grande lettre)"
          />
          <Toggle
            value={p.mostra_nome}
            onChange={(v) => u('mostra_nome', v)}
            label="Afficher le nom"
          />
        </ParamGroup>

        {/* ── Dimensions ───────────────────────────────────── */}
        <ParamGroup title="Dimensions (mm)">
          <Field label="Hauteur de couche (layer height)" hint="Affecte les avertissements de taille minimum">
            <NumberInput
              value={p.layer_height}
              onChange={(v) => u('layer_height', v)}
              min={0.05} max={0.6} step={0.05}
            />
          </Field>

          <Field label="Hauteur de la base" hint="Épaisseur de la grande lettre">
            <NumberInput
              value={p.altezza_base}
              onChange={(v) => u('altezza_base', v)}
              min={5} max={100} step={1}
            />
          </Field>

          <Field label="Profondeur de gravure">
            <NumberInput
              value={p.profondita_incisione}
              onChange={(v) => u('profondita_incisione', v)}
              min={0.5} max={20} step={0.5}
            />
          </Field>

          <Field label="Taille lettre de base">
            <NumberInput
              value={p.dimensione_lettera}
              onChange={(v) => u('dimensione_lettera', v)}
              min={20} max={500} step={5}
            />
          </Field>

          <Field label="Taille du nom" hint="Réduire si le nom dépasse la lettre de base">
            <NumberInput
              value={p.dimensione_nome}
              onChange={(v) => u('dimensione_nome', v)}
              min={5} max={200} step={1}
            />
            {/* Text size + layer height warning */}
            {sizeWarn && (
              <div className={`mt-1 rounded px-2 py-1 text-[11px] leading-[1.4] ${
                sizeWarn.level === 'danger'
                  ? 'bg-red-400/10 text-red-300'
                  : 'bg-yellow-400/10 text-yellow-300'
              }`}>
                {sizeWarn.msg}
              </div>
            )}
          </Field>

          <Field label="Épaisseur nom en relief" hint="Si nom en solide">
            <NumberInput
              value={p.altezza_nome_solido}
              onChange={(v) => u('altezza_nome_solido', v)}
              min={0.5} max={30} step={0.5}
            />
          </Field>

          <Field label="Décalage horizontal du nom (X)">
            <NumberInput
              value={p.offset_nome_x}
              onChange={(v) => u('offset_nome_x', v)}
              min={-200} max={200} step={1}
            />
          </Field>

          <Field label="Décalage vertical du nom (Y)">
            <NumberInput
              value={p.offset_nome_y}
              onChange={(v) => u('offset_nome_y', v)}
              min={-200} max={200} step={1}
            />
          </Field>

          <Field label="Tolérance gravure">
            <NumberInput
              value={p.tolleranza}
              onChange={(v) => u('tolleranza', v)}
              min={0} max={2} step={0.05}
            />
          </Field>

          <Field label="Marge coupe bord inférieur">
            <NumberInput
              value={p.margine_taglio}
              onChange={(v) => u('margine_taglio', v)}
              min={0} max={50} step={1}
            />
          </Field>

          <Field label="Coupe du bas" hint="0 = courbe intacte · 30 = plat haut">
            <NumberInput
              value={p.taglio_base}
              onChange={(v) => u('taglio_base', v)}
              min={0} max={60} step={1}
            />
          </Field>
        </ParamGroup>

        {/* ── Finitions d'impression ───────────────────────── */}
        <ParamGroup title="Finitions d'impression">

          {/* ── Fuzzy Skin ── */}
          <Toggle
            value={p.fuzzy_skin}
            onChange={(v) => u('fuzzy_skin', v)}
            label="Fuzzy Skin (texture rugueuse)"
          />
          {p.fuzzy_skin && (
            <>
              <Field label="Épaisseur Fuzzy" hint="mm — amplitude de la texture">
                <NumberInput
                  value={p.fuzzy_skin_thickness}
                  onChange={(v) => u('fuzzy_skin_thickness', v)}
                  min={0.1} max={3} step={0.1}
                />
              </Field>
              <Field label="Distance entre points" hint="mm — densité de la texture">
                <NumberInput
                  value={p.fuzzy_skin_point_distance}
                  onChange={(v) => u('fuzzy_skin_point_distance', v)}
                  min={0.2} max={5} step={0.1}
                />
              </Field>
            </>
          )}

          {/* ── Ironing ── */}
          <Toggle
            value={p.ironing_top}
            onChange={(v) => u('ironing_top', v)}
            label="Ironing surface haute"
          />

          {/* Info banner — slicer settings embedded in 3MF */}
          {(p.fuzzy_skin || p.ironing_top) && (
            <div className="rounded px-2 py-1.5 text-[11px] leading-[1.4] bg-[#1e3a5f]/60 border border-blue-500/30 text-blue-300">
              ℹ️ Réglages slicer — intégrés dans l'export <strong>3MF</strong> pour BambuStudio.
              Non visibles dans la preview 3D.
            </div>
          )}

          {/* ── Chanfrein géométrique ── */}
          <div className="border-t border-app-border pt-3">
            <Toggle
              value={p.chanfrein_haut}
              onChange={(v) => u('chanfrein_haut', v)}
              label="Chanfrein bord supérieur"
            />
            {p.chanfrein_haut && (
              <Field label="Taille chanfrein" hint="mm — biseau à 45° en haut de la lettre">
                <NumberInput
                  value={p.chanfrein_taille}
                  onChange={(v) => u('chanfrein_taille', v)}
                  min={0.2} max={10} step={0.2}
                />
              </Field>
            )}
          </div>

        </ParamGroup>

        {/* ── Couleurs ─────────────────────────────────────── */}
        <ParamGroup title="Couleurs d'impression">
          <Field label="Couleur de la base" hint="Filament 1 (grande lettre)">
            <ColorInput
              value={p.colore_base}
              onChange={(v) => u('colore_base', v)}
            />
          </Field>

          <Field label="Couleur du nom" hint="Filament 2 (texte)">
            <ColorInput
              value={p.colore_nome}
              onChange={(v) => u('colore_nome', v)}
            />
          </Field>
        </ParamGroup>
      </div>

      {/* ── Actions ──────────────────────────────────────────── */}
      <div className="p-3 border-t border-app-border space-y-2 shrink-0">
        <button
          className="btn-primary w-full"
          onClick={onGenerate}
          disabled={loading || bambuLoading}
        >
          {loading ? (
            <>
              <Spinner />
              Génération…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="square" d="M12 4v16m8-8H4" />
              </svg>
              Générer
            </>
          )}
        </button>

        <div className="flex gap-2">
          <button
            className="btn-outline flex-1 text-[13px] h-9 px-3 flex items-center justify-center gap-1.5"
            onClick={() => onDownload('stl')}
            disabled={loading || bambuLoading}
          >
            {downloadingFormat === 'stl' ? <><Spinner />STL…</> : 'STL'}
          </button>
          <button
            className="btn-outline flex-1 text-[13px] h-9 px-3 flex items-center justify-center gap-1.5"
            onClick={() => onDownload('3mf')}
            disabled={loading || bambuLoading}
          >
            {downloadingFormat === '3mf' ? <><Spinner />3MF…</> : '3MF'}
          </button>
        </div>

        {/* BambuStudio 1-click export */}
        <button
          className="w-full h-9 px-3 rounded text-[13px] font-medium flex items-center justify-center gap-2
                     bg-[#00ae42]/15 border border-[#00ae42]/40 text-[#00ae42]
                     hover:bg-[#00ae42]/25 hover:border-[#00ae42]/70
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={onOpenInBambu}
          disabled={loading || bambuLoading}
        >
          {bambuLoading ? (
            <>
              <Spinner />
              Ouverture…
            </>
          ) : (
            <>
              {/* Bambu-ish icon */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Ouvrir dans BambuStudio
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
