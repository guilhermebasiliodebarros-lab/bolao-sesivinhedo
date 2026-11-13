# Bolão SESI Vinhedo

Aplicação React + Vite para cadastro de participantes, login, palpites, ranking automático e painel master com Firebase Authentication e Firestore.

## Ensaio antes do evento

Para experimentar o placar sem sair do sistema, abra **Painel master → Ensaio geral → Iniciar modo de teste**. A simulação cria seis jogos e alunos fictícios apenas na memória do navegador. Use os mesmos controles de arbitragem para gols, pontos, cartões, presença, relógio e períodos; a prévia reutiliza o mesmo componente da TV oficial e pode ser ampliada. Futebol e handebol mostram um jogo; basquete e vôlei mostram dois. Reiniciar ou sair descarta somente os dados fictícios. O modo não faz gravações no Firebase nem muda a seleção da TV oficial, e não depende de um servidor de ensaio.

O ambiente abaixo é opcional para conferir também autenticação, palpites e comunicação com o banco de teste:

Use **Iniciar-Ensaio.cmd** ou `npm run ensaio` para praticar com autenticação, jogos, jogadores e palpites fictícios em um banco local. Abra `http://127.0.0.1:5179/#login`; a senha das contas de treino é `Ensaio2026!`. A organização usa `suporte`, o participante usa `professor@ensaio.local` e a consulta usa `sesivinhedo`. O projeto `demo-interclasse-ensaio` é separado do Firebase oficial e só é ativado no servidor de desenvolvimento em modo `rehearsal`.

Com o ensaio aberto, `npm run validar:ensaio` repete o fluxo integrado pela interface. `npm run ensaio:reiniciar` restaura os dados fictícios. Veja o [guia de ensaio e operação](docs/guia-ensaio-e-operacao.md) e o [relatório de preparação](docs/validacao-completa-2026-11-13.md).

## Configuração do Firebase

1. Crie um projeto no Firebase Console.
2. Ative Authentication > Sign-in method > Email/Password.
3. Ative Firestore Database.
4. Copie `.env.example` para `.env.local`.
5. Preencha as variáveis:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

As chaves reais ficam somente em `.env.local`; não coloque credenciais diretamente no código.

O build exige todas essas variáveis e interrompe a publicação se alguma estiver ausente. O deploy do Hosting executa o build automaticamente para publicar a configuração atual.

## Primeiro usuário master

1. Crie o usuário normalmente pela tela de cadastro ou pelo Firebase Authentication.
2. Abra Firestore Database > `users`.
3. Selecione o documento do usuário.
4. Altere `role` de `"user"` para `"master"`.
5. Altere ou crie `participaRanking` como `false`.

O usuário master serve apenas para administração. Para participar do bolão, crie outra conta normal com `role: "user"`.

Contas de usuário autenticadas têm navegação restrita a **Painel**, **Jogos**, **Meus palpites** e **Classificação**, tanto no menu superior quanto no lateral. O logo leva ao Painel; links diretos para outras telas redirecionam ao Painel após o carregamento do perfil. Tema e saída da conta continuam disponíveis. Visitantes mantêm a navegação pública, e o master mantém suas telas de organização. Essa separação é da navegação do site; as permissões dos dados continuam sob as regras do Firestore.

## Coleções usadas

A conta compartilhada de consulta usa o nome e login **sesivinhedo** (`sesivinhedo@interclasse-sesivinhedo.local`), perfil `role: "viewer"` e `participaRanking: false`. Ela abre o Calendário e tem somente os menus Calendário, Chaveamento, Simulador, Regulamentos e Estatísticas. Links diretos para outras telas retornam ao Calendário. O simulador modifica apenas cenários locais, sem salvar resultados oficiais. As regras do Firestore bloqueiam gravações e acesso aos perfis de outros usuários para essa conta. A senha é definida no Firebase Authentication e não fica no código.

- `users`: perfil, role, pontos e flags de ranking.
- `games`: jogos, status e placar final.
- `predictions`: palpites por usuário e jogo.

Cada jogo tem um `limitePalpites` automático, exatamente **5 minutos antes do início**. Exemplo: jogo às 10h, fechamento às 9h55. A partir das 9h55, participantes não podem criar nem editar palpites, mesmo com a página aberta. O jogo também precisa estar aberto, sem ter começado e sem adiamento/cancelamento/W.O. Jogos sem data não aceitam palpites. Datas locais usam o horário de São Paulo para calcular o instante de fechamento.

Cadastro, edição de horário, reagendamento, terceiro lugar e reorganização da agenda recalculam o prazo. **Palpites até (automático)** mostra o limite sem edição manual. Ao abrir o painel master, uma sincronização ajusta os limites antigos dos jogos ainda agendados, em transações que leem o horário atual. Ela não altera os horários, os palpites já enviados ou os resultados; erros aparecem com opção de tentar novamente. O envio lê novamente a partida em transação e as regras do Firestore usam `request.time < limitePalpites`, com prazo obrigatório do tipo timestamp. Para ativar essa proteção no servidor publicado, publique também `firestore.rules` e abra o painel master atualizado para sincronizar os prazos existentes; publicar apenas o site não atualiza as regras.

Status de jogo:

- `aberto`: participantes podem criar ou editar palpites.
- `encerrado`: palpites bloqueados, placar ainda não finalizado.
- `finalizado`: placar lançado, palpites pontuados e ranking atualizado.

## Esportes e partidas ao vivo

O calendário e a página Jogos têm filtros por modalidade. No painel master, use **Esporte para gerenciar** para alternar entre as listas de jogos.

Na aba **Ao vivo / TV**:

1. Selecione uma partida e clique em **Iniciar jogo**. Os palpites desse jogo são fechados imediatamente.
2. Use **Atualizar placar** para transmitir o placar parcial. Várias partidas podem acontecer ao mesmo tempo.
3. Use **Encerrar partida** e confirme o placar final para publicar o resultado, avançar o chaveamento e recalcular o ranking.

O início é controlado pela organização; o horário programado sozinho não marca uma partida como ao vivo. Jogos antigos continuam agendados até serem iniciados, ou aparecem como resultado se já estavam finalizados.

## Modo TV

Abra `https://bolao-sesivinhedo.web.app/#tv` ou use **Modo TV** no menu. A tela pública usa o nome **Interclasse SESI Vinhedo**, mantém o logo e recebe os dados em tempo real. As páginas alternam entre partidas ao vivo, jogos de hoje, amanhã, outros dias e resultados. Cada página mostra até quatro partidas ao vivo ou seis jogos de um esporte. Os jogos ao vivo voltam entre as páginas da programação, com uma faixa de placares permanente.

