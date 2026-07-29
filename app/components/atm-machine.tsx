type AtmMachineProps = {
  tier?: "low" | "medium" | "high" | "very-high";
  className?: string;
};

const palettes = {
  low: { body: "#4b4b50", light: "#808087", dark: "#24242a", side: "#17171c" },
  medium: { body: "#38483d", light: "#69806b", dark: "#202b23", side: "#151d18" },
  high: { body: "#303743", light: "#5e6877", dark: "#1c2129", side: "#13171e" },
  "very-high": { body: "#625124", light: "#a48948", dark: "#362c17", side: "#211b10" },
};

export function AtmMachine({ tier = "medium", className = "" }: AtmMachineProps) {
  const color = palettes[tier];
  const keys = [
    ["#f6f7f8", "#f6f7f8", "#f6f7f8"],
    ["#f6f7f8", "#f6f7f8", "#f6f7f8"],
    ["#f6f7f8", "#f6f7f8", "#f6f7f8"],
  ];

  return (
    <svg viewBox="0 0 280 340" role="img" aria-label={`${tier} hoodATM machine`} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`cabinet-${tier}`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor={color.light} /><stop offset="0.45" stopColor={color.body} /><stop offset="1" stopColor={color.dark} />
        </linearGradient>
        <linearGradient id={`screen-${tier}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#4d100e" /><stop offset="1" stopColor="#120506" /></linearGradient>
        <filter id={`shadow-${tier}`} x="-20%" y="-10%" width="150%" height="130%"><feDropShadow dx="7" dy="10" stdDeviation="4" floodOpacity="0.38" /></filter>
      </defs>
      <g filter={`url(#shadow-${tier})`} stroke="#151b21" strokeWidth="4" strokeLinejoin="round">
        <path d="M38 34 211 34 250 57 250 299 221 319 40 312 22 297 22 77Z" fill="none" stroke="#c99a45" strokeWidth="2" opacity=".9" />
        <path d="M42 38 208 38 245 59 245 296 219 315 43 308 27 294 27 80Z" fill={color.side} />
        <path d="M42 38 208 38 225 51 211 58 44 58 32 78Z" fill={color.light} />
        <path d="M32 78 44 58 211 58 219 72 219 294 200 305 43 300 32 287Z" fill={`url(#cabinet-${tier})`} />
        <path d="M44 58 211 58 202 196 32 196Z" fill={color.dark} />
        <path d="M52 68 201 68 192 185 42 185Z" fill="#252d33" />
        <path d="M64 80 188 80 182 154 56 154Z" fill="#080d0f" />
        <path d="M73 89 178 89 173 145 67 145Z" fill={`url(#screen-${tier})`} stroke="#050807" />
        <path d="M108 76h36" stroke="#d9a13e" strokeWidth="3" strokeLinecap="round" />
        <text x="123" y="111" fill="#ff655b" fontFamily="monospace" fontSize="12" fontWeight="700" textAnchor="middle" stroke="none">HOOD ATM</text>
        <text x="123" y="126" fill="#f2bf64" fontFamily="monospace" fontSize="7" fontWeight="700" textAnchor="middle" stroke="none">CASH ON THE BLOCK</text>
        <path d="M116 132h14v9h-14z" fill="#e33d32" stroke="none" /><path d="M120 135h6v6" fill="none" stroke="#2b0607" strokeWidth="1.5" />
        {[95, 116, 137, 158].map((y) => <g key={y}><rect x="49" y={y} width="8" height="8" rx="1" fill="#e13a32" /><rect x="188" y={y} width="8" height="8" rx="1" fill="#e13a32" /></g>)}
        <path d="M42 185 192 185 204 207 31 207Z" fill={color.light} />
        <path d="M39 207 204 207 204 237 36 237Z" fill={color.body} />
        <g>{keys.map((row, rowIndex) => row.map((key, keyIndex) => <rect key={`${rowIndex}-${keyIndex}`} x={58 + keyIndex * 18} y={211 + rowIndex * 12} width="14" height="8" rx="1.5" fill={key} />))}</g>
        <rect x="112" y="211" width="14" height="8" rx="1.5" fill="#f34a35" /><rect x="112" y="223" width="14" height="8" rx="1.5" fill="#ffb51c" /><rect x="112" y="235" width="14" height="8" rx="1.5" fill="#4de06f" />
        <path d="M145 207h42l-7 36h-42z" fill={color.dark} /><text x="165" y="216" fill="#d6ab50" fontFamily="sans-serif" fontSize="7" fontWeight="700" textAnchor="middle" stroke="none">CARD</text><path d="M151 224h27v10h-27z" fill="#070b0d" /><path d="M154 226h21" stroke="#e9bc5d" strokeWidth="2" />
        <path d="M36 237h168v60l-14 8H48l-12-10Z" fill={color.body} />
        <path d="M69 251h89v28H69z" fill="#1d2429" /><path d="M76 258h75v14H76z" fill="#060a0c" /><path d="M80 261h67" stroke="#3c444b" strokeWidth="2" /><text x="113" y="256" fill="#e7edf0" fontFamily="sans-serif" fontSize="7" fontWeight="700" textAnchor="middle" stroke="none">CASH</text>
        <text x="118" y="294" fill="#e2b75d" fontFamily="Arial, sans-serif" fontSize="21" fontWeight="800" textAnchor="middle" stroke="none">hoodATM</text>
        <path d="M47 70 55 78M179 73l10 10M46 275l10 4" stroke="#d8ad54" strokeWidth="1.5" opacity=".6" />
        <path d="M35 296h169l-14 10H48Z" fill="#141a20" /><path d="M45 306h22v8H48Z M178 306h22v8h-18Z" fill="#141a20" />
      </g>
    </svg>
  );
}
