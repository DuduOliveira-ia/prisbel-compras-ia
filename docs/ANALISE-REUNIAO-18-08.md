# Análise das transcrições da reunião (18/08/2026)

Leitura das duas gravações (~2h) procurando ponto cego e erro conceitual. O que já
estava mapeado ficou de fora; aqui só o que **muda o que vamos construir**.

---

## 1. O fluxo alvo, na voz do Luís — e ele NÃO é o que temos

Trecho decisivo (Gravação 1, 58:10):

> "Se o pedido tinha 10 materiais, de alguma forma eu tenho que fazer uma confirmação
> para a Dani: *Dani, o Eduardo pediu 10 itens. Desses 10, cinco já têm preço aqui, é
> controlado. Posso liberar?* — *Pode.* E foi lá para o fornecedor. *Os outros cinco,
> posso cotar?* — *Pode.* Disparou para os fornecedores."

Isso é mais específico do que o backlog #18 registrava. O pedido não é roteado inteiro:
ele é **particionado em dois grupos** e a Daniela dá **duas autorizações distintas** —
uma para liberar AF do que já tem preço, outra para cotar o resto. Hoje a Bella manda
tudo para cotação, e mesmo depois do #18 ela trataria o pedido como bloco único.

**Consequência prática:** a resposta da Bella a um pedido misto passa a ter duas
perguntas, não uma.

## 2. Material controlado exige mais que NBR

> "Tem que ter laudo, tem que ter certificado... O concreto mandou para o laboratório,
> fez um teste nele. Se tem um certificado deles, está válido." (03:12)

Registramos NBR, mas o controle real inclui **laudo laboratorial, certificado e
validade**. Um certificado vencido invalida o material. Isso não existe em lugar nenhum
do nosso modelo.

E mais: **a NBR tem que ir no e-mail ao fornecedor** (03:33) — "o pedido que eu mando
para o fornecedor quando é material controlado tem que ter NBR também". Hoje a cotação
sai sem NBR nenhuma.

## 3. Contrato não é preço fixo eterno — tem prazo curto e indexador

> "Aço varia por causa de dólar. O fio varia por causa do cobre. Eu posso negociar aço,
> mas três meses, quatro meses no máximo. Depois vai mudar a cotação, vai ter que ser
> renegociado." (36:52) · "Cimento varia por causa de combustível." (37:38)

O backlog #19 previa `vigencia` e `saldo`. Falta o essencial: **cada material tem um
horizonte de revalidação diferente** (areia e brita: 1 ano; aço: 3–4 meses) e um
**indexador** que explica por quê. Sem isso, a Bella vai emitir AF com preço vencido.

## 4. Endereço: só o bairro — e eu tinha implementado errado

> "Posto da obra Paradiso. Isso aqui a gente pode até tirar. O cara não precisa nem saber
> para onde. Ele tem que saber que é da Prisbel. É o bairro, não precisa ser o endereço
> exato." (38:45)

Implementei hoje o endereço completo no e-mail de cotação. **Corrigido**: agora vai só
bairro e cidade. Endereço exato de obra não se manda para lista de fornecedores.

## 5. Busca de fornecedor não escala

> "Você vai ter que ter uma forma aqui de digitar o nome e achar o cara. Senão eu vou
> abrir uma lista de dois mil fornecedores." (08:24)

O painel mostra os fornecedores como lista de marcação. Com 2.000 cadastros isso trava a
tela e a cabeça de quem usa. Precisa de busca por nome e filtro por categoria.

## 6. A Bella tem que falar com a obra, não só com a compradora

> "Bela, manda um e-mail perguntando se o material está atrasado... e responde no
> WhatsApp pra mim. E ela mesma encaminha: *Eduardo, o fornecedor pediu desculpas, mas o
> material vai chegar sexta-feira.*" (Gravação 2, 02:05)

Hoje a comunicação é obra → Bella → compradora. Falta o caminho de volta: a Bella
avisando o **requisitante** sobre prazo, atraso e confirmação de entrega. É o que fecha o
ciclo para quem está no canteiro.

## 7. Cobrança de fornecedor tem critério

> "E se ela não responder? Ela cobra? — Cobra. Você fala: *quais pedidos têm mais de um
> dia?* Reenvia e fala que a gente está fechando a cotação." (39:25)

O critério é **mais de um dia sem resposta**, e a mensagem tem um gancho de urgência
("estamos fechando a cotação"). Dá para implementar exatamente assim.

## 8. Status por item, não por pedido

> "Ainda está em cotação. Então quer dizer que o restante já tem resposta? Ele está
> completo, mas o item 1 ainda está em cotação." (44:35)

Um pedido pode ter itens em estados diferentes. Hoje a Bella responde um estado só e
confunde. A resposta de status precisa ser por item quando eles divergem.

## 9. Pergunta repetida: ela repetiu a resposta em vez de reconsultar

> "Ela falou: *se eu acabei de te responder, você está me perguntando de novo, é isso
> aqui.* Só copiou o mesmo texto e não olhou na base." (32:59)

Quando a mesma pergunta vem duas vezes, a Bella copiou a resposta anterior do histórico
em vez de reler os dados — e naquele momento a base já tinha mudado (pedidos 9 e 10
recém-criados).

## 10. Auditoria quer o que foi APAGADO

> "Eles vão auditar o sistema. Inclusive para pegar o log e saber quem fez, a hora que
> fez, **se apagou, se não apagou**." (02:45)

Não basta registrar o que existe: a auditoria quer saber o que foi **removido ou
alterado**. Nossa planilha permite apagar uma linha sem deixar rastro.

## 11. Vocabulário: ela chama de "coleta de preços"

> "No assunto do e-mail eu coloco: coleta de preços, obra tal." (39:17)

Nós usamos "Cotação". Vale adotar o termo da casa nos e-mails que saem — com o cuidado
de que o WF5 identifica a resposta pelo assunto, então a mudança tem que ser coordenada.

---

## O conflito de visão que precisa de decisão

Daniela e Luís discordam, e está gravado:

> **Daniela:** "Isso está naquele painel. Eu acho mais seguro no painel."
> **Luís:** "Ele pode até mostrar o painel, mas que fique ali a conversa... o assistente
> não pode perder essa pessoalidade. Se começa a pessoa clica, escolhe, vira TOTVS."

Não é preferência estética: é **quem conduz o fluxo**. Minha leitura é que os dois estão
certos em coisas diferentes, e a síntese é **a conversa conduz, o painel confirma** — a
Bella propõe e pergunta no chat; o painel existe para a Daniela conferir em lote e ter a
visão da fila. O que não pode acontecer é a conversa virar um menu de cliques.

## O critério de aceite, na voz do Luís

> "Qual é a resposta que ela tem que dar? Qual é o e-mail que ele tem que mandar? Criar
> um case." (55:57)

O case completo que ele descreve: **obra pede → Bella depura e corrige (tijolo cerâmico
× tijolo de nó) → identifica o que é controlado → o que tem contrato vira AF, o que não
tem vai a cotação → propostas voltam → Daniela negocia → "Bella, corrige o preço do vaso
de 40 para 32 e emite a AF" → AF emitida = compra efetivada.**

Vale transformar isso num roteiro de aceite único, que a gente roda inteiro antes de
dizer que está pronto. Hoje cobrimos do "obra pede" até "propostas voltam".
