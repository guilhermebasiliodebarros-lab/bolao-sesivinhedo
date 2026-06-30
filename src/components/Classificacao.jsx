import { useEffect, useState } from 'react'
import { subscribeRanking } from '../services/bolaoService.js'
import EmptyState from './EmptyState.jsx'
import LoadingState from './LoadingState.jsx'
import RankingTable from './RankingTable.jsx'

export default function Classificacao({ onNavigate }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeRanking(
      (items) => {
        setRanking(items)
        setLoading(false)
      },
      setError,
    )
  }, [])

  if (loading) {
    return <LoadingState label="Atualizando classificacao..." />
  }

  return (
    <section className="page-shell">
      <div className="page-heading with-actions">
        <div>
          <span className="eyebrow">Ranking geral</span>
          <h1>Classificacao</h1>
          <p>Ordenada por maior pontuacao, com desempate por acertos exatos e acertos de resultado.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          Ver jogos
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {ranking.length ? (
        <RankingTable ranking={ranking} />
      ) : (
        <EmptyState
          title="Ranking ainda vazio"
          description="Os participantes aparecem aqui depois do cadastro."
          action={
            <button className="btn btn-primary" type="button" onClick={() => onNavigate('cadastro')}>
              Cadastrar participante
            </button>
          }
        />
      )}
    </section>
  )
}
