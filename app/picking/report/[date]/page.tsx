
import { Suspense } from 'react';
import DailyReportClient from './DailyReportClient';
import { Loader2 } from 'lucide-react';

function Loading() {
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading Item List...</p>
            </div>
        </div>
    )
}

type DailyReportPageProps = {
  params: {
    date: string;
  };
};

// This page handles a dynamic route segment for the report date.
// e.g., /picking/report/25-11-2025
export default function DailyReportPage({ params }: DailyReportPageProps) {
  const date = params.date ? decodeURIComponent(params.date) : '';

  return (
    <Suspense fallback={<Loading />}>
      <DailyReportClient date={date} />
    </Suspense>
  );
}
