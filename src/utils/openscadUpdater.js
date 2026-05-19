'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);
const { getOpenSCADPath, getOpenSCADVersion } = require('./openscadRunner');

// OpenSCAD GitHub API — latest release
const GITHUB_API_URL = 'https://api.github.com/repos/openscad/openscad/releases/latest';
const USER_AGENT = 'NameForge/1.0 (Electron app)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_REDIRECTS = 5;

function assertHttpsUrl(url) {
  if (!url || !String(url).startsWith('https://')) {
    throw new Error(`Redirection non-HTTPS refusée : ${url}`);
  }
}

const MAX_API_BYTES = 1 * 1024 * 1024; // 1MB cap — GitHub API responses are typically < 50KB

function httpsGet(url, redirectCount = 0) {
  assertHttpsUrl(url);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume(); // drain body to release socket before following redirect
        if (redirectCount >= MAX_REDIRECTS) {
          return reject(new Error(`Trop de redirections (max ${MAX_REDIRECTS})`));
        }
        return resolve(httpsGet(res.headers.location, redirectCount + 1));
      }
      const chunks = [];
      let totalBytes = 0;
      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_API_BYTES) {
          res.destroy(new Error('Réponse GitHub API trop grande (> 1MB)'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function normalizeVersion(v) {
  // Remove leading 'v', zero-pad each segment for consistent comparison
  // e.g. "2024.05.12" and "2024.5.12" both → "002024.000005.000012"
  return (v || '').replace(/^v/, '').trim()
    .split('.')
    .map((seg) => (parseInt(seg, 10) || 0).toString().padStart(6, '0'))
    .join('.');
}

// ─── Check for update ─────────────────────────────────────────────────────────

async function checkForOpenSCADUpdate(app) {
  const currentVersion = await getOpenSCADVersion(app).catch(() => null);

  const body = await httpsGet(GITHUB_API_URL);

  let release;
  try {
    release = JSON.parse(body);
  } catch {
    throw new Error('Réponse GitHub API invalide (JSON malformé)');
  }

  if (!release || typeof release !== 'object') {
    throw new Error('Réponse GitHub API invalide (structure inattendue)');
  }

  const latestVersion = normalizeVersion(release.tag_name ?? '');
  const currentNorm = normalizeVersion(currentVersion || '');

  if (!latestVersion) {
    throw new Error('Impossible de lire la version depuis GitHub API');
  }

  // hasUpdate = false when not installed — no point prompting update for missing binary
  const isInstalled = currentVersion !== null;
  const hasUpdate = isInstalled && latestVersion !== currentNorm;

  // Find asset for current platform
  const assetUrl = pickAssetForPlatform(Array.isArray(release.assets) ? release.assets : []);

  return {
    success: true,
    currentVersion: currentNorm || 'non installé',
    latestVersion,
    hasUpdate,
    downloadUrl: assetUrl,
    releaseUrl: release.html_url ?? null,
  };
}

function pickAssetForPlatform(assets) {
  const platform = process.platform;

  const matchers = {
    win32: (name) => name.endsWith('.exe') && name.includes('x86-64'),
    darwin: (name) => name.endsWith('.dmg'),
    linux: (name) => name.endsWith('.AppImage'),
  };

  const matcher = matchers[platform] || (() => false);
  const asset = assets.find((a) => matcher(a.name));
  return asset ? asset.browser_download_url : null;
}

// ─── Download update ──────────────────────────────────────────────────────────

async function downloadOpenSCADUpdate(app, downloadUrl, onProgress) {
  if (!downloadUrl) throw new Error('URL de téléchargement manquante');

  // Always download to tmpdir — never touch the running binary.
  // Caller is responsible for prompting the user to run the installer.
  const ext = path.extname(new URL(downloadUrl).pathname) || '.bin';
  const tmpFile = path.join(os.tmpdir(), `openscad_update${ext}`);

  await downloadFile(downloadUrl, tmpFile, onProgress);

  // Integrity check — reject empty files (truncated download, network error)
  const stat = await fs.promises.stat(tmpFile);
  if (stat.size === 0) {
    throw new Error('Fichier téléchargé vide — téléchargement incomplet');
  }

  return { installerPath: tmpFile };
}

// MEDIUM-2: 500 MB cap — prevents disk exhaustion from a compromised CDN.
// OpenSCAD installer is ~70 MB; 500 MB provides ample headroom for all platforms.
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

async function downloadFile(url, dest, onProgress) {
  const res = await followRedirects(url);

  const total = parseInt(res.headers['content-length'] || '0', 10);
  let received = 0;

  res.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_DOWNLOAD_BYTES) {
      res.destroy(new Error('Téléchargement trop grand (> 500 MB) — abandon'));
      return;
    }
    if (onProgress && total) {
      onProgress(Math.round((received / total) * 100));
    }
  });

  // stream.pipeline handles backpressure and closes the WriteStream properly
  await pipelineAsync(res, fs.createWriteStream(dest));
}

// MEDIUM-4: Host allowlist — redirect chains must stay on trusted domains.
// Prevents a compromised CDN from redirecting to an attacker-controlled host.
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'releases.openscad.org',
  'openscad.s3.amazonaws.com',
  'github-releases.githubusercontent.com',
]);

function assertAllowedHost(url) {
  let hostname;
  try { hostname = new URL(url).hostname; }
  catch { throw new Error(`URL de redirection invalide : ${url}`); }
  if (!ALLOWED_DOWNLOAD_HOSTS.has(hostname)) {
    throw new Error(`Hôte de redirection non autorisé : ${hostname}`);
  }
}

function followRedirects(url, redirectCount = 0) {
  try { assertHttpsUrl(url); assertAllowedHost(url); } catch (e) { return Promise.reject(e); }

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume(); // drain redirect body to release socket
        if (redirectCount >= MAX_REDIRECTS) {
          return reject(new Error(`Trop de redirections lors du téléchargement (max ${MAX_REDIRECTS})`));
        }
        return resolve(followRedirects(res.headers.location, redirectCount + 1));
      }
      resolve(res);
    }).on('error', reject);
  });
}

module.exports = { checkForOpenSCADUpdate, downloadOpenSCADUpdate };
