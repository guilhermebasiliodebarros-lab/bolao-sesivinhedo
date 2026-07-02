import heroImage from '../assets/bolao-hero.png'
import { COPY } from '../content/copy.js'

export default function Home({ onNavigate }) {
  return (
    <section className="home-page">
      <div className="hero-section" style={{ '--hero-image': `url(${heroImage})` }}>
        <div className="hero-copy">
          <span className="eyebrow">{COPY.home.eyebrow}</span>
          <h1>{COPY.brand.name}</h1>
          <p>{COPY.home.intro}</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" type="button" onClick={() => onNavigate('login')}>
              {COPY.actions.entrar}
            </button>
            <button className="btn btn-light btn-large" type="button" onClick={() => onNavigate('cadastro')}>
              {COPY.actions.cadastrar}
            </button>
            <button className="btn btn-outline-light btn-large" type="button" onClick={() => onNavigate('classificacao')}>
              {COPY.actions.verClassificacao}
            </button>
          </div>
        </div>
        <div className="hero-signal" aria-label="Resumo do sistema">
          {COPY.home.heroSignal.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="home-grid">
        {COPY.home.cards.map((card) => (
          <article className="info-card" key={card.number}>
            <span className="card-number">{card.number}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>

      <section className="sports-showcase" aria-label={COPY.home.sports.label}>
        <div>
          <span className="eyebrow">{COPY.home.sports.eyebrow}</span>
          <h2>{COPY.home.sports.title}</h2>
        </div>
        <div className="sport-tile-grid">
          <article className="sport-tile sport-tile-field">
            <span>{COPY.home.sports.items[0]}</span>
          </article>
          <article className="sport-tile sport-tile-court">
            <span>{COPY.home.sports.items[1]}</span>
          </article>
          <article className="sport-tile sport-tile-net">
            <span>{COPY.home.sports.items[2]}</span>
          </article>
          <article className="sport-tile sport-tile-handball">
            <span>{COPY.home.sports.items[3]}</span>
          </article>
        </div>
      </section>

      <section className="feature-band">
        <div>
          <span className="eyebrow">{COPY.home.feature.eyebrow}</span>
          <h2>{COPY.home.feature.title}</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => onNavigate('jogos')}>
          {COPY.actions.verJogos}
        </button>
      </section>
    </section>
  )
}
