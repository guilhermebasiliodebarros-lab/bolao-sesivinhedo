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

## Regras do Firestore

O arquivo `firestore.rules.example` traz uma base de segurança para impedir que participantes alterem `role`, pontuação ou dados de outros usuários. Revise no Firebase Console antes de publicar como `firestore.rules`.

## Rodar localmente

```bash
npm install
npm run dev
npm run build
```

## Publicação

```bash
npm run build
git add .
git commit -m "Configura Firebase, usuário master e sistema do bolão"
git push
firebase deploy
```
