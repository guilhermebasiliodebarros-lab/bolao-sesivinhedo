# Acesso autenticado · atualizado em 23/11/2026

Sem uma conta logada, o site apresenta somente boas-vindas, login e cadastro. A página inicial preserva a identidade visual do Interclasse e oferece **Entrar** e **Criar minha conta**. Não mostra programação, partidas em destaque, placares, resumo do evento ou atalhos para as funções.

Os menus superior, lateral e inferior do celular aparecem somente depois do login. Links diretos para calendário, chaveamento, simulador, regulamentos, estatísticas, classificação, palpites, administração, Modo TV e placar ao vivo redirecionam para o login. O sistema aguarda a autenticação e o perfil antes de renderizar as telas. Ao sair, as telas e suas assinaturas em tempo real são desmontadas.

## Permissões após entrar

- **Professor aprovado:** Painel, Jogos, Meus palpites e Classificação.
- **Cadastro pendente ou recusado:** somente situação do próprio cadastro, sem acesso ao campeonato, palpites ou classificação. Cadastros anteriores sem aprovação também são pendentes.
- **Guilherme (`guilhermebasiliodebarros@gmail.com`):** aprovação e recusa de cadastros pelo menu **Aprovar cadastros** ou pela seção **Cadastros / professores** do painel master. Essa autorização não promove a conta a master.
- **Consulta:** Calendário, Chaveamento, Simulador, Regulamentos e Estatísticas.
- **Master:** telas do evento, organização, Modo TV e placar ao vivo.

Para abrir uma TV em outro navegador ou dispositivo, primeiro entre com a conta da organização naquele navegador e depois abra o placar. O modo de teste interno continua disponível no painel master. A análise de cadastros registra a conta responsável e a data; aprovação, recusa e revisão de uma recusa atualizam as sessões abertas automaticamente.

## Proteção dos dados

As regras de leitura de jogos, modalidades, equipes, configurações da transmissão e avisos ativos exigem um perfil master, de consulta ou de participante aprovado. O bloqueio também vale para chamadas diretas ao Firestore. Elencos, documentos de partidas e operações continuam reservados ao master. Participantes e contas de consulta continuam sem permissão de administrar jogos ou ler informações privadas.

O cadastro só cria perfis `role: "user"`, `approvalStatus: "pending"` e `participaRanking: false`, com o e-mail da própria conta autenticada. Somente o e-mail autenticado de Guilherme pode aprovar ou recusar, sem alterar papéis ou pontuações pela operação de análise. Pendentes e recusados leem apenas o próprio perfil. A consulta de classificação filtra explicitamente professores aprovados; recalcular pontos não reativa cadastros recusados.

A tela de boas-vindas não assina as consultas de jogos. As faixas de placares e de atualização em tempo real também não são montadas antes do login. As páginas de login e cadastro continuam acessíveis normalmente.

## Validação

`npm test` verifica todas as rotas de visitantes, links diretos, saída da conta e permissões dos perfis existentes.

Com `npm run ensaio` aberto, `npm run validar:cadastros` verifica o fluxo real de cadastro, aprovação e recusa, os bloqueios do servidor, a classificação e a atualização de sessões no computador e no celular. O relatório e as capturas ficam em `artifacts/rehearsal/registration-approval/`. Os testes não acessam dados oficiais.

Com `npm run ensaio` aberto, execute `npm run validar:acesso`. O roteiro usa as regras reais dos emuladores de autenticação e Firestore em `demo-interclasse-ensaio`: verifica leituras negadas sem login, acesso autenticado dos três perfis, consultas de avisos ativos e manutenção das restrições administrativas. Usa somente dados fictícios e remove os avisos que cria. O relatório fica em `artifacts/rehearsal/access-result.json`.

## Publicação

Em 23/11/2026, a interface de análise e as regras de aprovação foram publicadas juntas no projeto `bolao-sesivinhedo`, em `https://bolao-sesivinhedo.web.app`. Os cadastros antigos sem aprovação explícita ficam pendentes até a análise de Guilherme; não foi feita aprovação automática nem exclusão de contas.

Para publicar em outro ambiente, atualize tanto a interface quanto `firestore.rules`. Publicar somente a interface não aplica o bloqueio no banco. TVs continuam usando uma conta da organização; perfis de consulta mantêm o acesso de leitura.
