import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { 
  CheckCircle, 
  Clock, 
  Zap, 
  AlertTriangle, 
  TrendingUp,
  Cpu,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const data = [
  { name: 'Mon', runs: 400, latency: 45 },
  { name: 'Tue', runs: 300, latency: 38 },
  { name: 'Wed', runs: 600, latency: 62 },
  { name: 'Thu', runs: 800, latency: 55 },
  { name: 'Fri', runs: 700, latency: 40 },
  { name: 'Sat', runs: 900, latency: 42 },
  { name: 'Sun', runs: 1100, latency: 38 },
];

interface MetricCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  trend?: string;
}

const MetricCard = ({ label, value, subtext, icon, trend }: MetricCardProps) => (
  <div className="bg-surface-container-lowest border border-blueprint-line rounded-xl p-8 flex flex-col justify-between h-48 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <span className="text-ui-label text-blueprint-muted">{label}</span>
      <div className="text-blueprint-muted opacity-60">
        {icon}
      </div>
    </div>
    <div className="space-y-1">
      <div className="text-headline-lg text-blueprint-accent flex items-baseline gap-2">
        {value}
        {trend && <span className="text-technical-mono text-green-600 text-sm">{trend}</span>}
      </div>
      <p className="text-technical-mono text-blueprint-muted opacity-60">{subtext}</p>
    </div>
  </div>
);

export default function Analytics() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full space-y-8 sm:space-y-12">
      <div className="space-y-4">
        <h2 className="text-display-xl text-blueprint-accent">Performance Analytics</h2>
        <p className="text-body-lg text-blueprint-muted max-w-2xl leading-relaxed">
          High-level operator metrics and system health indicators. Data reflects real-time processing across all active node clusters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <MetricCard 
          label="Success Rate" 
          value="99.98%" 
          subtext="+0.02% from last epoch"
          icon={<CheckCircle size={20} />}
          trend="↑"
        />
        <MetricCard 
          label="Latency (p99)" 
          value="24ms" 
          subtext="-12ms optimization delta"
          icon={<Zap size={20} />}
        />
        <MetricCard 
          label="Total Runs" 
          value="2,450" 
          subtext="Volume across 42 endpoints"
          icon={<Cpu size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-surface-container-lowest border border-blueprint-line rounded-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-blueprint-line flex justify-between items-center bg-blueprint-bg/50">
             <h3 className="text-headline-md text-blueprint-accent">Time-Series Overview</h3>
             <div className="flex gap-2">
                {['1H', '24H', '7D', '30D'].map(period => (
                  <button key={period} className={cn(
                    "px-3 py-1 rounded-full text-technical-mono",
                    period === '24H' ? "bg-blueprint-accent text-white" : "text-blueprint-muted hover:bg-blueprint-line/40"
                  )}>
                    {period}
                  </button>
                ))}
             </div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 h-72 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRuns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid #e4e2e2',
                    fontFamily: 'monospace'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="runs" 
                  stroke="#000" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRuns)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="text-blueprint-accent" size={24} />
              <h3 className="text-headline-md text-blueprint-accent text-xl sm:text-2xl">Anomaly Detection</h3>
           </div>
           
           <div className="space-y-4">
              {[
                { title: "Unexpected path length", time: "2 mins ago", msg: "Deviation detected on Onboarding Agent. Path depth exceeded nominal bounds.", severity: "high" },
                { title: "Latency spike identified", time: "14 mins ago", msg: "Cluster delta observed. Auto-scaling resolved bottleneck at ingestion.", severity: "low" },
                { title: "Rate limiting trigger", time: "1 hour ago", msg: "Google Sheets integration approaching Tier 1 limits.", severity: "med" }
              ].map((log, i) => (
                <div key={i} className="p-6 border border-blueprint-line rounded-xl bg-blueprint-bg/20 space-y-2 hover:bg-blueprint-bg/40 transition-colors cursor-pointer">
                  <div className="flex justify-between">
                    <span className="text-ui-label text-blueprint-accent text-[12px]">{log.title}</span>
                    <span className="text-technical-mono opacity-50 text-[10px]">{log.time}</span>
                  </div>
                  <p className="text-body-md text-blueprint-muted text-sm">{log.msg}</p>
                </div>
              ))}
           </div>

           <button className="w-full mt-4 flex items-center justify-between p-4 border border-blueprint-line rounded-xl text-technical-mono group hover:bg-blueprint-accent hover:text-white transition-all">
              See All Anomalies
              <ArrowUpRight size={16} />
           </button>
        </div>
      </div>
    </div>
  );
}
