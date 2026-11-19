// Starting a scan (08-spec-scanner): system document scanner (VisionKit on iOS, ML Kit on
// Android) or the system photo picker, then the review screen.
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

import { getDb, getKv, setKv } from '@/data/db';
import type { PhotoKind } from '@/data/photos';

export type Source = 'camera' | 'gallery';
const TIPS_KEY = 'scan:tips';

/** The tips screen is shown before the first scan only; after that the dock opens the scanner. */
export const tipsSeen = () => getKv(getDb(), TIPS_KEY) === '1';

/**
 * iOS asks for the camera (VisionKit uses the app's permission). Android needs none: the ML Kit
 * scanner runs its own camera inside Google Play services, so the app never gets CAMERA.
 */
async function cameraAllowed() {
  if (Platform.OS !== 'ios') return true;
  const now = await Camera.getCameraPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await Camera.requestCameraPermissionsAsync()).granted;
}

type Capture = { uri: string } | { blocked: 'denied' | 'unavailable' } | null;

/** One image from the scanner or the picker; null when the user cancels. */
export async function capture(source: Source): Promise<Capture> {
  if (source === 'gallery') {
    // System photo picker: no library permission needed (iOS 14+, Android photo picker).
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    return r.canceled || !r.assets[0] ? null : { uri: r.assets[0].uri };
  }
  if (!(await cameraAllowed())) return { blocked: 'denied' };
  try {
    const r = await CameraView.scanDocumentAsync({ quality: 1 });
    // ML Kit lets people scan several pages; a card is one, the first one wins.
    return r?.pages[0] ? { uri: r.pages[0] } : null;
  } catch {
    // No Google Play services / scanner module (some Android phones, emulators without Play).
    return { blocked: 'unavailable' };
  }
}

export type ScanTarget = { cardId?: string; kind?: PhotoKind };

type Router = ReturnType<typeof useRouter>;

/** Opens the scanner (or picker) and continues to the review screen. */
export async function openScan(router: Router, source: Source, target: ScanTarget = {}) {
  setKv(getDb(), TIPS_KEY, '1');
  const r = await capture(source);
  if (!r) return;
  if ('blocked' in r) {
    router.navigate({ pathname: '/scan', params: { blocked: r.blocked } });
    return;
  }
  router.push({
    pathname: '/scan-review',
    params: { uri: r.uri, source, cardId: target.cardId ?? '', kind: target.kind ?? 'scan' },
  });
}

// Card chosen in the "¿Qué carta es?" sheet, read by the review screen.
let picked: string | null = null;
const listeners = new Set<() => void>();
export function setPickedCard(id: string | null) {
  picked = id;
  listeners.forEach((fn) => fn());
}
export const usePickedCard = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => picked,
  );
