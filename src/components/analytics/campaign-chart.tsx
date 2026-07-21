'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OutreachCampaignBarChart } from '@/components/cold-email/outreach-ui';
import { useAppSection } from '@/lib/app-section';
import { cn } from '@/lib/utils';
import { outreachCardClass } from '@/components/outreach/page-body';

interface CampaignChartProps {
  data: { month: string; count: number; sent: number }[];
}

export function CampaignChart({ data }: CampaignChartProps) {
  const { section } = useAppSection();
  const isOutreach = section === 'outreach';

  if (isOutreach) {
    return <OutreachCampaignBarChart data={data} />;
  }

  return (
    <Card className={cn(isOutreach && outreachCardClass)}>
      <CardHeader className={cn(isOutreach && 'p-5 pb-2')}>
        <CardTitle className="text-base font-semibold text-gray-900">Campaigns per Month</CardTitle>
      </CardHeader>
      <CardContent className={cn(isOutreach && 'px-5 pb-5 pt-0')}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E8DCC2' }} />
            <Legend />
            <Bar dataKey="count" name="Campaigns" fill="#003049" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sent" name="Emails Sent" fill="#2e86ab" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
