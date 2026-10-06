# 7. Etapa 2 — Operação, interface e desempenho

Todos os números desta seção foram medidos contra o banco construído na Etapa 1, com a carga de `sql/02_carga.sql`. Os dois experimentos são reprodutíveis:

```bash
cd app
node scripts/experimento-concorrencia.js   # B3
node scripts/estudo-indices.js             # B4
```

## 7.1 B1 — A aplicação

Web, em Node com Express, servindo HTML renderizado no servidor. Sem framework de front-end: a disciplina não avalia a interface, e sim o que ela revela sobre o banco.

| Exigência | Onde está |
|---|---|
| CRUD de pelo menos quatro entidades | `app/src/rotas/cadastros.js` — aluno, professor, turma e disciplina |
| Duas consultas parametrizadas com junção e agregação | `app/src/rotas/consultas.js` — desempenho por turma/disciplina (6 tabelas) e carga horária por professor |
| Relatório consolidado alimentado por visão | `app/src/rotas/relatorio.js`, sobre `vw_boletim_turma` |
| Operação transacional multitabela | `app/src/rotas/matricula.js` |
| Erro de restrição tratado | `app/src/erros.js` |

**Aluno e professor gravam em duas tabelas.** A especialização foi mapeada em tabela por subclasse na Etapa 1, então criar um aluno é inserir em `pessoa` e em `aluno`. Os dois CRUDs usam transação: uma linha em `pessoa` sem a subclasse correspondente seria um registro órfão, proibido pela RN03.

**Tratamento de erro.** `app/src/erros.js` traduz a falha do banco pelo **nome da restrição** — por isso a Etapa 1 nomeou todas. A regra de negócio é o que aparece na tela:

| O usuário faz | O banco devolve | A tela mostra |
|---|---|---|
| CPF repetido | `ER_DUP_ENTRY ... uq_pessoa_cpf` | "Ja existe uma pessoa cadastrada com esse CPF." |
| CPF com 3 dígitos | `CHECK ... ck_pessoa_cpf` | "O CPF deve ter exatamente 11 digitos numericos, sem pontos nem traco." |
| Turma com 99 vagas | `CHECK ... ck_turma_capacidade` | "A capacidade da turma deve ficar entre 5 e 45 alunos." |
| Excluir aluno matriculado | `fk_matricula_aluno` | "Esse aluno tem matricula registrada e nao pode ser excluido." |
| Professor coordenando a si mesmo | `SIGNAL 45000` do gatilho | A própria mensagem da RN08 |

Nenhuma dessas telas exibe `Duplicate entry`, `SQLSTATE` ou qualquer fragmento de SQL. O texto cru vai para o log do servidor.

## 7.2 B2 — Camada de acesso a dados

**Prepared statements em tudo.** `app/src/db.js` só expõe funções que recebem `(sql, parametros)` e chamam `conn.execute()`, que usa prepared statement no protocolo do MySQL. Não existe no projeto uma consulta montada por concatenação. Os filtros opcionais usam o padrão `(? IS NULL OR coluna = ?)`, que mantém o texto do SQL fixo independentemente de quantos filtros o usuário preencheu.

**Tentativa de injeção, com o resultado obtido.** Três payloads na busca do cadastro de alunos:

| Entrada | Resultado |
|---|---|
| `' OR '1'='1` | 0 linhas |
| `'; DROP TABLE nota; --` | 0 linhas; `nota` continuou com 1.950 linhas |
| `x' UNION SELECT cpf,nome,... FROM pessoa -- ` | 0 linhas |

As 16 tabelas continuaram no lugar. O motivo não é a lista de payloads ter sido pequena: o valor digitado nunca chega ao parser de SQL. Ele viaja num pacote separado do protocolo e é tratado como literal — procurar um aluno chamado `' OR '1'='1` é uma busca legítima que simplesmente não encontra ninguém.

**Credenciais fora do código.** `app/src/config.js` lê tudo do ambiente e **aborta no boot** listando o que falta. O `.env` real está no `.gitignore`; o versionado é o `app/.env.example`.

Uma ressalva honesta: as senhas dos usuários MySQL aparecem em `sql/06_usuarios_perfis.sql`, porque o `GRANT` precisa ser legível na correção. São senhas de desenvolvimento local, e trocá-las é o primeiro passo de qualquer uso real. A aplicação nunca lê esse arquivo.

