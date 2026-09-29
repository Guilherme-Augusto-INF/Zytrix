# Ativar contador de espectadores em tempo real

A mudança está na PR #14 e **não deve entrar em produção antes das regras**.
O contador usa `streams.viewerCount`, incrementado e decrementado na mesma
transação que cria/remove `streams/{id}/livePresence/{uid}`.

## Configuração necessária (administrador)

1. No projeto Firebase **zytrix-ca4f2**, abra Authentication > Sign-in method e
   habilite **Anonymous**. A autenticação anônima usa um app Firebase separado
   e não autentica o visitante no chat ou no perfil da Zytrix.
   Para um lançamento público resistente a abusos, configure também Firebase
   App Check e proteções contra criação automatizada de identidades anônimas.
2. No console Firebase > Firestore Database > Rules, publique o conteúdo
   **integral e atualizado** de `firebase/firestore.rules` deste branch
   (equivalente a `firestore.rules` e `REGRAS-PARA-COLAR-NO-FIREBASE.txt`).
   Não substitua regras parcialmente; compare a versão atual antes de publicar.
   Alternativa local para administradores autenticados:
   `npx firebase-tools deploy --only firestore:rules --project zytrix-ca4f2`.
3. Depois de verificar o deploy das regras, incorporar a PR #14 em main,
   permitindo à Vercel atualizar os arquivos JS de produção.

## Validação

- Conta autenticada A entra: de 0 para 1 em cards e na live; sai: volta a 0.
- Visitante sem login entra (com Anonymous Auth habilitado): +1;
  sai/oculta a aba: -1; logins e chat continuam exigindo conta normal.
- A mesma conta navegando novamente enquanto há presença existente não soma
  duas vezes.
- O streamer não conta como espectador do próprio canal.
- Duas pessoas em navegadores separados: +2; quando só uma sai: -1.
- Forjar contagem via Firestore sem criar/remover a própria presença no
  mesmo commit é negado.
- Conferir ausência de erros de permissão no console do navegador.

## Precisão operacional

- Valores de `viewerCount` modificados manualmente anteriormente (ex.: 80)
  permanecem como base; um visitante faz 80 -> 81 -> 80. Para migrar para
  audiência totalmente real, um administrador precisa primeiro reconciliar
  contagens legadas em uma janela sem live ativa.
- Saída/ocultação de aba dispara remoção assíncrona; fechar o navegador à força
  ou perder a conexão pode impedir a operação. **Antes de usar como métrica
  pública exata, implante reconciliação confiável de sessões vencidas** no
  backend (por exemplo, rotina administrativa programada com credenciais
  protegidas). A propriedade `expiresAt` marca documentos vencidos mas não
  atualiza automaticamente `viewerCount`.
- Sessão única é por identidade Firebase/conta em uma live: várias abas do
  mesmo navegador compartilham identidade. Evite chamar o mecanismo
  de contagem exata por dispositivo até coordenar múltiplas abas.
