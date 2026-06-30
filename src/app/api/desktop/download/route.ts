import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const VERSION = '1.0.0';
const GH_BASE =
  'https://github.com/MeetBoxIA/meetbox-desktop/releases/latest/download';

// Filenames match electron-builder default output with productName "MeetBox Desktop"
const PLATFORMS: Record<string, { local: string; github: string; mime: string }> = {
  windows: {
    local: `MeetBox Desktop Setup ${VERSION}.exe`,
    github: `MeetBox+Desktop+Setup+${VERSION}.exe`,
    mime: 'application/octet-stream',
  },
  mac: {
    local: `MeetBox Desktop-${VERSION}-arm64.dmg`,
    github: `MeetBox+Desktop-${VERSION}-arm64.dmg`,
    mime: 'application/x-apple-diskimage',
  },
  linux: {
    local: `MeetBox Desktop-${VERSION}.AppImage`,
    github: `MeetBox+Desktop-${VERSION}.AppImage`,
    mime: 'application/x-executable',
  },
};

export async function GET(req: NextRequest) {
  const os = req.nextUrl.searchParams.get('os') ?? 'windows';
  const entry = PLATFORMS[os];

  if (!entry) {
    return NextResponse.json({ error: 'OS no soportado' }, { status: 400 });
  }

  // 1. Check for local file (dev / manual upload to public/downloads/)
  const localPath = path.join(process.cwd(), 'public', 'downloads', entry.local);
  if (fs.existsSync(localPath)) {
    const buf = fs.readFileSync(localPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': entry.mime,
        'Content-Disposition': `attachment; filename="${entry.local}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  }

  // 2. Redirect to GitHub Releases (production — set after running the workflow)
  const githubUrl = `${GH_BASE}/${entry.github}`;

  // Verify the release exists before redirecting (avoids dead links)
  try {
    const head = await fetch(githubUrl, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) {
      return NextResponse.redirect(githubUrl, { status: 302 });
    }
  } catch {
    // Network or DNS error — fall through to 503
  }

  // 3. Not yet available
  return NextResponse.json(
    {
      error: 'not_available',
      message:
        'El instalador estará disponible muy pronto. Vuelve en unos días.',
    },
    { status: 503 }
  );
}
