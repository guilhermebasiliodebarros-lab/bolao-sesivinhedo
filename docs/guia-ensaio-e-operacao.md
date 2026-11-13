# Ensaio e operação do Interclasse

## Abrir o ambiente de treino

Na pasta do projeto, dê dois cliques em **Iniciar-Ensaio.cmd**, ou abra um terminal nessa pasta e execute:

```powershell
npm run ensaio
```

Mantenha a janela do terminal aberta. A primeira execução pode baixar os emuladores e preparar Java portátil no cache do computador. O ambiente usa o projeto fictício `demo-interclasse-ensaio`, autenticação e banco locais. O app identifica o ensaio com uma faixa amarela. O modo de treino não pode ser compilado para publicação.

Abra no computador:

- Site de treino: <http://127.0.0.1:5179/#login>
- Placar de treino: <http://127.0.0.1:5179/#placar>

**Credenciais exclusivas do ensaio — senha `Ensaio2026!`:**

| Acesso | Login | Uso |
| --- | --- | --- |
| Organização | `suporte` | Jogadores, presença, início, placares e resultados |
| Participante | `professor@ensaio.local` | Enviar palpites e acompanhar a pontuação |
| Consulta | `sesivinhedo` | Calendário, chaveamento, simulador, regulamentos e estatísticas |

Use uma janela normal para a organização, uma janela anônima/InPrivate para o professor e outra aba da janela da organização para o placar. Assim os logins ficam separados. Há seis jogos fictícios: futebol, handebol, dois de basquete e dois de vôlei, com equipes e jogadores de exemplo. O horário é definido para aproximadamente 90 minutos depois da criação do ensaio; você pode iniciar manualmente antes desse horário para praticar.

No ensaio, futebol e vôlei ficam na aba **Manhã**; handebol e basquete ficam na aba **Tarde**. A escola utiliza manhã para 9º e Ensino Médio e tarde para 6º, 7º e 8º.

Para voltar aos dados iniciais, mantenha o ensaio aberto e execute em outro terminal:

```powershell
npm run ensaio:reiniciar
```

Depois, atualize as janelas e entre novamente nas contas de treino. Para encerrar, use **Ctrl+C** no terminal do ensaio. Para usar uma TV física durante o treino, espelhe o computador ou conecte-o por HDMI: o endereço `127.0.0.1` funciona neste computador, não em outro dispositivo.

## Checklist com a equipe

Abra **Painel master → Ensaio geral**. No ambiente fictício, a aba permite marcar as etapas conferidas, registrar pendências e salvar um relatório de texto. As marcações ficam neste navegador; elas representam a conferência feita pela equipe, não uma aprovação automática. No site oficial, a mesma aba mostra como abrir o ambiente de treino.

Distribua os papéis: um organizador controla a seleção da TV, cada árbitro opera sua quadra e um professor testa os palpites em outra janela. Use **Abrir operação dos jogos** para ir à central. A TV fica em uma segunda aba, monitor ou projeção.

Para simular uma queda apenas na aba da TV durante o ensaio local, abra as ferramentas do navegador com **F12 → Rede → Offline**. Registre um lance na janela da organização, volte a aba da TV para **Online/Sem limitação** e confira a recuperação. O diagnóstico deve mostrar **Sem internet** durante a queda e **TV conectada** após confirmar os dados. Para a conferência física, teste a conexão e a leitura da TV no local antes dos jogos.

## Roteiro de teste completo

