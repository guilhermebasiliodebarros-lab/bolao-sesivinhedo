import { COPY } from '../content/copy.js'
import { useAuth } from '../context/useAuth.js'

export default function Footer({ accessOnly = false }) {
  const { isViewer } = useAuth()
  return (
    <footer className="site-footer">
      <div>
        <strong>{COPY.brand.name}</strong>
        <span>{isViewer || accessOnly ? 'Calendário, chaveamento, simulador, regulamentos e estatísticas.' : COPY.footer.tagline}</span>
      </div>
      <span>{isViewer ? 'Acesso somente para consulta.' : accessOnly ? 'Acesse com o login fornecido pela organização.' : COPY.footer.scoring}</span>
    </footer>
  )
}