Use o filtro por esporte, as abas da programação e os controles de página para escolher o que exibir. O intervalo pode ser de 8, 12, 20 ou 30 segundos; a opção fica salva no navegador. A programação considera o horário de São Paulo. Jogos atrasados e sem horário têm páginas próprias e não são marcados como ao vivo automaticamente. Sem conexão, a tela identifica que está exibindo os últimos dados recebidos.

## Jogadores das equipes

No painel master, abra **Times → Jogadores** na equipe desejada, ou use a aba **Jogadores** e selecione a equipe. Cadastre o nome do jogador e, se desejar, posição e indicação de capitão. Não há cadastro de número de camisa. O cadastro permite editar e remover jogadores.

Os jogadores ficam na subcoleção `teams/{teamId}/players`, com leitura e escrita restritas a usuários master. O cadastro de equipes público contém apenas a quantidade de jogadores. Excluir uma equipe também remove seu elenco.

## Organização do Interclasse

### Chaveamento público e simulador

Os menus **Chaveamento** (`#chaveamento`) e **Simulador** (`#simulador`) podem ser acessados sem login. Ambos recebem as modalidades, as equipes e as partidas públicas em tempo real, com seleção por esporte, turno e torneio.

- **Chaveamento:** mostra as tabelas oficiais dos grupos e as rodadas do mata-mata com conexões entre os jogos. As linhas seguem os vínculos registrados (`sourceGameIdA/B` ou `nextGameId`), sem adivinhar avanços pela ordem do calendário. Toque em uma partida para destacar seus antecedentes e o caminho até a final. O campeão só aparece com uma final oficial decidida, incluindo W.O. e desempate. No celular, o desenho tem rolagem horizontal própria.
- **Simulador:** permite preencher resultados hipotéticos apenas em jogos ainda sem resultado oficial da fase de grupos ou de todos contra todos. A tabela reaproveita as regras reais de pontos e desempate do sistema, com conferência dos sets do vôlei e meios pontos do xadrez. É possível destacar uma equipe e ajustar a faixa de classificação para explorar cenários. Empates no corte são sinalizados; a faixa escolhida não confirma uma vaga oficial e partidas restantes podem mudar as posições.
- Os cenários existem somente na memória da tela. Não gravam placares, palpites, ranking ou chaveamento no Firebase. Trocar o torneio, sair da tela ou usar **Limpar simulação** descarta os cenários. Se nomes, regras ou situação oficial de uma partida forem alterados enquanto ela estiver simulada, o cenário antigo é ignorado e a tela pede novo preenchimento. Resultados já finalizados, cancelamentos e W.O. permanecem oficiais.

As telas estão prontas no código local. A atualização do site publicado depende de uma nova publicação do Hosting. A suíte `tests/tournamentExplorer.test.mjs` cobre os vínculos, os turnos, as regras de placar, a imutabilidade dos resultados, os empates na faixa e as atualizações oficiais.

Todas as modalidades começam com as **14 turmas da escola**: 6º, 7º e 8º A/B no turno da tarde; 9º A/B e 1º, 2º e 3º A/B do Ensino Médio de manhã. Ao abrir o painel master, os esportes antigos recebem somente as turmas que faltam. Cadastros existentes são identificados também sem espaço, como `9ºA`, preservando seus IDs, nomes, jogadores e jogos. A turma, a categoria e o turno são preenchidos no cadastro existente quando necessário; categorias já informadas são preservadas. Modalidades novas são salvas junto das 14 equipes em uma única operação.

A preparação é registrada por modalidade em `schoolClassesVersion`, com IDs estáveis para as turmas novas. Reabrir o painel ou executar novamente não duplica equipes. Remoções feitas posteriormente pelo master não são desfeitas automaticamente. A separação por turno continua sendo respeitada nos jogos, nas listas e no gerador de chaveamento.

- **Identidade:** todo o site usa o nome Interclasse SESI Vinhedo, incluindo a área de palpites dos professores. O logo `public/logo-interclasse.png` preserva o escudo SESI Vinhedo.
- **Local e coletes:** em Jogos, informe quadra/sala, duração prevista e a cor de colete de cada equipe. Os dados aparecem nos jogos, no calendário e na TV.
- **Conflitos:** o sorteio cria os confrontos sem horários. A organização preenche a agenda depois; o início verifica a disponibilidade do local e das equipes. O local, a área, a duração e os coletes são definidos em **Preparar partida**. Para identificar turmas entre modalidades, preencha **Turma** no cadastro de cada time com o mesmo nome.
- **Placares por esporte:** em Esportes, configure gols, pontos, sets ou xadrez; no vôlei, melhor de 3 ou 5 sets. Em Ao vivo / TV, registre parciais de sets opcionais; xadrez aceita vitória, derrota ou empate de ½ ponto. Os pontos por vitória, empate e derrota são configuráveis para o regulamento escolar.
- **Avisos TV:** publique avisos, chamadas de equipes ou atrasos com validade. A chamada pode ser preenchida a partir de uma partida. É possível ocultar, exibir novamente ou remover; avisos vencidos saem da TV automaticamente.
- **Classificação por grupo:** no painel master, apresenta uma tabela para cada grupo do torneio, com filtros por modalidade e torneio. As equipes aparecem com zero pontos antes de jogar, e apenas os resultados finais da fase de grupos contam. Semifinais, finais e outros jogos sem grupo ficam fora dessa pontuação. Os critérios são pontos, vitórias, saldo, pontos/gols/sets a favor e nome. Esta tabela é independente dos palpites dos professores e não aparece no modo TV.
- **Importação de jogadores:** em Jogadores, selecione a equipe e abra **Importar jogadores de Word, PDF ou Bloco de notas**. Aceita Word `.docx`, PDF e texto `.txt`, ou nomes colados. Arquivos Word antigos `.doc` devem ser salvos como `.docx`. Use um nome por linha ou tabela com Nome, Posição e Capitão; documentos de até 15 MB e PDFs de até 20 páginas. PDFs sem texto passam por OCR em português, com recursos hospedados no próprio site. Revise a prévia, desmarque entradas indevidas e confirme a importação. Nomes repetidos são ignorados. O arquivo é lido no navegador; apenas os jogadores selecionados são gravados na equipe.

## Situação das partidas e súmulas

Na lista de **Jogos**, abra **Situação da partida** para adiar, cancelar, registrar W.O. ou reagendar. Partidas ao vivo também têm este botão na central **Ao vivo / TV**. A alteração tem uma etapa de revisão e exige um motivo público, mostrado no calendário e na TV.

