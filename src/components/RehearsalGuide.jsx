import { useState } from 'react'
import { isRehearsal } from '../config/rehearsal.js'
import { readPreference, writePreference } from '../utils/preferences.js'
import './RehearsalGuide.css'

const key = 'interclasse-rehearsal-checklist-v1'
const tasks = [
  ['prepare', 'Organizador · preparar uma partida', 'Em Ao vivo / TV, prepare o Futebol de ensaio, confira alunos presentes, coletes e local, e inicie a partida.'],
  ['broadcast', 'TV · receber a seleção', 'Abra o placar em outra tela. Transmita o Futebol e confira que apenas a partida escolhida aparece. Abra o diagnóstico e verifique a confirmação do servidor.'],
  ['goal', 'Árbitro · registrar gol com aluno', 'Abra o modo árbitro, escolha Ana e marque um gol. Na TV, confira placar, bola, primeiro nome e minuto.'],
  ['cards', 'Árbitro · lançar e anular um cartão', 'Na mesma tela, registre um amarelo para Carla. Confira a TV e a Central disciplinar. Anule o cartão, informando um motivo, e confira sua retirada da TV.'],
  ['period', 'Árbitro · intervalo e próximo tempo', 'Encerre o primeiro tempo e confirme o intervalo. O relógio deve parar e novos gols ficam bloqueados. Inicie o segundo tempo: a contagem do período começa em zero e o acumulado é preservado.'],
  ['correct', 'Árbitro · corrigir um lance', 'Registre e desfaça um gol. Confira que o placar e o aluno são corrigidos na TV, preservando os cartões válidos.'],
  ['two', 'Organização e TV · dois jogos simultâneos', 'Prepare os dois jogos de Basquete, no turno da tarde. Selecione somente esses dois para a TV. Lance uma cesta de 3 em um e uma de 1 no outro; confira autoria e placares separados.'],
  ['volley', 'Árbitro · conferir os sets', 'Em um Vôlei de ensaio, registre pontos e confirme o encerramento do set. Confira pontos zerados para o set seguinte, sets conquistados e parciais na TV.'],
  ['offline', 'Equipe · queda e retorno da internet', 'Desconecte a TV por alguns segundos. Ela deve avisar e preservar os dados. Faça um lance em outro aparelho e reconecte a TV: o placar deve se atualizar. No aparelho do árbitro, confira que lançamentos ficam bloqueados sem internet.'],
  ['prediction', 'Participante · palpite e resultado', 'Em uma janela privada, entre como professor e envie um palpite antes de iniciar outra partida. Encerre esse jogo pela organização e confira a pontuação do participante.'],
  ['review', 'Equipe · revisar o ensaio', 'Confira a conexão e a leitura da TV no local do evento, defina quem opera cada quadra e registre as pendências abaixo. Salve o relatório do ensaio.'],
]
function loadProgress() {
  if (!isRehearsal) return {}
  try { return JSON.parse(readPreference(key, '{}')) || {} } catch { return {} }
}

