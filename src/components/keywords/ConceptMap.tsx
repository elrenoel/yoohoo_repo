"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

export type ConceptNode = { id: string; term: string; snippet: string | null };
export type ConceptEdge = { from: string; to: string; type: string };

type Props = {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
};

export default function ConceptMap({ nodes, edges, selected, onToggle }: Props) {
  const [activeId, setActiveId] = useState<string | null>(nodes[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const degree = useMemo(() => {
    const result = new Map<string, number>();
    for (const edge of edges) {
      result.set(edge.from, (result.get(edge.from) ?? 0) + 1);
      result.set(edge.to, (result.get(edge.to) ?? 0) + 1);
    }
    return result;
  }, [edges]);
  const connectedOnly = nodes.length > 80;
  const visibleNodes = useMemo(() => connectedOnly ? nodes.filter(node => (degree.get(node.id) ?? 0) > 0) : nodes, [connectedOnly, degree, nodes]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
  const visibleEdges = edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const positions = useMemo(() => {
    const centerX = 380, centerY = 255;
    const points = visibleNodes.map((node, index) => {
      const angle = (index / Math.max(visibleNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return { id: node.id, x: centerX + Math.cos(angle) * 150, y: centerY + Math.sin(angle) * 150, size: 7 + Math.min(14, degree.get(node.id) ?? 0) };
    });
    const byId = new Map(points.map(point => [point.id, point]));
    for (let iteration = 0; iteration < 55; iteration += 1) {
      const forces = points.map(() => ({ x: 0, y: 0 }));
      for (let left = 0; left < points.length; left += 1) {
        for (let right = left + 1; right < points.length; right += 1) {
          const dx = points[right].x - points[left].x, dy = points[right].y - points[left].y;
          const distance = Math.max(12, Math.hypot(dx, dy));
          const repulsion = 1500 / (distance * distance);
          forces[left].x -= (dx / distance) * repulsion; forces[left].y -= (dy / distance) * repulsion;
          forces[right].x += (dx / distance) * repulsion; forces[right].y += (dy / distance) * repulsion;
        }
      }
      for (const edge of visibleEdges) {
        const from = byId.get(edge.from), to = byId.get(edge.to);
        if (!from || !to) continue;
        const fromIndex = points.indexOf(from), toIndex = points.indexOf(to);
        const dx = to.x - from.x, dy = to.y - from.y, distance = Math.max(1, Math.hypot(dx, dy));
        const spring = (distance - 105) * 0.008;
        forces[fromIndex].x += (dx / distance) * spring; forces[fromIndex].y += (dy / distance) * spring;
        forces[toIndex].x -= (dx / distance) * spring; forces[toIndex].y -= (dy / distance) * spring;
      }
      points.forEach((point, index) => { point.x = Math.max(30, Math.min(730, point.x + forces[index].x)); point.y = Math.max(30, Math.min(490, point.y + forces[index].y)); });
    }
    return new Map(points.map(point => [point.id, point]));
  }, [degree, visibleEdges, visibleNodes]);
  const activeNode = nodes.find(node => node.id === activeId) ?? null;
  const filteredList = nodes.filter(node => !search.trim() || node.term.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID")));

  if (!nodes.length) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">Belum ada keyword untuk dibuat menjadi peta konsep.</div>;
  }

  return (
    <div className="space-y-4">
      {edges.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Konsep di materi ini belum banyak yang saling terkait. Kamu bisa beralih ke mode Kartu Hafalan.</div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <svg viewBox="0 0 760 520" className="h-[420px] w-full bg-[#fbfdfb] sm:h-[520px]" role="img" aria-label="Peta hubungan antar keyword">
            {visibleEdges.map((edge, index) => {
              const from = positions.get(edge.from), to = positions.get(edge.to);
              if (!from || !to) return null;
              const semantic = edge.type === "semantic";
              return <line key={`${edge.from}-${edge.to}-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={edge.type === "mentioned" ? "#0f766e" : semantic ? "#c084fc" : "#cbd5e1"}
                strokeWidth={edge.type === "mentioned" ? 2.5 : semantic ? 2 : 1.5}
                strokeDasharray={edge.type === "co_occurs" || semantic ? "5 4" : undefined} />;
            })}
            {visibleNodes.map(node => {
              const point = positions.get(node.id);
              if (!point) return null;
              const isActive = activeId === node.id;
              const isSelected = selected.has(node.id);
              return <g key={node.id} transform={`translate(${point.x},${point.y})`} className="cursor-pointer" onClick={() => setActiveId(node.id)} role="button" aria-label={`Pilih ${node.term}`}>
                <circle r={point.size + (isActive ? 4 : 0)} fill={isSelected ? "#84cc16" : isActive ? "#0f766e" : "#d1fae5"} stroke={isActive ? "#064e3b" : "#0f766e"} strokeWidth={isActive ? 3 : 1.5} />
                <text y={point.size + 18} textAnchor="middle" className="fill-neutral-700 text-[11px]">{node.term.length > 19 ? `${node.term.slice(0, 18)}…` : node.term}</text>
              </g>;
            })}
          </svg>
          <div className="flex flex-wrap gap-3 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 bg-teal-700" /> disebutkan</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 border-t border-dashed border-neutral-400" /> muncul berdekatan</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 border-t border-dashed border-purple-400" /> hubungan makna</span>
          </div>
          {connectedOnly && <p className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500">Node terisolasi disembunyikan dari graf utama karena keyword sangat banyak. Gunakan pencarian di panel.</p>}
        </div>

        <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari keyword..." className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
          </label>
          {activeNode ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-sm font-semibold text-neutral-900">{activeNode.term}</p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-600">{activeNode.snippet || "Snippet belum tersedia."}</p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-800">
              <input type="checkbox" checked={selected.has(activeNode.id)} onChange={event => onToggle(activeNode.id, event.target.checked)} className="h-4 w-4 accent-emerald-700" />
              Pilih untuk dibuatkan flashcard
            </label>
          </div> : <p className="mt-4 text-xs text-neutral-500">Klik node untuk melihat penjelasan.</p>}
          <div className="mt-4 max-h-52 space-y-1 overflow-y-auto border-t border-neutral-100 pt-3">
            {filteredList.map(node => <button key={node.id} type="button" onClick={() => setActiveId(node.id)} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${activeId === node.id ? "bg-emerald-50 text-emerald-900" : "hover:bg-neutral-50"}`}>
              <span className="truncate">{node.term}</span>{selected.has(node.id) && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" />}
            </button>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
