# A2 — Modelo Entidade-Relacionamento conceitual

O diagrama está em `docs/mer-conceitual.pdf`, com arquivo-fonte editável em `docs/mer-conceitual.drawio`. A notação usada é a de **Engenharia da Informação (pé de galinha)**, mantida do início ao fim do trabalho.

![MER conceitual](mer.png)

## 2.1 Como ler o diagrama

- **Pé de galinha** junto à entidade: cardinalidade **máxima N**. **Traço**: máxima 1.
- **Círculo** no segundo símbolo: cardinalidade **mínima 0** (participação opcional). **Traço**: mínima 1 (participação obrigatória).
- Caixas **azuis**: entidades fortes e subclasses. Caixas **verdes**: entidades associativas, geradas por relacionamentos N:N com atributos próprios. Caixa **laranja de borda dupla**: entidade fraca.
- O círculo com **"d"** abaixo de PESSOA marca a especialização **disjunta**; a legenda indica que ela é também **total**.

Os relacionamentos N:N aparecem como entidades associativas, prática padrão da notação pé de galinha, que não dispõe de losango para atributos de relacionamento. Cada caixa verde corresponde, no modelo conceitual, a um relacionamento muitos-para-muitos — não a uma entidade do domínio.

## 2.2 Entidades do modelo

Nove entidades, sem contar as associativas: PESSOA, ALUNO, PROFESSOR, RESPONSAVEL, ANO_LETIVO, DISCIPLINA, TURMA, HISTORICO_SITUACAO_ALUNO e AVALIACAO. As cinco associativas são ALUNO_RESPONSAVEL, MATRICULA, ALOCACAO, NOTA e PRE_REQUISITO.

## 2.3 Cardinalidades

| Relacionamento | Lado esquerdo | Lado direito | Leitura |
|---|---|---|---|
| PESSOA **é um** ALUNO | PESSOA (1,1) | ALUNO (0,1) | Todo aluno é uma pessoa; uma pessoa é aluno ou professor |
| PESSOA **é um** PROFESSOR | PESSOA (1,1) | PROFESSOR (0,1) | Idem, para o professor |
| ALUNO **tem** RESPONSAVEL | ALUNO (1,N) | RESPONSAVEL (1,N) | Todo aluno tem ao menos um responsável; todo responsável responde por ao menos um aluno |
| ALUNO **registra** HISTORICO | ALUNO (1,1) | HISTORICO (1,N) | Todo aluno tem ao menos um registro de situação |
| ALUNO **efetua** MATRICULA | ALUNO (1,1) | MATRICULA (0,N) | Um aluno recém-cadastrado pode ainda não ter matrícula |
| TURMA **recebe** MATRICULA | TURMA (1,1) | MATRICULA (0,N) | Turma criada pode estar vazia no início do ano |
| ANO_LETIVO **organiza** TURMA | ANO_LETIVO (1,1) | TURMA (1,N) | Toda turma pertence a exatamente um ano letivo |
| PROFESSOR **rege** TURMA | PROFESSOR (0,1) | TURMA (0,N) | A regência pode estar vaga; um professor rege várias turmas |
| PROFESSOR **coordena** PROFESSOR | PROFESSOR (0,1) | PROFESSOR (0,N) | **Autorrelacionamento**: o coordenador é professor e pode não haver coordenação |
| TURMA **oferta** ALOCACAO | TURMA (1,1) | ALOCACAO (1,N) | Toda turma tem grade; toda alocação pertence a uma turma |
| DISCIPLINA **é ofertada em** ALOCACAO | DISCIPLINA (1,1) | ALOCACAO (0,N) | Disciplina aprovada na matriz pode não estar ofertada no ano |
| PROFESSOR **leciona** ALOCACAO | PROFESSOR (1,1) | ALOCACAO (0,N) | Toda alocação tem professor; professor recém-admitido pode não ter turma |
| DISCIPLINA **exige** DISCIPLINA | DISCIPLINA (0,N) | DISCIPLINA (0,N) | **Autorrelacionamento** N:N de pré-requisito |
| ALOCACAO **define** AVALIACAO | ALOCACAO (1,1) | AVALIACAO (0,N) | **Entidade fraca**: a avaliação não existe fora da alocação |
| MATRICULA **gera** NOTA | MATRICULA (1,1) | NOTA (0,N) | Matrícula recente ainda não tem notas |
| AVALIACAO **é lançada em** NOTA | AVALIACAO (1,1) | NOTA (0,N) | Avaliação planejada ainda não tem notas |

## 2.4 Atributos especiais assinalados

| Atributo | Tipo | Onde | Tratamento |
|---|---|---|---|
| endereço | **Composto** | PESSOA | Decomposto em logradouro, número, complemento, bairro, cidade, UF e CEP |
| idade | **Derivado** | PESSOA | Calculado a partir de `data_nascimento`; não armazenado |
| situação do aluno | **Temporal** | HISTORICO_SITUACAO_ALUNO | Série histórica datada; registro sem data de fim é o vigente |
| numero_avaliacao | **Identificador parcial** | AVALIACAO | Único apenas dentro da alocação proprietária |

Não há atributos multivalorados no modelo. Os candidatos — telefones e e-mails múltiplos — foram reduzidos a um contato preferencial por decisão de escopo, registrada aqui para deixar claro que a ausência é deliberada.

## 2.5 Requisitos mínimos de complexidade

| Requisito | Mínimo exigido | Como o modelo atende |
|---|---|---|
| Entidades | Oito, sem contar associativas | **Nove**: PESSOA, ALUNO, PROFESSOR, RESPONSAVEL, ANO_LETIVO, DISCIPLINA, TURMA, HISTORICO_SITUACAO_ALUNO, AVALIACAO |
| Relacionamentos N:N com atributo | Dois | **Cinco**: ALUNO_RESPONSAVEL, MATRICULA, ALOCACAO (ternário), NOTA, PRE_REQUISITO |
| Autorrelacionamento | Um | **Dois**: PROFESSOR *coordena* PROFESSOR (1:N) e DISCIPLINA *exige* DISCIPLINA (N:N) |
| Generalização/especialização | Uma, com estratégia justificada | PESSOA → ALUNO / PROFESSOR, total e exclusiva, mapeada em três tabelas (justificativa em D1) |
| Entidade fraca | Uma, por dependência | AVALIACAO, identificada por `(id_alocacao, numero_avaliacao)` |
| Atributo temporal | Uma entidade com histórico datado | HISTORICO_SITUACAO_ALUNO |
| Regras de negócio | Vinte, verificáveis | **Trinta e uma**, numeradas e rastreadas até a implementação |
| Volume de carga | 40 linhas nas principais, 100 na de maior movimento | 175 pessoas, 130 alunos, 45 professores, 130 responsáveis, 41 disciplinas, 40 turmas, 249 matrículas, 320 alocações e **1.950 notas** |
