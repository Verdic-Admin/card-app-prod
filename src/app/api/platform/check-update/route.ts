import { NextResponse } from 'next/server';

/**
 * GET /api/platform/check-update
 *
 * Compares the deployed Docker image version (baked at build time via GIT_SHA)
 * against the latest commit on the upstream repo. Returns update status
 * for the admin dashboard PlatformUpdateBanner.
 */

const UPSTREAM_REPO = 'Verdic-Admin/card-app-prod';
const UPSTREAM_BRANCH = 'main';
const GITHUB_API = `https://api.github.com/repos/${UPSTREAM_REPO}/commits/${UPSTREAM_BRANCH}`;

export async function GET() {
  try {
    // Docker image bakes GIT_SHA at build time via docker-publish.yml
    const currentSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';

    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({
        updateAvailable: false,
        message: 'Could not check for updates.',
      });
    }

    const data = await res.json();
    const latestSha = data.sha as string;
    const latestMessage = (data.commit?.message as string) || '';
    const latestDate = (data.commit?.committer?.date as string) || '';

    const updateAvailable =
      currentSha !== 'unknown' && latestSha !== currentSha;

    return NextResponse.json({
      updateAvailable,
      currentVersion: currentSha.slice(0, 7),
      latestVersion: latestSha.slice(0, 7),
      latestMessage: latestMessage.split('\n')[0],
      latestDate,
    });
  } catch {
    return NextResponse.json({
      updateAvailable: false,
      message: 'Update check failed.',
    });
  }
}