## 7.3 B3 — Transações e controle de concorrência

### A operação transacional

Matricular um aluno altera **três tabelas**:

1. `matricula` — cria o vínculo
2. `historico_situacao_aluno` — fecha a situação anterior e abre `ATIVO` (RN20)
3. `nota` — abre uma linha vazia por avaliação já cadastrada na turma

```
BEGIN
  SELECT ... FROM turma WHERE id_turma = ? FOR UPDATE   -- trava a linha
  SELECT COUNT(*) ... WHERE situacao = 'ATIVA'          -- RN30
  INSERT INTO matricula ...
  UPDATE historico_situacao_aluno SET data_fim = ...    -- fecha a anterior
  INSERT INTO historico_situacao_aluno ...              -- abre a nova
  INSERT INTO nota SELECT ... FROM avaliacao ...        -- abre o diário
COMMIT
```

### Cenário de falha provocado

A tela tem uma caixa **"simular falha no meio da transação"**: as três tabelas são alteradas e, logo antes do `COMMIT`, um erro é levantado de propósito. Medido:

| | matricula | historico | nota |
|---|---:|---:|---:|
| antes | 250 | 140 | 1.974 |
| depois do rollback | 250 | 140 | 1.974 |

Nada ficou. Para comparação, a mesma operação sem a falha deixou +1 matrícula, +1 registro de histórico e +24 linhas de nota.

### Experimento de concorrência

Duas sessões disputando a **última vaga** da turma 2026-6A, capacidade ajustada para 14 com 13 matrículas ativas.

**Rodada 1 — sem trava** (`SELECT COUNT(*)` comum):

```
[   34ms] SESSAO-A  contou 13 ativas para 14 vagas
[   34ms] SESSAO-A  INSERT em matricula
[  196ms] SESSAO-B  contou 13 ativas para 14 vagas     <- leu o mesmo que A
[  199ms] SESSAO-B  COMMIT
[ 1252ms] SESSAO-A  COMMIT
resultado: ativas 13 -> 15 para 14 vagas   >>> RN30 VIOLADA
```

**Rodada 2 — com `SELECT ... FOR UPDATE`**:

```
[ 1259ms] SESSAO-A  obteve a trava da linha da turma
[ 1262ms] SESSAO-A  contou 13 ativas, INSERT
[ 1411ms] SESSAO-B  SELECT ... FOR UPDATE              <- bloqueia aqui
[ 2472ms] SESSAO-A  COMMIT
[ 2472ms] SESSAO-B  obteve a trava da linha da turma   <- liberada
[ 2474ms] SESSAO-B  contou 14 ativas para 14 vagas
[ 2475ms] SESSAO-B  RECUSOU: turma lotada (RN30)
resultado: ativas 13 -> 14 para 14 vagas   RN30 preservada
```

**Comportamento observado: bloqueio com espera, não deadlock.** A sessão B esperou **1.065 ms** contra 6 ms na rodada sem trava — exatamente o tempo em que ficou parada na trava da linha. Não houve deadlock porque as duas sessões pedem os recursos na mesma ordem (turma, depois matrícula); deadlock exigiria ordens opostas. O `innodb_lock_wait_timeout` padrão é 50 s, folgado para o tempo real de espera.

### Nível de isolamento adotado

**REPEATABLE READ**, o padrão do InnoDB, mantido de propósito.

A tentação seria subir para SERIALIZABLE "por segurança". Não se justifica: o problema desta aplicação não é leitura inconsistente, é a janela entre **ler a contagem e gravar a matrícula**. SERIALIZABLE fecharia essa janela transformando toda leitura em leitura travada — e pagaria esse preço em todas as telas de consulta, que são a maioria do uso e não precisam de nada disso.

O `SELECT ... FOR UPDATE` resolve o mesmo problema travando **uma linha**, só na transação que escreve. É o bloqueio mínimo que torna a RN30 confiável. READ COMMITTED, no sentido oposto, não traria benefício: as leituras repetidas dentro da transação de matrícula se beneficiam da estabilidade do snapshot.

## 7.4 B4 — Otimização de consultas

Volume medido: `nota` 1.950 linhas, `alocacao` 320, `matricula` 250, `avaliacao` 240, `pessoa` 175. Tempos são a **mediana de 41 execuções, após 10 de aquecimento** — medição única mediria o cache, não o plano.

### Caso 1 — conferência de vaga (GANHO, −36%)

