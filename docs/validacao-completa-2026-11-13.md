# Validação de preparação para o evento — 13/11/2026

## Escopo

Validação das partidas de futebol, handebol, basquete e vôlei; presença e autores; placar de TV com seleção manual; palpites, classificação e privacidade. Os ensaios de escrita utilizam apenas o projeto fictício `demo-interclasse-ensaio`, com Authentication e Firestore locais. A leitura da situação oficial foi feita sem alterar jogos, atletas ou classificação.

## Correção publicada

As regras publicadas não permitiam consultar um documento de palpite ainda inexistente durante a transação de primeiro envio. A simulação das regras do servidor reproduziu a falha com erro de valor nulo. Foi publicada a regra específica de consulta de documento inexistente, mantendo os palpites de outros usuários protegidos.

Também foi publicada a validação obrigatória do prazo em timestamp, estritamente anterior aos cinco minutos de corte, com bloqueio de partidas iniciadas ou em exclusão. Um jogo sem prazo válido não aceita palpites. A configuração de segurança foi conferida novamente após a publicação: primeiro envio permitido, consulta do próprio palpite permitida e leitura de palpite de outra conta negada.

## Evidências reproduzíveis

Atualização da operação: **207 testes automáticos, 13 etapas integradas do fluxo completo e 9 cenários da operação unificada aprovados**. Foram conferidos os cartões e sua anulação dentro da arbitragem, presença na mesma tela, intervalos e segundo tempo com minutos acumulados preservados, quatro períodos do basquete, diagnóstico com conferência manual, aviso por ausência de confirmação do servidor, queda e retorno da internet, adaptação para celular e checklist com relatório do ensaio. O ambiente de escrita continuou restrito aos emuladores fictícios. Os relatórios atuais são `artifacts/rehearsal/operations-result.json` e `artifacts/rehearsal/last-result.json`.

Para repetir os nove cenários novos, inicie `npm run ensaio` e, em outro terminal, execute `npm run validar:operacao`. Não execute simultaneamente com `npm run validar:ensaio`, pois ambos reiniciam os mesmos dados de treino.

Na execução inicial foram **195 testes automáticos aprovados e 13 etapas integradas aprovadas**. O build de produção passou e foi conferido sem o projeto, os endereços dos emuladores ou a faixa do ensaio. A tentativa de compilar o modo de ensaio para publicação foi bloqueada conforme esperado.

- `npm test`: regras de pontuação, modalidades, conflitos, preparação, disciplina, correções, prazo, ranking, TV e seleção de partidas.
- `npm run ensaio`: inicia o ambiente fictício e prepara seis partidas com elencos e contas de exemplo.
- `npm run validar:ensaio`: valida o fluxo pela interface com SDK e banco reais dos emuladores. O resultado mais recente e as imagens ficam em `artifacts/rehearsal/`.

O ensaio integrado verifica cadastro de atleta, presença, início, bloqueio de palpites, autoria, TV em outra sessão, desfazer, troca de equipe/autor, exclusão, relógio, operação sem internet, resultados, pontos de 1/2/3 no basquete, dois jogos simultâneos, vôlei em sets, estatísticas e restrições da conta de consulta. O cenário do futebol termina em 2 × 1 e confere a pontuação de quatro palpites: 4,2 / 3,6 / 3 / 0. O vôlei confere parciais 25–23 e 25–19, resultado 2–0 e o palpite em sets.

## Pendências de cadastro do evento real

Na leitura de 13/11/2026:

| Item | Situação |
| --- | --- |
| Jogos cadastrados | 120 |
| Jogos com data/horário | 1 |
| Jogos sem data/horário | 119 |
| Modalidades | 8 |
| Equipes | 112 |
| Atletas cadastrados | 0 |
| Jogos ao vivo | 0 |
| Jogos abertos para palpites | 0 |

Os 119 jogos sem horário estão com os palpites fechados. O único jogo com horário tem prazo de palpite salvo. Os cadastros de atletas e a definição da programação precisam ser concluídos para a operação do evento.

## Ensaio no equipamento da escola

Os testes de navegador não substituem a conferência da TV física e da rede no local. Abra o placar oficial na TV para conferir leitura e conexão. Para ensaiar com dados fictícios, conecte o computador de treino à TV por HDMI ou espelhamento. O guia de operação está em [guia-ensaio-e-operacao.md](guia-ensaio-e-operacao.md).
