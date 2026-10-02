"use client";

import { useMemo } from "react";

type Material = { id: string; title: string };
type KeywordNode = { id: string; documentId: string };
type KeywordEdge = { from: string; to: string; type: string };

type Props = {
  deckTitle: string;
  materials: Material[];
  keywordNodes: KeywordNode[];
  keywordEdges: KeywordEdge[];
  activeMaterialId: string | null;
  onSelectMaterial: (id: string) => void;
};

const WIDTH = 760;
const HEIGHT = 390;

function shortTitle(title: string) {
  return title.length > 22 ? `${title.slice(0, 21)}…` : title;
}

export default function DeckMaterialMap({
  deckTitle,
  materials,
  keywordNodes,
  keywordEdges,
  activeMaterialId,
  onSelectMaterial,
}: Props) {
  const visibleMaterials = materials.slice(0, 8);
  const positions = useMemo(() => {
    const radiusX = visibleMaterials.length <= 2 ? 230 : 280;
    const radiusY = visibleMaterials.length <= 2 ? 100 : 142;
    return new Map(visibleMaterials.map((material, index) => {
      const angle = (index / Math.max(visibleMaterials.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return [material.id, {
        x: WIDTH / 2 + Math.cos(angle) * radiusX,
        y: HEIGHT / 2 + Math.sin(angle) * radiusY,
      }];
    }));
  }, [visibleMaterials]);

  const materialRelations = useMemo(() => {
    const documentByKeyword = new Map(keywordNodes.map(node => [node.id, node.documentId]));
    const relationCounts = new Map<string, { from: string; to: string; count: number; semantic: boolean }>();

    for (const edge of keywordEdges) {
      const from = documentByKeyword.get(edge.from);
      const to = documentByKeyword.get(edge.to);
      if (!from || !to || from === to || !positions.has(from) || !positions.has(to)) continue;
      const [left, right] = [from, to].sort();
      const key = `${left}:${right}`;
      const current = relationCounts.get(key) ?? { from: left, to: right, count: 0, semantic: false };
      current.count += 1;
      current.semantic ||= edge.type === "semantic";
      relationCounts.set(key, current);
    }

    return [...relationCounts.values()];
  }, [keywordEdges, keywordNodes, positions]);

  if (!materials.length) {
    return <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-[#B9C4B8] bg-white/40 px-6 text-center text-sm text-[#637067]">Peta akan terbentuk setelah materi ditambahkan ke deck.</div>;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-[#CED6CB] bg-[#F7FAF4]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[320px] w-full sm:h-[390px]" role="img" aria-label="Peta hubungan antar materi">
          <defs>
            <pattern id="deck-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#DCE4D8" />
            </pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#deck-map-grid)" />

          {materialRelations.length > 0 ? materialRelations.map(relation => {
            const from = positions.get(relation.from);
            const to = positions.get(relation.to);
            if (!from || !to) return null;
            return <g key={`${relation.from}-${relation.to}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={relation.semantic ? "#8F7AE6" : "#67A17B"} strokeWidth={Math.min(5, 1.5 + relation.count * 0.45)} strokeDasharray={relation.semantic ? "7 5" : undefined} opacity="0.72" />
              <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="11" fill="#FFFFFF" stroke="#C9D4C7" />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 + 3.5} textAnchor="middle" className="fill-[#526159] text-[9px] font-semibold">{relation.count}</text>
            </g>;
          }) : visibleMaterials.map(material => {
            const point = positions.get(material.id);
            if (!point) return null;
            return <line key={material.id} x1={WIDTH / 2} y1={HEIGHT / 2} x2={point.x} y2={point.y} stroke="#B8C6B7" strokeWidth="1.5" strokeDasharray="6 6" />;
          })}

          <g transform={`translate(${WIDTH / 2},${HEIGHT / 2})`}>
            <circle r="53" fill="#0B4437" />
            <circle r="47" fill="none" stroke="#B8D8A8" strokeWidth="1" strokeDasharray="3 4" />
            <text y="-4" textAnchor="middle" className="fill-[#D8F0C8] text-[10px] font-medium uppercase tracking-widest">deck</text>
            <text y="14" textAnchor="middle" className="fill-white text-[12px] font-semibold">{shortTitle(deckTitle)}</text>
          </g>

          {visibleMaterials.map((material, index) => {
            const point = positions.get(material.id);
            if (!point) return null;
            const active = material.id === activeMaterialId;
            return <g key={material.id} transform={`translate(${point.x},${point.y})`} className="cursor-pointer" role="button" tabIndex={0} aria-label={`Buka keyword ${material.title}`} onClick={() => onSelectMaterial(material.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") onSelectMaterial(material.id); }}>
              <rect x="-76" y="-31" width="152" height="62" rx="16" fill={active ? "#E5F277" : "#FFFFFF"} stroke={active ? "#263E22" : "#BFCBBE"} strokeWidth={active ? "2.5" : "1.5"} />
              <circle cx="-57" cy="-12" r="9" fill={active ? "#163F32" : "#DCEADF"} />
              <text x="-57" y="-8.5" textAnchor="middle" className={active ? "fill-white text-[9px] font-bold" : "fill-[#315C47] text-[9px] font-bold"}>{index + 1}</text>
              <text x="-42" y="-8" className="fill-[#17352C] text-[11px] font-semibold">Materi</text>
              <text x="-57" y="14" className="fill-[#4E5F57] text-[11px]">{shortTitle(material.title)}</text>
            </g>;
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#657269]">
        {materialRelations.length > 0 ? <>
          <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5 bg-[#67A17B]" />Keterkaitan konsep</span>
          <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5 border-t-2 border-dashed border-[#8F7AE6]" />Hubungan semantik</span>
          <span>Angka menunjukkan jumlah relasi keyword.</span>
        </> : <span>Garis putus-putus menunjukkan materi berada dalam deck yang sama; relasi konsep lintas materi belum ditemukan.</span>}
      </div>
      {materials.length > visibleMaterials.length && <p className="mt-2 text-[11px] text-[#657269]">Menampilkan 8 dari {materials.length} materi agar peta tetap terbaca.</p>}
    </div>
  );
}
