export default function LoadingState({ label = 'Carregando dados...', error = '' }) {
  if (error) return <section className="load-failure" role="alert"><h2>Não foi possível carregar os dados</h2><p>{error}</p><button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>Tentar novamente</button></section>
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
