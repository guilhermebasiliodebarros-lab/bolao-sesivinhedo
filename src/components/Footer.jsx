import { COPY } from '../content/copy.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>{COPY.brand.name}</strong>
        <span>{COPY.footer.tagline}</span>
      </div>
      <span>{COPY.footer.scoring}</span>
    </footer>
  )
}
