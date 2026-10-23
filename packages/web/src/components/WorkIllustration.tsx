/** An editorial illustration of connected work, not simulated application data. */
export function WorkIllustration() {
  return <svg className="work-illustration" viewBox="0 0 420 190" fill="none" aria-hidden="true">
    <path d="M54 80H190V131H350" stroke="#b4a5ff" strokeWidth="2" strokeDasharray="3 5" />
    <path d="M190 80V39H306" stroke="#b4a5ff" strokeWidth="2" />
    <circle cx="190" cy="80" r="5" fill="#c7b8ff" />
    <g transform="rotate(-5 74 67)">
      <rect x="9" y="20" width="128" height="89" rx="8" fill="#6b51ed" />
      <circle cx="29" cy="40" r="4" fill="#d3c6ff" />
      <text x="25" y="69" className="ink-on-violet" fill="#fff8ef" fontSize="20" fontFamily="Georgia,serif">You guide.</text>
      <path d="M25 86H76" stroke="#c3b4ff" strokeWidth="2" />
    </g>
    <g transform="rotate(3 319 40)">
      <rect x="253" y="7" width="145" height="67" rx="8" fill="#f6a280" />
      <text x="269" y="36" className="ink-on-coral" fill="#312024" fontSize="18" fontFamily="Georgia,serif">Agents work.</text>
      <path d="M270 52H337m8 0h17" stroke="#653d40" strokeWidth="2" />
    </g>
    <g transform="rotate(-2 296 142)">
      <rect x="217" y="103" width="188" height="74" rx="8" fill="#b3e9cb" />
      <path d="m234 124 4 4 8-9" stroke="#244a3b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="234" y="155" className="ink-on-mint" fill="#183a30" fontSize="20" fontFamily="Georgia,serif">You check in.</text>
    </g>
    <text x="12" y="158" fill="#c0baca" fontSize="10" letterSpacing="2" fontFamily="sans-serif">WORK, TOGETHER.</text>
  </svg>;
}
