import { memo, useId } from 'react'

export function DecadeEmblem({ decade, className = '' }) {
  return <svg className={`decade-emblem ${className}`} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
    {decade === 20 ? <><path d="m20 3 12 12-12 22L8 15 20 3Zm0 0v34M8 15h24M4 25V12l7-7m25 20V12l-7-7M3 32h8m18 0h8" /><path d="m14 15 6-6 6 6-6 13-6-13Z" /></>
      : decade === 40 ? <><rect x="13" y="4" width="14" height="24" rx="7" /><path d="M9 18v3a11 11 0 0 0 22 0v-3M20 32v5m-7 0h14M17 9h6m-6 5h6m-6 5h6" /></>
        : decade === 50 ? <><circle cx="20" cy="20" r="16" /><circle cx="20" cy="20" r="11" /><circle cx="20" cy="20" r="5" /><circle cx="20" cy="20" r="1" /><path d="M7 16a14 14 0 0 1 9-9m8 26a14 14 0 0 0 9-9" /></>
          : decade === 60 ? <><path d="M20 11c-13-18-20 0-9 9-18 13 0 20 9 9 13 18 20 0 9-9 18-13 0-20-9-9Z" /><circle cx="20" cy="20" r="5" /></>
            : decade === 70 ? <><circle cx="20" cy="21" r="14" /><path d="M20 7v28M6 21h28M9 13h22M9 29h22M20 7c-11 6-11 22 0 28m0-28c11 6 11 22 0 28M20 1v4M2 7l5 5m31-5-5 5" /></>
              : decade === 80 ? <><path d="M8 4h24l-3 24H11L8 4Zm4 5h16l-2 11H14L12 9ZM11 28l-4 9h26l-4-9M15 29l-1 5m11-5 1 5M18 25h4" /><path d="m18 13 2-2 2 2m-6 2h8m-6 2h4" /></>
                : decade === 90 ? <><path d="M5 5h30v25H5zM5 12h30M9 8h2m3 0h2m3 0h2M14 16v17l5-5 5 8 4-2-5-8h7L14 16Z" /></>
                  : decade === 2000 ? <><ellipse cx="20" cy="20" rx="19" ry="7" transform="rotate(-30 20 20)" /><path d="m20 4 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z" /></>
                    : <><circle cx="20" cy="20" r="14" /><path d="M6 20h28M20 6v28" /></>}
  </svg>
}

