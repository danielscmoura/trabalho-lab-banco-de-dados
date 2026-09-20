# A3 — Dicionário de dados

Formato conforme o Anexo A do enunciado. A coluna **Observação** registra a regra de negócio associada ao atributo e o nome da restrição que a implementa.

## PESSOA
Dados civis comuns a alunos e professores. Supertipo da especialização.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_pessoa | Identificador interno da pessoa | Inteiro sequencial | Sim | Chave primária substituta |
| cpf | Cadastro de pessoa física | 11 dígitos numéricos | Sim | RN01 — único (`uq_pessoa_cpf`, `ck_pessoa_cpf`) |
| nome | Nome civil completo | Texto até 120 caracteres | Sim | RN02 |
| data_nascimento | Data de nascimento | Data entre 1930 e o ano corrente | Sim | RN02 — não pode ser futura (`ck_pessoa_nascimento`) |
| sexo | Sexo informado no cadastro | F, M ou N (não informado) | Não | Preenchimento opcional |
| email | Correio eletrônico de contato | Texto até 120 caracteres com "@" | Não | `ck_pessoa_email`; aceita ausência |
| telefone | Contato telefônico preferencial | Texto até 20 caracteres | Não | Aceita ausência de contato |
| end_logradouro | Logradouro do endereço | Texto até 120 caracteres | Não | Parte do atributo composto *endereço* |
| end_numero | Número do imóvel | Texto até 10 caracteres | Não | Texto porque admite "s/n" |
| end_complemento | Complemento (bloco, apartamento) | Texto até 40 caracteres | Não | Parte do atributo composto *endereço* |
| end_bairro | Bairro ou região administrativa | Texto até 60 caracteres | Não | Parte do atributo composto *endereço* |
| end_cidade | Município | Texto até 60 caracteres | Não | Parte do atributo composto *endereço* |
| end_uf | Unidade da federação | 2 letras maiúsculas | Não | `ck_pessoa_uf` |
| end_cep | Código de endereçamento postal | 8 dígitos | Não | Dado de contato, não identificador de logradouro |
| tipo_pessoa | Discriminador da especialização | ALUNO ou PROFESSOR | Sim | RN03 — especialização total e exclusiva |
| criado_em | Momento do cadastro | Data e hora | Sim | Preenchido automaticamente |
| *idade* | *Idade em anos completos* | *Inteiro* | — | **Atributo derivado** — calculado a partir de `data_nascimento`, não armazenado |

## ALUNO
Subclasse de PESSOA. Quem cursa as turmas.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_pessoa | Identificador herdado do supertipo | Inteiro sequencial | Sim | PK e FK para PESSOA |
| matricula | Matrícula acadêmica interna | Texto até 12 caracteres | Sim | RN04 — única (`uq_aluno_matricula`) |
| data_ingresso | Data de entrada do aluno na escola | Data | Sim | Usada como início do histórico de situação |
| bolsista | Indica se o aluno é bolsista | Verdadeiro/falso | Sim | Padrão: falso |
| percentual_bolsa | Percentual de desconto da bolsa | Decimal de 0,01 a 100,00 | Não | RN05 — só existe se `bolsista` for verdadeiro (`ck_aluno_bolsa`) |
| observacao | Anotação pedagógica livre | Texto até 255 caracteres | Não | Aceita ausência |

## PROFESSOR
Subclasse de PESSOA. Quem ministra as disciplinas.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_pessoa | Identificador herdado do supertipo | Inteiro sequencial | Sim | PK e FK para PESSOA |
| registro_funcional | Registro funcional do professor | Texto até 10 caracteres | Sim | Único (`uq_professor_registro`) |
| titulacao | Maior titulação acadêmica | GRADUACAO, ESPECIALIZACAO, MESTRADO, DOUTORADO | Sim | Usada em relatórios de corpo docente |
| data_admissao | Data de admissão | Data | Sim | — |
| data_desligamento | Data de desligamento | Data | Não | RN06 — nunca anterior à admissão (`ck_professor_datas`); nula enquanto ativo |
| id_coordenador | Professor que coordena a área | Inteiro sequencial | Não | RN07/RN08 — **autorrelacionamento**; `trg_professor_autocoord_bi`/`_bu` impedem autocoordenação |

## RESPONSAVEL
Responsável legal ou financeiro por um ou mais alunos.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_responsavel | Identificador interno do responsável | Inteiro sequencial | Sim | Chave primária substituta |
| cpf | Cadastro de pessoa física | 11 dígitos numéricos | Sim | Único (`uq_responsavel_cpf`) |
| nome | Nome civil completo | Texto até 120 caracteres | Sim | — |
| telefone | Contato telefônico | Texto até 20 caracteres | Sim | Obrigatório: é o canal de emergência da escola |
| email | Correio eletrônico | Texto até 120 caracteres | Não | Aceita ausência |
| profissao | Profissão declarada | Texto até 60 caracteres | Não | Dado cadastral opcional |