- **Adiar:** tira a partida dos jogos ao vivo e da agenda de próximos jogos, bloqueando os palpites. Preserva o placar parcial para retomada.
- **Reagendar:** define novo dia/horário e recalcula o prazo dos palpites para 5 minutos antes. Reabrir palpites exige uma escolha explícita e só é permitido se a partida ainda não começou. Ao iniciar novamente uma partida interrompida, o placar parcial e os sets são preservados.
- **Cancelar:** identifica a partida como cancelada, sem pontos para a classificação nem para os palpites. Para recuperá-la, use Reagendar.
- **W.O.:** escolha a vencedora e, opcionalmente, o placar regulamentar conforme o esporte. Sem placar informado, o sistema atribui os pontos de vitória e derrota configurados, sem inventar gols/pontos para o saldo. O W.O. atualiza a classificação do grupo e o avanço de fase; os palpites do bolão ficam anulados. Resultados não podem ser alterados quando uma partida dependente já começou.

A TV mantém a classificação fora da transmissão. A página **Alterações** reúne jogos adiados e cancelados; W.O. aparece nos resultados, identificado claramente.

Em **Súmula / PDF**, preencha arbitragem, responsáveis das equipes e observações. **Salvar súmula** mantém esses dados no sistema. **Baixar PDF** gera um arquivo A4 com o logo Interclasse, local, coletes, situação, placar/parciais, jogadores opcionais e espaços para presença e assinaturas. O PDF pode ser emitido antes do jogo, sem resultado inventado; usa os dados atuais do formulário. As anotações ficam em `games/{gameId}/documents/matchReport`, com leitura e escrita restritas a master, assim como os elencos. O motivo da alteração é público; as observações da súmula são privadas.

