# Simulação de atrasos e padronização da interface

Atualização de 17/11/2026. Implementada no projeto local, ainda dependente de publicação no Firebase Hosting.

## Como usar a simulação

1. Abra **Painel master → Programação / PDF**.
2. Escolha o dia da agenda e, se necessário, o turno e a modalidade para localizar a partida inicial.
3. Clique em **Simular atraso** e selecione a partida que começará mais tarde.
4. Informe o atraso mínimo, entre 1 e 240 minutos, ou use os atalhos de 5, 10, 15, 30 e 60 minutos.
5. Confira os horários atuais, os propostos, os novos limites dos palpites e o motivo de cada ajuste.
6. Marque **Conferi as partidas e os novos horários desta prévia** e use **Aplicar horários da prévia**.

Fechar a janela ou usar **Voltar sem alterar** descarta a simulação. Alterar a partida ou os minutos exige conferir a nova proposta novamente.

## O que o cálculo considera

- Atrasos propagam-se pela mesma quadra/área, pelas equipes ou turmas em modalidades diferentes e pelos vínculos de fases anteriores.
- Intervalos livres absorvem o atraso. Nem toda partida seguinte precisa receber a mesma quantidade de minutos.
- A análise considera a agenda completa, incluindo outras modalidades e turnos, mesmo que estejam fora do filtro usado para localizar a partida inicial.
- Áreas diferentes do mesmo local permitem jogos simultâneos. Um local sem área definida reserva o espaço inteiro.
- As durações são as previstas no cadastro. O início e o encerramento continuam sob controle da organização.
- Jogos iniciados, ao vivo, finalizados, cancelados, adiados ou em exclusão não são movidos. Um jogo fixo que impeça a proposta bloqueia sua aplicação.
- Propostas que ultrapassam o dia da programação, mantêm horários no passado ou deixam conflitos precisam de ajuste antes de aplicar.
- Horários antigos que contêm segundos são arredondados para o minuto seguinte, preservando o atraso mínimo.
- O serviço relê os jogos e as equipes, confere os dados da prévia e grava as alterações em uma transação. São aceitas até 450 partidas alteradas por aplicação.

As partidas preservam identidade, equipes, local, duração, resultados e palpites existentes. Os limites são recalculados para cinco minutos antes de cada novo horário; partidas fechadas pela organização continuam fechadas. A preparação é invalidada somente nas partidas alteradas, que precisam ser conferidas antes de iniciar.

Se a agenda mudar durante a simulação, a janela bloqueia a aplicação e oferece **Atualizar prévia**.

## Cards e componentes

- Jogos de palpites e calendário público usam o mesmo resumo: modalidade e situação, equipes e placar, horário de Brasília e local.
- Coletes, duração, torneio e regras de pontuação ficam em uma seção expansível. O palpite enviado, os pontos recebidos e o prazo permanecem visíveis quando aplicáveis.
- Partidas adiadas ou canceladas identificam a data como horário anterior. Partidas sem data não inventam horário ou placar.
- Botões, campos, caixas de seleção, painéis, diálogos e mensagens seguem medidas, bordas e tipografia compartilhadas, nos temas claro e noturno.
- Os carregamentos mostram a estrutura da tela que está chegando: jogos, calendário, ranking, painel, administração e formulários. A estrutura visual fica oculta de leitores de tela, com uma mensagem de carregamento; a preferência por movimento reduzido é respeitada.

## Verificação

- 238 testes automatizados aprovados, incluindo 14 novos testes do atraso e da gravação.
- Ensaio integrado no navegador com dados fictícios: três partidas afetadas, cinco partidas independentes preservadas, novos limites de palpites corretos e confirmação de que sair da prévia não grava horários.
- Conferidos o bloqueio de prévia desatualizada, a validação de minutos e a necessidade de nova confirmação após mudar a proposta.
- Envio de palpite conferido pelo formulário redesenhado; detalhes e horário atualizado verificados na conta participante.
- Cards, calendário e carregamentos verificados em telas de 320 e 390 px e em tela grande, sem rolagem lateral da página.
- Os seis modelos de carregamento foram conferidos nos tamanhos de computador e celular, incluindo os atributos de acessibilidade.

Os arquivos de ensaio em `artifacts/rehearsal/` são locais, ignorados pelo Git e não fazem parte do build de produção.
