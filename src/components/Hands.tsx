import type { Throw } from '@/lib/game';

const INK = '#17120d';
const NAIL = '#fffaf0';

/** Skin, shade and cuff colours come from the --skin-c / --shade-c / --cuff-c of whoever uses them. */
const skin = { fill: 'var(--skin-c)' } as const;
const shade = { stroke: 'var(--shade-c)' } as const;
const cuff = { fill: 'var(--cuff-c)' } as const;
const armor = { fill: 'var(--armor-c)' } as const;
const armorShade = { stroke: 'var(--armor-shade)' } as const;
const GOLD = '#f6d23c';
const STEEL = '#dfe6ec';

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

        {/*
          Armour for the player's forearm, earned every 3 wins in a run. Drawn over the arm only,
          so it fits every throw. Colours come from --armor-c / --armor-shade.
        */}
        <g id="armor-plate">
          <path
            d="M34 65 L100 59 L100 125 L34 121 Z"
            style={armor}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M40 70 L94 65"
            style={armorShade}
            strokeWidth="5"
            strokeLinecap="round"
            opacity=".8"
          />
          <path d="M52 64 L52 122M82 61 L82 124" stroke={INK} strokeWidth="3" opacity=".55" />
          <g fill={GOLD} stroke={INK} strokeWidth="2.5">
            <circle cx="42" cy="75" r="3.5" />
            <circle cx="42" cy="111" r="3.5" />
            <circle cx="92" cy="70" r="3.5" />
            <circle cx="92" cy="114" r="3.5" />
          </g>
        </g>
        <g id="armor-spikes" style={armor} stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M40 68 L46 38 L57 67 Z" />
          <path d="M59 66 L67 32 L76 65 Z" />
          <path d="M78 64 L87 33 L94 63 Z" />
          <path d="M44 121 L51 146 L60 122 Z" />
          <path d="M74 124 L83 148 L90 124 Z" />
        </g>
        <g id="armor-pauldron">
          <path
            d="M-12 62 Q12 52 38 60 L40 126 Q12 132 -12 122 Z"
            style={armor}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M-4 72 Q14 66 30 70M-4 92 Q14 86 32 90M-4 112 Q14 108 32 110"
            style={armorShade}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <g id="armor-gem">
          <path
            d="M67 78 L78 92 L67 106 L56 92 Z"
            fill="#c4202c"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M62 88 L67 82" stroke={NAIL} strokeWidth="3" strokeLinecap="round" />
        </g>
        <symbol id="armor-1" viewBox="0 0 240 160" overflow="visible">
          <use href="#armor-plate" />
        </symbol>
        <symbol id="armor-2" viewBox="0 0 240 160" overflow="visible">
          <use href="#armor-spikes" />
          <use href="#armor-plate" />
          <use href="#armor-pauldron" />
        </symbol>
        <symbol id="armor-3" viewBox="0 0 240 160" overflow="visible">
          <use href="#armor-spikes" />
          <use href="#armor-plate" />
          <use href="#armor-pauldron" />
          <use href="#armor-gem" />
        </symbol>
        <symbol id="armor-4" viewBox="0 0 240 160" overflow="visible">
          <use href="#armor-spikes" />
          <use href="#armor-plate" />
          <use href="#armor-pauldron" />
          <use href="#armor-gem" />
        </symbol>

        {/*
          Weapons, drawn behind the hand and arm (Arena puts the armor-back-N symbol first):
          a blade strapped under the wrist, then a broadsword slung behind the arm, set alight
          at the top tier.
        */}
        <g id="weapon-wrist-blade">
          <rect
            x="52"
            y="112"
            width="36"
            height="30"
            rx="4"
            style={armor}
            stroke={INK}
            strokeWidth="4"
          />
          <path
            d="M58 134 H204 L232 140 L204 146 H58 Z"
            fill={STEEL}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M72 140 H198" stroke="#8b98a3" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g id="weapon-sword-blade">
          <path
            d="M36 -10 H226 L256 0 L226 10 H36 Z"
            fill={STEEL}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M46 0 H222" stroke="#8b98a3" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g id="weapon-sword-hilt">
          <rect
            x="0"
            y="-6"
            width="26"
            height="12"
            rx="3"
            fill="#6b3b1f"
            stroke={INK}
            strokeWidth="3.5"
          />
          <circle cx="-5" cy="0" r="8" style={armor} stroke={INK} strokeWidth="3.5" />
          <rect
            x="24"
            y="-20"
            width="12"
            height="40"
            rx="3"
            style={armor}
            stroke={INK}
            strokeWidth="3.5"
          />
        </g>
        <g id="weapon-flames" stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path
            d="M120 -9 Q130 -40 142 -12 Q152 -52 166 -12 Q178 -58 192 -11 Q204 -50 214 -10 Q228 -40 236 -8 Q246 -26 252 -3 Z"
            fill="#ff7a1a"
          />
          <path
            d="M120 9 Q132 34 144 12 Q156 42 170 12 Q184 44 198 11 Q210 36 222 9 Q234 26 244 5 Z"
            fill="#ff7a1a"
          />
          <path
            d="M134 -10 Q144 -30 152 -11 Q164 -38 176 -11 Q188 -36 200 -10 Q212 -28 222 -9 Z"
            fill={GOLD}
            stroke="none"
          />
          <path
            d="M136 10 Q146 24 156 11 Q168 28 180 11 Q192 26 204 10 Z"
            fill={GOLD}
            stroke="none"
          />
        </g>
        <symbol id="armor-back-2" viewBox="0 0 240 160" overflow="visible">
          <use href="#weapon-wrist-blade" />
        </symbol>
        <symbol id="armor-back-3" viewBox="0 0 240 160" overflow="visible">
          <g transform="translate(6 150) rotate(-48)">
            <use href="#weapon-sword-blade" />
            <use href="#weapon-sword-hilt" />
          </g>
          <use href="#weapon-wrist-blade" />
        </symbol>
        <symbol id="armor-back-4" viewBox="0 0 240 160" overflow="visible">
          <g transform="translate(6 150) rotate(-48)">
            <use href="#weapon-flames" />
            <use href="#weapon-sword-blade" />
            <use href="#weapon-sword-hilt" />
          </g>
          <use href="#weapon-wrist-blade" />
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
