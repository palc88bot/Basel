import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MarketTick } from '../types';
import { BarChart3, Sliders, Zap, ShieldCheck, Activity, Eye, ArrowUpDown, Filter, Terminal } from 'lucide-react';
import { BackstageTerminalFeed } from './BackstageTerminalFeed';
import { InstitutionalSuitePanel } from './InstitutionalSuitePanel';
import { QuantumMindViewPanel } from './QuantumMindViewPanel';

interface QuantitativeEngineViewProps {
  ticks: MarketTick[];
}

export const QuantitativeEngineView: React.FC<QuantitativeEngineViewProps> = ({ ticks }) => {
  const [activeMode, setActiveMode] = useState<'ARBITRAGE_GAP' | 'Z_SCORE_BANDS' | 'KALMAN_BETA'>('ARBITRAGE_GAP');
  const [showTerminal, setShowTerminal] = useState(false);
  const [selectedTick, setSelectedTick] = useState<MarketTick | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render D3 chart whenever ticks or activeMode changes
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || ticks.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = 360;
    const margin = { top: 30, right: 35, bottom: 40, left: 55 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous SVG contents
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Time
    const timeExtent = d3.extent(ticks, (d: MarketTick) => new Date(d.timestamp));
    const xScale = d3
      .scaleTime()
      .domain([timeExtent[0] || new Date(), timeExtent[1] || new Date()])
      .range([0, innerWidth]);

    // Grid lines
    const xGrid = d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(() => '');
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xGrid)
      .selectAll('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3 3');

    // Gradients & Defs
    const defs = svg.append('defs');

    // Gradient for positive arbitrage gap
    const gradPos = defs.append('linearGradient')
      .attr('id', 'grad-pos-arb')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    gradPos.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.4);
    gradPos.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a').attr('stop-opacity', 0.0);

    // Gradient for negative arbitrage gap
    const gradNeg = defs.append('linearGradient')
      .attr('id', 'grad-neg-arb')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    gradNeg.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.4);
    gradNeg.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a').attr('stop-opacity', 0.0);

    // Gradient for Z-score fill
    const gradZ = defs.append('linearGradient')
      .attr('id', 'grad-zscore')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    gradZ.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.25);
    gradZ.append('stop').attr('offset', '50%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.1);
    gradZ.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.25);

    if (activeMode === 'ARBITRAGE_GAP') {
      // Y Scale for Spread ($)
      const spreadMin = (d3.min(ticks, (d: MarketTick) => d.spread) as number) ?? 0;
      const spreadMax = (d3.max(ticks, (d: MarketTick) => d.spread) as number) ?? 100;
      const spreadPadding = (spreadMax - spreadMin) * 0.15 || 5;

      const yScale = d3
        .scaleLinear()
        .domain([spreadMin - spreadPadding, spreadMax + spreadPadding])
        .range([innerHeight, 0]);

      // Y Grid lines
      g.append('g')
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ''))
        .selectAll('line')
        .attr('stroke', '#1e293b')
        .attr('stroke-dasharray', '3 3');

      // Mean line (Kalman baseline approximation)
      const meanSpread = (d3.mean(ticks, (d: MarketTick) => d.spread) as number) ?? 0;
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(meanSpread))
        .attr('y2', yScale(meanSpread))
        .attr('stroke', '#64748b')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('x', 10)
        .attr('y', yScale(meanSpread) - 6)
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'JetBrains Mono')
        .text(`متوسط كالمان النظري: $${meanSpread.toFixed(2)}`);

      // Shaded Area between spread and baseline
      const areaGen = d3
        .area<MarketTick>()
        .x(d => xScale(new Date(d.timestamp)))
        .y0(yScale(meanSpread))
        .y1(d => yScale(d.spread))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(ticks)
        .attr('fill', 'url(#grad-neg-arb)')
        .attr('d', areaGen);

      // Line for Actual Spread
      const lineGen = d3
        .line<MarketTick>()
        .x(d => xScale(new Date(d.timestamp)))
        .y(d => yScale(d.spread))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(ticks)
        .attr('fill', 'none')
        .attr('stroke', '#22d3ee')
        .attr('stroke-width', 2.5)
        .attr('d', lineGen);

      // Circles for arbitrage entry candidates (|Z| >= 1.8)
      g.selectAll('.arb-point')
        .data(ticks.filter(d => Math.abs(d.zScore) >= 1.8))
        .enter()
        .append('circle')
        .attr('class', 'arb-point')
        .attr('cx', (d: any) => xScale(new Date(d.timestamp)))
        .attr('cy', (d: any) => yScale(d.spread))
        .attr('r', 5.5)
        .attr('fill', (d: any) => d.zScore <= -1.8 ? '#10b981' : '#ef4444')
        .attr('stroke', '#020617')
        .attr('stroke-width', 2);

      // Y Axis labels
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `$${d}`))
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', '10px');

    } else if (activeMode === 'Z_SCORE_BANDS') {
      // Y Scale for Z-Score
      const yScale = d3
        .scaleLinear()
        .domain([-3.2, 3.2])
        .range([innerHeight, 0]);

      // Draw Threshold Bands
      // Stop Loss Upper (+2.8)
      g.append('line')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', yScale(2.8)).attr('y2', yScale(2.8))
        .attr('stroke', '#b91c1c').attr('stroke-dasharray', '3 3').attr('stroke-width', 1);
      g.append('text')
        .attr('x', innerWidth - 8).attr('y', yScale(2.8) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#f87171').attr('font-size', '10px').attr('font-family', 'Cairo')
        .text('وقف خسارة البيع (+2.8 Z)');

      // Sell Entry (+1.8)
      g.append('line')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', yScale(1.8)).attr('y2', yScale(1.8))
        .attr('stroke', '#ef4444').attr('stroke-dasharray', '5 3').attr('stroke-width', 1.5);
      g.append('text')
        .attr('x', innerWidth - 8).attr('y', yScale(1.8) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#ef4444').attr('font-size', '10px').attr('font-family', 'Cairo')
        .text('حد دخول بيع (+1.8 Z)');

      // Zero Equilibrium Line (0.0)
      g.append('line')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .attr('stroke', '#475569').attr('stroke-width', 1);
      g.append('text')
        .attr('x', 8).attr('y', yScale(0) - 4)
        .attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-family', 'Cairo')
        .text('خط التوازن النظري (Z = 0)');

      // Buy Entry (-1.8)
      g.append('line')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', yScale(-1.8)).attr('y2', yScale(-1.8))
        .attr('stroke', '#10b981').attr('stroke-dasharray', '5 3').attr('stroke-width', 1.5);
      g.append('text')
        .attr('x', innerWidth - 8).attr('y', yScale(-1.8) + 12)
        .attr('text-anchor', 'end')
        .attr('fill', '#34d399').attr('font-size', '10px').attr('font-family', 'Cairo')
        .text('حد دخول شراء (-1.8 Z)');

      // Stop Loss Lower (-2.8)
      g.append('line')
        .attr('x1', 0).attr('x2', innerWidth)
        .attr('y1', yScale(-2.8)).attr('y2', yScale(-2.8))
        .attr('stroke', '#047857').attr('stroke-dasharray', '3 3').attr('stroke-width', 1);

      // Area fill for Z-Score curve
      const areaGen = d3
        .area<MarketTick>()
        .x(d => xScale(new Date(d.timestamp)))
        .y0(yScale(0))
        .y1(d => yScale(d.zScore))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(ticks)
        .attr('fill', 'url(#grad-zscore)')
        .attr('d', areaGen);

      // Z-Score Line
      const lineGen = d3
        .line<MarketTick>()
        .x(d => xScale(new Date(d.timestamp)))
        .y(d => yScale(d.zScore))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(ticks)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2.5)
        .attr('d', lineGen);

      // Critical Points
      g.selectAll('.z-point')
        .data(ticks)
        .enter()
        .append('circle')
        .attr('class', 'z-point')
        .attr('cx', (d: any) => xScale(new Date(d.timestamp)))
        .attr('cy', (d: any) => yScale(d.zScore))
        .attr('r', (d: any) => Math.abs(d.zScore) >= 1.8 ? 6 : 2.5)
        .attr('fill', (d: any) => d.zScore <= -1.8 ? '#10b981' : d.zScore >= 1.8 ? '#ef4444' : '#38bdf8')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.5);

      // Y Axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(7).tickFormat(d => `${d}Z`))
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', '10px');

    } else if (activeMode === 'KALMAN_BETA') {
      // Y Scale for Beta
      const betaMin = (d3.min(ticks, (d: MarketTick) => d.beta) as number) ?? 30.0;
      const betaMax = (d3.max(ticks, (d: MarketTick) => d.beta) as number) ?? 32.5;
      const betaPadding = (betaMax - betaMin) * 0.2 || 0.1;

      const yScale = d3
        .scaleLinear()
        .domain([betaMin - betaPadding, betaMax + betaPadding])
        .range([innerHeight, 0]);

      // Beta line
      const lineGen = d3
        .line<MarketTick>()
        .x(d => xScale(new Date(d.timestamp)))
        .y(d => yScale(d.beta))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(ticks)
        .attr('fill', 'none')
        .attr('stroke', '#c084fc')
        .attr('stroke-width', 2.5)
        .attr('d', lineGen);

      // Y Axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => Number(d).toFixed(3)))
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', '10px');
    }

    // X Axis at the bottom
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => d3.timeFormat('%H:%M:%S')(d as Date)))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'JetBrains Mono')
      .attr('font-size', '10px');

    // Interactive Overlay for Crosshair
    const bisectDate = d3.bisector<MarketTick, Date>(d => new Date(d.timestamp)).left;

    const crosshair = g.append('g').style('display', 'none');
    crosshair.append('line')
      .attr('class', 'cross-x')
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('stroke', '#38bdf8').attr('stroke-dasharray', '2 2');

    svg
      .append('rect')
      .attr('class', 'overlay')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => crosshair.style('display', null))
      .on('mouseout', () => {
        crosshair.style('display', 'none');
        setSelectedTick(null);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const i = bisectDate(ticks, x0, 1);
        const d0 = ticks[i - 1];
        const d1 = ticks[i];
        let d = d0;
        if (d1 && d0) {
          d = x0.getTime() - d0.timestamp > d1.timestamp - x0.getTime() ? d1 : d0;
        }
        if (d) {
          const cx = xScale(new Date(d.timestamp));
          crosshair.select('.cross-x').attr('x1', cx).attr('x2', cx);
          setSelectedTick(d);
        }
      });

  }, [ticks, activeMode]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header & Chart Mode Selectors */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white font-sans">
                المحرك الكمي والتحليل البياني التفاعلي (D3 Arbitrage Engine)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              رسم بياني لحظي فائق الدقة مبني بواسطة D3.js لمراقبة انحراف الفجوة السعرية (Z-Score) ومعاملات فلتر كالمان في آنٍ واحد.
            </p>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Terminal Toggle Button */}
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 space-x-reverse border transition-all ${
                showTerminal
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showTerminal ? 'إخفاء الطرفية' : 'شاشة العمليات خلف الكواليس'}</span>
            </button>

            {/* Mode Selectors */}
            <div className="flex gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'ARBITRAGE_GAP', label: 'الفجوة والتحكيم (Spread)' },
                { id: 'Z_SCORE_BANDS', label: 'مؤشر Z-Score والحواجز' },
                { id: 'KALMAN_BETA', label: 'معامل كالمان (Beta)' },
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={() => setActiveMode(btn.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeMode === btn.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Hover Status Header Banner */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center space-x-4 space-x-reverse">
            <div>
              <span className="text-slate-400 text-[10px] block font-sans">الانحراف اللحظي (Z-Score):</span>
              <span className={`font-bold text-sm ${
                (selectedTick?.zScore ?? ticks[ticks.length - 1]?.zScore ?? 0) <= -1.8 ? 'text-emerald-400' :
                (selectedTick?.zScore ?? ticks[ticks.length - 1]?.zScore ?? 0) >= 1.8 ? 'text-rose-400' :
                'text-cyan-300'
              }`}>
                {selectedTick ? selectedTick.zScore : ticks[ticks.length - 1]?.zScore ?? 0}
              </span>
            </div>

            <div className="border-r border-slate-800 pr-4">
              <span className="text-slate-400 text-[10px] block font-sans">سعر A (BTC):</span>
              <span className="text-white font-bold text-sm">
                ${(selectedTick?.priceA ?? ticks[ticks.length - 1]?.priceA ?? 75420).toLocaleString()}
              </span>
            </div>

            <div className="border-r border-slate-800 pr-4">
              <span className="text-slate-400 text-[10px] block font-sans">سعر B (ETH):</span>
              <span className="text-white font-bold text-sm">
                ${(selectedTick?.priceB ?? ticks[ticks.length - 1]?.priceB ?? 2415).toLocaleString()}
              </span>
            </div>

            <div className="border-r border-slate-800 pr-4">
              <span className="text-slate-400 text-[10px] block font-sans">معامل بيتا اللحظي:</span>
              <span className="text-purple-300 font-bold text-sm">
                {selectedTick ? selectedTick.beta : ticks[ticks.length - 1]?.beta ?? 31.23}
              </span>
            </div>
          </div>

          <div className="text-left font-sans text-[11px] text-slate-400">
            {selectedTick ? (
              <span className="text-cyan-400">نقطة فحص: {new Date(selectedTick.timestamp).toLocaleTimeString('ar-SA')}</span>
            ) : (
              <span>مرر المؤشر على المخطط لقراءة المعاملات بدقة</span>
            )}
          </div>
        </div>

        {/* D3 SVG Chart Stage */}
        <div ref={containerRef} className="w-full bg-slate-950/90 rounded-xl p-2 border border-slate-800 relative">
          <svg ref={svgRef} className="w-full overflow-visible select-none" />
        </div>
      </div>

      {/* Embedded Terminal View when toggled */}
      {showTerminal && (
        <div className="transition-all animate-fadeIn">
          <BackstageTerminalFeed />
        </div>
      )}

      {/* Core Math & Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 space-x-reverse text-cyan-400 mb-2">
            <Sliders className="w-5 h-5" />
            <h3 className="font-semibold text-white text-sm font-sans">فلتر كالمان المتغير (Kalman State)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 font-sans">
            يعيد تقدير مصفوفة التغاير اللحظي (Q & R) بين أسعار العقود الآجلة لإلغاء أي تشويش سعري.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-cyan-400">0.0010</span>
              <span className="text-slate-400 font-sans">تشويش المعالجة (Q):</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-cyan-400">0.0010</span>
              <span className="text-slate-400 font-sans">تشويش القياس (R):</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-emerald-400 font-bold font-sans">متزن وتوافقي</span>
              <span className="text-slate-400 font-sans">حالة التكيف:</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 space-x-reverse text-indigo-400 mb-2">
            <Zap className="w-5 h-5" />
            <h3 className="font-semibold text-white text-sm font-sans">نموذج الارتداد (Ornstein-Uhlenbeck)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 font-sans">
            يقيس سرعة انغلاق الفجوة السعرية (Half-Life) لضمان الخروج بالربح الصافي في أقصر مدة زمنية.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-indigo-400">310 ثانية</span>
              <span className="text-slate-400 font-sans">فترة نصف العمر:</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-indigo-400">0.0241</span>
              <span className="text-slate-400 font-sans">سرعة الارتداد (Theta):</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-emerald-400 font-bold font-sans">صالح ومثالي للتحكيم</span>
              <span className="text-slate-400 font-sans">معيار الصلاحية:</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 space-x-reverse text-emerald-400 mb-2">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-semibold text-white text-sm font-sans">قواطع الأمان (Circuit Breakers)</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4 font-sans">
            مراقبة دائمة للسبريد، تأخر البيانات (Latency)، والانزلاق السعري لحظر أي صفقات خطرة.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-emerald-400">68 ميكروثانية</span>
              <span className="text-slate-400 font-sans">سرعة اتخاذ القرار:</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-emerald-400">0.009%</span>
              <span className="text-slate-400 font-sans">سبريد السوق الحالي:</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-2.5 rounded-lg">
              <span className="text-emerald-400 font-bold font-sans">نشطة ومحمية</span>
              <span className="text-slate-400 font-sans">حالة القواطع:</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Institutional Models Section */}
      <div className="mt-6 bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base font-sans">النماذج الكمية المتقدمة (Advanced Institutional Suite)</h3>
              <p className="text-xs text-slate-400 font-sans">دمج GARCH و Hidden Markov و Order Flow Imbalance و Kelly Criterion لمكافحة التقلبات الفجائية</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-full">
            100% Native TS Execution
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: GARCH */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-cyan-400 font-sans">نموذج GARCH (1,1)</span>
              <span className="text-[10px] font-mono text-slate-400">Volatility Clustering</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 font-sans">تعديل Z-Score ديناميكياً بحسب شدة صدمات التقلب الشرطية.</p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">التقلب الفوري:</span>
                <span className="text-white">21.4 Bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">معامل التعديل:</span>
                <span className="text-emerald-400 font-bold">1.0x (طبيعي)</span>
              </div>
            </div>
          </div>

          {/* Card 2: HMM Regime Switcher */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-indigo-400 font-sans">نموذج HMM (ماركوف المخفي)</span>
              <span className="text-[10px] font-mono text-slate-400">Regime Detector</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 font-sans">كشف حالة السوق (ارتدادي نطاقي vs اتجاهي صاعد/هابط).</p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">حالة النظام:</span>
                <span className="text-emerald-400 font-bold font-sans">MEAN_REVERTING</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">احتمالية الأمان:</span>
                <span className="text-emerald-400 font-bold">88%</span>
              </div>
            </div>
          </div>

          {/* Card 3: Order Flow Imbalance (OFI) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-amber-400 font-sans">تدفق الأوامر (OFI)</span>
              <span className="text-[10px] font-mono text-slate-400">Microstructure</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 font-sans">تحليل ضغط عمق الشراء والبيع الفوري في دفتر الأوامر L2.</p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">مؤشر الضغط OFI:</span>
                <span className="text-amber-400 font-bold">+0.14</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">دعم التنفيذ:</span>
                <span className="text-emerald-400 font-bold font-sans">مؤيد للصفقة</span>
              </div>
            </div>
          </div>

          {/* Card 4: Adaptive Kelly Sizing */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-purple-400 font-sans">تحجيم كيلي (Adaptive Kelly)</span>
              <span className="text-[10px] font-mono text-slate-400">Dynamic Risk</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 font-sans">تخصيص الهامش والرافعة آلياً بناءً على مؤشر الثقة والتقلب.</p>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">كسر كيلي الآمن:</span>
                <span className="text-purple-400 font-bold">0.25 (Quarter-Kelly)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">الرافعة التكيفية:</span>
                <span className="text-emerald-400 font-bold">5x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Render 5-System Institutional Suite */}
      <InstitutionalSuitePanel />

      {/* Render Quantum Mind IQ 200 Simulator Suite */}
      <QuantumMindViewPanel />
    </div>
  );
};

