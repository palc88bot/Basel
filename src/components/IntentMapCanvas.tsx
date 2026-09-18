import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'motion/react';
import { Compass, Sparkles, Target, Zap, MousePointer, ShieldCheck, Activity } from 'lucide-react';

export interface CandidateCoinNode extends d3.SimulationNodeDatum {
  id: string;
  symbol: string;
  fitnessScore: number; // 0 to 100
  zScore: number;
  halfLifeSec: number;
  isBotCore?: boolean;
  color?: string;
  radius?: number;
}

interface IntentMapCanvasProps {
  candidates?: Array<{
    symbol: string;
    score: number;
    zScore: number;
    halfLife: number;
  }>;
  volatility?: number;
  botRunning: boolean;
  onSelectCoin?: (symbol: string) => void;
}

export const IntentMapCanvas: React.FC<IntentMapCanvasProps> = ({
  candidates = [],
  volatility = 0.08,
  botRunning,
  onSelectCoin
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<CandidateCoinNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<CandidateCoinNode | null>(null);
  const [gestureActive, setGestureActive] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Prepare default candidate nodes if none provided
  const coinDataList = candidates.length > 0 ? candidates : [
    { symbol: 'ETHUSDT', score: 92, zScore: 2.4, halfLife: 45 },
    { symbol: 'SOLUSDT', score: 88, zScore: 2.1, halfLife: 52 },
    { symbol: 'AVAXUSDT', score: 78, zScore: 1.8, halfLife: 60 },
    { symbol: 'LINKUSDT', score: 85, zScore: 2.2, halfLife: 40 },
    { symbol: 'NEARUSDT', score: 74, zScore: 1.5, halfLife: 75 },
    { symbol: 'SUIUSDT', score: 81, zScore: 1.9, halfLife: 48 },
    { symbol: 'APTUSDT', score: 68, zScore: 1.2, halfLife: 90 },
    { symbol: 'BNBUSDT', score: 79, zScore: 1.7, halfLife: 55 }
  ];

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 400;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear canvas for re-render

    // Construct Node Dataset with Bot Core at Center
    const botCoreNode: CandidateCoinNode = {
      id: 'BOT_CORE',
      symbol: 'عقل البوت',
      fitnessScore: 100,
      zScore: 0,
      halfLifeSec: 0,
      isBotCore: true,
      x: width / 2,
      y: height / 2,
      fx: width / 2, // Fixed at center
      fy: height / 2,
      radius: 36,
      color: '#10b981'
    };

    const coinNodes: CandidateCoinNode[] = coinDataList.map((c, i) => {
      // High fitness score = closer attraction to Bot Core
      const angle = (i / coinDataList.length) * Math.PI * 2;
      const dist = Math.max(80, 220 - c.score * 1.5);
      return {
        id: c.symbol,
        symbol: c.symbol.replace('USDT', ''),
        fitnessScore: c.score,
        zScore: c.zScore,
        halfLifeSec: c.halfLife,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        radius: Math.max(14, Math.min(26, c.score / 4)),
        color: c.score >= 85 ? '#f59e0b' : c.score >= 75 ? '#06b6d4' : '#6366f1'
      };
    });

    const allNodes = [botCoreNode, ...coinNodes];

    // Links connecting candidate coins to Bot Core with attractive forces
    const links = coinNodes.map((n) => ({
      source: 'BOT_CORE',
      target: n.id,
      strength: n.fitnessScore / 100
    }));

    // Define D3 Force Simulation
    const simulation = d3
      .forceSimulation<CandidateCoinNode>(allNodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance((d: any) => Math.max(70, 240 - d.strength * 160))
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => (d.radius || 20) + 10));

    // SVG Defs for Glowing Filters and Gradients
    const defs = svg.append('defs');

    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Draw Attract Vector Links
    const linkGroup = svg.append('g').attr('class', 'links');
    const linkElements = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => (d.strength >= 0.85 ? '#f59e0b' : '#0284c7'))
      .attr('stroke-opacity', (d: any) => 0.2 + d.strength * 0.5)
      .attr('stroke-width', (d: any) => 1 + d.strength * 2.5)
      .attr('stroke-dasharray', '4, 4');

    // Node Group
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    const nodeElements = nodeGroup
      .selectAll('g')
      .data(allNodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, CandidateCoinNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            if (!d.isBotCore) {
              d.fx = d.x;
              d.fy = d.y;
            }
          })
          .on('drag', (event, d) => {
            if (!d.isBotCore) {
              d.fx = event.x;
              d.fy = event.y;
            }
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (!d.isBotCore) {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Node Glowing Circles
    nodeElements
      .append('circle')
      .attr('r', (d) => d.radius || 20)
      .attr('fill', (d) => (d.isBotCore ? 'url(#botCoreGradient)' : d.color || '#3b82f6'))
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d) => (d.isBotCore ? '#10b981' : '#ffffff'))
      .attr('stroke-width', (d) => (d.isBotCore ? 3 : 1.5))
      .attr('filter', 'url(#glow)');

    // Bot Core Gradient
    const gradient = defs
      .append('radialGradient')
      .attr('id', 'botCoreGradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#34d399');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#059669');

    // Node Labels
    nodeElements
      .append('text')
      .text((d) => d.symbol)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#ffffff')
      .attr('font-size', (d) => (d.isBotCore ? '11px' : '10px'))
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif')
      .attr('pointer-events', 'none');

    // Node Interaction Events
    nodeElements.on('mouseover', (event, d) => {
      setHoveredNode(d);
      if (!d.isBotCore) setGestureActive(true);
    });

    nodeElements.on('mouseout', () => {
      setHoveredNode(null);
      setGestureActive(false);
    });

    nodeElements.on('click', (event, d) => {
      if (!d.isBotCore) {
        setSelectedNode(d);
        onSelectCoin?.(`${d.id}`);
      }
    });

    // Simulation Tick Update
    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeElements.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [coinDataList]);

  // Handle Mouse / Touch Proximity Gesture Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-right font-sans space-y-4 relative overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <Compass className="w-6 h-6 animate-spin" style={{ animationDuration: '20s' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 space-x-reverse">
              <span>خريطة النوايا والجاذبية الكمية (Intent Map)</span>
              <span className="text-[10px] px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full font-mono">
                d3.js Particle Physics
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              تتحرك العملات المرشحة كجسيمات حية تنجذب آلياً لنواة البوت بحسب قوة فرصة التحكيم الإحصائي.
            </p>
          </div>
        </div>

        {/* Proximity Gesture Indicator Badge */}
        <div className={`px-3 py-1.5 rounded-2xl border text-xs font-semibold flex items-center space-x-2 space-x-reverse transition-all ${
          gestureActive ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/20' : 'bg-slate-950 border-slate-800 text-slate-400'
        }`}>
          <MousePointer className="w-3.5 h-3.5 text-amber-400" />
          <span>{gestureActive ? 'استشعار إيماءات التفاعل الحرة' : 'حرك الماوس بالقرب من العملات لمشاهدة الانجذاب'}</span>
        </div>
      </div>

      {/* D3 Simulation Interactive Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePos(null)}
        className="relative w-full h-[380px] bg-slate-950/90 rounded-2xl border border-slate-800/80 overflow-hidden flex items-center justify-center cursor-crosshair"
      >
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* D3 SVG Canvas */}
        <svg ref={svgRef} className="w-full h-full relative z-10" />

        {/* Selected Coin Inspector Floating Card */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700/80 p-4 rounded-2xl shadow-2xl backdrop-blur-md text-right z-20 max-w-xs space-y-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white text-sm flex items-center space-x-1.5 space-x-reverse">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>{selectedNode.symbol}USDT</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                درجة الجاذبية: {selectedNode.fitnessScore}%
              </span>
            </div>

            <div className="text-xs text-slate-300 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">حالة التحكيم:</span>
                <span className="text-emerald-400 font-bold">جاهزة للقنص</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">سرعة الارتداد:</span>
                <span className="text-cyan-300">{selectedNode.halfLifeSec} ثانية</span>
              </div>
            </div>

            <button
              onClick={() => {
                onSelectCoin?.(`${selectedNode.id}`);
                setSelectedNode(null);
              }}
              className="w-full mt-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 font-bold py-1.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-1 space-x-reverse shadow-md shadow-cyan-600/20"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>تركيز البوت على هذه العملة</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