function DecadeArtwork({ decade }) {
  const unique = `decade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const grain = `${unique}-grain`, metallic = `${unique}-metal`
  return <svg className="decade-artwork" viewBox="0 0 420 560" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
    <defs>
      <pattern id={grain} width="17" height="17" patternUnits="userSpaceOnUse"><path d="M2 1h1M11 8h2M6 14h1" strokeWidth="1" /></pattern>
      <linearGradient id={metallic} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--era-secondary)" /><stop offset=".25" stopColor="#eb338f" /><stop offset=".5" stopColor="var(--era-accent)" /><stop offset=".72" stopColor="#ffb3d9" /><stop offset="1" stopColor="#db1c78" /></linearGradient>
    </defs>
    {decade === 20 ? <g className="era-art-deco">
      <path d="M16 160V18h134l60 60 60-60h134v142M28 152V30h115l67 67 67-67h115v122M40 143V42h96l74 74 74-74h96v101" />
      <path d="m16 18 194 124L404 18M68 18l142 124L352 18M120 18l90 124 90-124M164 18l46 124 46-124M210 18v124M16 75l194 67L404 75M16 122l194 20 194-20" />
      <path d="m210 432 38 38-38 65-38-65 38-38Zm0 0v103m-38-65h76M16 407v135h120m-108-12V419m376-12v135H284m108-12V419" />
      <path d="m55 560 155-128 155 128M90 560l120-105 120 105M124 560l86-81 86 81" />
      <path d="M16 204v50m0 51v50m388-151v50m0 51v50" />
    </g> : decade === 40 ? <g className="era-art-vintage">
      <rect x="18" y="18" width="384" height="524" rx="2" /><rect x="27" y="27" width="366" height="506" />
      <path d="m27 68 18-23 19-18m329 41-18-23-19-18M27 492l18 23 19 18m329-41-18 23-19 18" />
      <path d="M35 380c-28 85 35 126 80 133M45 418l-18-28m22 44-25-5m32 24-9-29m18 47-31-10m44 28-13-33m25 44-35-11m290-119c28 85-35 126-80 133m70-95 18-28m-22 44 25-5m-32 24 9-29m-18 47 31-10m-44 28 13-33m-25 44 35-11" strokeWidth="2.2" />
      <g transform="translate(292 50)"><rect width="52" height="90" rx="26" /><path d="M-11 49v12a37 37 0 0 0 74 0V49M26 98v22M5 120h42M15 14h22M15 27h22M15 40h22M15 53h22" /></g>
      <rect x="40" y="40" width="340" height="480" fill={`url(#${grain})`} stroke="none" opacity=".35" />
      <path d="M130 497h160m-145 9h130M50 173h52m216 0h52" />
      <text x="59" y="104" fontFamily="Georgia, serif" fontStyle="italic" fontSize="34" strokeWidth=".7">1940</text>
    </g> : decade === 50 ? <g className="era-art-diner">
      <g transform="translate(320 90)"><circle r="74" /><circle r="62" /><circle r="52" /><circle r="40" /><circle r="22" fill="currentColor" fillOpacity=".14" /><circle r="5" /></g>
      <path d="m39 60 7 22 23 4-23 5-7 24-6-24-22-5 22-4 6-22ZM344 377l5 15 15 5-15 4-5 17-4-17-16-4 16-5 4-15Z" />
      <g transform="translate(70 454) rotate(-16)"><ellipse rx="63" ry="17" /><ellipse rx="63" ry="17" transform="rotate(70)" /><ellipse rx="63" ry="17" transform="rotate(-70)" /><circle r="5" fill="currentColor" /></g>
      <path d="M256 430v62c-27-13-35 25-8 18 10-2 15-10 15-17v-48l42-10v44c-26-10-32 23-9 18 10-2 16-9 16-17v-66l-56 16Z" />
      {Array.from({ length: 14 }, (_, index) => <rect key={index} x={(index % 7) * 60} y={index < 7 ? 530 : 545} width="30" height="15" fill="currentColor" opacity=".45" transform={index < 7 ? '' : 'translate(30 0)'} />)}
      <path d="M18 160V19h133M402 390v130H269" strokeWidth="3" />
    </g> : decade === 60 ? <g className="era-art-psychedelic">
      {[0, 1, 2, 3, 4].map((index) => <path key={index} d={`M${-170 + index * 30} 560C${-35 + index * 30} 440 ${-20 + index * 30} 470 ${20 + index * 30} 360S${15 + index * 30} 170 ${150 + index * 30} 90S${310 + index * 30} 80 ${450 + index * 30} -50`} strokeWidth="17" stroke={index % 2 ? 'var(--era-secondary)' : 'currentColor'} />)}
      <g transform="translate(335 453)">{[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => <ellipse key={angle} cy="-32" rx="14" ry="28" transform={`rotate(${angle})`} />)}<circle r="15" fill="currentColor" fillOpacity=".25" /></g>
      <g transform="translate(64 73)"><circle r="51" /><circle r="35" /><circle r="19" /></g>
    </g> : decade === 70 ? <g className="era-art-disco">
      <g transform="translate(311 83)"><path d="M0-83v24" /><circle r="59" /><ellipse rx="24" ry="59" /><ellipse rx="45" ry="59" /><path d="M-59 0H59M-54-23H54M-54 23H54M-35-47h70M-35 47h70M0-59V59" /><path d="M-80-68l13 14m143-5 18-14M-88 42l20-7m145 17 22 8" strokeWidth="3" /></g>
      {[0, 1, 2, 3].map((index) => <path key={index} d={`M${-45 + index * 26} 560v-48a${100 + index * 14} ${100 + index * 14} 0 0 1 ${200 + index * 28} 0v48`} strokeWidth="13" stroke={index % 2 ? 'var(--era-secondary)' : 'currentColor'} />)}
      <path d="m58 44 5 16 16 4-16 5-5 16-5-16-16-5 16-4 5-16ZM343 342l5 17 18 5-18 5-5 18-5-18-17-5 17-5 5-17Z" />
      <circle cx="53" cy="174" r="7" /><circle cx="367" cy="222" r="5" />
    </g> : decade === 80 ? <g className="era-art-arcade">
      <path d="M-40 560 210 341 460 560M10 560l200-219 200 219M75 560l135-219 135 219M142 560l68-219 68 219M210 341v219M0 376h420M0 404h420M0 445h420M0 495h420M0 556h420" stroke="var(--era-secondary)" />
      <path d="M18 156V18h132m-120 0v126M402 360v182H268m122-170v158" strokeWidth="3" />
      <g transform="translate(292 47)"><path d="M-8 0h68l-8 74H0L-8 0ZM4 14h44l-4 35H8L4 14ZM0 74l-12 29h77L52 74M14 76l-3 15m26-15 3 15" /><path d="M16 29h16M24 21v16" strokeWidth="4" /></g>
      <path d="M40 270h18v18H40zm18 18h18v18H58zm-18 18h18v18H40zm18 18h18v18H58Z" fill="currentColor" fillOpacity=".25" />
      <path d="m352 234 9 17-9 17-9-17 9-17Z" />
    </g> : decade === 90 ? <g className="era-art-grunge">
      <path d="M0 44 157 0M0 64 209 0M0 85 261 0M251 560l169-46m-117 46 117-26M18 18h108M18 18v76m384 448H294m108 0v-75" strokeWidth="3" />
      <g transform="translate(263 52) rotate(6)"><path d="M0 0h118v101H0zM0 20h118M10 10h7m9 0h7m9 0h7" /><path d="M25 39v75l22-21 18 33 17-9-18-33h32L25 39Z" fill="var(--era-background)" strokeWidth="3" /></g>
      <g fill="currentColor" fillOpacity=".4">{[[34, 409], [50, 409], [66, 425], [34, 441], [50, 457], [82, 457], [98, 441], [82, 409], [114, 425], [114, 457]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" />)}</g>
      <path d="m282 476 101-32m-92 45 98-26m-105 40 106-22" strokeWidth="4" />
      <rect width="420" height="560" fill={`url(#${grain})`} stroke="none" opacity=".75" />
    </g> : decade === 2000 ? <g className="era-art-y2k">
      <g transform="translate(312 96) rotate(-27)"><ellipse rx="110" ry="27" stroke={`url(#${metallic})`} strokeWidth="9" /><ellipse rx="81" ry="48" stroke="var(--era-secondary)" strokeWidth="2" /><circle r="43" stroke={`url(#${metallic})`} strokeWidth="4" /><circle r="7" /></g>
      <path d="m57 348 12 41 41 12-41 12-12 41-12-41-41-12 41-12 12-41ZM323 425l9 31 31 9-31 9-9 31-9-31-31-9 31-9 9-31Z" fill={`url(#${metallic})`} strokeWidth="0" />
      <rect x="158" y="492" width="232" height="31" rx="15.5" stroke={`url(#${metallic})`} strokeWidth="3" />
      <path d="m33 31 92 0m-92 11h55M394 263v102m-10-70v40" strokeWidth="4" />
      <text x="34" y="155" fontFamily="Arial, sans-serif" fontStyle="italic" fontWeight="900" fontSize="29" stroke={`url(#${metallic})`} strokeWidth=".7">Y2K</text>
    </g> : <g opacity=".5"><path d="M18 150V18h132m252 392v132H270M18 18l80 80m304 444-80-80" /><circle cx="210" cy="280" r="160" /></g>}
  </svg>
}

export default memo(DecadeArtwork)
