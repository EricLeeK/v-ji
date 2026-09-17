"use client";

import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function StatsCharts({
  points,
}: {
  points: Array<{ date: string; reviews: number; minutes: number }>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4">
        <p className="mb-3 text-sm font-medium">复习次数</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="reviews" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-3xl bg-white p-4">
        <p className="mb-3 text-sm font-medium">学习时长（分钟）</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="minutes"
                stroke="#62c2b3"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
