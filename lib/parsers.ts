import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const TOKEN_CHAR_LIMIT = 150000;

export async function extractText(file: File, index: number): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;

  if (file.type === 'application/pdf') {
    const result = await pdfParse(buffer);
    text = result.text;
  } else {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }

  return `[文件 ${index}: ${file.name}]\n${text}`;
}

export function concatenateFiles(texts: string[]): string {
  const combined = texts.join('\n\n');
  return combined.length > TOKEN_CHAR_LIMIT ? combined.slice(0, TOKEN_CHAR_LIMIT) : combined;
}
