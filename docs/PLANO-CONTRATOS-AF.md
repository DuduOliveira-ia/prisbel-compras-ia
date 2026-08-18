# Plano de trabalho — contratos, AF e consolidação (v1.0, 18/08/2026)

O que falta resolver no software para a Bella acompanhar o processo **real** de compras
da Prisbel. Ordenado por dependência: a Fase 0 não depende de ninguém e pode ser feita
enquanto a Daniela não confirma; as Fases 1 e 2 têm decisões que **só ela** pode dar.

Origem: resumo da reunião (18/08) + conversa com o Eduardo. Itens numerados remetem ao
`docs/BACKLOG.md`.

---

## Fase 0 — dá para fazer agora, sem depender de resposta

Sete frentes independentes. Nenhuma exige decisão da Daniela.

### 0.1 Fornecedores nas 10 categorias novas ⚠️ o mais urgente
Criamos PINTURA, REVESTIMENTO, GESSO, MADEIRAS, IMPERMEABILIZAÇÃO, AGREGADOS, INCÊNDIO,
PRÉ-MOLDADOS, GÁS e CONCRETO USINADO na REQUISITOS, mas **nenhum fornecedor está cadastrado
nelas**. Hoje um pedido de pintura cai no fornecedor GERAL. Enquanto não houver o cadastro real,
apontar os fornecedores de teste para elas, para o roteamento ficar coerente.
*Esforço: minutos.*

### 0.2 Bairro de entrega no e-mail de cotação — backlog #23
O fornecedor precisa do bairro para calcular frete. A aba OBRAS já tem `endereco` e nós não
usamos. Incluir no corpo do e-mail (WF4 e WF7).
*Esforço: pequeno.*

### 0.3 Faturamento mínimo — backlog #22
Campo novo na FORNECEDORES (a estrutura pode ir agora; os valores a Daniela preenche depois).
A Bella avisa quando a cotação não atinge o mínimo do fornecedor.
*Esforço: pequeno (estrutura) + regra no comparativo.*

### 0.4 Cotação repetida do mesmo fornecedor — backlog #17
Hoje duas respostas do mesmo fornecedor para o mesmo item **somam** e podem inverter o vencedor.
Deduplicar por (pedido, item, fornecedor) mantendo a mais recente.
*Esforço: pequeno, no cálculo do comparativo.*

### 0.5 Extração de resposta informal e anexo PDF — backlog #24
Caso relatado na reunião: *"200 micras = 180 por rolo, total 1.440"* não foi extraído. E proposta
em **anexo PDF** o WF5 não lê. Os dois com teste próprio.
*Esforço: médio (o PDF exige baixar anexo e mandar ao Gemini, como o WF3 já faz).*

### 0.6 Identidade no painel — backlog #1 · agora é compliance
A auditoria externa passa a olhar log, histórico e rastreabilidade. Aprovação de envio sem autor
registrado não se sustenta. Migrar o painel para a aba ACESSOS (como o chat) e gravar quem aprovou
cada cotação.
*Esforço: médio.*

### 0.7 Rastreabilidade das ações
Ainda ligado à auditoria: registrar em LOG quem pediu, quem aprovou e o que a Bella enviou —
hoje isso está espalhado entre CONVERSAS, PEDIDOS e a caixa de e-mail.
*Esforço: médio.*

---

## Fase 1 — contrato e AF (o coração da mudança)

**Regra do processo:** material **controlado** (cimento, concreto, areia, brita, aço) tem contrato
de longa duração, com quantidade fechada e preço travado por período. A obra vai **puxando** ao
longo do tempo. Pedido desses materiais **não vai a cotação** — vira **AF (Autorização de
Fornecimento)** direto para o fornecedor do contrato.

### 1.1 Modelo de dados do contrato — backlog #19
A aba CONTRATOS_COMPRAS já tem material, fornecedor, preço, vigência, pedido mínimo e condições.
Faltam **`quantidade_contratada`** e **`saldo` / `consumido`** — é o saldo que importa no dia a dia.
🔒 *Depende da Daniela:* quem mantém a conta hoje (Totvs? planilha? a cabeça dela?).

