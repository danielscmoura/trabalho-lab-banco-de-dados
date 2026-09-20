# 6. Implementação física, carga e verificação

Esta seção não é exigida como artefato separado, mas registra o que foi entregue nos arquivos `A6`, `A7` e `A8` e como a equipe conferiu o resultado.

## 6.1 Script físico — `sql/01_ddl.sql`

O script cria o banco `escola_ucb` do zero (`DROP DATABASE IF EXISTS` seguido de `CREATE DATABASE`) e as catorze tabelas, em ordem de dependência. Decisões registradas:

- **Todas as restrições são nomeadas** com os prefixos combinados: `pk_`, `uq_`, `fk_`, `ck_` e `idx_` — mais `trg_` para os quatro gatilhos descritos adiante. Os índices que dão suporte às chaves estrangeiras são declarados dentro do `CREATE TABLE` com o nome `idx_`: se fossem criados depois, o InnoDB já teria gerado um índice automático com o nome da própria FK e o esquema ficaria com índices duplicados e fora da convenção.
- **Tipos escolhidos pelo domínio real do atributo**: `CHAR(11)` para CPF (tamanho fixo e conhecido), `VARCHAR` dimensionado por atributo em vez de um `VARCHAR(255)` genérico, `DECIMAL(4,2)` para notas — nunca `FLOAT`, porque nota é valor exato e comparado por igualdade —, `DATE` para datas sem hora e `DATETIME` só onde o horário importa (`nota.data_lancamento`), `ENUM` para domínios fechados e estáveis (turno, situação, titulação) e `TINYINT UNSIGNED` para contadores pequenos como `numero_avaliacao` e `capacidade`.
- **`ON DELETE` e `ON UPDATE` explícitos em todas as chaves estrangeiras**, escolhidos pela regra de negócio, não por padrão:

| Chave estrangeira | Ação | Por quê |
|---|---|---|
| `aluno`/`professor` → `pessoa` | CASCADE / CASCADE | A subclasse não sobrevive ao supertipo |
| `aluno_responsavel` → `aluno` | CASCADE / CASCADE | O vínculo morre com o aluno |
| `aluno_responsavel` → `responsavel` | RESTRICT / CASCADE | Não se apaga um responsável que ainda responde por alguém |
| `professor.id_coordenador` | SET NULL / CASCADE | A saída do coordenador não apaga os coordenados |
| `turma` → `ano_letivo` | RESTRICT / CASCADE | RN21 — ano letivo com turmas é histórico |
| `turma.id_professor_regente` | SET NULL / CASCADE | RN17 — a turma continua existindo sem regente |
| `matricula` → `aluno` / `turma` | RESTRICT / CASCADE | Histórico acadêmico não é apagado por efeito colateral |
| `alocacao` → `turma` | CASCADE / CASCADE | Desfeita a turma, sua grade não faz sentido |
| `alocacao` → `disciplina` / `professor` | RESTRICT / CASCADE | RN23 — não se apaga quem está em uso |
| `avaliacao` → `alocacao` | CASCADE / CASCADE | RN25 — dependência de existência da entidade fraca |
| `pre_requisito` → `disciplina` (lado possuidor) | CASCADE / CASCADE | Apagada a disciplina, sua lista de pré-requisitos deixa de existir |
| `pre_requisito` → `disciplina` (lado exigido) | RESTRICT / CASCADE | Não se apaga uma disciplina que ainda é exigida por outra |
| `nota` → `matricula` / `avaliacao` | CASCADE / CASCADE | A nota não existe sem os dois lados |

- **Comentários associando comandos às regras de negócio**: cada bloco de tabela cita as RN que implementa.
- **Quatro gatilhos, por imposição do SGBD**: o MySQL 8 proíbe `CHECK` sobre colunas que participam de chave estrangeira com ação referencial — tentar as duas coisas produz o erro 3823. É exatamente o caso das duas regras de autorrelacionamento do modelo: RN08 (`professor.id_coordenador <> professor.id_pessoa`) e RN14 (`pre_requisito.id_disciplina <> id_disciplina_requisito`). A equipe optou por **manter as ações referenciais**, que foram escolhidas pela regra de negócio, e mover a verificação para gatilhos `BEFORE INSERT` e `BEFORE UPDATE` (`trg_professor_autocoord_*`, `trg_prereq_ciclo_*`), que rejeitam a linha com `SIGNAL SQLSTATE '45000'` e mensagem citando a RN. A alternativa — rebaixar as FKs para `RESTRICT` só para poder usar `CHECK` — foi descartada: trocaria uma regra de integridade justificada por uma conveniência de sintaxe.

- **Limitação registrada com honestidade**: o MySQL 8 não aceita funções não determinísticas em `CHECK`, de modo que "data de nascimento não pode ser futura" (RN02) não pôde virar `CHECK (data_nascimento < CURRENT_DATE)`. A restrição foi implementada como faixa fixa (`ck_pessoa_nascimento`) e a parte dinâmica fica a cargo da aplicação na Etapa 2. O mesmo vale para as regras que comparam linhas de tabelas diferentes (RN29, RN30, RN31), candidatas naturais a gatilho.

## 6.2 Script de carga — `sql/02_carga.sql`

Dados **inteiramente fictícios**, gerados sinteticamente; nenhum dado pessoal real de terceiros foi utilizado. A carga respeita a ordem de dependência e roda dentro de uma transação única.

