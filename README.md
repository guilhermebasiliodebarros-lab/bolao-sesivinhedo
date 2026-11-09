# Bolão SESI Vinhedo

Aplicação React + Vite para cadastro de participantes, login, palpites, ranking automático e painel master com Firebase Authentication e Firestore.

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

## Coleções usadas

- `users`: perfil, role, pontos e flags de ranking.
- `games`: jogos, status e placar final.
- `predictions`: palpites por usuário e jogo.

Cada jogo também tem `limitePalpites`. Participantes só conseguem criar ou editar palpites enquanto o jogo estiver `aberto` e antes desse horário.

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

- **Logo:** a versão `public/logo-interclasse.png` troca Bolão por Interclasse preservando o escudo SESI Vinhedo. A área de palpites dos professores mantém o nome Bolão.
- **Local e coletes:** em Jogos, informe quadra/sala, duração prevista e a cor de colete de cada equipe. Os dados aparecem nos jogos, no calendário e na TV.
- **Conflitos:** a prévia do chaveamento avisa sobre horários sobrepostos com a mesma equipe/turma. O local, a área, a duração e os coletes são definidos apenas em **Preparar partida**; o início verifica a disponibilidade do local e das equipes. Para detectar turmas entre modalidades, preencha **Turma** no cadastro de cada time com o mesmo nome.
- **Placares por esporte:** em Esportes, configure gols, pontos, sets ou xadrez; no vôlei, melhor de 3 ou 5 sets. Em Ao vivo / TV, registre parciais de sets opcionais; xadrez aceita vitória, derrota ou empate de ½ ponto. Os pontos por vitória, empate e derrota são configuráveis para o regulamento escolar.
- **Avisos TV:** publique avisos, chamadas de equipes ou atrasos com validade. A chamada pode ser preenchida a partir de uma partida. É possível ocultar, exibir novamente ou remover; avisos vencidos saem da TV automaticamente.
- **Classificação por grupo:** no painel master, apresenta uma tabela para cada grupo do torneio, com filtros por modalidade e torneio. As equipes aparecem com zero pontos antes de jogar, e apenas os resultados finais da fase de grupos contam. Semifinais, finais e outros jogos sem grupo ficam fora dessa pontuação. Os critérios são pontos, vitórias, saldo, pontos/gols/sets a favor e nome. Esta tabela é independente dos palpites dos professores e não aparece no modo TV.
- **Importação de jogadores:** em Jogadores, selecione a equipe e abra **Importar jogadores de Word, PDF ou Bloco de notas**. Aceita Word `.docx`, PDF e texto `.txt`, ou nomes colados. Arquivos Word antigos `.doc` devem ser salvos como `.docx`. Use um nome por linha ou tabela com Nome, Posição e Capitão; documentos de até 15 MB e PDFs de até 20 páginas. PDFs sem texto passam por OCR em português, com recursos hospedados no próprio site. Revise a prévia, desmarque entradas indevidas e confirme a importação. Nomes repetidos são ignorados. O arquivo é lido no navegador; apenas os jogadores selecionados são gravados na equipe.

## Situação das partidas e súmulas

Na lista de **Jogos**, abra **Situação da partida** para adiar, cancelar, registrar W.O. ou reagendar. Partidas ao vivo também têm este botão na central **Ao vivo / TV**. A alteração tem uma etapa de revisão e exige um motivo público, mostrado no calendário e na TV.

- **Adiar:** tira a partida dos jogos ao vivo e da agenda de próximos jogos, bloqueando os palpites. Preserva o placar parcial para retomada.
- **Reagendar:** define novo dia/horário e prazo de palpites. Reabrir palpites exige uma escolha explícita e só é permitido se a partida ainda não começou. Ao iniciar novamente uma partida interrompida, o placar parcial e os sets são preservados.
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