## ALUNO_RESPONSAVEL
Vínculo entre aluno e responsável. Relacionamento N:N com atributos próprios.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_aluno | Aluno do vínculo | Inteiro sequencial | Sim | Parte da PK; FK para ALUNO |
| id_responsavel | Responsável do vínculo | Inteiro sequencial | Sim | Parte da PK; FK para RESPONSAVEL |
| grau_parentesco | Relação de parentesco | MAE, PAI, AVO, TIO, IRMAO, TUTOR, OUTRO | Sim | RN10 |
| responsavel_financeiro | Indica quem responde pela mensalidade | Verdadeiro/falso | Sim | RN11 — exatamente um por aluno (verificado por consulta) |
| autoriza_saida | Pode autorizar saída antecipada | Verdadeiro/falso | Sim | Padrão: falso |
| data_vinculo | Data em que o vínculo foi registrado | Data | Sim | RN10 |

## ANO_LETIVO
Período letivo que agrupa as turmas ofertadas.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_ano_letivo | Identificador interno do ano letivo | Inteiro sequencial | Sim | Chave primária substituta |
| ano | Ano civil de referência | Inteiro entre 2000 e 2100 | Sim | RN12 — único (`uq_ano_letivo_ano`) |
| data_inicio | Início das aulas | Data | Sim | — |
| data_fim | Encerramento do ano letivo | Data | Sim | RN12 — posterior ao início (`ck_ano_letivo_periodo`) |
| situacao | Estágio do ano letivo | PLANEJADO, EM_ANDAMENTO, ENCERRADO | Sim | Padrão: PLANEJADO |

## DISCIPLINA
Componente curricular de uma série.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_disciplina | Identificador interno da disciplina | Inteiro sequencial | Sim | Chave primária substituta |
| codigo | Código curricular | Texto até 10 caracteres | Sim | RN13 — único (`uq_disciplina_codigo`) |
| nome | Nome do componente | Texto até 80 caracteres | Sim | RN13 — não se repete na mesma série (`uq_disciplina_nome_serie`) |
| serie | Série a que o componente pertence | 6ANO, 7ANO, 8ANO, 9ANO, 1EM | Sim | Compõe a chave candidata com `nome` |
| carga_horaria_anual | Carga horária anual prevista | Inteiro de 20 a 400 | Sim | `ck_disciplina_carga` |
| ementa | Descrição dos conteúdos | Texto longo | Não | Aceita ausência |
| ativa | Indica se está ofertada na matriz | Verdadeiro/falso | Sim | Padrão: verdadeiro |

## PRE_REQUISITO
Autorrelacionamento N:N de DISCIPLINA: qual disciplina exige qual.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_disciplina | Disciplina que possui o pré-requisito | Inteiro sequencial | Sim | Parte da PK; FK para DISCIPLINA |
| id_disciplina_requisito | Disciplina exigida previamente | Inteiro sequencial | Sim | Parte da PK; FK para DISCIPLINA |
| obrigatorio | Indica se o pré-requisito é impeditivo | Verdadeiro/falso | Sim | RN14 — `trg_prereq_ciclo_bi`/`_bu` impedem autorreferência |
| observacao | Justificativa pedagógica | Texto até 120 caracteres | Não | Aceita ausência |

## TURMA
Agrupamento de alunos em um ano letivo.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_turma | Identificador interno da turma | Inteiro sequencial | Sim | Chave primária substituta |
| id_ano_letivo | Ano letivo da turma | Inteiro sequencial | Sim | FK para ANO_LETIVO; RN21 — exclusão restrita |
| codigo | Código de exibição da turma | Texto até 12 caracteres | Sim | RN15 — único no ano letivo (`uq_turma_codigo_ano`) |
| serie | Série da turma | 6ANO, 7ANO, 8ANO, 9ANO, 1EM | Sim | RN31 — deve coincidir com a série das disciplinas alocadas |
| turno | Turno de funcionamento | MATUTINO, VESPERTINO | Sim | — |
| sala | Sala designada | Texto até 10 caracteres | Não | Pode estar indefinida no início do ano |
| capacidade | Número máximo de alunos | Inteiro de 5 a 45 | Sim | RN16/RN30 — `ck_turma_capacidade` |
| id_professor_regente | Professor regente da turma | Inteiro sequencial | Não | RN17 — nulo se ainda não designado (`ON DELETE SET NULL`) |

