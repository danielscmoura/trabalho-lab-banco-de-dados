# A5 — Verificação de normalização

A análise percorre as catorze relações. Para cada uma, listam-se as dependências funcionais relevantes e verifica-se 1FN, 2FN e 3FN; ao final, indica-se quais relações alcançam a Forma Normal de Boyce-Codd.

## 5.1 Primeira Forma Normal

Todas as relações estão em 1FN: cada atributo é atômico e não há grupos repetitivos. Os dois pontos que poderiam violá-la foram tratados no mapeamento:

- **Endereço** (composto no conceitual) foi decomposto em sete colunas atômicas em PESSOA.
- **Responsáveis de um aluno** não viraram colunas repetidas (`responsavel_1`, `responsavel_2`), e sim linhas da relação ALUNO_RESPONSAVEL.

## 5.2 Dependências funcionais e análise por relação

Notação: `X → Y` lê-se "X determina funcionalmente Y". Os atributos-chave estão sublinhados.

**PESSOA**
`id_pessoa → cpf, nome, data_nascimento, sexo, email, telefone, end_*, tipo_pessoa, criado_em`
`cpf → id_pessoa` (chave candidata)
Chave primária simples ⇒ 2FN trivialmente satisfeita. Nenhum atributo não-chave determina outro: `end_cidade` não determina `end_uf` no modelo, porque `end_uf` é informado junto e não deduzido; **não há** a DF `end_cep → end_logradouro, end_bairro, end_cidade, end_uf`, que existiria caso o CEP fosse tratado como chave de uma tabela de endereços. Esta é uma decisão consciente: o CEP é armazenado como dado de contato, não como identificador de logradouro, e a escola não mantém tabela de CEPs. **3FN e BCNF** (os dois determinantes, `id_pessoa` e `cpf`, são chaves candidatas).

**ALUNO**
`id_pessoa → matricula, data_ingresso, bolsista, percentual_bolsa, observacao`
`matricula → id_pessoa` (chave candidata)
Nenhuma DF entre não-chaves. Note-se que `bolsista → percentual_bolsa` **não** é uma DF: `bolsista = TRUE` não determina um percentual específico, apenas condiciona sua existência — é uma restrição de integridade (`ck_aluno_bolsa`), não uma dependência funcional. **3FN e BCNF**.

**PROFESSOR**
`id_pessoa → registro_funcional, titulacao, data_admissao, data_desligamento, id_coordenador`
`registro_funcional → id_pessoa` (chave candidata)
**3FN e BCNF**.

**RESPONSAVEL**
`id_responsavel → cpf, nome, telefone, email, profissao`; `cpf → id_responsavel`
**3FN e BCNF**.

**ALUNO_RESPONSAVEL**
`(id_aluno, id_responsavel) → grau_parentesco, responsavel_financeiro, autoriza_saida, data_vinculo`
Chave composta: é preciso checar dependência parcial. Nenhum dos atributos depende só de `id_aluno` (o parentesco varia conforme o responsável) nem só de `id_responsavel` (o mesmo responsável pode ser mãe de um aluno e tutora de outro). ⇒ **2FN**. Não há DF entre não-chaves ⇒ **3FN e BCNF**.

**ANO_LETIVO**
`id_ano_letivo → ano, data_inicio, data_fim, situacao`; `ano → id_ano_letivo`
**3FN e BCNF**.

**DISCIPLINA**
`id_disciplina → codigo, nome, serie, carga_horaria_anual, ementa, ativa`
`codigo → id_disciplina`; `(nome, serie) → id_disciplina`
Três determinantes, todos chaves candidatas ⇒ **3FN e BCNF**. Observação importante: **não** existe a DF `nome → carga_horaria_anual`. "Matemática" não determina carga horária alguma; "Matemática do 6º ano" determina — e essa é exatamente a chave candidata (nome, serie). Se a carga horária dependesse apenas do nome, haveria dependência parcial e a relação precisaria ser decomposta em COMPONENTE e DISCIPLINA_SERIE.

