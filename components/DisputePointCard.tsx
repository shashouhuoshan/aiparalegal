import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DisputePointType } from '@/lib/schema';

interface Props {
  point: DisputePointType;
  index: number;
}

export function DisputePointCard({ point, index }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {index}
          </span>
          {point.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Section label="我方观点" content={point.our_position} />

        {point.opposing_arguments.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-gray-600">对方可能论点</p>
            <ul className="list-inside list-disc space-y-0.5 text-gray-700">
              {point.opposing_arguments.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {point.key_evidence.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-gray-600">关键证据</p>
            <ul className="list-inside list-disc space-y-0.5 text-gray-700">
              {point.key_evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {point.applicable_laws.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-gray-600">相关法条</p>
            <div className="space-y-1">
              {point.applicable_laws.map((law, i) => (
                <div key={i} className="rounded bg-gray-50 px-3 py-2">
                  <p className="font-medium text-gray-800">{law.citation}</p>
                  <p className="text-xs text-gray-500">{law.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {point.risks && (
          <div className="rounded border-l-4 border-yellow-400 bg-yellow-50 px-3 py-2">
            <p className="text-xs font-medium text-yellow-800">风险提示</p>
            <p className="text-yellow-700">{point.risks}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="mb-1 font-medium text-gray-600">{label}</p>
      <p className="text-gray-700">{content}</p>
    </div>
  );
}
