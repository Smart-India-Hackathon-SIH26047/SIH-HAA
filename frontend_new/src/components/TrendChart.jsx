import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// Custom Tooltip component for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-line rounded-xl p-3 shadow-md text-xs space-y-1.5 z-50">
        <p className="font-semibold text-ink border-b border-line pb-1">{label}</p>
        <p className="text-brand font-bold text-sm">
          Distress Score: <span className="text-ink">{data.distress_score}/100</span>
        </p>
        {data.event && (
          <p className="text-alert font-medium bg-red-50 p-1.5 rounded border border-red-200">
            📌 Event: {data.event}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Dot to visually accentuate events directly on the trend line
const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  if (payload.event) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#B3261E" stroke="#ffffff" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={9} fill="none" stroke="#B3261E" strokeWidth={1.5} opacity={0.6} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill="#3457D5" stroke="#ffffff" strokeWidth={2} />;
};

export default function TrendChart({ timeline = [], caseEvents = [] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-paper rounded-xl border border-line text-xs text-muted">
        No distress score history available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted px-1">
        <span className="font-semibold text-ink">Distress Score Timeline</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" /> Score Trend
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-alert inline-block" /> Case Event / Delay
          </span>
        </div>
      </div>

      <div className="h-64 w-full bg-white rounded-xl border border-line p-3 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7EAF0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#8B93A7' }}
              axisLine={{ stroke: '#E7EAF0' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#8B93A7' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Threshold reference line for high risk */}
            <ReferenceLine y={75} stroke="#B3261E" strokeDasharray="4 4" label={{ value: 'High Risk Threshold (75)', fill: '#B3261E', fontSize: 10, position: 'insideTopRight' }} />

            <Line
              type="monotone"
              dataKey="distress_score"
              stroke="#3457D5"
              strokeWidth={2.5}
              dot={<CustomDot />}
              activeDot={{ r: 7, fill: '#3457D5' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
