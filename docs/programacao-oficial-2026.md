# Programação oficial do Interclasse 2026

A transcrição em `src/data/officialSchedule2026.js` reúne os cronogramas de manhã, de tarde e dos esportes secundários recebidos em 27/11/2026. São 156 partidas entre 30/11 e 03/12/2026, no horário de São Paulo. O PDF atualizado da manhã detalha os jogos de segunda a quarta, então as 15 partidas de quinta de basquete, futsal, handebol e vôlei seguem a agenda publicada em 24/11.

| Modalidade | Manhã | Tarde | Total |
| --- | ---: | ---: | ---: |
| Basquete | 15 | 9 | 24 |
| Futsal | 15 | 9 | 24 |
| Handebol | 15 | 9 | 24 |
| Vôlei | 15 | 9 | 24 |
| Futmesa | 15 | 0 | 15 |
| Mancala | 15 | 0 | 15 |
| Tênis de Mesa | 15 | 0 | 15 |
| Xadrez | 15 | 0 | 15 |
| **Total** | **120** | **36** | **156** |

São 120 jogos de grupos, 24 semifinais e 12 finais. Em basquete, futsal, handebol e vôlei, a semifinal 1 cruza o primeiro do Grupo B com o segundo do Grupo A. Em futmesa, mancala, tênis de mesa e xadrez, a semifinal 1 cruza o primeiro do Grupo A com o segundo do Grupo B. A semifinal 2 recebe os outros dois classificados. Cada final recebe os vencedores das semifinais do mesmo turno e modalidade.

## Conferir e aplicar

O comando usa uma conta do Firebase CLI com acesso ao projeto. No exemplo, os três PDFs de 27/11 estão na pasta acima do repositório. O mural anterior da manhã fica em Downloads por padrão e sua pasta pode ser indicada com `--previous-source-directory`. Os hashes dos PDFs são conferidos antes da gravação.

```powershell
npm run agenda:oficial -- --project bolao-sesivinhedo --source-directory .. --prediction-policy open-defined
```

A execução acima gera apenas uma prévia. Para aplicar a mesma política:

```powershell
npm run agenda:oficial -- --project bolao-sesivinhedo --source-directory .. --prediction-policy open-defined --apply
```

`open-defined` abre os jogos de grupos com equipes definidas e mantém as eliminatórias fechadas enquanto dependem dos classificados. Cada partida recebe início, fim, duração e prazo de palpites cinco minutos antes do início. O local e a meia-quadra são preenchidos quando indicados no cronograma. O PDF das modalidades secundárias não informa os locais, então a agenda mantém qualquer local já cadastrado. A organização pode abrir os palpites de uma eliminatória pelo painel depois de conhecer seus dois participantes, respeitando o mesmo prazo.

A importação reutiliza os identificadores dos confrontos que já estão cadastrados e cria as partidas que faltam com identificadores estáveis. Apresentação cultural, intervalos e montagem de redes são registrados junto aos dados de organização.

O plano fica em `artifacts/rehearsal/official-schedule/<projeto>/plan.json`. Antes da gravação, um arquivo `before-<data>.json` registra a situação anterior, os documentos criados e o plano. Esse registro contém dados do banco e deve permanecer privado, fora do Git. A gravação é atômica e usa as versões lidas para impedir alterações concorrentes. O comprovante `receipt.json` registra a conferência das 156 partidas e dos palpites existentes. A operação também registra a versão em `operations/official-schedule-2026` e publica um aviso agrupado da agenda.

Repetir o comando antes do início da competição não duplica partidas nem avisos quando a agenda já corresponde ao manifesto. Jogos iniciados, com placar ou lances, confrontos antigos sem correspondência e inversões que afetariam palpites interrompem a importação para revisão. O comando não deve ser usado para restaurar a agenda depois que a competição começar.

## Ensaio local

Use o projeto fictício com os emuladores já abertos e as modalidades/equipes cadastradas:

```powershell
npm run agenda:oficial -- --project demo-interclasse-ensaio --emulator --source-directory .. --prediction-policy open-defined --apply
```

O parâmetro `--emulator` aceita apenas projetos `demo-` e usa o Firestore local na porta 8180. Os testes unitários verificam confrontos completos, colisões, fuso horário, duração, prazo, vínculos do mata-mata, preservação e importação repetida.
