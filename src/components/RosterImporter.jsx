import { useEffect, useRef, useState } from 'react'
import { importPlayers } from '../services/bolaoService.js'
import { parseRosterText } from '../utils/rosterImport.js'

export default function RosterImporter({ team, players, disabled: parentDisabled }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState('')
  const [ocr, setOcr] = useState(false)
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  const selected = rows.filter((row) => row.selected && !row.issue)
  const prepare = (value) => { const parsed = parseRosterText(value, players); setRows(parsed); setNotice(parsed.length ? '' : 'Nenhum nome encontrado. Confira o arquivo ou cole a lista de nomes.') }
  const read = async (file) => {
    if (!file) return
    controller.current?.abort()
    const task = new AbortController(); controller.current = task
    setBusy(true); setRows([]); setNotice(''); setProgress('Preparando o arquivo…')
    try {
      const { readRosterFile } = await import('../services/rosterFileReader.js')
      const result = await readRosterFile(file, { signal: task.signal, onProgress: setProgress })
      if (task.signal.aborted) return
      setText(result.text); setOcr(result.ocr); prepare(result.text)
    } catch (error) { if (!task.signal.aborted) setNotice(error.message || 'Não foi possível ler o arquivo. Você também pode colar os nomes abaixo.') }
    finally { if (!task.signal.aborted) { setBusy(false); setProgress('') } }
  }
  const save = async () => {
    setBusy(true); setNotice('')
    try {
      const result = await importPlayers(team.id, selected)
      setNotice(`${result.added} jogador(es) importado(s) na equipe ${team.nome}.${result.skipped ? ` ${result.skipped} nome(s) repetido(s) ignorado(s).` : ''}`)
      setRows([]); setText('')
    } catch (error) { setNotice(error.message) }
    finally { setBusy(false) }
  }
  return <details className="roster-importer"><summary>Importar jogadores de Word, PDF ou Bloco de notas</summary><div className="roster-import-content"><p>Equipe de destino: <strong>{team.nome}</strong>. Use um nome por linha ou uma tabela com Nome, Posição e Capitão. Revise a prévia antes de importar.</p><label>Arquivo Word (.docx), PDF ou texto (.txt)<input type="file" accept=".docx,.doc,.pdf,.txt" disabled={busy || parentDisabled} onChange={(event) => read(event.target.files[0])} /></label><small>Até 15 MB e 20 páginas de PDF. PDFs escaneados passam por reconhecimento de texto.</small>{busy && progress ? <div className="import-progress" role="status">{progress}<button className="btn btn-outline btn-small" type="button" onClick={() => { controller.current?.abort(); setBusy(false); setProgress('') }}>Cancelar leitura</button></div> : null}<label>Ou cole a lista de nomes<textarea rows="5" value={text} disabled={busy || parentDisabled} onChange={(event) => setText(event.target.value)} placeholder={'Ana Silva\nBruno Souza\nCarla Oliveira'} /></label><button className="btn btn-outline" type="button" disabled={busy || parentDisabled || !text.trim()} onClick={() => { setOcr(false); prepare(text) }}>Preparar prévia</button>{ocr ? <p className="schedule-warning">Confira os nomes reconhecidos no PDF antes de salvar.</p> : null}{rows.length ? <div className="import-preview"><h4>Prévia: {rows.length} nome(s) encontrado(s)</h4>{rows.map((row) => <label className="import-preview-row" key={row.id}><input type="checkbox" checked={row.selected} disabled={busy || Boolean(row.issue)} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, selected: event.target.checked } : item))} /><span><strong>{row.nome}</strong><small>{row.issue || [row.posicao, row.capitao ? 'Capitão' : ''].filter(Boolean).join(' · ')}</small></span></label>)}<p>{selected.length} selecionado(s). Nomes já cadastrados não serão duplicados.</p><button className="btn btn-primary" type="button" disabled={busy || parentDisabled || !selected.length || selected.length > 200} onClick={save}>{busy ? 'Importando…' : `Importar ${selected.length} jogador(es)`}</button>{selected.length > 200 ? <p>Selecione até 200 jogadores por importação.</p> : null}</div> : null}{notice ? <div className="alert" role="status">{notice}</div> : null}</div></details>
}