A consulta roda em toda matrícula, dentro da transação e com a linha da turma travada: enquanto ela não termina, as outras secretarias esperam.

| | plano | tempo |
|---|---|---|
| antes | `ref` em `idx_matricula_turma`, filtered **48,4%** | 0,940 ms |
| depois | `ref` em `idx_matricula_turma_situacao`, filtered **100%**, `Using index` | 0,605 ms |

`CREATE INDEX idx_matricula_turma_situacao ON matricula (id_turma, situacao)` — nessa ordem porque `id_turma` é a igualdade que mais reduz o conjunto, e `situacao` refina dentro dela. O inverso serviria mal: `'ATIVA'` sozinho corta pouco.

**O detalhe que quase passou batido.** Na primeira tentativa criamos só o índice composto e o otimizador **continuou escolhendo o antigo** — os dois servem para o `ref` em `id_turma`. Como `idx_matricula_turma` é *prefixo* do novo, ele não era apenas redundante: era concorrente. Foi preciso removê-lo no mesmo passo para o ganho aparecer. Sem isso, teríamos relatado um ganho de 35% que era puro ruído de medição.

### Caso 2 — situação vigente (ganho modesto, −17%)

| | plano | tempo |
|---|---|---|
| antes | `ALL`, varredura de 140 linhas, filtered 8% | 0,376 ms |
| depois | `ref` em `idx_historico_vigente`, filtered 80% | 0,314 ms |

O plano melhorou muito mais do que o relógio. A 140 linhas, varrer a tabela inteira já é barato, e 17% está no limite do ruído. O índice foi mantido mesmo assim porque `historico_situacao_aluno` é a tabela que mais cresce por aluno ao longo dos anos: a varredura piora linearmente, o acesso por índice não.

### Caso 3 — média das notas (SEM GANHO, e era o esperado)

| | plano | tempo |
|---|---|---|
| antes | `ALL`, 1.974 linhas, filtered 90% | 0,697 ms |
| depois | `range` em `idx_nota_valor`, `Using index` | 0,721 ms |

**O índice foi descartado.** O filtro `valor IS NOT NULL` aceita 1.901 das 1.974 linhas — 96% da tabela. O otimizador até passa a usar o índice, mas percorrer 96% dele e depois agregar não é mais barato do que varrer a tabela de uma vez. E haveria o custo permanente de manter mais um índice a cada `INSERT` e `UPDATE` em `nota`, que é a tabela de maior movimento do modelo.

A lição: índice resolve **seletividade**. Um predicado que aceita quase tudo não tem o que selecionar. O ganho nos casos 1 e 2 veio de filtros que cortam o conjunto; aqui não havia corte a fazer.

### Limitação da medição

Na escala desta carga, os tempos são sub-milissegundo e boa parte deles é ida e volta de rede, não acesso a dados. Foi por isso que o caso 1 precisou ser medido com uma consulta que repete a mesma busca uma vez por turma dentro de **uma única viagem ao servidor**: o custo do plano aparece multiplicado por 40 e a sobrecarga de protocolo é paga uma vez só. Os três planos de execução, esses sim, são conclusivos independentemente do volume.

## 7.5 B5 — Segurança e controle de acesso

### Quatro perfis, não três

| Perfil MySQL | O que alcança |
|---|---|
| `escola_auth` | `SELECT` em **sete colunas** de `usuario_app` e `UPDATE` só em `ultimo_acesso`. Nada mais no banco. |
| `escola_secretaria` | CRUD nas 14 tabelas acadêmicas; `SELECT` nas visões; **só leitura** em `auditoria` |
| `escola_professor` | `SELECT` no que precisa; `SELECT/INSERT/UPDATE` em `nota`. Sem `DELETE` em lugar nenhum |
| `escola_consulta` | `SELECT` em **duas visões**. Zero privilégio em tabela base |

A aplicação mantém **um pool de conexão por perfil**: quem entra como professor fala com o banco pelo usuário `escola_professor`. O limite não é a tela esconder o botão — é o SGBD recusar. Verificado:

```
escola_consulta  -> SELECT cpf FROM pessoa
   ERROR 1142: SELECT command denied to user 'escola_consulta'@'localhost' for table 'pessoa'
escola_professor -> DELETE FROM nota
   ERROR 1142: DELETE command denied to user 'escola_professor'@'localhost' for table 'nota'
```

