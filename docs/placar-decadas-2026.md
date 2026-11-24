# Placar Décadas em jogo · Interclasse 2026

O acesso **Placar ao vivo** combina a identidade das duas turmas selecionadas pela organização. Cada lado ocupa a mesma área, com sua década, cor, tipografia, moldura e ilustração. Os números permanecem grandes, claros e com uma fonte comum para facilitar a leitura à distância.

## Como usar

O placar e o Modo TV exigem login. Em cada navegador da transmissão, entre com a conta da organização antes de abrir a TV. Veja o [guia de acesso autenticado](acesso-autenticado.md).

1. Selecione um ou dois jogos em **Painel master → Ao vivo / TV → Escolher jogos do placar**.
2. Abra **Placar ao vivo** na TV. As identidades são aplicadas automaticamente às turmas e acompanham as mudanças de seleção.
3. Use **Ajustar placar da TV → Décadas e cores das turmas** para consultar a legenda completa.
4. Para experimentar sem alterar o campeonato, abra **Painel master → Ensaio geral → Iniciar modo de teste**. Em **Equipes para testar o placar**, escolha **Equipe A** e **Equipe B** entre as 14 turmas; as opções mostram a década e a cor de cada uma. No basquete e no vôlei, use **Jogo para operar** para escolher as equipes de cada partida separadamente. A prévia e sua versão ampliada usam o mesmo placar temático e refletem a seleção imediatamente. Trocar as turmas mantém o placar, os lances, o relógio e os alunos fictícios; reiniciar os testes zera os resultados, preservando as equipes escolhidas até sair do modo de teste.

A programação rotativa do **Modo TV** também identifica as décadas com seus ícones, cores e fontes, em uma apresentação compacta.

As paletas das 14 turmas usam tons vivos e saturados, com molduras sólidas e ilustrações sem a transparência geral que deixava as cores apagadas. O laranja tem faixas fortes em laranja e âmbar; os Anos 2000 usam rosa pink vivo nas molduras, nos fundos e nas ilustrações Y2K. Os fundos recebem a cor da turma, e uma sombra central preserva a leitura dos números. O mesmo ajuste aparece no placar, no Modo TV e nas prévias do modo de teste.

## Identidades das turmas

| Turno | Turma | Década | Cor |
| --- | --- | --- | --- |
| Tarde | 6º A | Anos 70 | Dourado / amarelo |
| Tarde | 6º B | Anos 60 | Laranja |
| Tarde | 7º A | Anos 50 | Vermelho |
| Tarde | 7º B | Anos 90 | Verde / verde-militar |
| Tarde | 8º A | Anos 80 | Azul |
| Tarde | 8º B | Anos 2000 | Rosa pink (Hot Pink, #FF69B4) |
| Manhã | 9º A | Anos 60 | Laranja |
| Manhã | 9º B | Anos 70 | Preto |
| Manhã | 1º A | Anos 20 | Dourado / amarelo |
| Manhã | 1º B | Anos 50 | Vermelho |
| Manhã | 2º A | Anos 90 | Verde / verde-militar |
| Manhã | 2º B | Anos 80 | Azul |
| Manhã | 3º A | Anos 2000 | Rosa pink (Hot Pink, #FF69B4) |
| Manhã | 3º B | Anos 40 | Roxo |

## Referências visuais

| Década | Elementos do placar |
| --- | --- |
| Anos 20 | Leques geométricos, diamantes e linhas escalonadas de Art Déco |
| Anos 40 | Moldura de cartaz, textura de impressão, microfone de rádio e ramos ornamentais |
| Anos 50 | Discos de vinil, notas musicais, estrelas, formas atômicas e faixa quadriculada |
| Anos 60 | Curvas psicodélicas, círculos concêntricos e flores |
| Anos 70 | Globo de discoteca, reflexos e curvas arredondadas, nas versões dourada e preta |
| Anos 80 | Grade em perspectiva, máquina de arcade, pixels e linhas de neon |
| Anos 90 | Janela de computador, cursor, pixels, riscos e bordas grunge |
| Anos 2000 | Órbitas, disco, estrelas e detalhes Y2K com brilho em tons de rosa |

As ilustrações são vetoriais e locais. O tema não exige baixar imagens ou fontes externas. Os desenhos ficam nas bordas e ao fundo; uma camada escura protege o contraste dos nomes e da pontuação. Elementos decorativos são ignorados pelos leitores de tela, e a preferência por movimento reduzido é respeitada.

## Dados e funcionamento

A identificação prioriza a turma registrada na partida e reconhece os formatos de nome já usados pelo sistema, como `9º A`, `9A` e `9º ano A`, além dos identificadores automáticos das equipes escolares. Participantes ainda indefinidos e equipes desconhecidas recebem uma identidade neutra até serem identificados. O cadastro visual fica centralizado em `src/utils/decadeIdentities.js`.

As cores dos coletes continuam separadas das cores temáticas. Placar, relógio, períodos, pontos e sets do vôlei, parciais, autores dos lances, cartões e diagnóstico da conexão usam o funcionamento existente. A personalização não grava novos campos nos jogos nem altera resultados ou permissões.

## Validação local

- 243 testes automatizados aprovados, incluindo as 14 associações, os oito estilos, nomes legados, participantes indefinidos, simetria ao trocar as equipes e preservação dos dados da partida.
- Compilação de produção e verificação de textos aprovadas.
- Atualização recebida pelo Firestore de ensaio sem recarregar a TV, preservando tema, cronômetro, autores e cartões.
- Conferência de um e dois jogos, placar de três dígitos no basquete, pontos/sets do vôlei, telas de 1920×1080 e 1366×768 e celular de 390×844.
- Conferência da programação rotativa com dois e quatro jogos e da prévia incorporada/ampliada do modo de teste.

As verificações utilizaram dados fictícios no ambiente local. A nova interface precisa ser publicada para aparecer nos outros dispositivos.
