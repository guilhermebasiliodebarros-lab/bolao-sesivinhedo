export const COPY = {
  brand: {
    name: 'Bolão SESI Vinhedo',
    shortMark: 'BV',
  },
  nav: {
    home: 'Início',
    calendario: 'Calendário',
    classificacao: 'Classificação',
    dashboard: 'Painel',
    jogos: 'Jogos',
    palpites: 'Meus palpites',
    admin: 'Admin',
  },
  actions: {
    entrar: 'Entrar',
    cadastrar: 'Cadastrar',
    sair: 'Sair',
    verJogos: 'Ver jogos',
    verClassificacao: 'Ver classificação',
    criarCadastro: 'Criar cadastro',
  },
  header: {
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    mainNavigation: 'Navegação principal',
    lightMode: 'Modo claro',
    darkMode: 'Modo noturno',
  },
  home: {
    eyebrow: 'Evento escolar com ranking ao vivo',
    intro:
      'Participe do bolão, registre seus palpites antes dos jogos e acompanhe sua pontuação subir conforme os resultados forem finalizados pela organização.',
    heroSignal: ['Palpites com prazo', 'Ranking ao vivo', 'Painel master'],
    cards: [
      {
        number: '01',
        title: 'Palpite antes do jogo',
        description: 'Com o jogo aberto, cada participante envia um placar único e pode editar até o horário limite.',
      },
      {
        number: '02',
        title: 'Pontuação automática',
        description:
          'Acertar vencedor ou empate vale 3 pontos, com multiplicador de 1,2 por gol parcial e 1,4 no placar exato.',
      },
      {
        number: '03',
        title: 'Ranking em tempo real',
        description: 'A classificação mostra pódio, pontuação total, acertos exatos e acertos de resultado.',
      },
    ],
    sports: {
      label: 'Esportes do evento',
      eyebrow: 'Clima de competição',
      title: 'Visual pensado para quadra, torcida e placar ao vivo.',
      items: ['Futebol', 'Basquete', 'Vôlei', 'Handebol'],
    },
    feature: {
      eyebrow: 'Organização simples',
      title: 'Administre jogos, placares e status em uma única área.',
    },
  },
  auth: {
    login: {
      eyebrow: 'Acesso seguro',
      title: 'Entrar no bolão',
      description: 'Participantes entram no painel do bolão. Usuários master entram direto na administração.',
      missingFields: 'Informe e-mail ou login e senha para entrar.',
      emailLabel: 'E-mail ou login',
      emailPlaceholder: 'voce@email.com ou suporte',
      passwordLabel: 'Senha',
      passwordPlaceholder: 'Sua senha',
      loading: 'Entrando...',
      switchText: 'Ainda não participa?',
    },
    cadastro: {
      eyebrow: 'Novo participante',
      title: 'Cadastrar conta',
      description: 'Crie seu acesso para participar do Bolão SESI Vinhedo e acompanhar sua pontuação.',
      missingFields: 'Preencha nome, e-mail e senha.',
      shortPassword: 'A senha precisa ter pelo menos 6 caracteres.',
      nameLabel: 'Nome',
      namePlaceholder: 'Seu nome completo',
      emailLabel: 'E-mail',
      emailPlaceholder: 'voce@email.com',
      passwordLabel: 'Senha',
      passwordPlaceholder: 'Mínimo de 6 caracteres',
      loading: 'Cadastrando...',
      switchText: 'Já tem conta?',
    },
  },
  footer: {
    tagline: 'Palpites, ranking e emoção em tempo real para o evento escolar.',
    scoring: 'Resultado 3 pts | Gol parcial x1,2 | Placar exato x1,4',
  },
}
