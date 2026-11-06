# Bolão SESI Vinhedo

Aplicação React + Vite para cadastro de participantes, login, palpites, ranking automático e painel master com Firebase Authentication e Firestore.

## Configuração do Firebase

1. Crie um projeto no Firebase Console.
2. Ative Authentication > Sign-in method > Email/Password.
3. Ative Firestore Database.
4. Copie `.env.example` para `.env.local`.
5. Preencha as variáveis:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

As chaves reais ficam somente em `.env.local`; não coloque credenciais diretamente no código.

O build exige todas essas variáveis e interrompe a publicação se alguma estiver ausente. O deploy do Hosting executa o build automaticamente para publicar a configuração atual.

## Primeiro usuário master

1. Crie o usuário normalmente pela tela de cadastro ou pelo Firebase Authentication.
2. Abra Firestore Database > `users`.
3. Selecione o documento do usuário.
4. Altere `role` de `"user"` para `"master"`.
5. Altere ou crie `participaRanking` como `false`.

O usuário master serve apenas para administração. Para participar do bolão, crie outra conta normal com `role: "user"`.

## Coleções usadas

- `users`: perfil, role, pontos e flags de ranking.
- `games`: jogos, status e placar final.
- `predictions`: palpites por usuário e jogo.

Cada jogo também tem `limitePalpites`. Participantes só conseguem criar ou editar palpites enquanto o jogo estiver `aberto` e antes desse horário.

Status de jogo:

- `aberto`: participantes podem criar ou editar palpites.
- `encerrado`: palpites bloqueados, placar ainda não finalizado.
- `finalizado`: placar lançado, palpites pontuados e ranking atualizado.

## Esportes e partidas ao vivo

O calendário e a página Jogos têm filtros por modalidade. No painel master, use **Esporte para gerenciar** para alternar entre as listas de jogos.

Na aba **Ao vivo / TV**:

1. Selecione uma partida e clique em **Iniciar jogo**. Os palpites desse jogo são fechados imediatamente.
2. Use **Atualizar placar** para transmitir o placar parcial. Várias partidas podem acontecer ao mesmo tempo.
3. Use **Encerrar partida** e confirme o placar final para publicar o resultado, avançar o chaveamento e recalcular o ranking.

O início é controlado pela organização; o horário programado sozinho não marca uma partida como ao vivo. Jogos antigos continuam agendados até serem iniciados, ou aparecem como resultado se já estavam finalizados.

## Modo TV

Abra `https://bolao-sesivinhedo.web.app/#tv` ou use **Modo TV** no menu. A tela é pública e recebe os dados em tempo real, com partidas ao vivo, próximos horários e últimos resultados. O filtro por esporte, a rotação de páginas a cada 12 segundos e o botão **Tela cheia** ajudam na exibição em televisores. Sem conexão, a tela identifica que está exibindo os últimos dados recebidos.

## Regras do Firestore

O arquivo `firestore.rules.example` traz uma base de segurança para impedir que participantes alterem `role`, pontuação ou dados de outros usuários. Revise no Firebase Console antes de publicar como `firestore.rules`.

## Rodar localmente

```bash
npm install
npm run dev
npm run build
```

Os testes de partidas usam um banco isolado em memória e não alteram o Firebase de produção. Para executá-los, use Node.js 24 e `npm test`.

## Publicação

```bash
npm run build
git add .
git commit -m "Configura Firebase, usuário master e sistema do bolão"
git push
firebase deploy
```
