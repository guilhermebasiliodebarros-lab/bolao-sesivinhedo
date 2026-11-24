# Inscrições das equipes de 2026

O lote recebido em 24/11/2026 contém 214 inscrições nas turmas 6º B, 8º A, 9º B, 3º A e 3º B. O mesmo aluno pode participar de modalidades diferentes, portanto o total representa inscrições por equipe, sem misturar elencos.

| Modalidade | Inscrições |
| --- | ---: |
| Basquete | 22 |
| Vôlei | 44 |
| Handebol | 44 |
| Futsal | 40 |
| Mancala | 7 |
| Futmesa | 14 |
| Tênis de Mesa | 9 |
| Xadrez | 9 |
| FIFA | 9 |
| RPG | 16 |

São 171 titulares e 43 reservas. Conforme orientação da organização, toda inscrição sem indicação de reserva é cadastrada como Titular. As funções de jogo citadas no documento, como goleiro, ala e levantador, são desconsideradas. O formulário usa apenas nome e a seleção entre Titular e Reserva; metadados antigos de capitão podem continuar armazenados, mas não são solicitados nem exibidos nesse cadastro.

## Conferência da transcrição

O PDF original tem 11 páginas e células visualmente cortadas. O texto completo foi recuperado dos objetos do PDF e relacionado por coluna e linha, mantendo a turma e a modalidade de origem. Nomes abreviados e grafias enviadas foram mantidos. A observação sobre participação no handebol do 3º B foi tratada como observação do documento; nenhuma decisão de elegibilidade foi tomada pelo importador. A lista de Mancala do 3º B está vazia e não cria inscrições fictícias.

O manifesto revisado fica em `artifacts/rehearsal/rosters-2026/manifest.json`. Ele contém nomes de alunos e permanece fora do Git e da interface pública. A modalidade e a turma são informadas em cada grupo, e cada aluno contém apenas `nome` e `posicao` (`Titular` ou `Reserva`). A origem guarda o nome e o SHA-256 do PDF.

## Aplicar lotes complementares

O comando exige um projeto explícito, o PDF original e seu manifesto revisado. Sem `--apply`, ele apenas gera uma prévia:

```powershell
npm run inscricoes:sincronizar -- --project bolao-sesivinhedo --manifest artifacts/rehearsal/rosters-2026/manifest.json --source "C:\Users\Guilherme\Downloads\Interclasse – Inscrição das Equipes.pdf"
```

Acrescente `--apply` para gravar o lote conferido. Para o ensaio local, use `--project demo-interclasse-ensaio --emulator`.

O importador relaciona nome e equipe, preserva identificadores de jogadores já existentes e não remove alunos ou turmas ausentes do novo documento. Nomes iguais em modalidades diferentes pertencem a elencos separados. Repetir o mesmo lote não duplica inscrições. Listas vazias não apagam cadastros anteriores. Nomes duplicados dentro de uma equipe, turmas desconhecidas e vínculos ambíguos interrompem o plano para revisão.

FIFA e RPG são cadastrados como modalidades próprias, com as 14 equipes escolares, mantendo vazios os elencos das turmas ainda não enviadas. O cadastro não cria partidas nem muda a agenda ou os resultados.

Antes de aplicar, é gravada uma cópia privada da situação anterior em `artifacts/rehearsal/rosters-2026/<projeto>/before-<data>.json`. A escrita é atômica, com verificação das versões lidas. Após a aplicação, o comando confere novamente os jogadores, os contadores das equipes, os registros fora do lote e os jogos, e gera `receipt.json` no mesmo diretório. A origem também fica registrada em cada jogador e em uma operação identificada pelo hash do PDF.
