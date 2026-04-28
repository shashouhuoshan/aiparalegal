import { z } from 'zod';

const ApplicableLaw = z.object({
  citation: z.string(),
  text: z.string(),
});

const DisputePoint = z.object({
  title: z.string(),
  our_position: z.string(),
  opposing_arguments: z.array(z.string()),
  key_evidence: z.array(z.string()),
  applicable_laws: z.array(ApplicableLaw),
  risks: z.string(),
});

export const AnalysisResultSchema = z.object({
  summary: z.string(),
  dispute_points: z.array(DisputePoint),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type DisputePointType = z.infer<typeof DisputePoint>;
