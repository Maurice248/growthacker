'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OutreachLeadBarChart } from '@/components/cold-email/outreach-ui';
import { useAppSection } from '@/lib/app-section';
import { cn } from '@/lib/utils';
import { outreachCardClass } from '@/components/outreach/page-body';

const COLORS = ['#003049', '#2e86ab', '#48cae4', '#00b4d8', '#90e0ef', '#ade8f4'];

interface LeadChartProps {
  data: { sheet: string; count: number }[];
  title?: string;
}

export function LeadChart({ data, title = 'Leads by Sheet' }: LeadChartProps) {
  const { section } = useAppSection();
  const isOutreach = section === 'outreach';

  if (isOutreach) {
    return <OutreachLeadBarChart data={data} title={title} />;
  }

  return (
    <Card className={cn(isOutreach && outreachCardClass)}>
      <CardHeader className={cn(isOutreach && 'p-5 pb-2')}>
        <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn(isOutreach && 'px-5 pb-5 pt-0')}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="sheet"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ sheet, percent }) =>
                percent >= 0.05
                  ? `${sheet.replace(' Leads', '')} (${(percent * 100).toFixed(0)}%)`
                  : null
              }
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #E8DCC2' }}
              formatter={(value: number, name: string) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
