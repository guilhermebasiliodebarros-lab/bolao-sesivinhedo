# Programação oficial do Interclasse 2026

A transcrição em `src/data/officialSchedule2026.js` reúne os dois murais recebidos em 24/11/2026: o arquivo terminado em `(1).pdf` corresponde à tarde; o terminado em `(2).pdf`, à manhã. São 96 partidas entre 30/11 e 03/12/2026, no fuso de São Paulo.

| Modalidade | Manhã | Tarde | Total |
| --- | ---: | ---: | ---: |
| Basquete | 15 | 9 | 24 |
| Futsal | 15 | 9 | 24 |
| Handebol | 15 | 9 | 24 |
| Vôlei | 15 | 9 | 24 |

Os grupos somam 72 jogos; há 16 semifinais e oito finais. A semifinal 1 cruza o primeiro do Grupo B com o segundo do Grupo A; a semifinal 2 cruza o primeiro do Grupo A com o segundo do Grupo B. Cada final recebe os vencedores das semifinais do mesmo turno e modalidade.

## Conferir e aplicar

O comando requer uma conta do Firebase CLI com acesso ao projeto e os dois PDFs originais em Downloads. `--source-directory` permite informar outra pasta. Os hashes dos PDFs são conferidos antes de qualquer gravação.

```powershell
npm run agenda:oficial -- --project bolao-sesivinhedo --prediction-policy open-defined
```

A execução acima gera apenas uma prévia. Para aplicar a mesma política:

```powershell
npm run agenda:oficial -- --project bolao-sesivinhedo --prediction-policy open-defined --apply
```

`open-defined` abre os jogos de grupos com equipes definidas e mantém as eliminatórias fechadas enquanto dependem dos classificados. Cada partida recebe início, fim, duração, quadra e prazo de palpites cinco minutos antes do início, como timestamps. A organização pode abrir os palpites de uma eliminatória pelo painel depois de conhecer seus dois participantes, respeitando o mesmo prazo. O vôlei usa melhor de três sets.

A importação mantém os identificadores das 60 partidas da manhã e acrescenta 36 à tarde com identificadores estáveis. Futebol passa a se chamar Futsal e o nome Vôlei é corrigido, preservando modalidades, equipes e elencos. Os 60 jogos das outras quatro modalidades permanecem como estavam, pois não constam nesses murais. Apresentação cultural, intervalos e montagem de redes ficam registrados como informações de organização, sem criar confrontos fictícios.

O plano fica em `artifacts/rehearsal/official-schedule/<projeto>/plan.json`. Antes da gravação, um arquivo `before-<data>.json` registra a situação anterior, os documentos criados e o plano. Esse registro contém dados do banco e deve permanecer privado, fora do Git. A gravação é atômica e usa as versões lidas para impedir alterações concorrentes. O comprovante `receipt.json` só é emitido após a leitura de conferência confirmar as 96 partidas, a preservação das outras modalidades e dos palpites existentes. A operação também registra a versão em `operations/official-schedule-2026` e publica um aviso agrupado da agenda.

Repetir o comando antes do início da competição não duplica partidas nem avisos quando a agenda já corresponde ao manifesto. Jogos iniciados, com placar ou lances, confrontos antigos sem correspondência e inversões que afetariam palpites interrompem a importação para revisão. O comando não deve ser usado para restaurar a agenda depois que a competição começar.

## Ensaio local

Use o projeto fictício com os emuladores já abertos e as modalidades/equipes cadastradas:

```powershell
npm run agenda:oficial -- --project demo-interclasse-ensaio --emulator --prediction-policy open-defined --apply
```

O parâmetro `--emulator` aceita apenas projetos `demo-` e usa o Firestore local na porta 8180. Os testes unitários verificam confrontos completos, colisões, fuso horário, duração, prazo, vínculos do mata-mata, preservação e importação repetida.