### REVOKE, e por quê

O professor chegou a receber `DELETE` em `nota` e teve o privilégio retirado: professor **corrige** nota, não apaga lançamento. Apagar a linha destruiria o rastro que o gatilho de auditoria existe para manter — a auditoria registra `UPDATE`, não ressuscita `DELETE`.

O segundo `REVOKE` tira `INSERT`, `UPDATE` e `DELETE` em `auditoria` da secretaria. Os gatilhos gravam com o privilégio do `DEFINER`, não do usuário conectado: **a aplicação produz a trilha sem conseguir adulterá-la**. Verificado — a secretaria recebe `ERROR 1142` ao tentar `DELETE FROM auditoria`.

### Visão que restringe colunas

`vw_aluno_publico` expõe nome, matrícula, data de ingresso e turma atual. Não expõe CPF, data de nascimento, telefone nem endereço. Para o perfil `escola_consulta` ela não é conveniência: é o único caminho até o dado, porque ele não tem `SELECT` em nenhuma tabela base. A restrição é estrutural, não combinada.

### Senhas

`usuario_app.senha_hash` guarda bcrypt com custo 10. O sal está embutido no próprio hash (`$2b$10$<sal 22 chars><digest 31 chars>`), diferente para cada senha — duas pessoas com a mesma senha têm hashes distintos. A comparação é feita com `bcrypt.compare`, nunca texto com texto.

A restrição `ck_usuario_app_hash CHECK (senha_hash LIKE '$2%$%')` impede que uma senha crua entre na tabela por descuito de quem escreve o `INSERT` — é o banco se defendendo de um erro da aplicação.

A autenticação compara o hash **mesmo quando o login não existe**, usando um hash descartável, para que a resposta demore o mesmo tanto nos dois casos. Sem isso, o tempo de resposta diria se o login existe.

### Dados pessoais no projeto

| Dado | Onde | Cuidado adotado |
|---|---|---|
| CPF | `pessoa`, `responsavel` | Fora de `vw_aluno_publico`; inacessível ao perfil de consulta |
| Data de nascimento | `pessoa` | Idem |
| Endereço completo | `pessoa` | Idem |
| Telefone e e-mail | `pessoa`, `responsavel` | Idem |
| Senha | `usuario_app` | Nunca armazenada; só o hash com sal |
| Vínculo aluno–responsável | `aluno_responsavel` | Visível só aos perfis que operam a secretaria |

Toda a carga é **sintética**. Nenhum dado pessoal real de terceiros foi usado, conforme o item 10 do enunciado.

## 7.6 B6 — Gatilhos e auditoria

Auditar tudo é o mesmo que não auditar nada: a tabela cresce, ninguém lê, e o dado que importa fica enterrado. Os dois pontos escolhidos são aqueles em que uma alteração silenciosa tem consequência **fora do banco**:

| Gatilho | Tabela | Por quê |
|---|---|---|
| `trg_nota_auditoria_au` | `nota` | Uma nota que muda depois de divulgada é o fato mais contestável de uma escola. Quando um responsável questiona, a secretaria precisa responder quem alterou, quando, e de quanto para quanto. |
| `trg_matricula_auditoria_au` | `matricula` | A situação da matrícula decide se o aluno é contado no censo, cobrado na mensalidade e certificado. Passar de ATIVA para CANCELADA sem rastro tem efeito administrativo e legal. |

Ambos são `AFTER UPDATE`: é a alteração de um valor que precisa de "antes e depois". A exclusão desses registros já é barrada por `ON DELETE RESTRICT` nas chaves estrangeiras da Etapa 1.

**O autor.** A aplicação executa `SET @app_usuario = '<login>'` ao pegar uma conexão do pool. O gatilho grava esse login **e** o `CURRENT_USER()` do banco, que diz por qual perfil a operação entrou. Quem mexer pelo Workbench, sem definir a variável, fica registrado como `direto-sgbd` — o que também é informação útil. Exemplo real da trilha:

| tabela | registro | campo | de | para | usuario_app | usuario_banco |
|---|---|---|---|---|---|---|
| nota | 1/241/1 | valor | 8.10 | 9.10 | secretaria.teste | root@localhost |
| nota | 1/241/2 | valor | 4.89 | *(vazio)* | secretaria.teste | root@localhost |
| nota | 1/241/2 | faltou | 0 | 1 | secretaria.teste | root@localhost |
| matricula | 2 | situacao | ATIVA | TRANCADA | secretaria.teste | root@localhost |

