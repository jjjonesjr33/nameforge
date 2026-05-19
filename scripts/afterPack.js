'use strict';

// ASAR-1: Apply Electron fuses after packing to harden the binary.
// Fuses bake security flags into the Electron executable itself.
// Does NOT require code signing to work — effective even unsigned.

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

/**
 * electron-builder afterPack hook.
 * Called once per platform/arch after the app is assembled but before signing.
 * @param {import('electron-builder').AfterPackContext} context
 */
async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;

  // Locate the Electron executable for this platform
  let executablePath;
  if (electronPlatformName === 'win32') {
    executablePath = path.join(appOutDir, 'NameForge.exe');
  } else if (electronPlatformName === 'darwin') {
    executablePath = path.join(appOutDir, 'NameForge.app', 'Contents', 'MacOS', 'NameForge');
  } else {
    executablePath = path.join(appOutDir, 'nameforge');
  }

  console.log(`\n🔒 Applying Electron fuses to: ${executablePath}`);

  try {
    await flipFuses(executablePath, {
      version: FuseVersion.V1,
      // Prevent loading app from outside the ASAR archive
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      // Validate ASAR integrity at startup (requires code signing for full effect)
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // Disable `ELECTRON_RUN_AS_NODE` env var — prevents process reuse as plain Node
      [FuseV1Options.RunAsNode]: false,
      // Disable nodeCliInspect (--inspect, --inspect-brk) to block debugger attach
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
    });
    console.log('   ✅ Fuses applied successfully\n');
  } catch (err) {
    // Non-fatal in dev/unsigned builds — warn but don't abort the build
    console.warn(`   ⚠️  Fuse application failed (may need @electron/fuses): ${err.message}\n`);
  }
}

module.exports = afterPack;
