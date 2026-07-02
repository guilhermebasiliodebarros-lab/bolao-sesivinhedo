export default function PendingGuessBanner({ count, onNavigate }) {
  if (!Number.isFinite(count)) {
    return null
  }

  const isComplete = count === 0

  return (
    <section className={isComplete ? 'pending-guess-banner is-complete' : 'pending-guess-banner'} role="status">
      <div>
        <span className="eyebrow">Seus palpites</span>
        <strong>
          {isComplete ? 'Todos os palpites abertos foram enviados' : `Faltam ${count} palpite${count === 1 ? '' : 's'} para você`}
        </strong>
      </div>
      {onNavigate ? (
        <button className={isComplete ? 'btn btn-outline btn-small' : 'btn btn-primary btn-small'} type="button" onClick={() => onNavigate(isComplete ? 'palpites' : 'jogos')}>
          {isComplete ? 'Ver palpites' : 'Palpitar agora'}
        </button>
      ) : null}
    </section>
  )
}