A comparação usa o operador `<=>`, seguro contra `NULL`: uma nota que sai de `NULL` para 7,5 é uma alteração e precisa aparecer.

## 7.7 B7 — Projeto físico e armazenamento

### Revisão dos tipos de dados

| Decisão da Etapa 1 | Veredito |
|---|---|
| `DECIMAL(4,2)` para nota | **Mantida.** Nota é valor exato, comparado por igualdade. `FLOAT` daria 6,999999 onde se espera 7. |
| `CHAR(11)` para CPF | **Mantida.** Tamanho fixo e conhecido; `VARCHAR` pagaria o byte de comprimento sem ganho. |
| `ENUM` para turno, situação, titulação | **Mantida**, com ressalva: `ENUM` é barato e autodocumentado, mas acrescentar um valor exige `ALTER TABLE`. Para domínios estáveis como turno, vale. Se a escola passar a ter turno integral e noturno com frequência, viraria tabela de domínio. |
| `DATETIME(3)` em `auditoria` | **Nova na Etapa 2.** Milissegundos importam para ordenar duas alterações no mesmo segundo. |
| `VARCHAR(255)` em `auditoria.valor_anterior/novo` | **Ressalva registrada.** Cabe para os campos auditados hoje (nota e situação). Auditar `ementa`, que é `TEXT`, exigiria truncar ou mudar o tipo. |
| `TINYINT UNSIGNED` para `capacidade` e `numero_avaliacao` | **Mantida.** Contadores pequenos com teto conhecido. |

### Estimativa de crescimento em dois anos

A carga atual é de uma escola pequena. Projetando para operação real — **600 alunos, 20 turmas, 8 disciplinas por turma, 4 avaliações por disciplina ao ano**:

| Tabela | Hoje | Por ano letivo | Em 2 anos |
|---|---:|---:|---:|
| `nota` | 1.950 | ~19.200 | ~38.400 |
| `matricula` | 250 | ~600 | ~1.200 |
| `alocacao` | 320 | ~160 | ~320 |
| `avaliacao` | 240 | ~640 | ~1.280 |
| `historico_situacao_aluno` | 139 | ~900 | ~1.800 |
| `auditoria` | — | ~2.000 | ~4.000 |

Com o tamanho médio de linha observado (`nota` ocupa cerca de 100 bytes somando dados e índices), **a tabela de maior movimento chega a algo em torno de 4 MB em dois anos**. O banco inteiro fica abaixo de 20 MB.

A conclusão honesta é que **volume não é o problema deste sistema**. Nenhuma tabela justifica particionamento ou arquivamento histórico: o particionamento cobraria complexidade de manutenção sem resolver gargalo nenhum. Se um dia fizer sentido, o candidato natural é `nota`, particionada por ano letivo, porque consulta de boletim quase nunca cruza anos. Registrar isso agora é diferente de implementar agora.

O que realmente cresce em importância é a **concorrência na matrícula**: no início do ano letivo, várias secretarias matriculam ao mesmo tempo nas mesmas turmas. É ali que o `SELECT ... FOR UPDATE` da seção 7.3 passa a importar de verdade.

### Plano de backup

| Item | Definição |
|---|---|
| O que copiar | Base completa `escola_ucb`: esquema, dados, visões, gatilhos e usuários (`mysqldump --routines --triggers --databases`) |
| Frequência | Dump completo diário, fora do horário escolar; binlog habilitado para recuperação a ponto no tempo entre dumps |
| Retenção | 7 diários, 4 semanais, 12 mensais. Os mensais cobrem o ano letivo inteiro, que é o horizonte em que uma contestação de nota pode aparecer |
| Onde | Duas cópias, uma delas fora da máquina do banco |
| Como a restauração seria testada | Restauração mensal num banco descartável, seguida de três conferências: contagem de linhas por tabela, as 15 consultas de `03_consultas.sql` e uma alteração de nota para verificar que os gatilhos de auditoria voltaram funcionando. **Backup não testado não é backup** — é um arquivo cuja utilidade ninguém verificou. |

Vale registrar que esse plano é uma proposta documentada, não algo implantado: o projeto roda em máquina local de desenvolvimento, e montar rotina de backup agendada ficaria fora do escopo da disciplina.