**PRE_REQUISITO**
`(id_disciplina, id_disciplina_requisito) → obrigatorio, observacao`
Nenhum dos dois atributos depende de metade da chave. **3FN e BCNF**.

**TURMA**
`id_turma → id_ano_letivo, codigo, serie, turno, sala, capacidade, id_professor_regente`
`(id_ano_letivo, codigo) → id_turma` (chave candidata)
Ponto que merece atenção: o código "2026-7A" embute a série. Isso poderia sugerir `codigo → serie`. Como o código só é único dentro do ano letivo, o determinante correto seria `(id_ano_letivo, codigo)`, que é chave candidata — logo não há violação de 3FN. Ainda assim, a redundância entre o texto do código e a coluna `serie` é real, e foi mantida de propósito: o código é rótulo de exibição, sujeito a convenções que mudam, e `serie` é o dado semântico usado nas junções e restrições. **3FN e BCNF**.

**MATRICULA**
`id_matricula → id_aluno, id_turma, data_matricula, situacao, data_encerramento`
`(id_aluno, id_turma) → id_matricula` (chave candidata)
Não há DF entre não-chaves — `situacao` não determina `data_encerramento` (várias situações distintas podem ter a mesma data, e a relação entre elas é restrição, não dependência). **3FN e BCNF**.

**HISTORICO_SITUACAO_ALUNO**
`id_historico → id_aluno, situacao, data_inicio, data_fim, motivo`
`(id_aluno, data_inicio) → id_historico` (chave candidata)
**3FN e BCNF**. É a relação que sustenta o atributo temporal: sem ela, `situacao` seria coluna de ALUNO e a série histórica se perderia a cada atualização.

**ALOCACAO**
`id_alocacao → id_turma, id_disciplina, id_professor, carga_horaria_semanal, dia_semana, horario_inicio`
`(id_turma, id_disciplina) → id_alocacao, id_professor` (chave candidata)
Aqui vale explicitar por que **não** há dependência transitiva: poderia parecer que `id_disciplina → carga_horaria_semanal`, já que Matemática tem mais aulas que Arte. Mas a carga **semanal** é decisão de grade de cada turma — uma turma pode ter cinco aulas de Matemática e outra, quatro. O que a disciplina determina é a carga **anual**, e essa mora em DISCIPLINA, não aqui. **3FN e BCNF**.

**AVALIACAO**
`(id_alocacao, numero_avaliacao) → descricao, tipo, data_aplicacao, peso, valor_maximo`
Dependência parcial seria `numero_avaliacao → descricao` — e ela de fato não existe: a "avaliação nº 1" de Matemática do 7º A tem descrição e data próprias, independentes da avaliação nº 1 de História. **2FN, 3FN e BCNF**.

**NOTA**
`(id_matricula, id_alocacao, numero_avaliacao) → valor, data_lancamento, faltou, observacao`
Chave de três colunas: nenhum atributo depende de subconjunto próprio dela. O valor da nota exige o aluno *e* a avaliação; a data de lançamento idem. ⇒ **2FN**. Não há DF entre não-chaves ⇒ **3FN e BCNF**.

## 5.3 Conclusão

**As catorze relações estão em 3FN, e todas alcançam também a Forma Normal de Boyce-Codd**, porque em cada uma o lado esquerdo de toda dependência funcional não trivial é uma chave candidata.

**Não há desnormalização deliberada no esquema.** Os dois candidatos naturais foram examinados e recusados:

- A **média do aluno por disciplina** não é armazenada; é calculada pelas consultas C09, C11, C13 e C15. Guardá-la significaria mantê-la sincronizada a cada lançamento de nota, com risco de divergência silenciosa. Se o volume tornar o cálculo caro, a saída correta na Etapa 2 é uma visão materializada ou um índice de cobertura, não uma coluna redundante.
- A **idade** da pessoa, pelo motivo exposto em D6 do modelo lógico.

Caso a medição de desempenho da Etapa 2 indique necessidade, a candidata mais provável a desnormalização é a coluna `serie` replicada de DISCIPLINA para ALOCACAO, que hoje exige uma junção adicional nas consultas por série. A decisão será tomada com base em plano de execução medido, e não por antecipação.
