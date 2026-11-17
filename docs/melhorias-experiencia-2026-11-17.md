# Melhorias de experiência — 17/11/2026

Esta rodada melhora a consulta pública do evento, a leitura do ranking e o uso no celular. As alterações estão no projeto local; a versão publicada no Firebase Hosting depende de um novo deploy.

## Implementado

- **Página inicial:** nova composição visual, acesso direto à programação, destaque de partida ao vivo ou do próximo confronto, indicadores reais e atalhos para chaveamento, estatísticas e regulamentos. A consulta pública utiliza somente os dados dos jogos.
- **Próximo confronto correto:** a seleção considera partidas agendadas no futuro mesmo quando os palpites já estão fechados. Partidas antigas, adiadas e canceladas não são anunciadas como próximas; o horário sozinho não inicia um jogo.
- **Calendário:** atalhos Hoje/Amanhã, seleção de data, local, turno, fase e situação; busca também por quadra, área e torneio; organização por dia ou modalidade; contagem de resultados e ação para limpar filtros.
- **Horários:** os novos filtros e agrupamentos usam America/Sao_Paulo, incluindo a mudança de dia. Partidas sem horário continuam disponíveis na consulta geral, ao final da lista.
- **Tabelas oficiais:** os filtros de consulta não reduzem o conjunto de partidas usado para calcular a classificação do torneio. Grupos e mata-mata ficam em uma seção expansível.
- **Ranking:** busca sem acentos, posições oficiais preservadas após a busca, resumo pessoal, diferença de pontos para a liderança, identificação “Você” e atalho até a própria linha. Pódio e estatísticas ficam compactos no celular.
- **Navegação:** barra inferior no site completo em telas pequenas, respeitando os menus de visitante, participante e consulta. A organização mantém sua navegação existente.
- **Acessibilidade:** atalho para pular ao conteúdo, foco no conteúdo ao mudar de tela, títulos de página descritivos, rótulos para os números do ranking no celular e respeito à preferência por movimento reduzido.

## Validação

- 224 testes automatizados aprovados, incluindo novos casos de filtros combinados, datas em São Paulo, estados oficiais, ausência de data, seleção de próximos jogos e preservação de posições na busca.
- Build de produção e verificação de acentuação aprovados.
- Conferência no navegador com o projeto fictício `demo-interclasse-ensaio`, sem alterar jogos ou resultados oficiais.
- Busca “ginasio” encontrou os quatro jogos do ginásio; combinada com o turno Tarde, retornou dois. Amanhã sem partidas mostrou a orientação para limpar os filtros.
- Busca de participante manteve a 4ª posição; busca sem correspondência mostrou uma recuperação clara; “Ver minha posição” limpou a busca e levou o foco à linha correta.
- Menus inferiores conferidos nos perfis participante e consulta. A consulta mantém suas cinco telas.
- Layout conferido em 320, 390, 900 e 1440 px, nos temas claro e noturno. Corrigidos o encobrimento da posição por estilos antigos e o excesso de largura em telas de 320 px.

## Preferências atualizadas

As propostas de Minha turma, página da turma e instalação como aplicativo foram retiradas da próxima etapa a pedido do usuário. Os avisos de mudanças seguem como proposta aprovada para evolução.

O usuário selecionou a simulação do impacto de atrasos, os cards com leitura mais rápida, os carregamentos e a padronização dos componentes. Essa rodada foi implementada; o uso e a validação estão no [guia da simulação e da interface](simulacao-atrasos-e-interface.md).

## Outras possibilidades para avaliar

1. **Avisos do evento:** central de novidades, mudanças de horário/local e avisos importantes com validade, reaproveitando os lembretes de palpites existentes.
2. **Histórico de alterações:** ampliar a trilha da organização para consultar quem mudou horários e resultados, quando e por quê, acompanhada de exportação e recuperação de dados.
3. **Carregamento inicial:** converter a imagem de abertura para um formato menor, medir o peso dos recursos e revisar o CSS acumulado. A imagem atual tem aproximadamente 1,8 MB no build.
4. **Acesso na escola:** disponibilizar um QR Code do calendário e do placar nos locais do evento, com nomes de quadras padronizados.
5. **Conferência com usuários:** observar participantes e equipe de consulta encontrando um jogo e consultando o ranking no próprio celular. Priorizar os ajustes que reduzirem dúvidas e toques nesses percursos.
