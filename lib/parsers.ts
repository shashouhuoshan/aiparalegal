import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { fromBuffer } from 'pdf2pic';
import { ocrBuffer } from '@/lib/ocr';

const TOKEN_CHAR_LIMIT = 150000;
const MIN_CHARS_PER_PAGE = 50;
const MAX_OCR_PAGES = 20;

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);

export async function extractText(file: File, index: number): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf') {
    return extractPdf(buffer, file.name, index);
  }
  if (IMAGE_MIME_TYPES.has(file.type)) {
    return extractImage(buffer, file.name, index);
  }
  return extractDocx(buffer, file.name, index);
}

async function extractPdf(buffer: Buffer, name: string, index: number): Promise<string> {
  const result = await pdfParse(buffer);
  const text = result.text.trim();
  const pages = result.numpages ?? 1;

  if (text.length >= pages * MIN_CHARS_PER_PAGE) {
    return `[文件 ${index}: ${name}]\n${text}`;
  }

  const ocrText = await ocrPdfPages(buffer, pages);
  const label = ocrText ? '[文件 ' + index + ': ' + name + '] [OCR]' : '[文件 ' + index + ': ' + name + ']';
  return `${label}\n${ocrText || text}`;
}

async function extractImage(buffer: Buffer, name: string, index: number): Promise<string> {
  const text = await ocrBuffer(buffer);
  return `[文件 ${index}: ${name}] [OCR]\n${text}`;
}

async function extractDocx(buffer: Buffer, name: string, index: number): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  let text = result.value.trim();

  const images = await extractDocxImages(buffer);
  if (images.length > 0) {
    const parts = await Promise.all(images.map((img) => ocrBuffer(img)));
    const imageText = parts.filter(Boolean).join('\n');
    if (imageText) text += '\n[嵌入图片 OCR]\n' + imageText;
  }

  return `[文件 ${index}: ${name}]\n${text}`;
}

async function ocrPdfPages(buffer: Buffer, totalPages: number): Promise<string> {
  const limit = Math.min(totalPages, MAX_OCR_PAGES);
  const convert = fromBuffer(buffer, {
    density: 150,
    format: 'png',
    width: 2480,
    height: 3508,
    savePath: '/tmp',
  });

  const texts: string[] = [];
  for (let page = 1; page <= limit; page++) {
    try {
      const result = await convert(page, { responseType: 'buffer' });
      if (result?.buffer) {
        const t = await ocrBuffer(result.buffer as Buffer);
        if (t) texts.push(t);
      }
    } catch {
      // skip unrenderable pages
    }
  }
  return texts.join('\n');
}

async function extractDocxImages(buffer: Buffer): Promise<Buffer[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const images: Buffer[] = [];
    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir && /^word\/media\/.+\.(png|jpe?g|bmp|tiff?)$/i.test(path)) {
        images.push(await file.async('nodebuffer'));
      }
    }
    return images;
  } catch {
    return [];
  }
}

export function concatenateFiles(texts: string[]): string {
  const combined = texts.join('\n\n');
  return combined.length > TOKEN_CHAR_LIMIT ? combined.slice(0, TOKEN_CHAR_LIMIT) : combined;
}
