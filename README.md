# Bolao SESI Vinhedo

Aplicacao React + Vite para cadastro de participantes, login, palpites, ranking automatico e painel master com Firebase Authentication e Firestore.

## Configuracao do Firebase

1. Crie um projeto no Firebase Console.
2. Ative Authentication > Sign-in method > Email/Password.
3. Ative Firestore Database.
4. Copie `.env.example` para `.env.local`.
5. Preencha as variaveis:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

As chaves reais ficam somente em `.env.local`; nao coloque credenciais diretamente no codigo.

## Primeiro usuario master

1. Crie o usuario normalmente pela tela de cadastro ou pelo Firebase Authentication.
2. Abra Firestore Database > `users`.
3. Selecione o documento do usuario.
4. Altere `role` de `"user"` para `"master"`.
5. Altere ou crie `participaRanking` como `false`.

O usuario master serve apenas para administracao. Para participar do bolao, crie outra conta normal com `role: "user"`.

## Colecoes usadas

- `users`: perfil, role, pontos e flags de ranking.
- `games`: jogos, status e placar final.
- `predictions`: palpites por usuario e jogo.

Cada jogo tambem tem `limitePalpites`. Participantes so conseguem criar ou editar palpites enquanto o jogo estiver `aberto` e antes desse horario.

Status de jogo:

- `aberto`: participantes podem criar ou editar palpites.
- `encerrado`: palpites bloqueados, placar ainda nao finalizado.
- `finalizado`: placar lancado, palpites pontuados e ranking atualizado.

## Regras do Firestore

O arquivo `firestore.rules.example` traz uma base de seguranca para impedir que participantes alterem `role`, pontuacao ou dados de outros usuarios. Revise no Firebase Console antes de publicar como `firestore.rules`.

## Rodar localmente

```bash
npm install
npm run dev
npm run build
```

## Publicacao

```bash
npm run build
git add .
git commit -m "Configura Firebase, usuario master e sistema do bolao"
git push
firebase deploy
```
