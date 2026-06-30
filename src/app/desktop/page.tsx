import { headers } from 'next/headers';
import DesktopDownloadClient from './DesktopDownloadClient';
import MobilePWAClient from './MobilePWAClient';

type DetectedOS =
  | 'windows'
  | 'mac'
  | 'linux'
  | 'android'
  | 'ios'
  | 'unknown';

function detectOS(ua: string): DetectedOS {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function isMobileUA(ua: string): boolean {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export default async function DesktopPage() {
  const headersList = await headers();
  const ua = headersList.get('user-agent') ?? '';
  const os = detectOS(ua);
  const mobile = isMobileUA(ua);

  if (mobile) {
    return <MobilePWAClient os={os} />;
  }

  return <DesktopDownloadClient os={os} />;
}
