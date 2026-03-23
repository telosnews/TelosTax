/**
 * TaxSankeyDiagram — SVG Sankey flow diagram showing where income comes
 * from, how it's reduced, what taxes are assessed, and the final result.
 *
 * Uses d3-sankey for layout computation and renders with React SVG.
 * Lazy-loaded via TaxFlowSwitcher to avoid impacting initial bundle.
 */

import { useMemo, useState, useCallback, useId } from 'react';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
} from 'd3-sankey';
import type { SankeyNode as D3SankeyNode, SankeyLink as D3SankeyLink } from 'd3-sankey';
import type { Form1040Result, CalculationResult } from '@telostax/engine';
import { buildSankeyData, type SankeyNode, type SankeyLink } from './sankeyDataTransform';
import { colorForCategory } from './sankeyColors';
import { useSankeyDimensions } from './useSankeyDimensions';
import { useTaxReturnStore } from '../../store/taxReturnStore';

interface TaxSankeyDiagramProps {
  form1040: Form1040Result;
  calculation: CalculationResult;
}

type NodeExtra = SankeyNode;
type LinkExtra = SankeyLink;
type LayoutNode = D3SankeyNode<NodeExtra, LinkExtra>;
type LayoutLink = D3SankeyLink<NodeExtra, LinkExtra>;

function fmtDollars(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

export default function TaxSankeyDiagram({ form1040, calculation }: TaxSankeyDiagramProps) {
  const goToStep = useTaxReturnStore((s) => s.goToStep);
  const gradientId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const data = useMemo(() => buildSankeyData(form1040, calculation), [form1040, calculation]);
  const { ref, width, height } = useSankeyDimensions(data.nodes.length);

  const layout = useMemo(() => {
    if (width < 100) return null;

    const margin = { top: 16, right: 120, bottom: 16, left: 16 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Build d3-sankey input — nodes keyed by id
    const nodeMap = new Map(data.nodes.map((n, i) => [n.id, i]));
    const sankeyNodes: (NodeExtra & { nodeId: number })[] = data.nodes.map((n, i) => ({
      ...n,
      nodeId: i,
    }));
    const sankeyLinks: { source: number; target: number; value: number }[] = data.links
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map(l => ({
        source: nodeMap.get(l.source)!,
        target: nodeMap.get(l.target)!,
        value: Math.max(1, l.value), // d3-sankey requires positive values
      }));

    const generator = d3Sankey<NodeExtra, LinkExtra>()
      .nodeId((d: any) => d.nodeId)
      .nodeAlign(sankeyLeft)
      .nodeWidth(14)
      .nodePadding(16)
      .extent([[margin.left, margin.top], [margin.left + innerWidth, margin.top + innerHeight]]);

    try {
      const graph = generator({
        nodes: sankeyNodes.map(d => ({ ...d })),
        links: sankeyLinks.map(d => ({ ...d })),
      } as any);
      return { graph, margin };
    } catch {
      return null;
    }
  }, [data, width, height]);

  const linkPath = useMemo(() => sankeyLinkHorizontal(), []);

  const handleNodeClick = useCallback((node: LayoutNode) => {
    const extra = node as any as NodeExtra;
    if (extra.stepId) goToStep(extra.stepId);
  }, [goToStep]);

  const handleLinkHover = useCallback((e: React.MouseEvent, link: LayoutLink, entering: boolean) => {
    if (!entering) {
      setHovered(null);
      setTooltip(null);
      return;
    }
    const sourceNode = link.source as LayoutNode;
    const targetNode = link.target as LayoutNode;
    const sourceName = (sourceNode as any).label || (sourceNode as any).id;
    const targetName = (targetNode as any).label || (targetNode as any).id;
    const linkId = `${(sourceNode as any).id}-${(targetNode as any).id}`;
    setHovered(linkId);

    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 12,
        text: `${sourceName} → ${targetName}: ${fmtDollars(link.value as number)}`,
      });
    }
  }, []);

  const handleNodeHover = useCallback((e: React.MouseEvent, node: LayoutNode, entering: boolean) => {
    if (!entering) {
      setTooltip(null);
      return;
    }
    const extra = node as any as NodeExtra;
    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 12,
        text: `${extra.label}: ${fmtDollars(extra.displayValue)}`,
      });
    }
  }, []);

  if (!layout) {
    return <div ref={ref} className="w-full min-h-[400px]" />;
  }

  const { graph } = layout;
  const nodes = (graph.nodes || []) as LayoutNode[];
  const links = (graph.links || []) as LayoutLink[];

  return (
    <div ref={ref} className="w-full relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Sankey diagram showing tax flow from ${fmtDollars(form1040.totalIncome)} total income to ${form1040.refundAmount > 0 ? `${fmtDollars(form1040.refundAmount)} refund` : `${fmtDollars(form1040.amountOwed)} owed`}`}
      >
        <defs>
          {links.map((link, i) => {
            const source = link.source as LayoutNode;
            const target = link.target as LayoutNode;
            const sourceColor = colorForCategory((source as any).colorKey);
            const targetColor = colorForCategory((target as any).colorKey);
            return (
              <linearGradient
                key={i}
                id={`${gradientId}-link-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={source.x1}
                x2={target.x0}
              >
                <stop offset="0%" stopColor={sourceColor} />
                <stop offset="100%" stopColor={targetColor} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Links */}
        <g fill="none">
          {links.map((link, i) => {
            const source = link.source as LayoutNode;
            const target = link.target as LayoutNode;
            const linkId = `${(source as any).id}-${(target as any).id}`;
            const isHovered = hovered === linkId;
            const pathD = linkPath(link as any);
            if (!pathD) return null;

            return (
              <path
                key={i}
                d={pathD}
                stroke={`url(#${gradientId}-link-${i})`}
                strokeWidth={Math.max(1, (link as any).width || 1)}
                strokeOpacity={isHovered ? 0.6 : 0.3}
                style={{ transition: 'stroke-opacity 150ms' }}
                onMouseEnter={(e) => handleLinkHover(e, link, true)}
                onMouseLeave={(e) => handleLinkHover(e, link, false)}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((node) => {
            const extra = node as any as NodeExtra;
            const nodeWidth = (node.x1 ?? 0) - (node.x0 ?? 0);
            const nodeHeight = (node.y1 ?? 0) - (node.y0 ?? 0);
            const color = colorForCategory(extra.colorKey);

            return (
              <g
                key={extra.id}
                style={{ cursor: extra.stepId ? 'pointer' : 'default' }}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={(e) => handleNodeHover(e, node, true)}
                onMouseLeave={(e) => handleNodeHover(e, node, false)}
              >
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={nodeWidth}
                  height={Math.max(nodeHeight, 2)}
                  rx={3}
                  ry={3}
                  fill={color}
                  fillOpacity={0.9}
                />
                <text
                  x={(node.x1 ?? 0) + 8}
                  y={(node.y0 ?? 0) + nodeHeight / 2}
                  dy="0.35em"
                  textAnchor="start"
                  fill="#CBD5E1"
                  fontSize={12}
                  fontFamily="Inter Variable, sans-serif"
                  fontWeight={extra.category === 'intermediate' || extra.category === 'result' ? 600 : 400}
                >
                  {extra.label}
                  <tspan dx={6} fill="#94A3B8" fontSize={11}>
                    {fmtDollars(extra.displayValue)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg text-xs whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1E293B',
            border: '1px solid #475569',
            color: '#E2E8F0',
            fontFamily: 'Inter Variable, sans-serif',
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}

      <p className="text-[11px] text-slate-500 text-center mt-1">
        Click any node to jump to that section
      </p>
    </div>
  );
}
