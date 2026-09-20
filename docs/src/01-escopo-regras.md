# A1 — Documento de escopo e regras de negócio

## 1.1 O domínio

O sistema modelado atende a **secretaria acadêmica de uma escola de educação básica** que oferta do 6º ano do ensino fundamental ao 1º ano do ensino médio, em dois turnos. O banco é responsável por registrar quem estuda e quem leciona, como os alunos são agrupados em turmas a cada ano letivo, que componentes curriculares cada turma cursa, quem ministra cada um deles e como o desempenho de cada aluno é apurado ao longo do ano.

**Pessoas.** Alunos e professores compartilham os mesmos dados civis — nome, CPF, data de nascimento, contato e endereço. Por isso o modelo trata *pessoa* como um conceito único e especializa-o em *aluno* e *professor*. Na escola real ninguém é aluno e professor ao mesmo tempo, e toda pessoa cadastrada é necessariamente uma das duas coisas: a especialização é, portanto, **total e exclusiva**. O aluno acrescenta matrícula acadêmica, data de ingresso e condição de bolsa; o professor acrescenta registro funcional, titulação e as datas de admissão e desligamento.

**Responsáveis.** Todo aluno é acompanhado por pelo menos um responsável legal. Um mesmo responsável pode responder por vários alunos (irmãos), e um mesmo aluno pode ter mais de um responsável — mãe, pai, avó, tutor. O vínculo entre os dois não é um dado do aluno nem do responsável: ele tem informação própria, como o grau de parentesco, se aquele responsável é o financeiro e se ele pode autorizar a saída antecipada do aluno.

**Ano letivo e turmas.** Cada ano letivo agrupa as turmas ofertadas naquele período. Uma turma pertence a exatamente um ano letivo, tem código, série, turno, sala e capacidade, e pode ter um professor regente designado — posto que às vezes fica vago no início do ano. A mesma turma "6º A" existe em 2024, 2025 e 2026 como três registros distintos, o que permite manter o histórico de anos encerrados sem ambiguidade.

**Matrícula.** O aluno se matricula em uma turma por ano letivo. A matrícula guarda a data em que foi feita, a situação (ativa, trancada, transferida, concluída, cancelada) e a data de encerramento quando houver. Como um aluno passa por várias turmas ao longo dos anos e uma turma recebe muitos alunos, a relação é N:N e carrega atributos próprios.

**Currículo.** A disciplina é o componente curricular de uma série: "Matemática do 7º ano" é uma disciplina diferente de "Matemática do 8º ano", com ementa e carga horária próprias. Uma disciplina pode exigir outra como pré-requisito — tipicamente a mesma matéria da série anterior —, o que constitui um **autorrelacionamento** do conceito de disciplina. Um segundo autorrelacionamento existe entre professores: o coordenador de área é ele próprio um professor da escola.

**Alocação.** A ligação entre turma, disciplina e professor é o coração operacional do modelo: diz quem ensina o quê para quem, com quantas aulas semanais e em que horário. Uma disciplina só pode aparecer uma vez na grade de uma mesma turma, mas um professor atende várias turmas e uma disciplina é ministrada em várias turmas ao longo dos anos.

**Avaliação e notas.** Cada alocação define suas próprias avaliações, numeradas sequencialmente dentro dela (1ª, 2ª, 3ª). A avaliação não tem existência independente: a "avaliação nº 2" só significa alguma coisa dentro de uma disciplina específica de uma turma específica — trata-se de uma **entidade fraca**, identificada por dependência da alocação. A nota liga uma matrícula a uma avaliação e registra o valor obtido, a data de lançamento e a eventual ausência do aluno. Avaliações planejadas e ainda não aplicadas existem no banco sem data e sem notas.

**Histórico do aluno.** A situação acadêmica do aluno muda ao longo do tempo: ativo, trancado, transferido, evadido, formado. O modelo não sobrescreve essa informação — mantém uma **série histórica datada**, em que cada registro tem data de início e, se já encerrado, data de fim. O registro com data de fim em aberto é a situação vigente.

## 1.2 Fronteiras do escopo

Ficam **fora** desta versão: financeiro e mensalidades, controle de frequência por aula, biblioteca, merenda, transporte e comunicação com as famílias. São recortes deliberados: o objetivo é um núcleo acadêmico coerente e completo, não um sistema escolar inteiro.

## 1.3 Regras de negócio

As regras estão numeradas de RN01 em diante. A coluna **Como foi atendida** indica o mecanismo que garante cada uma: *restrição do banco*, *consulta* ou *aplicação* (Etapa 2).

