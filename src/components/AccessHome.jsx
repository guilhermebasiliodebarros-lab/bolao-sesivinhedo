import heroImage from '../assets/bolao-hero.png'

export default function AccessHome({ onNavigate }) {
  return <section className="home-page event-home access-home">
    <div className="hero-section event-hero" style={{ '--hero-image': `url(${heroImage})` }}>
      <div className="hero-copy">
        <span className="eyebrow">Interclasse SESI Vinhedo</span>
        <h1>O Interclasse<br />acontece aqui<span>.</span></h1>
        <p>Entre com sua conta para acompanhar os jogos e acessar os recursos do Interclasse.</p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-large" type="button" onClick={() => onNavigate('login')}>Entrar <span aria-hidden="true">→</span></button>
          <button className="btn btn-outline-light btn-large" type="button" onClick={() => onNavigate('cadastro')}>Criar minha conta</button>
        </div>
      </div>
      <div className="event-hero-caption"><span>INTERCLASSE SESI VINHEDO</span><span>Esporte que conecta a escola.</span></div>
    </div>
  </section>
}