1. **Enviar um palpite antes do início.** Na janela do professor, vá a **Jogos** e envie `2 × 1` para o futebol `9º A × 9º B`. No vôlei, o palpite é em **sets**, por exemplo `2 × 0`.
2. **Conferir os atletas.** Na organização, abra **Jogadores**, selecione a equipe e confira os nomes. Você pode cadastrar outro jogador fictício para praticar.
3. **Preparar a partida.** Abra **Ao vivo / TV**, escolha a partida em **Partida para iniciar** e clique em **Preparar partida**. Use **Todos presentes · equipe A/B**, confira local, área, coletes diferentes e duração.
4. **Iniciar.** Clique em **Salvar e iniciar agora**. O cronômetro deve iniciar, a partida deve ficar ao vivo e os palpites desse jogo devem ficar bloqueados.
5. **Colocar na TV.** Em **Escolher jogos do placar**, marque o jogo e clique em **Transmitir seleção**. Um jogo ocupa a tela inteira; dois ficam lado a lado. Partidas não selecionadas ficam fora do placar.
6. **Marcar os lances.** No futebol, faça dois gols de Ana na equipe A e um de Carla na B. Veja o placar da outra janela chegar a `2 × 1` e mostrar o primeiro nome do autor.
7. **Corrigir um erro.** Acrescente um gol por engano e use **Desfazer último lance**. Teste também **Equipe errada? Corrigir**, selecionando o autor da equipe correta. O placar e as estatísticas devem acompanhar a correção.
8. **Pausar o tempo.** Use **Pausar cronômetro**; confira o tempo parado na TV. Depois clique em **Retomar cronômetro**.
9. **Encerrar.** Confira o placar e clique em **Encerrar partida → Encerrar e publicar resultado**. A TV mantém o resultado escolhido, e o palpite do professor deve receber `4,2` pontos.
10. **Dois jogos simultâneos.** Inicie as duas partidas de basquete ou vôlei, usando áreas distintas, e transmita as duas. Lance pontos em uma e confirme que somente o placar correspondente muda.
11. **Vôlei.** Registre pontos, use **Encerrar set → Confirmar encerramento do set** e confira os pontos zerados para o próximo set e o aumento no total de sets. Na melhor de três do ensaio, encerre a partida após dois sets vencidos. O palpite usa o resultado de sets, não os pontos de uma parcial.
12. **Estatísticas e consulta.** Abra **Estatísticas** e confira os atletas e totais. Entre também como `sesivinhedo` para verificar os cinco menus de consulta.

Cada clique de lance deve ser seguido da confirmação e da atualização do placar. Enquanto o sistema está gravando, os botões ficam bloqueados para evitar registros duplicados.

## Como registrar gols, pontos e nomes no evento

### Cadastrar e disponibilizar o jogador

Em **Painel master → Jogadores**, selecione a equipe da modalidade e cadastre o **Nome do jogador**. Na preparação da partida, confirme a presença desse atleta. Somente jogadores marcados como presentes entram na lista de autores.

Se o jogo já começou, use **Presença** para conferir um atleta que entrou depois. Em seguida, use **Atualizar alunos** no lançamento de lances, quando necessário.

### Lançar durante a partida

Em **Ao vivo / TV**, localize a partida em andamento. **Abrir modo árbitro** mostra os controles ampliados para operar pelo celular ou computador.

| Modalidade | Como lançar |
| --- | --- |
| Futebol e handebol | Escolha o atleta em **Quem marcou para…?** e clique em **+1 GOL** da equipe. Também é possível tocar diretamente no botão com o nome do atleta. |
| Basquete | Primeiro escolha **+1 ponto**, **+2 pontos** ou **+3 pontos**. Depois escolha o autor e use o botão da equipe, ou toque no nome do atleta. |
| Vôlei | Escolha o autor e registre **+1 PONTO**. Para ponto coletivo ou erro adversário, use **Sem autor / ponto coletivo**. Ao terminar a parcial, encerre e confirme o set. |

Na TV e nas estatísticas públicas aparece o primeiro nome do aluno. O cadastro completo e a presença ficam na área da organização. Lances sem autor atualizam o placar, mas não contam na estatística individual de nenhum atleta.

Para preservar a artilharia, prefira **Desfazer último lance**, **Excluir gol/ponto** ou **Equipe errada? Corrigir**. A opção **Correção manual do placar e parciais** reinicia os lances e autorias anteriores exibidos naquela partida.

### Operação reunida no modo árbitro

Em **Ao vivo / TV → Abrir modo árbitro**, a mesma tela reúne o relógio, períodos, gols/pontos, alunos presentes, cartões e encerramento. **Conferir alunos e presença** permite atualizar a escalação sem sair da arbitragem. O cadastro de alunos novos continua na aba **Jogadores**.

Em **Cartões da partida**, escolha equipe, aluno e cor; use **Revisar cartão → Confirmar cartão**. O minuto é automático, com opção de informar manualmente. É possível anular o cartão nessa tela informando um motivo. A Central disciplinar e a TV acompanham as alterações.

### Tempos, períodos e intervalo

Futebol e handebol começam com dois tempos; basquete começa com quatro períodos. Em **Formato da partida**, a organização pode escolher tempo único, dois tempos ou quatro períodos antes de encerrar o primeiro. O vôlei continua sendo controlado pelos sets.