| # | Regra | Como foi atendida |
|---|-------|-------------------|
| RN01 | O CPF identifica uma pessoa de forma única e deve conter exatamente onze dígitos numéricos. | Restrição: `uq_pessoa_cpf`, `ck_pessoa_cpf` |
| RN02 | Toda pessoa tem nome e data de nascimento; a data de nascimento fica entre 1930 e o ano corrente e nunca é futura. | Restrição: `NOT NULL`, `ck_pessoa_nascimento` (faixa fixa) + aplicação (limite "hoje") |
| RN03 | Toda pessoa cadastrada é aluno ou professor, e nunca os dois ao mesmo tempo. | Restrição: discriminador `tipo_pessoa` + tabelas separadas; exclusividade verificada por consulta e garantida pela aplicação |
| RN04 | Cada aluno possui uma matrícula acadêmica única na escola. | Restrição: `uq_aluno_matricula` |
| RN05 | O percentual de bolsa só existe para aluno bolsista e fica entre 0 e 100. | Restrição: `ck_aluno_bolsa` |
| RN06 | A data de desligamento de um professor nunca é anterior à sua admissão. | Restrição: `ck_professor_datas` |
| RN07 | Um professor pode ser coordenado por outro professor da escola. | Restrição: `fk_professor_coordenador` (autorrelacionamento) |
| RN08 | Nenhum professor coordena a si mesmo. | Gatilho: `trg_professor_autocoord_bi` e `trg_professor_autocoord_bu` |
| RN09 | Todo aluno tem pelo menos um responsável vinculado. | Consulta de verificação + aplicação (cardinalidade mínima 1 não é expressável em DDL) |
| RN10 | Todo vínculo aluno–responsável registra o grau de parentesco e a data em que foi criado. | Restrição: `NOT NULL` em `grau_parentesco` e `data_vinculo` |
| RN11 | Cada aluno tem exatamente um responsável financeiro. | Consulta de verificação + aplicação |
| RN12 | Existe um único registro de ano letivo por ano, e seu término é posterior ao início. | Restrição: `uq_ano_letivo_ano`, `ck_ano_letivo_periodo` |
| RN13 | O código da disciplina é único e seu nome não se repete dentro da mesma série. | Restrição: `uq_disciplina_codigo`, `uq_disciplina_nome_serie` |
| RN14 | Uma disciplina nunca é pré-requisito de si mesma. | Gatilho: `trg_prereq_ciclo_bi` e `trg_prereq_ciclo_bu` |
| RN15 | O código da turma não se repete dentro do mesmo ano letivo. | Restrição: `uq_turma_codigo_ano` |
| RN16 | A capacidade de uma turma fica entre 5 e 45 alunos. | Restrição: `ck_turma_capacidade` |
| RN17 | Uma turma pode existir sem professor regente; se o professor sai, a turma fica sem regente, mas não é apagada. | Restrição: coluna anulável + `fk_turma_regente ON DELETE SET NULL` |
| RN18 | Um aluno não pode ser matriculado duas vezes na mesma turma. | Restrição: `uq_matricula_aluno_turma` |
| RN19 | A data de encerramento de uma matrícula nunca é anterior à data da matrícula. | Restrição: `ck_matricula_encerramento` |
| RN20 | Cada aluno tem no máximo uma situação vigente — aquela cujo registro histórico está com data de fim em aberto. | Consulta de verificação + aplicação |
| RN21 | Um ano letivo não pode ser excluído enquanto houver turmas vinculadas a ele. | Restrição: `fk_turma_ano_letivo ON DELETE RESTRICT` |
| RN22 | Cada disciplina aparece no máximo uma vez na grade de uma mesma turma. | Restrição: `uq_alocacao_turma_disciplina` |
| RN23 | Um professor não pode ser removido enquanto tiver alocação registrada. | Restrição: `fk_alocacao_professor ON DELETE RESTRICT` |
| RN24 | A carga horária semanal de uma alocação fica entre 1 e 10 aulas. | Restrição: `ck_alocacao_carga` |
| RN25 | A avaliação não existe sem a alocação que a originou; excluída a alocação, suas avaliações e notas desaparecem com ela. | Restrição: PK composta `(id_alocacao, numero_avaliacao)` + `ON DELETE CASCADE` |
| RN26 | O peso de uma avaliação é positivo e não excede 5; o valor máximo não excede 10. | Restrição: `ck_avaliacao_peso`, `ck_avaliacao_valor_max` |
| RN27 | A nota fica entre 0 e 10, ou permanece nula enquanto não for lançada. | Restrição: `ck_nota_valor` |
| RN28 | Aluno ausente na avaliação não recebe nota numérica: registra-se a ausência, não um zero. | Restrição: `ck_nota_falta` |
| RN29 | Uma nota só pode ser lançada para um aluno matriculado na turma da alocação correspondente. | Consulta de verificação + aplicação (transação da Etapa 2) |
| RN30 | O número de matrículas ativas de uma turma não pode ultrapassar sua capacidade. | Consulta de verificação + aplicação |
| RN31 | A disciplina alocada a uma turma pertence à mesma série da turma. | Consulta de verificação + aplicação |

São 31 regras, acima do mínimo de vinte exigido. Vinte e três delas são garantidas por restrição declarativa do próprio banco.

Duas — RN08 e RN14 — seriam `CHECK` simples em outro SGBD, mas o MySQL 8 proíbe `CHECK` sobre colunas que participam de chave estrangeira com ação referencial (erro 3823). Como as ações referenciais foram escolhidas pela regra de negócio e a equipe não abriu mão delas, essas duas regras foram implementadas por gatilho `BEFORE INSERT`/`BEFORE UPDATE` no próprio `01_ddl.sql` — continuam, portanto, garantidas pelo banco.

As seis restantes — RN09, RN11, RN20, RN29, RN30 e RN31 — expressam cardinalidades mínimas e restrições entre tabelas distintas, que nem `CHECK` nem gatilho de linha resolvem bem; todas foram verificadas por consulta sobre a carga e serão implementadas na camada de aplicação e em gatilhos na Etapa 2.