## MATRICULA
Vínculo do aluno com uma turma. Relacionamento N:N com atributos próprios.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_matricula | Identificador interno da matrícula | Inteiro sequencial | Sim | Chave primária substituta |
| id_aluno | Aluno matriculado | Inteiro sequencial | Sim | FK para ALUNO; RN18 |
| id_turma | Turma da matrícula | Inteiro sequencial | Sim | FK para TURMA; RN18 — par único (`uq_matricula_aluno_turma`) |
| data_matricula | Data em que a matrícula foi feita | Data | Sim | — |
| situacao | Situação da matrícula | ATIVA, TRANCADA, TRANSFERIDA, CONCLUIDA, CANCELADA | Sim | Padrão: ATIVA |
| data_encerramento | Data de encerramento da matrícula | Data | Não | RN19 — nula se ainda em curso (`ck_matricula_encerramento`) |

## HISTORICO_SITUACAO_ALUNO
Série histórica datada da situação acadêmica do aluno. **Atributo temporal do modelo.**

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_historico | Identificador interno do evento | Inteiro sequencial | Sim | Chave primária substituta |
| id_aluno | Aluno a que o evento se refere | Inteiro sequencial | Sim | FK para ALUNO (`ON DELETE CASCADE`) |
| situacao | Situação vigente no período | ATIVO, TRANCADO, TRANSFERIDO, EVADIDO, FORMADO | Sim | — |
| data_inicio | Início da vigência da situação | Data | Sim | Único por aluno (`uq_historico_aluno_inicio`) |
| data_fim | Fim da vigência | Data | Não | RN20 — **nulo indica a situação vigente** (`ck_historico_periodo`) |
| motivo | Justificativa da mudança | Texto até 120 caracteres | Não | Aceita ausência |

## ALOCACAO
Liga turma, disciplina e professor. Relacionamento ternário N:N com atributos próprios.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_alocacao | Identificador interno da alocação | Inteiro sequencial | Sim | Chave primária substituta |
| id_turma | Turma que recebe a disciplina | Inteiro sequencial | Sim | FK para TURMA; RN22 |
| id_disciplina | Disciplina ministrada | Inteiro sequencial | Sim | FK para DISCIPLINA; RN22 — par único (`uq_alocacao_turma_disciplina`) |
| id_professor | Professor responsável | Inteiro sequencial | Sim | FK para PROFESSOR; RN23 — exclusão restrita |
| carga_horaria_semanal | Aulas semanais na grade da turma | Inteiro de 1 a 10 | Sim | RN24 — `ck_alocacao_carga` |
| dia_semana | Dia da aula | SEG a SEX | Não | Nulo enquanto a grade não é fechada |
| horario_inicio | Horário de início da aula | Hora | Não | Nulo enquanto a grade não é fechada |

## AVALIACAO
Instrumento de avaliação de uma alocação. **Entidade fraca**, identificada por dependência.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_alocacao | Alocação proprietária da avaliação | Inteiro sequencial | Sim | Parte da PK; FK para ALOCACAO (`ON DELETE CASCADE`) |
| numero_avaliacao | Ordem da avaliação dentro da alocação | Inteiro de 1 a 8 | Sim | **Identificador parcial** da entidade fraca (RN25) |
| descricao | Título da avaliação | Texto até 80 caracteres | Sim | — |
| tipo | Natureza do instrumento | PROVA, TRABALHO, SEMINARIO, PROJETO | Sim | — |
| data_aplicacao | Data em que foi aplicada | Data | Não | Nula enquanto planejada e não aplicada |
| peso | Peso no cálculo da média | Decimal de 0,01 a 5,00 | Sim | RN26 — `ck_avaliacao_peso` |
| valor_maximo | Nota máxima possível | Decimal de 0,01 a 10,00 | Sim | RN26 — `ck_avaliacao_valor_max` |

## NOTA
Resultado de um aluno em uma avaliação. Tabela de maior movimento do modelo.

| Atributo | Descrição | Domínio | Obrig. | Observação |
|---|---|---|---|---|
| id_matricula | Matrícula do aluno avaliado | Inteiro sequencial | Sim | Parte da PK; FK para MATRICULA; RN29 |
| id_alocacao | Alocação da avaliação | Inteiro sequencial | Sim | Parte da PK; FK composta para AVALIACAO |
| numero_avaliacao | Número da avaliação | Inteiro de 1 a 8 | Sim | Parte da PK; FK composta para AVALIACAO |
| valor | Nota obtida | Decimal de 0,00 a 10,00 | Não | RN27 — nula enquanto não lançada (`ck_nota_valor`) |
| data_lancamento | Momento do lançamento pelo professor | Data e hora | Não | Nula enquanto não lançada |
| faltou | Indica ausência na avaliação | Verdadeiro/falso | Sim | RN28 — se verdadeiro, `valor` é obrigatoriamente nulo (`ck_nota_falta`) |
| observacao | Anotação do professor | Texto até 120 caracteres | Não | Aceita ausência |
