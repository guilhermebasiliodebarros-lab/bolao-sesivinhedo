import heroImage from '../assets/bolao-hero.png'

export default function Home({ onNavigate }) {
  return (
    <section className="home-page">
      <div className="hero-section" style={{ '--hero-image': `url(${heroImage})` }}>
        <div className="hero-copy">
          <span className="eyebrow">Evento escolar com ranking ao vivo</span>
          <h1>Bolao SESI Vinhedo</h1>
          <p>
            Participe do bolao, registre seus palpites antes dos jogos e acompanhe sua
            pontuacao subir conforme os resultados forem finalizados pela organizacao.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" type="button" onClick={() => onNavigate('login')}>
              Entrar
            </button>
            <button className="btn btn-light btn-large" type="button" onClick={() => onNavigate('cadastro')}>
              Cadastrar
            </button>
            <button className="btn btn-outline-light btn-large" type="button" onClick={() => onNavigate('classificacao')}>
              Ver classificacao
            </button>
          </div>
        </div>
        <div className="hero-signal" aria-label="Resumo do sistema">
          <span>Palpites com prazo</span>
          <span>Ranking ao vivo</span>
          <span>Painel master</span>
        </div>
      </div>

      <div className="home-grid">
        <article className="info-card">
          <span className="card-number">01</span>
          <h2>Palpite antes do jogo</h2>
          <p>Com o jogo aberto, cada participante envia um placar unico e pode editar ate o horario limite.</p>
        </article>
        <article className="info-card">
          <span className="card-number">02</span>
          <h2>Pontuacao automatica</h2>
          <p>Acertar vencedor ou empate vale 3 pontos, com multiplicador de 1,2 por gol parcial e 1,4 no placar exato.</p>
        </article>
        <article className="info-card">
          <span className="card-number">03</span>
          <h2>Ranking em tempo real</h2>
          <p>A classificacao mostra podium, pontuacao total, acertos exatos e acertos de resultado.</p>
        </article>
      </div>

      <section className="sports-showcase" aria-label="Esportes do evento">
        <div>
          <span className="eyebrow">Clima de competicao</span>
          <h2>Visual pensado para quadra, torcida e placar ao vivo.</h2>
        </div>
        <div className="sport-tile-grid">
          <article className="sport-tile sport-tile-field">
            <span>Futebol</span>
          </article>
          <article className="sport-tile sport-tile-court">
            <span>Basquete</span>
          </article>
          <article className="sport-tile sport-tile-net">
            <span>Volei</span>
          </article>
          <article className="sport-tile sport-tile-handball">
            <span>Handebol</span>
          </article>
        </div>
      </section>

      <section className="feature-band">
        <div>
          <span className="eyebrow">Organizacao simples</span>
          <h2>Administre jogos, placares e status em uma unica area.</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          Ver jogos
        </button>
      </section>
    </section>
  )
}
