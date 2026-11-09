# Revisão de interface e usabilidade — 9 de novembro de 2026

Projeto: `bolao-sesivinhedo`. Revisão do código local e do navegador, com correções aplicadas. A publicação no Firebase Hosting não foi realizada.

## Problemas encontrados e corrigidos

| Área | Comportamento observado | Correção |
| --- | --- | --- |
| Confirmações do painel | A confirmação de exclusão podia ficar fora da janela após rolar a página. Em uma janela de 390 × 640, seu topo ficou acima de −1.600 px. O cabeçalho permanecia por cima e Escape não fechava a caixa. | Confirmação em diálogo nativo, sobre as camadas da página, com altura limitada e rolagem própria. Foco inicial em Cancelar, navegação por Tab, fechamento com Escape e retorno do foco ao acionador. Na mesma janela, a caixa passou a ocupar aproximadamente os pixels 152 a 489. |
| Mais opções da partida | O menu abria sempre para baixo. Uma reprodução colocou seu limite inferior em 884 px numa janela de 640 px. | Menu fora das caixas dos cartões, com posicionamento calculado conforme o espaço, altura limitada e rolagem interna. Reposiciona ao rolar/redimensionar, fecha com Escape/clique externo e permite navegação por teclado. |
| Diálogos de organização | O fundo continuava rolando com a janela de preparação aberta. | Bloqueio compartilhado da rolagem do fundo em preparação, gestão, confirmação, sorteio, reorganização e terceiro lugar. A rolagem e o foco anteriores são recuperados ao fechar. |
| Preparação da partida | A barra fixa de ações ocupava cerca de 189 px de uma janela de 640 px e passava sobre o formulário durante a rolagem. | As ações acompanham o fluxo do formulário, deixando campos e mensagens acessíveis sem essa camada sobreposta. Conferência adicional com teclado e em paisagem. |
| Calendário em celular estreito | A página excedia a largura em 14 px numa janela de 320 px. | Coluna com largura mínima zero, filhos flexíveis e quebra do texto dos atalhos. |
| Classificação por grupo | A seção excedia a largura em 48 px numa janela de 320 px. | Contenção da coluna e dos cartões. Tabelas extensas mantêm sua rolagem horizontal dentro da própria área. |
| Menu lateral do painel | Em janela com 600 px de altura, a navegação tinha aproximadamente 787 px sem rolagem interna. | Altura limitada ao espaço disponível e rolagem própria da lista. O deslocamento considera a altura real do cabeçalho. |
| Erros de carregamento | Calendário e painel exibiam somente o indicador de carregamento quando a assinatura de dados falhava. O mesmo padrão existia em outras telas. | Estado de falha com mensagem e Tentar novamente em calendário, painel, jogos, palpites e classificação. A página inicial também informa a falha. Alertas de erro identificados para tecnologias assistivas. |
| Preferências do navegador | O acesso direto ao armazenamento podia interromper a abertura quando o navegador o bloqueasse. | Leitura e gravação tolerantes a falhas para tema e preferências da TV. Conferido com `localStorage` indisponível. |
| Verificação de código | O lint analisava arquivos gerados do motor de OCR e apontava uma atualização síncrona de estado na classificação. | Arquivos de terceiros em `public/ocr` excluídos da análise de código próprio. Palpites da classificação vinculados ao usuário do carregamento; dependência instável da página inicial ajustada. |

## Cobertura realizada

- 232 combinações de página, perfil, janela e estado na revisão ampla, seguidas de verificações direcionadas das correções de foco e diálogos.
- Perfis de visitante, participante e master, usando contas fictícias nas simulações.
- Início, calendário, chaveamento, simulador, regulamentos, estatísticas, login, cadastro, painel do participante, jogos, palpites, ranking e todas as 14 seções administrativas.
- Larguras de 320, 390, 768, 1.000 e 1.440 px, com alturas que incluem janela curta e orientação em paisagem.
- Modo escuro, nomes e mensagens extensos, texto a 200%, estados vazios, falhas de carregamento e armazenamento indisponível.
- Modo TV com ajustes abertos e fechados, navegação por teclado, menu lateral, confirmações e preparação de partidas.
- Consulta real do calendário público local em um contexto de visitante, sem falha de carregamento ou erro de execução.
- Na simulação ampla: nenhuma exceção JavaScript, nenhum vazamento horizontal da página após as correções e nenhuma requisição ao Firestore de produção. A consulta real separada foi somente de leitura.
- 117 testes automatizados de regras e serviços aprovados; lint sem erros ou avisos e compilação de produção aprovada.

Os testes no navegador foram executados com Microsoft Edge em Windows. Esta revisão não equivale a testar todos os aparelhos, conteúdos possíveis, leitores de tela ou as regras do Firebase em um emulador. As confirmações e as demais gravações simuladas não alteraram partidas reais. As funções de disciplina e terceiro lugar criadas na etapa anterior foram preservadas.

## Possibilidades para a próxima etapa

1. **Interclasse em modo história:** transformar lances e resultados registrados numa linha do tempo com viradas, estreias e momentos marcantes. Textos derivados dos registros, com opção de revisão da organização.
2. **Passaporte de participação:** reconhecer diferentes formas de participação — atleta, arbitragem, reportagem, apoio e torcida — com atividades confirmadas pelos responsáveis.
3. **Simulador de imprevistos:** ensaiar atraso, chuva ou indisponibilidade de uma quadra e comparar propostas de reorganização antes de alterar a programação.
4. **Mapa vivo da escola:** localizar quadras, salas, pontos de água e trajetos acessíveis; cada local abre seus jogos atuais e próximos.

Antes de acrescentar muitas telas, convém compactar os atalhos do calendário no celular e revisar a nomenclatura: algumas áreas públicas falam em bolão e outras em interclasse. Uma organização consistente por **acompanhar jogos**, **participar do bolão** e **organizar o evento** ajudaria quem entra no site pela primeira vez.