Em **Ao vivo / TV** e **Abrir placar**, o lançamento rápido registra gols e pontos sem editar o placar inteiro. Expanda **Marcar por jogador** e toque no jogador presente da conferência. O painel mostra o nome cadastrado; o lance público e a TV recebem somente o primeiro nome. **Sem autor** atende pontos coletivos, erros do adversário e partidas sem elenco. Futebol e handebol somam gols; basquete oferece 1, 2 ou 3 pontos. No vôlei, os pontos pertencem ao set atual, separados do placar de sets. **Encerrar set** pede confirmação, registra a parcial e zera os pontos do próximo set. A decisão de encerrar segue o regulamento da escola; não existe encerramento automático aos 25 ou 15 pontos. Xadrez mantém o lançamento do resultado da partida.

**Desfazer último lance** restaura o placar, os pontos do set, as parciais e os autores correspondentes, inclusive ao desfazer um set encerrado. O registro usa transações, identificadores de requisição e versão do placar para impedir duplicações por repetição e sobrescritas por outros dispositivos. Rascunhos de correção e confirmações de resultado precisam ser atualizados quando outro operador muda o placar. Uma correção manual reinicia os lances e autores exibidos na TV, mantendo os registros técnicos privados em `games/{gameId}/events/{eventId}`; essa coleção é restrita a master. Apenas os últimos oito lances e os resumos de autores, já com primeiro nome, ficam no jogo público. Não é publicada a lista completa de jogadores ou presenças.

A TV destaca placar, local, pontos do set, cronômetro e último lance, com bola e minuto nos gols. Os autores dos gols aparecem por equipe. Os ajustes ficam recolhidos em **Ajustes da TV**; a programação e os placares ganham mais espaço. O padrão é duas partidas ao vivo por página, com opção de quatro em telas de pelo menos 1.000 pixels de altura. Telas menores usam quatro jogos de agenda por página; as maiores usam até seis. As páginas continuam alternando modalidades e trazendo os jogos ao vivo de volta à rotação. O logo Interclasse permanece.

## Controle do tempo de jogo

Ao iniciar uma partida, o cronômetro começa automaticamente. Em **Ao vivo / TV** ou **Abrir placar**, use **Pausar cronômetro** e **Retomar cronômetro**. A pausa mantém a partida ao vivo, a área ocupada e os palpites bloqueados. O tempo acumulado e o instante da retomada ficam salvos no jogo; trocar de tela ou recarregar não reinicia a contagem. Não há gravações a cada segundo. Controles concorrentes verificam a versão atual antes de alterar a contagem. Encerrar, adiar, cancelar ou registrar W.O. interrompe a contagem; retomar uma partida adiada preserva o tempo já jogado, e reabrir uma partida concluída zera o cronômetro.

A duração prevista serve como aviso visual, sem encerrar o jogo automaticamente. A Central de pendências considera o tempo de jogo e desconta pausas dos novos cronômetros. Jogos antigos ao vivo usam o início registrado até o primeiro controle do cronômetro. Em **Avisos TV**, a opção **Exibir cronômetros das partidas ao vivo na TV** controla a exibição para todos os televisores; o padrão é exibir. Cada jogo simultâneo tem sua própria contagem. A TV usa duas partidas por página como padrão; a opção de quatro depende de uma tela com pelo menos 1.000 pixels de altura.

## Programação diária em PDF

Em **Programação / PDF**, selecione um dia, modalidade e local. A lista **Dias com jogos** facilita localizar as datas do evento. A prévia e o PDF usam os mesmos filtros e ordenam os jogos pelo horário de São Paulo, mantendo jogos simultâneos. É possível incluir ou ocultar cancelados. O documento A4 em paisagem traz logo Interclasse, horários, modalidades, confrontos, torneios/fases, local/área, coletes e situação/placar conhecido. Locais e coletes ainda não preparados ficam a definir; placares finais não são inventados. O documento não inclui nomes de jogadores ou anotações privadas. Agendas extensas recebem páginas com cabeçalho da tabela e numeração.

## Estatísticas individuais

