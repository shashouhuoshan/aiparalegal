import { extractText, concatenateFiles } from '@/lib/parsers';

jest.mock('@/lib/ocr', () => ({
  ocrBuffer: jest.fn().mockResolvedValue('OCR识别结果'),
}));

jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'a'.repeat(60), numpages: 1 }));
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'DOCX提取的内容' }),
}));
jest.mock('pdf2pic', () => ({
  fromBuffer: jest.fn().mockReturnValue(jest.fn().mockResolvedValue(null)),
}));

describe('extractText', () => {
  test('PDF 提取结果含文件序号和文件名前缀', async () => {
    const file = new File(['dummy'], 'contract.pdf', { type: 'application/pdf' });
    const text = await extractText(file, 1);
    expect(text).toMatch(/^\[文件 1: contract\.pdf\]/);
  });

  test('DOCX 提取结果含文件序号和文件名前缀', async () => {
    const file = new File(['dummy'], 'record.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const text = await extractText(file, 2);
    expect(text).toBe('[文件 2: record.docx]\nDOCX提取的内容');
  });

  test('图片文件走 OCR 路径并含文件名前缀', async () => {
    const file = new File(['dummy'], 'scan.jpg', { type: 'image/jpeg' });
    const text = await extractText(file, 3);
    expect(text).toBe('[文件 3: scan.jpg] [OCR]\nOCR识别结果');
  });
});

describe('concatenateFiles', () => {
  test('未超限时原样拼接所有文件', () => {
    const texts = ['[文件 1: a.pdf]\n内容A', '[文件 2: b.pdf]\n内容B'];
    const result = concatenateFiles(texts);
    expect(result).toContain('内容A');
    expect(result).toContain('内容B');
  });

  test('超过 150000 字符时从末尾截断', () => {
    const longText = 'a'.repeat(200000);
    const result = concatenateFiles([longText]);
    expect(result.length).toBeLessThanOrEqual(150000);
  });
});
