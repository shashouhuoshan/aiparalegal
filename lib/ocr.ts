import Tesseract from 'tesseract.js';
import { existsSync } from 'fs';

const TESSDATA_LOCAL = process.env.TESSDATA_PATH ?? '/tessdata';
const TESSDATA_CDN = 'https://tessdata.projectnaptha.com/4.0.0';

function getLangPath(): string {
  return existsSync(`${TESSDATA_LOCAL}/chi_sim.traineddata`)
    ? TESSDATA_LOCAL
    : TESSDATA_CDN;
}

let _worker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!_worker) {
    _worker = await Tesseract.createWorker('chi_sim+eng', 1, {
      langPath: getLangPath(),
      cachePath: TESSDATA_LOCAL,
      logger: () => {},
    });
  }
  return _worker;
}

export async function ocrBuffer(imageBuffer: Buffer): Promise<string> {
  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(imageBuffer);
    return text.trim();
  } catch {
    return '';
  }
}