export default function RehearsalGuide({ onLive }) {
  const [progress, setProgress] = useState(loadProgress)
  const [notes, setNotes] = useState(() => isRehearsal ? readPreference(`${key}-notes`, '') : '')
  const count = tasks.filter(([id]) => progress[id]).length
  const update = (id, checked) => {
    const next = { ...progress, [id]: checked ? new Date().toISOString() : null }
    setProgress(next); writePreference(key, JSON.stringify(next))
  }
  return <section className="rehearsal-guide" aria-label="Ensaio geral da equipe">
    <div className="section-heading"><div><span className="eyebrow">Preparação para o evento</span><h2>Ensaio geral</h2><p>Uma rodada completa com quem vai operar. Cada etapa deve ser conferida pela equipe.</p></div><strong>{isRehearsal ? `${count} / ${tasks.length} etapas conferidas` : 'Roteiro do treinamento'}</strong></div>
    {!isRehearsal ? <div className="rehearsal-setup"><strong>Faça o treinamento no ambiente de ensaio</strong><ol><li>No computador com o projeto, abra <b>Iniciar-Ensaio.cmd</b>.</li><li>Aguarde a mensagem de que o ensaio está pronto e abra o endereço local abaixo.</li><li>Entre como <b>suporte</b>, com a senha fictícia <b>Ensaio2026!</b>, e abra esta aba.</li></ol><a className="btn btn-primary" href="http://127.0.0.1:5179/#login" target="_blank" rel="noreferrer">Abrir ensaio local ↗</a><p>O ensaio usa dados fictícios e não altera os jogos, alunos ou palpites oficiais.</p></div> : <div className="rehearsal-setup"><strong>Ambiente de ensaio ativo · dados fictícios</strong><p>Use outro aparelho ou uma TV conectada como segunda tela, ou abra outra janela do navegador. Para uma TV física, conecte o computador por HDMI ou espelhamento.</p><div className="form-actions"><button type="button" className="btn btn-primary" onClick={onLive}>Abrir operação dos jogos</button><a className="btn btn-outline" href="/#placar" target="_blank" rel="noreferrer">Abrir TV do ensaio ↗</a></div></div>}
    <div className="rehearsal-roles"><article><h3>Organizador e árbitro</h3><p>Login: <b>suporte</b></p><p>Opera partidas, alunos, períodos, cartões e seleção da TV.</p></article><article><h3>Professor participante</h3><p>Login: <b>professor@ensaio.local</b></p><p>Use uma janela privada para testar os palpites com outra conta.</p></article><article><h3>TV e consulta</h3><p>A TV abre sem login. Consulta: <b>sesivinhedo</b>.</p><p>A conta de consulta mantém seus cinco menus, sem edição.</p></article></div>
    <p className="form-hint">No ensaio, a senha dessas contas fictícias é <b>Ensaio2026!</b>. Os registros do checklist ficam neste navegador.</p>
    <div className="rehearsal-progress" aria-label="Progresso do ensaio"><progress max={tasks.length} value={count} /><span>{count} de {tasks.length}</span></div>
    <ol className="rehearsal-tasks">{tasks.map(([id, title, description]) => <li key={id} className={progress[id] ? 'is-complete' : ''}><label><input type="checkbox" checked={Boolean(progress[id])} disabled={!isRehearsal} onChange={(event) => update(id, event.target.checked)} /><span><strong>{title}</strong><span>{description}</span></span></label></li>)}</ol>
    <label>Pendências e observações do ensaio<textarea rows="4" disabled={!isRehearsal} value={notes} onChange={(event) => { setNotes(event.target.value); writePreference(`${key}-notes`, event.target.value) }} placeholder="Conexão, leitura da TV, responsáveis por quadra e ajustes necessários…" /></label>
    <div className="form-actions"><button type="button" className="btn btn-primary" disabled={!isRehearsal} onClick={() => {
      const content = [`Ensaio geral · Interclasse SESI Vinhedo`, new Date().toLocaleString('pt-BR'), `${count}/${tasks.length} etapas conferidas`, '', ...tasks.map(([id, title, description]) => `${progress[id] ? '[OK]' : '[PENDENTE]'} ${title}\n${description}${progress[id] ? `\nConferido em: ${new Date(progress[id]).toLocaleString('pt-BR')}` : ''}\n`), 'Pendências e observações:', notes || 'Sem observações registradas.'].join('\n')
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = 'relatorio-ensaio-interclasse.txt'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>Salvar relatório do ensaio</button><button type="button" className="btn btn-outline" disabled={!isRehearsal} onClick={() => { setProgress({}); writePreference(key, '{}') }}>Limpar marcações do checklist</button></div>
    <p className="form-hint">Para reiniciar os jogos fictícios, use <code>npm run ensaio:reiniciar</code> no computador do ensaio. Limpar o checklist altera apenas as marcações, sem apagar partidas.</p>
  </section>
}
