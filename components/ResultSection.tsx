import { DisputePointCard } from '@/components/DisputePointCard';
import type { AnalysisResult } from '@/lib/schema';

interface Props {
  result: AnalysisResult;
}

export function ResultSection({ result }: Props) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{result.summary}</p>
      <div className="space-y-4">
        {result.dispute_points.map((point, i) => (
          <DisputePointCard key={i} point={point} index={i + 1} />
        ))}
      </div>
    </div>
  );
}