Use **Encerrar 1º tempo/período → Confirmar intervalo**. O relógio para e novos gols/pontos ficam bloqueados, mantendo cartões e correções disponíveis. Depois use **Preparar 2º tempo/período → Iniciar 2º tempo/período**. O relógio do novo período começa em zero; o acumulado e os minutos dos gols são preservados. A TV mostra o período e o acumulado. O último período não encerra a partida automaticamente: confirme o resultado em **Encerrar partida**.

### Diagnóstico da transmissão

No rodapé do placar, toque em **TV conectada**, **Sem internet** ou no aviso de conexão para abrir **Diagnóstico da TV**. No Modo TV rotativo, o indicador fica junto aos controles do cabeçalho. O diagnóstico informa quando os placares e a seleção foram confirmados pelo servidor e permite **Verificar conexão agora**.

Sem confirmação por mais de 75 segundos nos placares ou 135 segundos na seleção, aparece um aviso de dados atrasados, mantendo os últimos dados. A ausência de novos gols não causa esse aviso: as confirmações são periódicas mesmo sem lances. Um cronômetro em movimento, sozinho, não prova que a conexão está funcionando.

### Cartões no placar ao vivo

Em **Painel master → Central disciplinar**, escolha a equipe, o atleta e **Cartão amarelo** ou **Cartão vermelho**. Vincule a **Partida da ocorrência** e registre o motivo. Durante o jogo, o minuto vem automaticamente do cronômetro; para um lançamento atrasado, preencha **Minuto do cartão**. Ao registrar, a TV mostra a cor do cartão, o primeiro nome do aluno e o minuto, separados por equipe. O motivo continua na área da organização.

**Anular registro** retira o cartão da TV e mantém o histórico privado da decisão. Cartões sem partida vinculada ficam apenas na Central disciplinar. Advertências e suspensões também continuam nessa central, com as regras de suspensão existentes.

Os gols permanecem visíveis com uma bola, o primeiro nome e os minutos. Quando há muitos lances, a lista alterna páginas automaticamente a cada dez segundos. O botão **Voltar**, no topo do placar, retorna ao Modo TV e encerra a tela cheia.

### Publicar o resultado e pontuar os palpites

O encerramento é manual: **Encerrar partida → Encerrar e publicar resultado**. O sistema recalcula a classificação dos participantes. Exemplo de resultado final `2 × 1`:

| Palpite | Pontos |
| --- | ---: |
| `2 × 1`: placar exato | 4,2 |
| `2 × 0`: vencedor e placar de uma equipe | 3,6 |
| `3 × 0`: somente o vencedor | 3 |
| `0 × 1`: resultado errado | 0 |

Palpites fecham cinco minutos antes do horário do jogo e também ficam bloqueados quando a organização inicia a partida. A conta master opera o evento; a conta `sesivinhedo` é de consulta. Para participar dos palpites, utilize uma conta normal de participante.

## Preparação do site oficial

Na consulta de 13/11/2026 foram encontrados **120 jogos, 119 sem data/horário, nenhum jogador cadastrado e nenhum jogo aberto para palpites**. Antes do evento:

- Defina a programação dos jogos e confira o turno correto.
- Cadastre os atletas nas equipes de cada modalidade.
- Confira quais jogos devem receber palpites e use as ações da lista **Jogos** para abri-los após definir o horário.
- Teste o navegador e a conexão da TV no local. O endereço oficial do placar é <https://bolao-sesivinhedo.web.app/#placar>.

## Repetir a validação automática

Com o ensaio em execução, em outro terminal:

```powershell
npm run validar:ensaio
```

Para conferir especificamente a operação unificada, períodos, cartões, diagnóstico, queda de internet e checklist:

```powershell
npm run validar:operacao
```

Os dois comandos reiniciam os mesmos jogos fictícios; execute um de cada vez. O segundo grava `artifacts/rehearsal/operations-result.json` e imagens da arbitragem e da TV.

Esse comando reinicia os dados fictícios e opera os formulários em navegadores separados. Ele usa o SDK e as regras reais dos emuladores, sem substituir os serviços por respostas simuladas. O navegador dos testes bloqueia requisições externas. O relatório fica em `artifacts/rehearsal/last-result.json`, com imagens da operação e da TV na mesma pasta.

Os testes gerais do projeto continuam disponíveis com `npm test`.
