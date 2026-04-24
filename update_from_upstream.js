/**
 * Build-time Self-Updater
 * ─────────────────────────────────────────────────────────────
 * Runs BEFORE `next build` inside Vercel's build pipeline.
 * Downloads the latest source from the public master template
 * and overwrites the local copy — zero customer action required.
 *
 * This replaces the GitHub Actions approach entirely:
 *  • Works on private repos (no workflow permissions needed)
 *  • No "enable Actions" step for customers
 *  • Non-fatal — if the fetch fails, the build proceeds with existing code
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UPSTREAM_REPO = 'Verdic-Admin/card-app-prod';
const UPSTREAM_BRANCH = 'main';
const TARBALL_URL = `https://github.com/${UPSTREAM_REPO}/archive/refs/heads/${UPSTREAM_BRANCH}.tar.gz`;

// Files/dirs that belong to the CUSTOMER and should never be overwritten
const PRESERVE_LIST = [
  '.env',
  '.env.local',
  '.git',
  'node_modules',
  '.vercel',
  '.next',
];

function shouldPreserve(name) {
  return PRESERVE_LIST.some((p) => name === p || name.startsWith(p + '/'));
}

async function selfUpdate() {
  // Only run inside Vercel's build environment
  if (!process.env.VERCEL) {
    console.log('[self-update] Not running on Vercel — skipping upstream sync.');
    return;
  }

  console.log(`[self-update] Fetching latest from ${UPSTREAM_REPO}...`);

  try {
    const tmpDir = '/tmp/upstream-sync';
    const tarball = '/tmp/upstream.tar.gz';

    // Clean previous runs
    execSync(`rm -rf ${tmpDir} ${tarball}`, { stdio: 'inherit' });

    // Download the latest tarball from the PUBLIC master repo (no auth needed)
    execSync(`curl -sL "${TARBALL_URL}" -o ${tarball}`, {
      stdio: 'inherit',
      timeout: 30000,
    });

    // Extract to temp directory
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`tar xzf ${tarball} --strip-components=1 -C ${tmpDir}`, {
      stdio: 'inherit',
    });

    // Sync files from upstream → current directory, skipping protected files
    const entries = fs.readdirSync(tmpDir);
    let updated = 0;

    for (const entry of entries) {
      if (shouldPreserve(entry)) {
        console.log(`  [skip] ${entry} (protected)`);
        continue;
      }

      const src = path.join(tmpDir, entry);
      const dest = path.join(process.cwd(), entry);

      // Remove old version and copy new
      execSync(`rm -rf "${dest}"`, { stdio: 'pipe' });
      execSync(`cp -r "${src}" "${dest}"`, { stdio: 'pipe' });
      updated++;
    }

    // Cleanup
    execSync(`rm -rf ${tmpDir} ${tarball}`, { stdio: 'pipe' });

    console.log(`[self-update] ✓ Synced ${updated} entries from upstream template.`);
  } catch (err) {
    // Non-fatal: if anything fails, the build proceeds with the existing code
    console.warn('[self-update] Could not sync from upstream (non-fatal):', err.message || err);
    console.warn('[self-update] Proceeding with existing code...');
  }
}

selfUpdate();