| Tabela | Linhas | | Tabela | Linhas |
|---|---:|---|---|---:|
| pessoa | 175 | | matricula | 249 |
| aluno | 130 | | historico_situacao_aluno | 139 |
| professor | 45 | | alocacao | 320 |
| responsavel | 130 | | avaliacao | 240 |
| aluno_responsavel | 174 | | **nota** | **1.950** |
| ano_letivo | 4 | | disciplina | 41 |
| pre_requisito | 32 | | turma | 40 |

`ano_letivo` é a única tabela com menos de 40 linhas: ela representa anos civis (2023 a 2026) e inflá-la significaria inventar anos letivos que a escola não teve. As tabelas principais e a de maior movimento atendem folgadamente ao mínimo exigido.

**Casos de contorno propositais incluídos na carga:**

1. Alunos sem e-mail e alunos sem telefone (colunas opcionais em branco).
2. Turmas sem professor regente designado e turmas sem sala definida.
3. Alocações sem dia da semana e sem horário — grade ainda não fechada.
4. Avaliações do 3º bimestre cadastradas **sem data de aplicação** e sem nenhuma nota associada.
5. Notas com `faltou = TRUE` e valor nulo, em vez de zero (RN28).
6. Notas do 2º bimestre de Arte deliberadamente não lançadas, para exercitar `LEFT JOIN` e contagem com `NULL`.
7. Matrículas em aberto (situação ATIVA, sem data de encerramento) convivendo com matrículas TRANCADA, TRANSFERIDA e CONCLUIDA.
8. Alunos com **mais de um evento** no histórico de situação, sendo o último em aberto — exatamente o caso que o atributo temporal existe para representar.
9. Uma disciplina ativa e aprovada na matriz (`ENR-EM`, Ensino Religioso) **nunca alocada** a turma alguma.
10. Professores desligados, com data de desligamento preenchida e sem alocação no ano corrente.
11. Responsáveis sem e-mail e sem profissão declarada.
12. Alunos bolsistas com percentual e alunos não bolsistas com percentual nulo (RN05).

## 6.3 Consultas — `sql/03_consultas.sql`

Quinze consultas comentadas, cada uma precedida da pergunta de negócio que responde: cinco básicas (C01–C05), cinco de junção e agregação (C06–C10) e cinco avançadas (C11–C15). A cobertura exigida está atendida — `LIKE` (C03), `BETWEEN` e `IN` (C02), tratamento de `NULL` (C01, C04, C09), junção de quatro tabelas (C06), `LEFT JOIN` (C07), `GROUP BY` com `HAVING` (C08, C10), subconsulta correlacionada (C11, C15), `NOT EXISTS` (C12) e `EXISTS` (C15).

A consulta **C15** é a pergunta não trivial do domínio: quais alunos estão em risco de reprovação, considerando a média **ponderada pelo peso** de cada avaliação — e não a média aritmética — apenas sobre avaliações efetivamente aplicadas, contabilizando à parte as ausências.

## 6.4 Como a equipe verificou

1. Banco apagado; `01_ddl.sql` executado do início ao fim em base limpa, sem erro — 14 tabelas e 4 gatilhos criados.
2. `02_carga.sql` executado na sequência, sem erro, dentro de transação única.
3. As quinze consultas executadas, todas retornando resultado coerente e não vazio (C12 retorna exatamente a disciplina nunca alocada, que é o resultado esperado).
4. Os gatilhos testados contra a violação que existem para impedir: `UPDATE professor SET id_coordenador = id_pessoa` e `INSERT INTO pre_requisito VALUES (10, 10)` foram ambos rejeitados com a mensagem da RN correspondente, e a coordenação válida continuou passando. O `ON DELETE CASCADE` da especialização foi conferido depois disso: apagada a pessoa, a linha em `professor` desapareceu junto.
5. Consultas de auditoria rodadas sobre a carga para conferir as regras que o DDL não garante: nenhum aluno sem responsável, exatamente um responsável financeiro por aluno, nenhuma nota de aluno fora da turma da alocação, nenhum aluno com duas situações vigentes, nenhuma turma acima da capacidade e nenhuma disciplina alocada em série diferente da turma. Todas retornaram zero ocorrências.

# 7. Declaração de uso de inteligência artificial

Conforme o item 10 do enunciado, a equipe registra o uso de assistente de IA neste trabalho.

| Onde foi usada | Como | Como a equipe verificou |
|---|---|---|
| Redação do documento de escopo e das regras de negócio | Apoio à escrita e à organização do texto a partir do domínio definido pela equipe | Leitura integral e revisão de cada regra quanto à verificabilidade |
| Geração do script DDL e das consultas | Apoio à escrita de código SQL | Execução em base limpa; conferência de cada restrição contra a regra de negócio correspondente |
| Geração dos dados sintéticos da carga | Script gerador de dados fictícios | Conferência de volume, de integridade referencial e dos casos de contorno por consulta |
| Diagramação do MER | Apoio à produção do diagrama | Conferência de cada cardinalidade contra as regras de negócio |

Todas as decisões de modelagem — escopo, entidades, cardinalidades, estratégia de especialização, escolha de chaves e ações referenciais — foram tomadas e são explicáveis pela equipe. Nenhum trecho de modelo, script ou aplicação de outra equipe, de semestre anterior ou de repositório público foi reaproveitado.
