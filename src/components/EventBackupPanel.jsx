import { useRef, useState } from 'react'
import { BACKUP_LABELS, BACKUP_MAX_BYTES, backupCounts } from '../utils/eventBackup.js'
import { downloadEventBackup, exportEventBackup, finalizeEventRecovery, previewEventRestore, restoreEventBackup } from '../services/eventBackupService.js'
import { trackWrite } from '../services/pendingWrites.js'
import { formatDateTime } from '../utils/format.js'
import ConfirmationDialog from './ConfirmationDialog.jsx'

export default function EventBackupPanel() {
  const [backup, setBackup] = useState(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState('missing')
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [needsFinalization, setNeedsFinalization] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const fileRef = useRef(null)
  const selectionVersion = useRef(0)
  const lock = useRef(false)
  const exportData = async () => {
    if (lock.current) return
    lock.current = true; setBusy('export'); setNotice(''); setError('')
    try {
      const result = await exportEventBackup()
      downloadEventBackup(result)
      setNotice(`Backup preparado com ${result.documents.length} registros. Guarde o arquivo baixado em um local seguro.`)
    } catch (requestError) { setError(requestError.message) }
    finally { lock.current = false; setBusy('') }
  }
  const review = async (value = backup, nextMode = mode) => {
    if (!value || lock.current) return
    lock.current = true; setBusy('preview'); setError(''); setNotice(''); setPlan(null)
    try { setPlan(await previewEventRestore(value, nextMode)) }
    catch (requestError) { setError(requestError.message) }
    finally { lock.current = false; setBusy('') }
  }
  const pickFile = async (event) => {
    const version = ++selectionVersion.current
    const file = event.target.files?.[0]
    setPlan(null); setBackup(null); setError(''); setNotice(''); setNeedsFinalization(false); setFileName(file?.name || '')
    if (!file) return
    if (file.size > BACKUP_MAX_BYTES) { setError('Escolha um backup de até 50 MB.'); return }
    try {
      const contents = await file.text()
      if (version !== selectionVersion.current) return
      const value = JSON.parse(contents)
      setBackup(value)
      await review(value)
    } catch { if (version === selectionVersion.current) setError('Não foi possível ler esse arquivo. Escolha um backup JSON exportado pelo sistema.') }
  }
  const recover = async () => {
    if (!plan?.changes.length || lock.current) return
    lock.current = true; setBusy('restore'); setError(''); setNotice('')
    try {
      await trackWrite(async () => {
        const safetyCopy = await exportEventBackup()
        downloadEventBackup(safetyCopy, 'interclasse-antes-da-recuperacao')
        const result = await restoreEventBackup(backup, plan, setProgress)
        setNotice(`Recuperação concluída: ${result.created} registros recuperados e ${result.replaced} substituídos. A pontuação foi recalculada. A cópia anterior também foi enviada para download.`)
      })
      setPlan(null); setBackup(null); setFileName(''); setNeedsFinalization(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (requestError) { setError(requestError.message); setNeedsFinalization(Boolean(requestError.needsFinalization)) }
    finally { lock.current = false; setBusy(''); setConfirming(false) }
  }
  const finishTotals = async () => {
    if (!backup || lock.current) return
    lock.current = true; setBusy('finalize'); setError('')
    try {
      await trackWrite(() => finalizeEventRecovery(backup))
      setNotice('Conferência concluída. As quantidades de atletas e a pontuação foram atualizadas com os dados atuais.')
      setNeedsFinalization(false); setPlan(null); setBackup(null); setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (requestError) { setError(requestError.message) }
    finally { lock.current = false; setBusy('') }
  }
  const counts = backup?.documents && Array.isArray(backup.documents) && plan ? backupCounts(backup.documents) : null
  return <section className="event-backup-panel" aria-label="Backup e recuperação">
    <div className="section-heading"><div><span className="eyebrow">Dados do Interclasse</span><h2>Backup e recuperação</h2><p>Guarde uma cópia do campeonato e recupere informações removidas ou alteradas por engano.</p></div></div>
    <div className="backup-actions-grid">
      <article className="backup-action-card"><span className="backup-card-number" aria-hidden="true">01</span><h3>Guardar uma cópia</h3><p>Inclui modalidades, regulamentos, equipes, atletas, partidas, súmulas, lances, palpites, disciplina e avisos.</p><button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={exportData}>{busy === 'export' ? 'Preparando backup…' : 'Baixar backup completo'}</button><small>Contas, senhas, aprovações e preferências pessoais ficam fora do arquivo.</small></article>
      <article className="backup-action-card"><span className="backup-card-number" aria-hidden="true">02</span><h3>Recuperar informações</h3><p>Escolha uma cópia deste mesmo ambiente. Confira a prévia antes de aplicar qualquer alteração.</p><label>Arquivo de backup (.json)<input ref={fileRef} type="file" accept=".json,application/json" disabled={Boolean(busy)} onChange={pickFile} /></label><label>Como recuperar<select value={mode} disabled={Boolean(busy)} onChange={(event) => { const value = event.target.value; setMode(value); setPlan(null); if (backup) review(backup, value) }}><option value="missing">Somente ausentes</option><option value="replace">Ausentes e alterados</option></select></label><p>{mode === 'missing' ? 'Recupera registros removidos e mantém as versões atuais dos demais.' : 'Recupera registros removidos e substitui as versões atuais pelas do arquivo.'}</p><small>Itens criados depois do backup são mantidos. A recuperação fica disponível quando não houver partidas ao vivo.</small></article>
    </div>
    {busy === 'preview' ? <p role="status" className="alert">Conferindo o arquivo e os dados atuais…</p> : null}
    {error ? <div className="alert alert-error" role="alert">{error}{backup && !busy ? <button type="button" className="btn btn-outline btn-small" onClick={() => review()}>Conferir novamente</button> : null}</div> : null}
    {notice ? <p className="alert alert-success" role="status">{notice}</p> : null}
    {needsFinalization ? <div className="backup-recovery-note"><p>Os registros já foram recuperados. Conclua a conferência das quantidades de atletas e da pontuação.</p><button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={finishTotals}>{busy === 'finalize' ? 'Conferindo totais…' : 'Concluir conferência dos totais'}</button></div> : null}
    {plan && counts ? <section className="backup-preview" aria-label="Prévia da recuperação"><div className="section-heading"><div><span className="eyebrow">Arquivo conferido</span><h3>Confira o que será recuperado</h3><p>{fileName} · Cópia de {formatDateTime(backup.createdAt)}</p></div></div>
      <div className="backup-summary"><div><strong>{plan.counts.created}</strong><span>Itens ausentes a recuperar</span></div><div><strong>{plan.counts.replaced}</strong><span>Itens a substituir</span></div><div><strong>{plan.counts.preserved}</strong><span>Itens do arquivo mantidos sem alteração</span></div></div>
      <dl className="backup-counts">{Object.entries(counts).filter(([, count]) => count).map(([name, count]) => <div key={name}><dt>{BACKUP_LABELS[name]}</dt><dd>{count} registro(s)</dd></div>)}</dl>
      <p className="backup-recovery-note">Antes de aplicar, o sistema baixa uma cópia dos dados atuais. A recuperação mantém as contas de acesso e recalcula o ranking. Partidas recuperadas que estavam ao vivo terão o cronômetro pausado.</p>
      <div className="form-actions"><button type="button" className="btn btn-primary" disabled={Boolean(busy) || !plan.changes.length} onClick={() => { setProgress({ completed: 0, total: plan.changes.length }); setConfirming(true) }}>Recuperar {plan.changes.length} registro(s)</button><button type="button" className="btn btn-outline" disabled={Boolean(busy)} onClick={() => review()}>Atualizar prévia</button></div>
      {!plan.changes.length ? <div><p role="status">Nenhuma alteração necessária nesta opção de recuperação. Você pode conferir os totais dos dados atuais.</p><button type="button" className="btn btn-outline btn-small" disabled={Boolean(busy)} onClick={finishTotals}>Conferir quantidades e pontuação</button></div> : null}
    </section> : null}
    {confirming ? <ConfirmationDialog title="Recuperar os dados do backup?" description={busy === 'restore' ? `Recuperando ${progress.completed} de ${progress.total} registros. Aguarde a conclusão.` : `Serão recuperados ${plan.counts.created} itens ausentes e substituídos ${plan.counts.replaced} itens pelas versões do arquivo. Uma cópia dos dados atuais será baixada primeiro. Os demais itens e as contas de acesso serão mantidos.`} confirmLabel="Baixar cópia atual e recuperar" busy={busy === 'restore'} onClose={() => setConfirming(false)} onConfirm={recover} /> : null}
  </section>
}
