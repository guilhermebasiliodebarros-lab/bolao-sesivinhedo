function SkeletonCard() {
  return <div className="skeleton-card"><div className="skeleton-card-top"><span className="skeleton-block skeleton-short" /><span className="skeleton-block skeleton-badge" /></div><span className="skeleton-block skeleton-medium" /><div className="skeleton-teams"><span className="skeleton-block" /><span className="skeleton-block skeleton-score" /><span className="skeleton-block" /></div><span className="skeleton-block skeleton-medium" /><span className="skeleton-block skeleton-field" /></div>
}

export default function LoadingState({ label = 'Carregando dados...', error = '', variant = 'list', count = 4 }) {
  if (error) return <section className="load-failure" role="alert"><h2>Não foi possível carregar os dados</h2><p>{error}</p><button type="button" className="btn btn-outline" onClick={() => window.location.reload()}>Tentar novamente</button></section>
  const rows = Array.from({ length: Math.max(1, Math.min(12, count)) }, (_, index) => index)
  const table = <div className="skeleton-table">{rows.map((index) => <div className="skeleton-row" key={index}><span className="skeleton-block skeleton-avatar" /><span className="skeleton-block" /><span className="skeleton-block skeleton-short" /></div>)}</div>
  return <section className={`loading-state skeleton-page skeleton-${variant}`} role="status" aria-busy="true">
    <p className="skeleton-status"><span aria-hidden="true" />{label}</p>
    <div aria-hidden="true">
      {!['list', 'screen'].includes(variant) ? <div className="skeleton-heading"><span className="skeleton-block skeleton-short" /><span className="skeleton-block skeleton-title" /><span className="skeleton-block skeleton-medium" /></div> : null}
      {variant === 'form' ? <div className="skeleton-form">{[0, 1, 2].map((index) => <div key={index}><span className="skeleton-block skeleton-short" /><span className="skeleton-block skeleton-field" /></div>)}<span className="skeleton-block skeleton-field" /></div>
        : variant === 'ranking' ? <><div className="skeleton-metrics">{[0, 1, 2, 3].map((index) => <span className="skeleton-block" key={index} />)}</div><div className="skeleton-podium">{[0, 1, 2].map((index) => <div key={index}><span className="skeleton-block skeleton-avatar" /><span className="skeleton-block" /><span className="skeleton-block skeleton-short" /></div>)}</div>{table}</>
          : variant === 'calendar' ? <><div className="skeleton-filter"><span className="skeleton-block skeleton-field" /><span className="skeleton-block skeleton-field" /><span className="skeleton-block skeleton-field" /></div>{table}</>
            : variant === 'admin' ? <div className="skeleton-admin"><div className="skeleton-admin-nav">{rows.map((index) => <span className="skeleton-block skeleton-field" key={index} />)}</div>{table}</div>
              : variant === 'list' ? table
                : <>{variant === 'dashboard' ? <div className="skeleton-metrics">{[0, 1, 2, 3].map((index) => <span className="skeleton-block" key={index} />)}</div> : null}<div className="skeleton-card-grid">{rows.map((index) => <SkeletonCard key={index} />)}</div></>}
    </div>
  </section>
}