O menu público **Estatísticas** (`/#estatisticas`) e **Painel master → Estatísticas individuais** mostram artilharia e pontos por atleta, com atualização em tempo real. Os filtros incluem modalidade, torneio, equipe, primeiro nome e somente partidas finalizadas. As listas são separadas por modalidade e tipo de placar; totais iguais recebem a mesma posição. Há páginas de até 15 atletas. A consulta pública utiliza somente o primeiro nome e os resumos públicos dos lances, sem acessar os elencos ou presenças individuais.

Os totais vêm de `scorerStats`, acumulados pelo lançamento **Marcar por jogador**. No vôlei, somam pontos dos sets, e no basquete respeitam cestas de 1, 2 ou 3 pontos. Os oito lances recentes da TV não limitam o total acumulado. Pontos sem autor, partidas canceladas, adiadas ou com W.O. e xadrez ficam fora dessas listas. É possível incluir partidas ao vivo, identificadas nas linhas, ou consultar apenas finalizadas. **Jogos com registro** conta as partidas em que o atleta recebeu ao menos um lance atribuído, sem presumir outras participações. Desfazer lances, reabrir partidas e corrigir manualmente o placar são refletidos na consulta; jogos com correções mostram que seus autores contam apenas a partir do ajuste. Não são criados autores ou pontuações individuais a partir de placares informados manualmente.

## Cadastro de regulamentos

O editor guarda automaticamente um rascunho local por usuário e modalidade. Reabrir a modalidade ou recarregar o mesmo navegador recupera o texto e a versão original; somente **Salvar regulamento** publica o conteúdo. Rascunhos antigos não sobrescrevem versões mais recentes sem revisão explícita. **Recarregar dados salvos** pede confirmação antes de descartar alterações. Se o armazenamento do navegador falhar, o editor avisa. Limpar os dados do navegador remove os rascunhos locais.

Na administração e na consulta pública, **Baixar regulamento em PDF** exporta o conteúdo salvo da modalidade. Também é possível baixar todos os regulamentos cadastrados em um arquivo, com logo Interclasse, versão, páginas numeradas e suporte a seções de 10.000 caracteres. Campos vazios e modalidades sem regulamento são omitidos. O arquivo pode ser aberto e impresso pelo navegador.

## Modo árbitro

Em **Ao vivo / TV → Abrir modo árbitro**, ou em **Jogos → Mais opções → Modo árbitro**, o master abre uma única partida com placar grande, cronômetro, coletes, local e botões ampliados. O painel também está disponível em **Abrir placar → Modo árbitro**. Cada partida simultânea tem seus próprios controles. O navegador tenta manter a tela ligada e oferece tela cheia; o painel continua utilizável quando o aparelho não permite essas funções.

Os jogadores presentes ficam expandidos para registrar gols e pontos com autor, mantendo somente o primeiro nome na TV. Basquete usa 1, 2 ou 3 pontos; vôlei separa os pontos do set, sets ganhos e parciais, com confirmação para encerrar o set. Xadrez oferece o resultado por seleção. O painel reutiliza as transações, verificações de versão, desfazer lance, correções e confirmação do resultado existentes. Sem internet, bloqueia os lançamentos; encerrar ou adiar a partida em outro dispositivo remove os controles ao receber a atualização. Sair do modo árbitro mantém a partida e o cronômetro em andamento.

Em **Painel master → Regulamentos**, a organização cadastra o regulamento de cada modalidade em cinco campos opcionais: participação, classificação/vagas, desempate, W.O./ausências e outras informações (até 10.000 caracteres por seção). Todos começam em branco, sem exemplos preenchidos ou regras automáticas. O menu público **Regulamentos** (`/#regulamentos`) mostra somente o texto salvo pela organização, sem exigir login. Antes do cadastro, informa **Regulamento ainda não cadastrado pela organização**. Campos vazios não são exibidos. A gravação verifica a versão para evitar sobrescrever edições concorrentes. O cadastro é para consulta; pontuação, formato dos placares e cálculos continuam configurados nas áreas próprias do sistema. Alterar o nome ou a pontuação de um esporte preserva o texto salvo.

## Rodar localmente

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
