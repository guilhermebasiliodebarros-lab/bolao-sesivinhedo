# Acesso autenticado · 18/11/2026

Sem uma conta logada, o site apresenta somente boas-vindas, login e cadastro. A página inicial preserva a identidade visual do Interclasse e oferece **Entrar** e **Criar minha conta**. Não mostra programação, partidas em destaque, placares, resumo do evento ou atalhos para as funções.

Os menus superior, lateral e inferior do celular aparecem somente depois do login. Links diretos para calendário, chaveamento, simulador, regulamentos, estatísticas, classificação, palpites, administração, Modo TV e placar ao vivo redirecionam para o login. O sistema aguarda a autenticação e o perfil antes de renderizar as telas. Ao sair, as telas e suas assinaturas em tempo real são desmontadas.

## Permissões após entrar

- **Participante:** Painel, Jogos, Meus palpites e Classificação.
- **Consulta:** Calendário, Chaveamento, Simulador, Regulamentos e Estatísticas.
- **Master:** telas do evento, organização, Modo TV e placar ao vivo.

As permissões de cada perfil foram preservadas. Para abrir uma TV em outro navegador ou dispositivo, primeiro entre com a conta da organização naquele navegador e depois abra o placar. O modo de teste interno continua disponível no painel master.

## Proteção dos dados

As regras de leitura de jogos, modalidades, equipes, configurações da transmissão e avisos ativos agora exigem autenticação. O bloqueio também vale para chamadas diretas ao Firestore. Elencos, documentos de partidas e operações continuam reservados ao master. Participantes e contas de consulta continuam sem permissão de administrar jogos ou ler informações privadas.

A tela de boas-vindas não assina as consultas de jogos. As faixas de placares e de atualização em tempo real também não são montadas antes do login. As páginas de login e cadastro continuam acessíveis normalmente.

## Validação

`npm test` verifica todas as rotas de visitantes, links diretos, saída da conta e permissões dos perfis existentes.

Com `npm run ensaio` aberto, execute `npm run validar:acesso`. O roteiro usa as regras reais dos emuladores de autenticação e Firestore em `demo-interclasse-ensaio`: verifica leituras negadas sem login, acesso autenticado dos três perfis, consultas de avisos ativos e manutenção das restrições administrativas. Usa somente dados fictícios e remove os avisos que cria. O relatório fica em `artifacts/rehearsal/access-result.json`.

## Publicação

Esta alteração foi preparada e validada no projeto local. Para aplicar a proteção no site publicado, é necessário publicar tanto a nova interface na hospedagem usada pelo site quanto o arquivo `firestore.rules` no projeto Firebase correspondente. Publicar somente a interface oculta as funções, mas não aplica a nova exigência de autenticação no banco. TVs e navegadores que consultavam o campeonato sem uma conta precisarão entrar após a publicação.
