type GangsterType = "civilian" | "rookie" | "captain" | "boss" | "legend";

const designs: Record<GangsterType, { skin: string; jacket: string; accent: string; hat: string; label: string }> = {
  civilian: { skin: "#b98262", jacket: "#334155", accent: "#94a3b8", hat: "#475569", label: "CV" },
  rookie: { skin: "#b57653", jacket: "#1b1c20", accent: "#d7a544", hat: "#111216", label: "R" },
  captain: { skin: "#9a6043", jacket: "#171a1f", accent: "#c8953c", hat: "#0e1014", label: "C" },
  boss: { skin: "#c48864", jacket: "#202126", accent: "#e0b75e", hat: "#252329", label: "B" },
  legend: { skin: "#824a31", jacket: "#16151a", accent: "#d4a340", hat: "#100e12", label: "L" },
};

export function PixelGangster({ type, className = "" }: { type: GangsterType; className?: string }) {
  const d = designs[type];
  const isBoss = type === "boss";
  const isLegend = type === "legend";
  const isCivilian = type === "civilian";
  return (
    <svg viewBox="0 0 160 180" role="img" aria-label={`${type} gangster`} className={className} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="8" width="130" height="164" rx="6" fill="#101420" />
      <path d="M15 130 45 104l17 14 23-28 23 22 37-34v94H15Z" fill="#17213a" />
      <path d="M20 24h17v60H20zM123 18h20v70h-20z" fill={d.jacket} opacity=".3" />
      <path d="M20 34h17M123 28h20" stroke={d.accent} strokeWidth="5" />
      {isLegend && <><rect x="23" y="32" width="13" height="13" fill="#f7c846" /><rect x="126" y="38" width="10" height="10" fill="#f7c846" /></>}
      {(type === "captain" || isLegend) && <path d="M43 112 51 74h58l10 38-15 15H56l-13-15Z" fill="#0b0c10" stroke="#080b12" strokeWidth="5" />}
      <path d="M43 159h74l-7-51H50l-7 51Z" fill={d.jacket} stroke="#080b12" strokeWidth="5" />
      <path d="M54 112h52l-8 47H62l-8-47Z" fill="#161a23" opacity=".58" />
      <path d="M62 107h36l-4 30H66l-4-30Z" fill="#f1eee5" stroke="#080b12" strokeWidth="4" />
      <path d="M74 116h12l5 23H69l5-23Z" fill={d.accent} stroke="#080b12" strokeWidth="3" />
      <path d="M53 103 42 125 28 117 39 88Z" fill={d.jacket} stroke="#080b12" strokeWidth="5" />
      <path d="M107 103 120 127 133 116 121 88Z" fill={d.jacket} stroke="#080b12" strokeWidth="5" />
      <rect x="30" y="111" width="16" height="18" fill={d.skin} stroke="#080b12" strokeWidth="4" />
      {type === "rookie" && <><path d="M19 102h26v10H19z" fill="#252b36" stroke="#080b12" strokeWidth="4" /><path d="M24 95h17v8H24z" fill="#f4c95d" /></>}
      {isCivilian && <><rect x="26" y="104" width="20" height="15" rx="3" fill="#64748b" stroke="#080b12" strokeWidth="4" /><path d="M31 109h10M31 114h7" stroke="#e2e8f0" strokeWidth="2" /></>}
      {type === "captain" && <><path d="M115 101h26v10h-26z" fill="#252b36" stroke="#080b12" strokeWidth="4" /><path d="M119 94h17v8h-17z" fill="#bdeef0" /></>}
      {isBoss && <><path d="M117 103h24v10h-24z" fill="#b99249" stroke="#080b12" strokeWidth="4" /><path d="M122 95h12v8h-12z" fill="#efd477" /></>}
      {isLegend && <><path d="M118 101h22v11h-22z" fill="#dc3c58" stroke="#080b12" strokeWidth="4" /><path d="M123 93h12v8h-12z" fill="#fa8d9d" /></>}
      <path d="M54 48h52v48l-10 14H64L54 96V48Z" fill={d.skin} stroke="#080b12" strokeWidth="5" />
      <path d="M64 82h32l-7 12H71l-7-12Z" fill="#f3f3ec" stroke="#080b12" strokeWidth="3" />
      <rect x="64" y="68" width="8" height="7" fill="#080b12" /><rect x="89" y="68" width="8" height="7" fill="#080b12" />
      <path d="M73 61h12M88 61h10" stroke="#080b12" strokeWidth="4" />
      <path d="M79 77h7" stroke="#a54f40" strokeWidth="3" />
      <path d="M58 78h44v20H58z" fill="#121216" stroke="#080b12" strokeWidth="3" />
      <path d="M63 84h8m4 0h8m4 0h8" stroke={d.accent} strokeWidth="2" opacity=".8" />
      {isCivilian
        ? <><path d="M51 47h58V32H51z" fill={d.hat} stroke="#080b12" strokeWidth="5" /><path d="M57 33h45V23H57z" fill={d.hat} stroke="#080b12" strokeWidth="5" /></>
        : isBoss ? <><path d="M40 48h80l-9-14H49l-9 14Z" fill={d.hat} stroke="#080b12" strokeWidth="5" /><path d="M54 33h52V18H54z" fill={d.hat} stroke="#080b12" strokeWidth="5" /><path d="M55 43h50" stroke={d.accent} strokeWidth="5" /></> : <><path d="M49 48h62V34H49z" fill={d.hat} stroke="#080b12" strokeWidth="5" /><path d="M57 35h45V20H57z" fill={d.hat} stroke="#080b12" strokeWidth="5" /><path d="M48 48h66" stroke={d.accent} strokeWidth="5" /></>}
      {type === "captain" && <path d="M68 37h30" stroke="#7ef0ea" strokeWidth="4" />}
      {isLegend && <path d="M56 28h45" stroke="#ed79e9" strokeWidth="4" />}
      <rect x="66" y="140" width="28" height="8" fill={d.accent} stroke="#080b12" strokeWidth="3" />
      <text x="80" y="147" textAnchor="middle" fontFamily="monospace" fontSize="7" fontWeight="700" fill="#111521" stroke="none">{d.label}</text>
      <path d="M41 160h29v9H36l5-9ZM91 160h29l5 9H90l1-9Z" fill="#080b12" />
      <path d="M18 173h124" stroke={d.accent} strokeWidth="3" opacity=".9" />
      <path d="M20 172 33 159M127 171l12-12" stroke="#b9322c" strokeWidth="2" opacity=".8" />
    </svg>
  );
}