A geração do PDF usa [jsPDF](https://github.com/parallax/jsPDF) e [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable), com a fonte Noto Sans hospedada localmente para preservar os acentos.

## Desempate, presença e chamadas automáticas

- **Desempate:** em uma partida de mata-mata de gols ou pontos, um placar normal empatado abre os campos de desempate. Use pênaltis para modalidades de gols, ou prorrogação para gols/pontos. Na prorrogação, informe apenas os pontos/gols do período extra. O resultado do desempate define quem avança, mas o placar normal continua separado para os palpites. Não é possível encerrar um mata-mata empatado sem definir uma vencedora no desempate. A TV, o calendário e a súmula mostram o desempate separadamente.
- **Presença:** use **Preparar partida** para conferir as equipes e jogadores junto com o local, a área e os coletes. Também é possível consultar e salvar a presença separadamente em **Mais opções → Conferir presença**. Marque cada equipe e jogador como Presente, Ausente ou Não conferido. O início exige as duas equipes presentes; se houver elenco, todos os jogadores precisam estar conferidos e ao menos um presente por equipe. Se as equipes mudarem, a conferência precisa ser refeita. Nomes e presença individual são privados em `games/{gameId}/documents/attendance`; apenas a confirmação das equipes fica no jogo público. O PDF inclui a presença salva e o elenco conferido.
- **Chamadas automáticas:** em **Avisos TV**, ative/desative e ajuste a antecedência para 5, 10, 15, 20 ou 30 minutos. O padrão é ativo com 10 minutos. A TV chama as equipes dos jogos agendados dentro dessa janela, informando modalidade, quadra/local, horário e minutos restantes. A chamada sai no horário de início ou assim que a organização inicia, adia ou cancela a partida. Alterações de horário e local são refletidas automaticamente. Várias chamadas se alternam com os avisos manuais; o filtro por modalidade da TV também se aplica às chamadas automáticas. As preferências ficam em `broadcastSettings/tv`.

## Preparação e ações da partida

A lista de jogos mostra uma ação principal e **Mais opções**. Em jogos agendados, **Preparar partida** abre uma conferência única: equipes definidas e presentes, jogadores conferidos, local, área e cores de colete diferentes. **Salvar conferência** mantém a partida agendada e não altera o prazo dos palpites. Depois de preparada, a ação principal muda para **Iniciar agora**. É possível usar **Salvar e iniciar agora** se a partida já deve começar. **Mais opções → Revisar conferência** permite ajustar a preparação.

Em **Ao vivo / TV → Prontas para iniciar**, selecione várias partidas preparadas e use **Iniciar partidas selecionadas** para publicar o mesmo início para todas. A operação é uma transação: se uma partida estiver indisponível, nenhuma será iniciada parcialmente. O controle privado `operations/liveMatches` coordena inícios por usuários diferentes e verifica conflitos no momento do início. A preparação pode ser salva enquanto a área está ocupada. Ao iniciar, os palpites são bloqueados e a TV atualizada.

Para basquete e vôlei simultâneos, use o mesmo **Local**, por exemplo **Quadra principal**, e **Áreas** diferentes: **Basquete** e **Vôlei**. A área aparece no calendário, na TV, nas chamadas e no PDF. Sem área, a partida reserva o local inteiro. Xadrez não exige coletes; use sala e mesa próprias para permitir partidas simultâneas. O responsável opcional fica apenas na conferência privada e no PDF; um organizador com acesso ao painel pode usar o filtro de Xadrez para acompanhar suas partidas. Uma equipe sem elenco pode ter a presença confirmada pela organização sem cadastrar nomes antes do jogo.

Mudanças de equipes, horário, local, área, coletes, elenco ou presença invalidam a conferência quando aplicável. O início confere novamente os dados atuais. Ao vivo, a ação principal vira **Abrir placar**, que reúne atualização, desempate e encerramento. Editar, reagendar, W.O., súmula, reabertura e exclusão ficam em **Mais opções**.

## Regras do Firestore

O arquivo `firestore.rules.example` traz uma base de segurança para impedir que participantes alterem `role`, pontuação ou dados de outros usuários. Revise no Firebase Console antes de publicar como `firestore.rules`.

## Central de pendências

O painel abre na **Central de pendências**, com filtros por modalidade, programação, busca e situação, além de páginas de até 12 partidas. Cada jogo aparece uma única vez: resultado a conferir, início atrasado, adiado, pronto, conferência pendente ou equipes a definir. Os atalhos abrem a preparação, o início validado, o placar ou o reagendamento existentes. O atalho **Iniciar partidas juntas / Ao vivo** abre a seleção de partidas preparadas. Jogos concluídos e cancelados saem da central; jogos ao vivo dentro da duração prevista ficam em **Ao vivo / TV**. Após a duração prevista, a central pede que o responsável confira o andamento ou resultado, sem encerrar automaticamente. Os avisos se atualizam a cada 30 segundos e usam o fuso de São Paulo. A central é somente da organização e não aparece na TV.

## Manhã e tarde

As abas **Manhã** e **Tarde** separam o cadastro de equipes por esporte e a operação dos torneios. **Manhã** reúne 9º A/B e 1º, 2º e 3º A/B do Ensino Médio (oito equipes); **Tarde** reúne 6º, 7º e 8º A/B do Fundamental II (seis equipes quando cadastradas). A aba Tarde começa vazia: o sistema não cria essas equipes automaticamente. Cadastre cada equipe na aba do turno correspondente, em cada modalidade.

Ao trocar de turno, a seleção de equipes e a prévia do chaveamento são limpas. O gerador usa somente as equipes do turno selecionado e inicia com dois grupos de quatro pela manhã ou dois grupos de três à tarde. Cada turno recebe um torneio independente, mesmo que os nomes dos torneios sejam iguais. Partidas e equipes novas salvam `turno: manha|tarde`; a gravação rejeita equipes de turnos diferentes na mesma partida e jogos de outro turno no mesmo torneio. A preparação verifica novamente as equipes. Jogos, jogadores, pendências, classificação por grupo, estatísticas e programação diária no painel seguem a aba selecionada. O controle de ocupação do local continua considerando todas as partidas ao vivo.

Os cadastros antigos reconhecem o turno pela turma ou pelo nome da equipe; semifinais e finais herdam o turno identificado no restante do torneio. Essa compatibilidade mantém IDs, elencos, palpites e horários existentes. O turno não é deduzido pelo horário do jogo. No calendário, na lista de jogos, nas estatísticas públicas e nos ajustes da TV, é possível filtrar o turno. As páginas de agenda da TV e as tabelas de classificação/estatísticas são separadas por turno; os rótulos das partidas e dos PDFs identificam manhã ou tarde.

## Distribuição dos jogos

O gerador distribui confrontos de grupos e todos contra todos em rodadas: uma equipe participa uma vez por rodada, e as rodadas dos grupos são combinadas na agenda. Isso evita concentrar todos os jogos de uma equipe em sequência. Os grupos e confrontos do sorteio continuam os mesmos. Com poucas equipes, podem existir jogos seguidos inevitáveis; o sistema apresenta esse aviso na reorganização.

Para um torneio já salvo, use **Jogos → Torneios criados → Reorganizar ordem dos jogos**. A prévia mostra horários atuais e novos, jogos seguidos e quantidade de outras partidas entre participações. **Aplicar nova ordem** reorganiza apenas partidas futuras de grupos/liga que ainda não começaram, usando os horários já existentes no mesmo dia, local e área. Mata-mata e partidas iniciadas não são movidos. A alteração preserva IDs, confrontos, grupos, palpites e demais dados; move o prazo de palpites pelo mesmo deslocamento de cada jogo e invalida a preparação quando o horário muda. A gravação é uma transação que confere novamente a versão das partidas e a prévia aprovada. Intervalo em quantidade de partidas não equivale a minutos de descanso: a duração efetiva de cada partida deve ser considerada pela organização.

## Registro dos lances

Em **Ao vivo / TV**, **Abrir placar** e **Modo árbitro**, cada equipe tem placar destacado, escolha **Quem marcou?** e botão grande de **+1 GOL** ou **+ PONTO**. Escolha o aluno e toque no botão, ou use os botões com nomes para registrar diretamente. As listas ficam abertas na central Ao vivo / TV e no modo árbitro. O painel mostra o nome cadastrado; o lance público e a TV recebem somente o primeiro nome. **Sem autor** atende pontos coletivos, erros do adversário e partidas sem elenco. **Atualizar alunos** recarrega a conferência; alterações na presença também atualizam a lista automaticamente. Um autor que deixe de estar presente precisa ser substituído na seleção. Futebol e handebol somam gols; basquete oferece 1, 2 ou 3 pontos. No vôlei, os pontos pertencem ao set atual, separados do placar de sets. **Encerrar set** pede confirmação, registra a parcial e zera os pontos do próximo set. A decisão de encerrar segue o regulamento da escola; não existe encerramento automático aos 25 ou 15 pontos. Xadrez mantém o lançamento do resultado da partida.

**− Excluir gol/ponto** retira o lance recente mais novo daquela equipe, mesmo que a adversária tenha marcado depois. Em **Lances recentes**, cada gol ou ponto elegível também pode ser excluído individualmente. **Equipe errada? Corrigir** permite transferir o lance para a adversária, escolhendo um aluno presente dela ou Sem autor e confirmando a equipe correta. O valor da cesta, os outros lances, seus minutos e a pontuação dos demais atletas são preservados. As estatísticas de autoria são corrigidas junto com o placar; não é necessário zerar os autores. No vôlei, esses controles atuam somente no set em andamento. Pontos de sets encerrados exigem reabrir o set, quando for o último lance, ou usar a correção manual de parciais. Os botões ficam bloqueados sem internet, durante a gravação e após a partida sair do estado ao vivo.

As correções dos oito lances recentes são gravadas com conferência de versão e identificador de requisição, em uma única operação, mantendo o registro privado da alteração. Os checkpoints posteriores são refeitos para que **Desfazer último lance** continue funcionando após corrigir um lance anterior. O mesmo pedido não é aplicado duas vezes e um placar alterado por outro operador precisa ser conferido novamente.

**Desfazer último lance** restaura o placar, os pontos do set, as parciais e os autores correspondentes, inclusive ao desfazer um set encerrado. O registro usa transações, identificadores de requisição e versão do placar para impedir duplicações por repetição e sobrescritas por outros dispositivos. Rascunhos de correção e confirmações de resultado precisam ser atualizados quando outro operador muda o placar. Uma correção manual reinicia os lances e autores exibidos na TV, mantendo os registros técnicos privados em `games/{gameId}/events/{eventId}`; essa coleção é restrita a master. Apenas os últimos oito lances e os resumos de autores, já com primeiro nome, ficam no jogo público. Não é publicada a lista completa de jogadores ou presenças.

A TV destaca placar, local, pontos do set, cronômetro e último lance, com bola e minuto nos gols. Os autores dos gols aparecem por equipe. Logo, controles e relógio ficam em uma única linha no topo; em telas estreitas, a faixa de controles permite rolagem lateral. Em tela cheia, os controles ficam recolhidos em **Ajustes da TV**; ao sair da tela cheia, reaparecem automaticamente. O padrão é duas partidas ao vivo por página, com opção de quatro em telas de pelo menos 1.000 pixels de altura. Telas menores usam quatro jogos de agenda por página; as maiores usam até seis. As páginas continuam alternando modalidades e trazendo os jogos ao vivo de volta à rotação. O logo Interclasse permanece.

## Placar fixo para TV

Abra `https://bolao-sesivinhedo.web.app/#placar` no navegador da TV, sem exigir login, ou use **Painel master → Placar para TV**. A central **Ao vivo / TV** também abre o placar em outra aba, para continuar operando os jogos. O Modo TV com programação rotativa continua disponível.

Em **Painel master → Ao vivo / TV → Escolher jogos do placar**, marque uma ou duas partidas e clique em **Transmitir seleção**. Um jogo ocupa a tela inteira; dois ficam lado a lado. A TV mostra somente as partidas escolhidas e recebe a troca em tempo real, inclusive quando a seleção é feita em outro computador ou celular. Os filtros de modalidade, turno e busca ajudam a localizar as partidas no seletor. Escolher uma partida para a TV não inicia nem encerra o jogo.

O placar não inclui automaticamente outros jogos, agenda, resultados de partidas diferentes ou rotação de páginas. Ao encerrar uma partida selecionada, o resultado final permanece até a organização trocar a seleção. Para deixar a TV em espera, use **Limpar seleção → Colocar TV em espera**. A seleção compartilhada fica em `broadcastSettings/scoreboard`, separada das opções de cronômetro e chamadas. Apenas a conta master pode alterá-la. Uma revisão impede que dois operadores sobrescrevam escolhas concorrentes; partidas removidas, canceladas ou adiadas não são substituídas por outras.

O vôlei mostra os pontos do set atual em tamanho grande, com sets conquistados e parciais separados. Os placares e a seleção usam assinaturas em tempo real e reconexão automática. A TV solicita manter a tela ligada quando o navegador permite. Sem conexão, preserva a última seleção e os últimos dados recebidos. Fora da tela cheia, os controles ficam visíveis; em tela cheia, reaparecem com mouse, toque ou teclado. **Ajustar placar da TV → Copiar link desta TV** compartilha o endereço público, que acompanha a mesma seleção da organização em todos os dispositivos. A conta `sesivinhedo` mantém seus cinco menus de consulta.

O botão **Voltar** retorna à página principal do site e encerra a tela cheia. Os lances ficam separados por equipe: bola, primeiro nome do aluno e minutos dos gols; pontos identificam o valor da cesta. Cartões amarelos e vermelhos registrados na **Central disciplinar**, com a partida vinculada, aparecem automaticamente com primeiro nome e minuto. O minuto usa o cronômetro ao vivo ou o valor informado pela organização. Anular o cartão remove sua exibição na TV, preservando o registro privado. Motivos e decisões disciplinares permanecem restritos à organização. Listas com mais de três linhas por equipe alternam páginas a cada dez segundos.

## Controle do tempo de jogo

O controle de períodos permite tempo único, dois tempos ou quatro períodos. Futebol e handebol usam dois tempos por padrão; basquete, quatro períodos. A organização pode alterar o formato durante o primeiro período, antes de iniciar o intervalo. **Encerrar tempo/período → Confirmar intervalo** pausa o relógio e bloqueia novos gols/pontos, preservando cartões e correções. **Preparar próximo período → Iniciar** retoma o jogo com o relógio do período em zero. O acumulado e os minutos dos lances são preservados. A TV mostra o período ou intervalo e o tempo acumulado. O encerramento da partida continua manual. O vôlei permanece controlado pelos sets.

Ao iniciar uma partida, o cronômetro começa automaticamente. Em **Ao vivo / TV** ou **Abrir placar**, use **Pausar cronômetro** e **Retomar cronômetro**. A pausa mantém a partida ao vivo, a área ocupada e os palpites bloqueados. O tempo acumulado e o instante da retomada ficam salvos no jogo; trocar de tela ou recarregar não reinicia a contagem. Não há gravações a cada segundo. Controles concorrentes verificam a versão atual antes de alterar a contagem. Encerrar, adiar, cancelar ou registrar W.O. interrompe a contagem; retomar uma partida adiada preserva o tempo já jogado, e reabrir uma partida concluída zera o cronômetro.

A duração prevista serve como aviso visual, sem encerrar o jogo automaticamente. A Central de pendências considera o tempo de jogo e desconta pausas dos novos cronômetros. Jogos antigos ao vivo usam o início registrado até o primeiro controle do cronômetro. Em **Avisos TV**, a opção **Exibir cronômetros das partidas ao vivo na TV** controla a exibição para todos os televisores; o padrão é exibir. Cada jogo simultâneo tem sua própria contagem. A TV usa duas partidas por página como padrão; a opção de quatro depende de uma tela com pelo menos 1.000 pixels de altura.

## Agenda visual por dia e quadra

Em **Painel master → Programação / PDF**, a **Agenda visual dos jogos** reúne as modalidades do turno selecionado. Escolha o dia, a modalidade e a faixa de horários; a grade pode usar intervalos de 15, 30 ou 60 minutos. Cada coluna representa uma quadra/local, incluindo **Local a definir**. **Adicionar local** cria uma coluna; o nome passa a integrar a agenda salva quando uma partida é agendada nele. Partidas fora da faixa exibida continuam acessíveis numa lista abaixo da grade.

Arraste uma partida sem data ou já agendada até a posição desejada. O movimento abre uma prévia com dia/horário, duração, quadra e área; somente **Salvar na agenda** grava a mudança. **Agendar** e **Editar agenda** oferecem o mesmo fluxo por teclado e no celular. A edição mantém IDs, equipes, vínculos do torneio, palpites e situação aberta/fechada; recalcula o fechamento para 5 minutos antes e invalida a conferência anterior. Jogos iniciados, finalizados, adiados, cancelados ou em exclusão não podem ser movidos.

Os avisos consideram duração completa, quadra/área e turmas em modalidades diferentes, inclusive jogos ocultos pelos filtros. Também avisam quando uma fase anterior vinculada não tem horário ou ainda estaria em andamento. A organização pode confirmar os conflitos apresentados para salvar mesmo assim. Ao gravar, o serviço relê a agenda e recusa uma partida alterada ou conflitos novos que ainda não foram conferidos. Novas partidas criadas simultaneamente em outra sessão podem exigir nova revisão da grade.

## Exclusão de jogos em lote

Em **Painel master → Jogos**, use **Excluir todos / em lote**. A janela começa na modalidade e turno atuais e permite filtrar por torneio. Para remover todos os jogos, escolha **Todas as modalidades**, **Todos os turnos** e todos os torneios. A prévia lista os confrontos e informa quantos jogos e palpites serão apagados. Confira a seleção, marque a confirmação e clique em **Excluir N jogo(s)**; cancelar não remove nada.

A exclusão remove jogos, palpites associados, documentos de súmula/presença e lances privados, depois recalcula o ranking. Ela não remove modalidades, equipes ou usuários. Partidas ao vivo bloqueiam a seleção; vínculos com confrontos fora dela exigem incluir o torneio completo. O serviço confere novamente os dados, fecha os palpites antes da limpeza e registra o andamento numa operação privada. Limpezas grandes usam lotes menores. Em falha parcial, a mensagem informa quantos jogos foram excluídos; jogos restantes são liberados quando possível e podem ser selecionados novamente. Registros vinculados já removidos não são restaurados. Uma exclusão interrompida por perda de conexão pode ser retomada pela mesma janela.

## Programação diária em PDF

Em **Programação / PDF**, selecione um dia, modalidade e local. A lista **Dias com jogos** facilita localizar as datas do evento. A prévia e o PDF usam os mesmos filtros e ordenam os jogos pelo horário de São Paulo, mantendo jogos simultâneos. É possível incluir ou ocultar cancelados. O documento A4 em paisagem traz logo Interclasse, horários, modalidades, confrontos, torneios/fases, local/área, coletes e situação/placar conhecido. Locais e coletes ainda não preparados ficam a definir; placares finais não são inventados. O documento não inclui nomes de jogadores ou anotações privadas. Agendas extensas recebem páginas com cabeçalho da tabela e numeração.

## Estatísticas individuais

O menu público **Estatísticas** (`/#estatisticas`) e **Painel master → Estatísticas individuais** mostram artilharia e pontos por atleta, com atualização em tempo real. Os filtros incluem modalidade, torneio, equipe, primeiro nome e somente partidas finalizadas. As listas são separadas por modalidade e tipo de placar; totais iguais recebem a mesma posição. Há páginas de até 15 atletas. A consulta pública utiliza somente o primeiro nome e os resumos públicos dos lances, sem acessar os elencos ou presenças individuais.

Os totais vêm de `scorerStats`, acumulados pelo lançamento **Marcar por jogador**. No vôlei, somam pontos dos sets, e no basquete respeitam cestas de 1, 2 ou 3 pontos. Os oito lances recentes da TV não limitam o total acumulado. Pontos sem autor, partidas canceladas, adiadas ou com W.O. e xadrez ficam fora dessas listas. É possível incluir partidas ao vivo, identificadas nas linhas, ou consultar apenas finalizadas. **Jogos com registro** conta as partidas em que o atleta recebeu ao menos um lance atribuído, sem presumir outras participações. Desfazer lances, reabrir partidas e corrigir manualmente o placar são refletidos na consulta; jogos com correções mostram que seus autores contam apenas a partir do ajuste. Não são criados autores ou pontuações individuais a partir de placares informados manualmente.

## Cadastro de regulamentos

O editor guarda automaticamente um rascunho local por usuário e modalidade. Reabrir a modalidade ou recarregar o mesmo navegador recupera o texto e a versão original; somente **Salvar regulamento** publica o conteúdo. Rascunhos antigos não sobrescrevem versões mais recentes sem revisão explícita. **Recarregar dados salvos** pede confirmação antes de descartar alterações. Se o armazenamento do navegador falhar, o editor avisa. Limpar os dados do navegador remove os rascunhos locais.

Na administração e na consulta pública, **Baixar regulamento em PDF** exporta o conteúdo salvo da modalidade. Também é possível baixar todos os regulamentos cadastrados em um arquivo, com logo Interclasse, versão, páginas numeradas e suporte a seções de 10.000 caracteres. Campos vazios e modalidades sem regulamento são omitidos. O arquivo pode ser aberto e impresso pelo navegador.

## Modo árbitro

A operação reúne relógio, períodos, gols/pontos, cartões e **Conferir alunos e presença** na mesma tela. Em **Cartões da partida**, selecione equipe, aluno e cor e confirme o lançamento; o cartão é vinculado automaticamente ao jogo e aparece na TV e na Central disciplinar. A anulação exige motivo e retira apenas o cartão escolhido.

Em **Ao vivo / TV → Abrir modo árbitro**, ou em **Jogos → Mais opções → Modo árbitro**, o master abre uma única partida com placar grande, cronômetro, coletes, local e botões ampliados. O painel também está disponível em **Abrir placar → Modo árbitro**. Cada partida simultânea tem seus próprios controles. O navegador tenta manter a tela ligada e oferece tela cheia; o painel continua utilizável quando o aparelho não permite essas funções.

Os jogadores presentes ficam expandidos para registrar gols e pontos com autor, mantendo somente o primeiro nome na TV. Basquete usa 1, 2 ou 3 pontos; vôlei separa os pontos do set, sets ganhos e parciais, com confirmação para encerrar o set. Xadrez oferece o resultado por seleção. O painel reutiliza as transações, verificações de versão, desfazer lance, correções e confirmação do resultado existentes. Sem internet, bloqueia os lançamentos; encerrar ou adiar a partida em outro dispositivo remove os controles ao receber a atualização. Sair do modo árbitro mantém a partida e o cronômetro em andamento.

Em **Painel master → Regulamentos**, a organização cadastra o regulamento de cada modalidade em cinco campos opcionais: participação, classificação/vagas, desempate, W.O./ausências e outras informações (até 10.000 caracteres por seção). Todos começam em branco, sem exemplos preenchidos ou regras automáticas. O menu público **Regulamentos** (`/#regulamentos`) mostra somente o texto salvo pela organização, sem exigir login. Antes do cadastro, informa **Regulamento ainda não cadastrado pela organização**. Campos vazios não são exibidos. A gravação verifica a versão para evitar sobrescrever edições concorrentes. O cadastro é para consulta; pontuação, formato dos placares e cálculos continuam configurados nas áreas próprias do sistema. Alterar o nome ou a pontuação de um esporte preserva o texto salvo.

## Sorteio animado das turmas

Em **Painel master → Jogos → Gerador de chaveamento**, selecione a modalidade e o turno, informe nome, formato, fase/rodada e as opções de grupos/mata-mata, e clique em **Sortear grupos/confrontos**. O gerador não pede agenda ou local. A urna mistura as bolinhas e lança uma cápsula, que fica balançando até clicar nela (também aceita toque, Enter ou Espaço). A abertura em duas metades dura 3,25 segundos, com separação gradual das metades e desdobramento do cartão. A turma fica em destaque por mais 2,25 segundos antes de um voo curvo de 1,2 segundo até sua posição no grupo. A chegada destaca a posição preenchida, sem recriar a janela. A apresentação alterna os grupos (A, B, A, B…), preservando a composição sorteada. Há avanço automático entre as turmas, pausa, avanço manual e opção de revelar as restantes; mesmo no avanço automático, cada bolinha aguarda o clique para abrir. Pausar conclui a turma em andamento antes de interromper a sequência. **Tela cheia** permite projetar a apresentação quando o navegador oferece suporte.

**Repetir última revelação** reencena somente a última turma confirmada, inclusive depois de concluir, sem avançar a contagem ou alterar posições. Ao terminar a chegada da última turma, a urna dá lugar ao panorama dos grupos, com uma chuva breve de confetes e a apresentação de até seis primeiros confrontos, um por vez. Os confrontos são os mesmos da prévia, ainda sem dias ou horários, e oferecem pausa e navegação manual. O seletor **Animação do sorteio** começa em **Completa e suave**, permite **Seguir preferência do dispositivo** ou **Sem movimentos**, e guarda a escolha neste navegador. O modo completo mantém as animações do sorteio mesmo quando o dispositivo reduz os movimentos; a preferência das outras telas continua respeitada. O modo sem movimentos desativa o voo, as animações e os confetes, mantém 2,25 segundos para ler a turma e deixa os confrontos sob controle manual. No celular, a rolagem acompanha o cartão durante o voo até o grupo dentro da própria janela.

Nos grupos, todas as turmas precisam caber exatamente na configuração. O sorteio também funciona em confronto simples (com aviso de turma sem adversário quando a quantidade é ímpar) e todos contra todos. A ordem é sorteada uma única vez com o gerador criptográfico do navegador; pausar ou mudar o ritmo não altera o resultado. Alterações nos cadastros ou na configuração durante a apresentação bloqueiam o uso de um resultado desatualizado.

Ao concluir, use **Usar resultado na prévia**, confira os grupos/confrontos e clique em **Salvar chaveamento**. Os jogos são criados sem data e com palpites fechados. Fechar a apresentação descarta apenas o sorteio em andamento e preserva a prévia anterior. A apresentação ocorre no dispositivo do organizador; não há transmissão simultânea para outros navegadores. Nenhum jogo existente é alterado pela animação.

## Central disciplinar

Em **Painel master → Central disciplinar**, escolha o turno, a modalidade/equipe e um atleta do elenco para registrar advertência, cartão amarelo, cartão vermelho ou suspensão. A partida da ocorrência é opcional. Suspensões podem abranger todas as partidas da equipe na modalidade ou somente o torneio de uma partida vinculada. Cartões não geram suspensões automaticamente; a organização aplica o regulamento. Suspensões continuam ativas até **Marcar como cumprida** ou **Anular registro**, com motivo obrigatório. A ocorrência original, autor, data e decisão de encerramento são preservados, com conferência de versão para impedir decisões concorrentes.

Na preparação da partida, as ocorrências são atualizadas em tempo real e os atletas suspensos não podem ser marcados como presentes. **Conferir disponíveis** marca esses atletas como ausentes e os demais como presentes. O início individual e em lote confere novamente as suspensões atuais, inclusive quando a conferência foi salva antes da suspensão. É necessário manter ao menos um atleta presente em uma equipe com elenco. Não há baixa automática após jogos nem suspensão de outras modalidades. As ocorrências e os nomes completos ficam em documentos privados de `operations`, protegidos pela regra master existente; não aparecem no chaveamento público ou na TV.

## Disputa de terceiro lugar

No gerador **Grupos + mata-mata**, ative **Incluir disputa de terceiro lugar** quando o mata-mata começar em semifinal ou quartas. A prévia inclui o jogo depois das semifinais e antes da final. Para um torneio já criado com duas semifinais, use **Adicionar terceiro lugar** no cartão do torneio e informe o horário e o encerramento dos palpites.

Os perdedores das semifinais são preenchidos automaticamente, incluindo desempates e W.O., com a identidade da equipe preservada para elenco e presença. Se as semifinais já terminaram, o preenchimento ocorre ao criar a disputa. Reabrir uma semifinal limpa seu participante tanto na final quanto no terceiro lugar; a correção fica bloqueada se uma dessas partidas já começou. O chaveamento público usa linhas tracejadas para os perdedores e mantém o campeão vinculado à final. Partidas e palpites existentes são preservados ao adicionar o novo confronto. Uma final direta e o sorteio simples não ganham uma disputa de terceiro lugar automaticamente.

## Definir a agenda depois do sorteio

O gerador salva somente o torneio, os grupos, os confrontos e os vínculos do mata-mata. Datas, horários e prazo de palpites ficam vazios; os jogos aparecem como **Data a definir** e não aceitam palpites. Não são inventados dias, horários ou locais provisórios.

Na lista de partidas, use **Definir data e horário** ou **Mais opções → Editar jogo**. Preencha **Data e horário**; **Palpites até (automático)** mostra o fechamento 5 minutos antes. Salve e use **Mais opções → Reabrir palpites / resultado** para abrir os palpites quando desejar. O sistema impede essa abertura enquanto faltar a agenda. Os demais confrontos continuam sem data até serem editados individualmente.

Local, área, duração, presença e coletes continuam em **Preparar partida**. Ao preencher a agenda, considere as outras modalidades, a duração e o descanso das turmas. O sorteio não altera jogos existentes; os grupos e vínculos de semifinal, final e terceiro lugar são preservados ao preencher as datas.


## Palpite rápido no celular

No celular, o acesso inicial e o login do participante abrem automaticamente o **Palpite rápido**, dentro de **Jogos**. A tela tem cabeçalho compacto, um jogo por vez e as abas **Faltam** e **Enviados**. Mostra somente partidas que ainda podem receber palpite na primeira aba, priorizando o prazo mais próximo. Os filtros de modalidade e turno são opcionais. O participante pode escolher outro jogo, avançar ou voltar sem perder o rascunho.

Futebol, handebol e basquete oferecem campos com teclado numérico e botões grandes de **+** e **−**. Os campos começam vazios: nenhum placar é enviado por padrão. Vôlei oferece os placares finais válidos em sets para melhor de três ou cinco; xadrez oferece vitória de cada equipe e empate. Após **Enviar palpite**, a confirmação aparece e o próximo jogo é apresentado. **Enviados** permite conferir os palpites e editar os que ainda estiverem dentro do prazo. Partidas encerradas permanecem apenas para consulta.

O modo usa o mesmo login, os mesmos rascunhos e a mesma transação de envio do site completo. A gravação confere a partida atual no servidor e bloqueia o envio cinco minutos antes do início. Sem conexão ou enquanto os dados ainda estiverem sincronizando, é possível preencher um rascunho, mas o botão de envio fica bloqueado. Não há envio automático quando a internet volta. Toques repetidos não criam envios simultâneos.

**Site completo** volta à lista normal de Jogos e guarda a preferência por conta neste navegador. Para reabrir, use **Jogos → Palpite rápido**; essa opção também funciona no computador. Para compartilhar o acesso direto, acrescente `?modo=palpite#jogos` ao endereço do site (por exemplo, `/?modo=palpite#jogos`). O link pede login quando necessário e abre o modo rápido depois da autenticação. O acesso master mantém o painel administrativo. Os quatro menus do participante continuam disponíveis no site completo.

## Rascunhos e lembretes de palpites

Ao preencher um placar em **Painel** ou **Jogos**, o navegador guarda um rascunho por conta e partida. Recarregar a página ou trocar de tela recupera os campos. **Rascunho · ainda não enviado** não é um palpite registrado: é necessário clicar em **Enviar** ou **Atualizar** antes do fechamento. O envio confirmado limpa o rascunho; erros de envio preservam os campos. Fechar a partida ou atingir o prazo remove o rascunho editável. Se as equipes ou o palpite salvo mudarem em outro dispositivo, um rascunho antigo não substitui os dados atuais. Limpar os dados do navegador remove os rascunhos locais; falhas de armazenamento são informadas na tela.

Em **Painel → Lembretes de palpites**, cada participante pode ativar um aviso 5, 10 ou 15 minutos antes do **fechamento dos palpites**. O fechamento continua sendo 5 minutos antes do início do jogo. Os lembretes começam desativados e consideram somente jogos abertos sem palpite enviado. As preferências e os avisos já apresentados ficam separados por conta neste navegador. Um jogo reagendado pode gerar um novo aviso para o novo prazo.

Os avisos aparecem na página enquanto o site estiver aberto. **Permitir avisos do navegador** solicita a permissão somente ao clicar; a recusa mantém os avisos internos. Não há envio com o site fechado, por e-mail, WhatsApp ou push em segundo plano. Os lembretes desaparecem após o envio, fechamento ou cancelamento da partida e não são exibidos para master ou visitantes.

## Atualizações automáticas e TVs remotas

Os indicadores de conexão do placar e do Modo TV abrem **Diagnóstico da TV**, com a última confirmação do servidor e a ação **Verificar conexão agora**. Confirmações são feitas mesmo sem lances novos. Sem confirmação por 75 segundos nos placares ou 135 segundos na seleção compartilhada, a tela indica dados atrasados e conserva o último conteúdo. O cronômetro não é usado como prova de conexão.

Em **Painel master → Ensaio geral → Iniciar modo de teste**, o treino do placar funciona no próprio site, sem link local, instalação ou alteração dos dados oficiais. O ambiente técnico opcional, iniciado por **Iniciar-Ensaio.cmd**, mantém o roteiro da equipe e permite conferir também logins, palpites e reconexão com o banco de ensaio. Com esse ambiente aberto, `npm run validar:teste-interno` confere a simulação e verifica que jogos e seleção do servidor não foram alterados; `npm run validar:operacao` confere a operação com servidor. Execute esses comandos e `npm run validar:ensaio` separadamente, pois reiniciam os mesmos dados fictícios do ambiente técnico.

Todas as telas recebem jogos, placares, classificação, palpites, regulamentos, equipes, elencos, avisos e configurações pela escuta em tempo real do Firestore. O sistema recupera a escuta após erros, retorno da internet ou retomada de uma aba. A conexão usa long polling para redes escolares que armazenam respostas de streaming. Há uma conferência adicional no servidor a cada 30 segundos para jogos e a cada 60 segundos para os demais dados, somente com a tela visível e conectada. Coleções com `updatedAt` usam alterações incrementais e contagem; exclusões ou diferenças provocam uma leitura completa. Consultas filtradas preservam os filtros e as permissões, sem exigir novos índices compostos. Consultas equivalentes compartilham a mesma conexão na aba e são descartadas quando o último componente deixa de usá-las. As conferências consomem leituras do Firestore. Os dados anteriores permanecem visíveis durante uma queda de conexão, e os erros são removidos ao recuperar o servidor.

Uma faixa de placares ao vivo aparece em todas as páginas principais, inclusive Painel, Jogos, Meus palpites e Classificação. O vôlei mostra os pontos do set atual, os sets ganhos e as parciais; uma alteração de ponto aparece mesmo sem mudar o total de sets. Jogos, calendário, chaveamento e painel master também usam essa apresentação. Os números recebem um destaque breve ao mudar, respeitando a preferência de movimento reduzido. Palpites e classificação continuam usando os sets finais, sem confundir pontos do set com o resultado da partida. A barra de conexão informa a situação de todas as consultas ativas, e não apenas dos jogos. No histórico de palpites, o placar oficial ao vivo aparece separado do placar apostado.

No modo TV, o rodapé mostra a situação da conexão e a última conferência com o servidor. Um erro recuperado deixa de aparecer automaticamente. Um operador pode alterar o placar em outro computador sem recarregar as TVs; todos precisam estar conectados ao mesmo projeto Firebase e ter acesso à internet. Alterações realizadas pelo sistema registram `updatedAt`, necessário para a conferência incremental. A sincronização em tempo real não transmite a animação local do sorteio.

Cada build inclui `version.json`. O site publicado confere a versão a cada minuto e ao recuperar a conexão ou voltar à aba. Uma versão nova é aplicada automaticamente em todas as telas, preservando a rota e as preferências persistidas. A atualização aguarda se houver campos editados, uma janela aberta, interação nos últimos cinco segundos ou gravações do sistema em andamento. Quando essas condições deixam de existir, aplica a versão automaticamente; **Atualizar site** também permite atualizar manualmente depois de salvar o trabalho. Formulários que mantêm os campos alterados após salvar continuam protegidos até sair da tela, restaurar os campos ou atualizar manualmente. Há proteção contra recarregamentos repetidos quando um cache entrega uma versão antiga. A tela cheia solicitada pela página pode precisar ser ativada novamente após recarregar; para TVs permanentes, use tela cheia do navegador (F11) ou modo quiosque.

As alterações de código só chegam aos outros dispositivos depois de publicar a nova versão. No desenvolvimento local, o Vite aplica suas próprias atualizações. O mecanismo de versões depende de publicar também `version.json` e os cabeçalhos de cache definidos em `firebase.json`. Não usa recarregamentos periódicos da página para atualizar placares.

## Rodar localmente

A revisão de interface, correções de sobreposição e cobertura de telas estão documentadas em [Revisão de usabilidade — 9/11/2026](docs/revisao-usabilidade-2026-11-09.md).

```bash
npm install
npm run dev
npm run build
```

Os testes de partidas usam um banco isolado em memória e não alteram o Firebase de produção. Para executá-los, use Node.js 24 e `npm test`.

## Publicação

```bash
npm run build
git add .
git commit -m "Configura Firebase, usuário master e sistema do bolão"
git push
firebase deploy
```
