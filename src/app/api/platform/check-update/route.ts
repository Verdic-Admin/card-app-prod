import { NextResponse } from 'next/server';

/**
 * GET /api/platform/check-update
 * 
 * Checks the upstream Verdic-Admin/card-app-prod repo for the latest commit
 * and compares it to the currently deployed version. Returns update status
 * for the admin dashboard banner.
 */

const UPSTREAM_REPO = 'Verdic-Admin/card-app-prod';
const UPSTREAM_BRANCH = 'main';
const GITHUB_API = `https://api.github.com/repos/${UPSTREAM_REPO}/commits/${UPSTREAM_BRANCH}`;

export async function GET() {
  try {
    // Current deployed version is baked in at build time by Vercel
    const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';

    // Fetch the latest commit from the upstream master repo
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({
        updateAvailable: false,
        message: 'Could not check for updates.',
      });
    }

    const data = await res.json();
    const latestSha = data.sha as string;
    const latestMessage = data.commit?.message as string || '';
    const latestDate = data.commit?.committer?.date as string || '';

    // Compare: if our deployed SHA doesn't match the latest upstream, there's an update
    const updateAvailable = currentSha !== 'unknown' && latestSha !== currentSha;

    return NextResponse.json({
      updateAvailable,
      currentVersion: currentSha.slice(0, 7),
      latestVersion: latestSha.slice(0, 7),
      latestMessage: latestMessage.split('\n')[0], // first line only
      latestDate,
    });
  } catch {
    return NextResponse.json({
      updateAvailable: false,
      message: 'Update check failed.',
    });
  }
}
