/** Flat, opaque layers keep every card edge and detail in the correct plane. */
export function FeaturedCardsArt() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 180 180"
      width="180"
      height="180"
      className="pointer-events-none block h-auto w-full"
      fill="none"
    >
      {/* Rear cards are complete silhouettes, painted before the front card. */}
      <g transform="rotate(14 116 98)">
        <rect x="71" y="38" width="88" height="120" rx="13" fill="#BCE2D5" stroke="#8FC5B5" strokeWidth="1.5" />
      </g>
      <g transform="rotate(-13 68 96)">
        <rect x="23" y="34" width="90" height="122" rx="13" fill="#369F8A" stroke="#298772" strokeWidth="1.5" />
        <path d="M36 52H52" stroke="#BEE8D9" strokeWidth="3" strokeLinecap="round" />
      </g>

      <g transform="rotate(5 98 88)">
        <rect x="49" y="21" width="98" height="134" rx="13" fill="#FFFDF7" stroke="#A8CFC0" strokeWidth="1.5" />
        {/* The ribbon starts below the top edge and stays within the card. */}
        <path d="M118 22H131V48L124.5 43L118 48Z" fill="#E9BE72" />
        <path d="M64 40H85" stroke="#7AAE9C" strokeWidth="3" strokeLinecap="round" />

        {/* Open-book outline: one continuous silhouette, with a single spine. */}
        <path
          d="M67 66C78 63 88 66 98 72C108 66 118 63 129 66V100C118 97 108 100 98 106C88 100 78 97 67 100Z"
          fill="#E4F2E9"
          stroke="#438C75"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M98 72V106" stroke="#438C75" strokeWidth="2" />
        <path
          d="M75 76C80 76 85 78 90 80M75 84C80 84 85 86 90 88M106 80C111 78 116 76 121 76M106 88C111 86 116 84 121 84"
          stroke="#7CAC97"
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        <rect x="70" y="122" width="56" height="4" rx="2" fill="#9FC9B6" />
        <rect x="81" y="132" width="34" height="3" rx="1.5" fill="#D0E4D7" />
      </g>
    </svg>
  );
}
