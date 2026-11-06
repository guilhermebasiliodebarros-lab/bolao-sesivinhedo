import { useEffect, useMemo, useState } from 'react'
import { subscribeSports } from '../services/bolaoService.js'
import { getSportIcon, getUniqueGameSports } from '../utils/game.js'

export default function SportFilter({ games, value, onChange, allValue = '' }) {
  const [sports, setSports] = useState([])
  useEffect(() => subscribeSports(setSports, () => setSports([])), [])
  const options = useMemo(() => {
    const merged = new Map(sports.map((sport) => [sport.id, sport]))
    getUniqueGameSports(games).forEach((sport) => {
      if (!merged.has(sport.id)) merged.set(sport.id, sport)
    })
    return [...merged.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [games, sports])

  return (
    <section className="sport-filter" aria-label="Filtrar por esporte">
      <div className="section-heading"><h2>Escolha o esporte</h2><span>Veja os jogos de cada modalidade</span></div>
      <div className="sport-filter-options">
        <button type="button" className={value === allValue ? 'sport-filter-button is-active' : 'sport-filter-button'} aria-pressed={value === allValue} onClick={() => onChange(allValue)}>
          Todos os esportes <span>{games.length}</span>
        </button>
        {options.map((sport) => {
          const count = games.filter((game) => game.sportId === sport.id || game.esporteNome === sport.nome).length
          return (
            <button type="button" key={sport.id} className={value === sport.id ? 'sport-filter-button is-active' : 'sport-filter-button'} aria-pressed={value === sport.id} onClick={() => onChange(sport.id)}>
              <span className="sport-filter-icon" aria-hidden="true">{getSportIcon(sport.nome)}</span>
              {sport.nome}<span>{count}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
