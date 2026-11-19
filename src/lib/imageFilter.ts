// On-device nudity check before a photo is saved (12-moderation-safety): nothing leaves the phone.
// Model: GantMan nsfw_model MobileNetV2 (MIT, float16), see assets/models/nsfw.LICENSE.md.
import * as Sentry from '@sentry/react-native';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import type { TfliteModel } from 'react-native-fast-tflite';

const SIZE = 224;
const HENTAI = 1;
const PORN = 3;
// "sexy" is ignored on purpose: idol photocards often score high there.
const LIMIT = 0.7;

export class InappropriateImageError extends Error {}

let model: Promise<TfliteModel> | null = null;
const load = () =>
  (model ??= import('react-native-fast-tflite') // lazy: the native module must not load in Jest
    .then((m) => m.loadTensorflowModel(require('../../assets/models/nsfw.tflite'), []))
    .catch((e) => {
      model = null;
      throw e;
    }));

/** RGBA pixels → the model's RGB float input in 0..1. */
export function toInput(rgba: Uint8Array) {
  const out = new Float32Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i] / 255;
    out[j + 1] = rgba[i + 1] / 255;
    out[j + 2] = rgba[i + 2] / 255;
  }
  return out;
}

export const isInappropriate = (scores: Float32Array) =>
  scores[PORN] > LIMIT || scores[HENTAI] > LIMIT;

/**
 * Throws InappropriateImageError for nudity. Fails open (reports to Sentry) if the model cannot
 * run: reports and takedown still cover it, and photos stay private until public binders.
 */
export async function checkImage(image: ImageRef) {
  let scores: Float32Array;
  try {
    const small = await ImageManipulator.manipulate(image)
      .resize({ width: SIZE, height: SIZE })
      .renderAsync();
    const { base64 } = await small.saveAsync({ format: SaveFormat.JPEG, base64: true });
    const jpeg = Uint8Array.from(atob(base64!), (ch) => ch.charCodeAt(0));
    const { data } = decode(jpeg, { useTArray: true });
    const [out] = await (await load()).run([toInput(data).buffer]);
    scores = new Float32Array(out);
  } catch (e) {
    Sentry.captureException(e);
    return;
  }
  if (isInappropriate(scores)) throw new InappropriateImageError();
}