### 1.2 Roteamento: contrato antes de cotação — backlog #18
Antes de propor cotação, a Bella consulta CONTRATOS_COMPRAS. Havendo contrato vigente com saldo,
ela propõe a **AF**; não havendo, segue para cotação como hoje.
🔒 *Depende da Daniela:* o acionamento do fornecedor é automático ou passa pela aprovação dela?

### 1.3 A AF em si — backlog #21
Definir o que a AF é na prática: e-mail ao fornecedor? documento anexo? lançamento no Totvs?
🔒 *Depende da Daniela:* formato, numeração e quem assina.

### 1.4 Baixa de saldo
Cada AF emitida abate do saldo do contrato. Sem isso, o saldo mente já na segunda compra.

### 1.5 Alertas de contrato
Saldo acabando e vigência vencendo. É o tipo de coisa que hoje só existe na memória da Daniela —
e onde a Bella ganha confiança rápido.

---

## Fase 2 — consolidação por obra — backlog #20

**Regra do processo:** a Daniela junta os pedidos de **todos os requisitantes da mesma obra**
(engenheiros + almoxarifes) antes de mandar cotar. Hoje a Bella trata cada pedido isoladamente,
o que fragmenta a compra, perde escala e ignora o faturamento mínimo.

Muda a unidade de trabalho do fluxo: deixa de ser "pedido" e passa a ser "consolidação da obra".

🔒 *Depende da Daniela:* quando a consolidação fecha — por período (toda 2ª feira?), por volume,
ou quando ela decide? E o pedido urgente fura a fila?

---

## Fase 3 — fechamento e negociação

### 3.1 Decisão sobre o comparativo → AF
Hoje o pedido morre em EM COTAÇÃO. Falta: a Daniela escolher o vencedor no chat ou no painel,
a Bella emitir a AF e o pedido virar COMPRADO.

### 3.2 Negociação por comando
*"Bella, fechei o vaso sanitário por 32 e não por 40, atualiza e emite a AF."* Atualiza o preço
da proposta vencedora e refaz a conta. Exige trilha de auditoria (quem mudou, de quanto para quanto).

### 3.3 Cobrança de fornecedor atrasado
*"Manda um e-mail cobrando o fornecedor que está atrasado."* Mesmo padrão da cobrança de pendência
que já existe: proposta → confirmação → envio.

---

## Fase 4 — produção (independente do resto)

- E-mail corporativo próprio da Bella + publicação do app OAuth (fim da reconexão semanal)
- E-mail oficial da Daniela nos avisos (`compras@grupomunizrabelo.com.br`) — 1 comando
- Migração planilha → banco
- Backup automático da planilha

---

## Perguntas que destravam as Fases 1 e 2

Para levar à reunião com a Daniela. São seis, e todas mudam o que se constrói:

1. **Saldo de contrato:** quem controla hoje? Se for o Totvs, dá para extrair? Se não, a Bella pode passar a manter a conta a cada AF?
2. **Puxada de contrato:** o acionamento do fornecedor é automático quando o requisitante pede, ou passa pela sua aprovação?
3. **AF:** o que é na prática — e-mail, documento, lançamento no Totvs? Quem assina? Tem numeração?
4. **Consolidação:** quando fecha? Período fixo, volume, ou quando você decide? Urgente fura a fila?
5. **Preço de contrato:** trava pelo período todo ou tem reajuste/gatilho?
6. **Faturamento mínimo:** você já tem esses valores por fornecedor, ou precisamos levantar?

---

## Ordem sugerida de execução

1. **Agora:** Fase 0 inteira, começando por 0.1 (fornecedores nas categorias novas), 0.4 (dedupe) e 0.2 (bairro) — são rápidas e melhoram o teste de hoje.
2. **Depois da reunião:** Fase 1 (contrato/AF), que é onde está o maior ganho percebido pela Daniela.
3. **Em seguida:** Fase 2 (consolidação) — depende de entender o ritmo dela.
4. **Fase 3** fecha o ciclo de ponta a ponta.
5. **Fase 4** conforme o calendário de virada para produção.
