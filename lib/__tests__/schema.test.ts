import { AnalysisResultSchema } from '@/lib/schema';

const validResult = {
  summary: '员工被违法辞退，未支付经济补偿。',
  dispute_points: [
    {
      title: '违法解除劳动合同',
      our_position: '用人单位未提前30天通知',
      opposing_arguments: ['员工存在严重违纪行为'],
      key_evidence: ['劳动合同（file_1 第3条）', '解除通知书（file_2）'],
      applicable_laws: [
        { citation: '《劳动合同法》第87条', text: '违法解除应支付赔偿金' },
      ],
      risks: '举证材料不足风险',
    },
  ],
};

describe('AnalysisResultSchema', () => {
  test('合法 LLM 输出通过校验', () => {
    expect(() => AnalysisResultSchema.parse(validResult)).not.toThrow();
  });

  test('缺少 summary 字段时抛出 ZodError', () => {
    const bad = { ...validResult, summary: undefined };
    expect(() => AnalysisResultSchema.parse(bad)).toThrow();
  });

  test('dispute_points 为空数组时通过校验', () => {
    const result = AnalysisResultSchema.parse({ ...validResult, dispute_points: [] });
    expect(result.dispute_points).toHaveLength(0);
  });

  test('applicable_laws 缺少 text 字段时抛出 ZodError', () => {
    const bad = JSON.parse(JSON.stringify(validResult));
    delete bad.dispute_points[0].applicable_laws[0].text;
    expect(() => AnalysisResultSchema.parse(bad)).toThrow();
  });
});
