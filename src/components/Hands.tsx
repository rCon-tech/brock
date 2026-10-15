import type { Throw } from '@/lib/game';

const INK = '#17120d';
const NAIL = '#fffaf0';

/** Skin, shade and cuff colours come from the --skin-c / --shade-c / --cuff-c of whoever uses them. */
const skin = { fill: 'var(--skin-c)' } as const;
const shade = { stroke: 'var(--shade-c)' } as const;
const cuff = { fill: 'var(--cuff-c)' } as const;

/**
 * The comic hand drawings, defined once per page and drawn with <Hand>. Every hand points right
 * from the wrist; the House's side mirrors them.
 */
export function HandDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <g id="hand-arm">
          <path
            d="M-6 72 L104 62 L104 122 L-6 116 Z"
            style={skin}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M-6 70 L30 67 L30 119 L-6 116 Z"
            style={cuff}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path d="M8 69 L8 117" stroke={INK} strokeWidth="3" opacity=".5" />
          <path
            d="M44 108 Q70 112 92 106"
            stroke={INK}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            opacity=".55"
          />
        </g>

        <symbol id="hand-rock" viewBox="0 0 240 160">
          <use href="#hand-arm" />
          <rect
            x="80"
            y="36"
            width="112"
            height="98"
            rx="32"
            style={skin}
            stroke={INK}
            strokeWidth="5"
          />
          <path
            d="M92 118 Q140 136 186 116"
            style={shade}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            opacity=".9"
          />
          <g stroke={INK} strokeWidth="5" style={skin}>
            <rect x="150" y="104" width="56" height="26" rx="13" />
            <rect x="152" y="81" width="60" height="26" rx="13" />
            <rect x="152" y="58" width="60" height="26" rx="13" />
            <rect x="148" y="36" width="58" height="26" rx="13" />
          </g>
          <path
            d="M178 44 l5 6M190 66 l5 5M190 89 l5 5M184 112 l5 5"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".7"
          />
          <rect
            x="100"
            y="70"
            width="78"
            height="26"
            rx="13"
            transform="rotate(-6 100 70)"
            style={skin}
            stroke={INK}
            strokeWidth="5"
          />
          <rect
            x="160"
            y="70"
            width="15"
            height="13"
            rx="5"
            transform="rotate(-6 100 70)"
            fill={NAIL}
            stroke={INK}
            strokeWidth="3"
          />
        </symbol>

        <symbol id="hand-paper" viewBox="0 0 240 160">
          <use href="#hand-arm" />
          <rect
            x="80"
            y="40"
            width="84"
            height="94"
            rx="28"
            style={skin}
            stroke={INK}
            strokeWidth="5"
          />
          <g stroke={INK} strokeWidth="5" style={skin}>
            <rect x="134" y="104" width="86" height="21" rx="10.5" />
            <rect x="134" y="83" width="98" height="21" rx="10.5" />
            <rect x="134" y="62" width="100" height="21" rx="10.5" />
            <rect x="134" y="41" width="92" height="21" rx="10.5" />
          </g>
          <g fill={NAIL} stroke={INK} strokeWidth="3">
            <rect x="201" y="108" width="14" height="13" rx="4" />
            <rect x="213" y="87" width="14" height="13" rx="4" />
            <rect x="215" y="66" width="14" height="13" rx="4" />
            <rect x="207" y="45" width="14" height="13" rx="4" />
          </g>
          <path
            d="M168 47 v8M172 68 v8M170 89 v8M166 110 v8"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".6"
          />
          <path
            d="M96 128 Q140 140 170 126"
            style={shade}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            opacity=".85"
          />
          <rect
            x="96"
            y="116"
            width="74"
            height="22"
            rx="11"
            transform="rotate(12 96 116)"
            style={skin}
            stroke={INK}
            strokeWidth="5"
          />
        </symbol>

        <symbol id="hand-scissors" viewBox="0 0 240 160">
          <use href="#hand-arm" />
          <rect
            x="80"
            y="42"
            width="88"
            height="90"
            rx="30"
            style={skin}
            stroke={INK}
            strokeWidth="5"
          />
          <path
            d="M92 120 Q130 134 164 120"
            style={shade}
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
            opacity=".85"
          />
          <g stroke={INK} strokeWidth="5" style={skin}>
            <rect x="140" y="104" width="46" height="24" rx="12" />
            <rect x="142" y="84" width="50" height="24" rx="12" />
          </g>
          <g transform="rotate(12 140 74)">
            <rect
              x="136"
              y="64"
              width="102"
              height="21"
              rx="10.5"
              style={skin}
              stroke={INK}
              strokeWidth="5"
            />
            <rect
              x="219"
              y="68"
              width="14"
              height="13"
              rx="4"
              fill={NAIL}
              stroke={INK}
              strokeWidth="3"
            />
          </g>
          <g transform="rotate(-17 140 62)">
            <rect
              x="136"
              y="51"
              width="100"
              height="21"
              rx="10.5"
              style={skin}
              stroke={INK}
              strokeWidth="5"
            />
            <rect
              x="217"
              y="55"
              width="14"
              height="13"
              rx="4"
              fill={NAIL}
              stroke={INK}
              strokeWidth="3"
            />
            <path
              d="M176 56 v8"
              stroke={INK}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity=".6"
            />
          </g>
          <rect
            x="102"
            y="82"
            width="70"
            height="24"
            rx="12"
            transform="rotate(-5 102 82)"
            style={skin}
            stroke={INK}
            strokeWidth="5"
          />
          <rect
            x="156"
            y="84"
            width="14"
            height="12"
            rx="4"
            transform="rotate(-5 102 82)"
            fill={NAIL}
            stroke={INK}
            strokeWidth="3"
          />
        </symbol>

        <symbol id="win-burst" viewBox="-100 -100 200 200">
          <polygon
            fill={NAIL}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
            points="0,-96 16,-40 62,-74 40,-22 96,-20 46,8 84,52 28,36 22,94 -6,44 -46,86 -36,30 -94,34 -48,2 -90,-36 -36,-28 -54,-82 -12,-42"
          />
        </symbol>
      </defs>
    </svg>
  );
}

/** One hand. Needs <HandDefs> somewhere on the page (the root layout renders it). */
export function Hand({ shape, className }: { shape: Throw; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 160" aria-hidden="true" focusable="false">
      <use href={`#hand-${shape}`} />
    </svg>
  );
}
