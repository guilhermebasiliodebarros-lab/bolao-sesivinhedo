import { schoolClassCode } from './schoolClasses.js'

export const DECADE_STYLES = Object.freeze({
  20: Object.freeze({ decade: 20, label: 'Anos 20', name: 'Art Déco', motif: 'deco' }),
  40: Object.freeze({ decade: 40, label: 'Anos 40', name: 'Cartazes & rádio', motif: 'vintage' }),
  50: Object.freeze({ decade: 50, label: 'Anos 50', name: 'Retrô & vinil', motif: 'diner' }),
  60: Object.freeze({ decade: 60, label: 'Anos 60', name: 'Psicodelia', motif: 'psychedelic' }),
  70: Object.freeze({ decade: 70, label: 'Anos 70', name: 'Disco & groove', motif: 'disco' }),
  80: Object.freeze({ decade: 80, label: 'Anos 80', name: 'Neon & arcade', motif: 'arcade' }),
  90: Object.freeze({ decade: 90, label: 'Anos 90', name: 'Grunge & pixels', motif: 'grunge' }),
  2000: Object.freeze({ decade: 2000, label: 'Anos 2000', name: 'Universo Y2K', motif: 'y2k' }),
})

const palettes = Object.freeze({
  gold: Object.freeze({ color: 'Dourado / amarelo', accent: '#ffca05', secondary: '#ffdf38', background: '#382000', wash: '#704300', swatch: '#ffca05' }),
  orange: Object.freeze({ color: 'Laranja', accent: '#ff7a00', secondary: '#ffb000', background: '#4a1500', wash: '#862700', swatch: '#ff7a00' }),
  red: Object.freeze({ color: 'Vermelho', accent: '#ff3548', secondary: '#ff5e38', background: '#4d0019', wash: '#780020', swatch: '#ff3548' }),
  olive: Object.freeze({ color: 'Verde / militar', accent: '#b6dc26', secondary: '#71c831', background: '#182c09', wash: '#314f0b', swatch: '#8fba14' }),
  blue: Object.freeze({ color: 'Azul', accent: '#329dff', secondary: '#00ddff', background: '#061b50', wash: '#083c89', swatch: '#1a8cff' }),
  silver: Object.freeze({ color: 'Prata / rosa', accent: '#f4f7ff', secondary: '#ff3db6', background: '#321044', wash: '#621358', swatch: '#ff3db6' }),
  ink: Object.freeze({ color: 'Preto', accent: '#f0f2f5', secondary: '#8d99a8', background: '#070709', wash: '#202127', swatch: '#08080a' }),
  purple: Object.freeze({ color: 'Roxo', accent: '#c450ff', secondary: '#de64ff', background: '#300d4e', wash: '#551178', swatch: '#aa35ff' }),
})

const assignments = [
  ['6-a', '6º A', 'tarde', 70, 'gold'], ['6-b', '6º B', 'tarde', 60, 'orange'],
  ['7-a', '7º A', 'tarde', 50, 'red'], ['7-b', '7º B', 'tarde', 90, 'olive'],
  ['8-a', '8º A', 'tarde', 80, 'blue'], ['8-b', '8º B', 'tarde', 2000, 'silver'],
  ['9-a', '9º A', 'manha', 60, 'orange'], ['9-b', '9º B', 'manha', 70, 'ink'],
  ['1-a', '1º A', 'manha', 20, 'gold'], ['1-b', '1º B', 'manha', 50, 'red'],
  ['2-a', '2º A', 'manha', 90, 'olive'], ['2-b', '2º B', 'manha', 80, 'blue'],
  ['3-a', '3º A', 'manha', 2000, 'silver'], ['3-b', '3º B', 'manha', 40, 'purple'],
]

export const CLASS_DECADE_IDENTITIES = Object.freeze(Object.fromEntries(assignments.map(([code, className, shift, decade, palette]) => [code, Object.freeze({ code, className, shift, palette, known: true, ...DECADE_STYLES[decade], ...palettes[palette] })])))
export const NEUTRAL_DECADE_IDENTITY = Object.freeze({ code: '', className: '', shift: '', decade: null, label: 'Década a definir', name: 'Interclasse 2026', motif: 'neutral', palette: 'neutral', known: false, color: '', accent: '#aebed1', secondary: '#d8e2ec', background: '#18212e', swatch: '#aebed1' })

export function classDecadeIdentity(value) {
  return CLASS_DECADE_IDENTITIES[schoolClassCode(value)] || NEUTRAL_DECADE_IDENTITY
}

export function matchDecadeIdentities(game = {}) {
  return Object.fromEntries(['A', 'B'].map((side) => {
    if (game[`seedLabel${side}`]) return [side, NEUTRAL_DECADE_IDENTITY]
    const metadata = classDecadeIdentity(game[`turma${side}`])
    const named = classDecadeIdentity(game[`time${side}`])
    const automaticCode = String(game[`teamId${side}`] || '').match(/^school_.+_([1236789]-[ab])$/)?.[1]
    return [side, metadata.known ? metadata : named.known ? named : CLASS_DECADE_IDENTITIES[automaticCode] || NEUTRAL_DECADE_IDENTITY]
  }))
}

export function decadeTeamStyle(identity) {
  return {
    '--era-accent': identity.accent, '--era-secondary': identity.secondary,
    '--era-background': identity.background, '--era-swatch': identity.swatch,
    '--era-line': identity.accent, '--era-wash': identity.wash || identity.background,
  }
}
