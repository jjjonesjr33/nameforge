'use strict';

/**
 * Patch an OpenSCAD-generated 3MF with BambuStudio-compatible process settings.
 *
 * BambuStudio reads per-object overrides from `Metadata/model_settings.config`.
 * We inject fuzzy_skin and ironing_type into object ID 1 (OpenSCAD default).
 * If BambuStudio does not pick them up automatically, the 3MF geometry is
 * still valid — the user can apply the settings manually.
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// XML attribute value escaping — prevents injection if values ever become user strings
function xmlAttr(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {string} filePath  - Path to the .3mf file (modified atomically)
 * @param {object} settings
 * @param {boolean} settings.fuzzy_skin
 * @param {number}  settings.fuzzy_skin_thickness       mm
 * @param {number}  settings.fuzzy_skin_point_distance  mm
 * @param {boolean} settings.ironing_top
 */
function patchBambu3mf(filePath, settings) {
  // NaN guard — if renderer sends undefined/null, use safe defaults
  const thickness = Number.isFinite(+settings.fuzzy_skin_thickness)
    ? Number(settings.fuzzy_skin_thickness).toFixed(2)
    : '0.30';
  const dist = Number.isFinite(+settings.fuzzy_skin_point_distance)
    ? Number(settings.fuzzy_skin_point_distance).toFixed(2)
    : '0.80';

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>', '  <object id="1">'];

  if (settings.fuzzy_skin) {
    lines.push(`    <metadata key="fuzzy_skin" value="${xmlAttr('external')}"/>`);
    lines.push(`    <metadata key="fuzzy_skin_thickness" value="${xmlAttr(thickness)}"/>`);
    lines.push(`    <metadata key="fuzzy_skin_point_dist" value="${xmlAttr(dist)}"/>`);
  }

  if (settings.ironing_top) {
    lines.push(`    <metadata key="ironing_type" value="${xmlAttr('top surfaces')}"/>`);
  }

  lines.push('  </object>', '</config>');

  const xml = lines.join('\n');

  // ── Atomic write: write to tmp file then rename (prevents corruption) ────────
  const tmpPath = filePath + '.tmp';
  try {
    const zip = new AdmZip(filePath);

    const entry = zip.getEntry('Metadata/model_settings.config');
    if (entry) zip.deleteFile('Metadata/model_settings.config');
    zip.addFile('Metadata/model_settings.config', Buffer.from(xml, 'utf8'));

    zip.writeZip(tmpPath);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

module.exports = { patchBambu3mf };
