-- =====================================================================
-- Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)
-- Etapa 1 — Consultas de verificacao
-- Arquivo: 03_consultas.sql   |   Executar APOS 01_ddl.sql e 02_carga.sql
-- 15 consultas: 5 basicas, 5 de juncao/agregacao, 5 avancadas.
-- Cada consulta e precedida da pergunta de negocio que responde.
-- =====================================================================
USE escola_ucb;

-- =====================================================================
-- BASICAS
-- =====================================================================

-- C01 — Pergunta: quem sao os alunos cadastrados e como a secretaria
--       entra em contato com cada um? (projecao, ordenacao e tratamento
--       de NULL nos contatos opcionais)
SELECT p.id_pessoa,
       p.nome,
       a.matricula,
       COALESCE(p.email, 'e-mail nao informado')       AS email_contato,
       COALESCE(p.telefone, 'telefone nao informado')  AS telefone_contato
FROM aluno a
JOIN pessoa p ON p.id_pessoa = a.id_pessoa
ORDER BY p.nome
LIMIT 25;

-- C02 — Pergunta: quais componentes curriculares do fundamental II tem
--       carga horaria intermediaria? (BETWEEN + IN + selecao)
SELECT codigo, nome, serie, carga_horaria_anual
FROM disciplina
WHERE carga_horaria_anual BETWEEN 80 AND 200
  AND serie IN ('6ANO','7ANO','8ANO','9ANO')
  AND ativa = TRUE
ORDER BY serie, carga_horaria_anual DESC, nome;

-- C03 — Pergunta: existe algum aluno cujo sobrenome contenha "Santos",
--       para conferencia de homonimos na secretaria? (LIKE)
SELECT p.nome, a.matricula, p.data_nascimento
FROM aluno a
JOIN pessoa p ON p.id_pessoa = a.id_pessoa
WHERE p.nome LIKE '%Santos%'
ORDER BY p.nome;

-- C04 — Pergunta: quais alunos estao sem telefone de contato no cadastro?
--       (tratamento explicito de NULL)
SELECT a.matricula, p.nome, p.email
FROM aluno a
JOIN pessoa p ON p.id_pessoa = a.id_pessoa
WHERE p.telefone IS NULL
ORDER BY p.nome;

-- C05 — Pergunta: como estao distribuidas as turmas do ano letivo
--       corrente por turno e capacidade? (selecao + ordenacao)
SELECT t.codigo, t.serie, t.turno, t.sala, t.capacidade
FROM turma t
JOIN ano_letivo al ON al.id_ano_letivo = t.id_ano_letivo
WHERE al.ano = 2026
ORDER BY t.turno, t.capacidade DESC, t.codigo;

-- =====================================================================
-- JUNCOES E AGREGACAO
-- =====================================================================

-- C06 — Pergunta: qual e a grade de uma turma, com disciplina e
--       professor responsavel? (juncao de quatro tabelas)
SELECT t.codigo        AS turma,
       d.nome          AS disciplina,
       p.nome          AS professor,
       al.carga_horaria_semanal,
       al.dia_semana,
       al.horario_inicio
FROM alocacao al
JOIN turma t      ON t.id_turma = al.id_turma
JOIN disciplina d ON d.id_disciplina = al.id_disciplina
JOIN pessoa p     ON p.id_pessoa = al.id_professor
WHERE t.codigo = '2026-6A'
ORDER BY al.dia_semana, al.horario_inicio;

-- C07 — Pergunta: quais turmas de 2026 estao sem professor regente
--       designado? (LEFT JOIN revelando a ausencia — RN17)
SELECT t.codigo, t.serie, t.turno,
       COALESCE(p.nome, 'SEM REGENTE DESIGNADO') AS regente
FROM turma t
JOIN ano_letivo alv ON alv.id_ano_letivo = t.id_ano_letivo
LEFT JOIN professor pr ON pr.id_pessoa = t.id_professor_regente
LEFT JOIN pessoa p     ON p.id_pessoa = pr.id_pessoa
WHERE alv.ano = 2026
ORDER BY regente = 'SEM REGENTE DESIGNADO' DESC, t.codigo;

-- C08 — Pergunta: quais turmas de 2026 tem mais de dez matriculas ativas
--       e qual a taxa de ocupacao em relacao a capacidade?
--       (GROUP BY + HAVING)
SELECT t.codigo,
       t.capacidade,
       COUNT(m.id_matricula) AS matriculas_ativas,
       ROUND(100 * COUNT(m.id_matricula) / t.capacidade, 1) AS ocupacao_pct
FROM turma t
JOIN ano_letivo al ON al.id_ano_letivo = t.id_ano_letivo
JOIN matricula m   ON m.id_turma = t.id_turma AND m.situacao = 'ATIVA'
WHERE al.ano = 2026
GROUP BY t.id_turma, t.codigo, t.capacidade
HAVING COUNT(m.id_matricula) > 10
ORDER BY ocupacao_pct DESC;

-- C09 — Pergunta: qual o desempenho medio da escola por disciplina no
--       ano letivo corrente? (agregacao com filtro de NULL nas notas)
SELECT d.nome AS disciplina,
       COUNT(n.valor)        AS notas_lancadas,
       ROUND(AVG(n.valor),2) AS media,
       MIN(n.valor)          AS menor,
       MAX(n.valor)          AS maior
FROM nota n
JOIN alocacao al  ON al.id_alocacao = n.id_alocacao
JOIN disciplina d ON d.id_disciplina = al.id_disciplina
JOIN turma t      ON t.id_turma = al.id_turma
JOIN ano_letivo a ON a.id_ano_letivo = t.id_ano_letivo
WHERE a.ano = 2026 AND n.valor IS NOT NULL
GROUP BY d.nome
ORDER BY media DESC;

-- C10 — Pergunta: qual a carga horaria semanal assumida por cada
--       professor em 2026, para verificar sobrecarga? (juncao +
--       agregacao + HAVING)
SELECT p.nome AS professor,
       COUNT(DISTINCT al.id_turma)      AS turmas,
       SUM(al.carga_horaria_semanal)    AS horas_semanais
FROM alocacao al
JOIN professor pr ON pr.id_pessoa = al.id_professor
JOIN pessoa p     ON p.id_pessoa = pr.id_pessoa
JOIN turma t      ON t.id_turma = al.id_turma
JOIN ano_letivo a ON a.id_ano_letivo = t.id_ano_letivo
WHERE a.ano = 2026
GROUP BY p.id_pessoa, p.nome
HAVING SUM(al.carga_horaria_semanal) >= 5
ORDER BY horas_semanais DESC;

-- =====================================================================
-- AVANCADAS
-- =====================================================================

-- C11 — Pergunta: quais alunos tem media geral acima da media da propria
--       turma? (subconsulta correlacionada)
SELECT p.nome AS aluno,
       t.codigo AS turma,
       ROUND(AVG(n.valor), 2) AS media_aluno
FROM nota n
JOIN matricula m ON m.id_matricula = n.id_matricula
JOIN turma t     ON t.id_turma = m.id_turma
JOIN pessoa p    ON p.id_pessoa = m.id_aluno
WHERE n.valor IS NOT NULL
GROUP BY p.id_pessoa, p.nome, t.id_turma, t.codigo
HAVING AVG(n.valor) > (
    SELECT AVG(n2.valor)
    FROM nota n2
    JOIN matricula m2 ON m2.id_matricula = n2.id_matricula
    WHERE m2.id_turma = t.id_turma AND n2.valor IS NOT NULL
)
ORDER BY t.codigo, media_aluno DESC;

-- C12 — Pergunta: existe alguma disciplina ativa que nunca foi alocada a
--       nenhuma turma? (NOT EXISTS)
SELECT d.codigo, d.nome, d.serie
FROM disciplina d
WHERE d.ativa = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM alocacao al WHERE al.id_disciplina = d.id_disciplina
  )
ORDER BY d.serie, d.nome;

-- C13 — Pergunta: quem sao os tres melhores alunos de cada turma de
--       2026? (funcao de janela sobre agregacao)
SELECT turma, aluno, media, posicao
FROM (
    SELECT t.codigo AS turma,
           p.nome   AS aluno,
           ROUND(AVG(n.valor), 2) AS media,
           RANK() OVER (PARTITION BY t.id_turma ORDER BY AVG(n.valor) DESC) AS posicao
    FROM nota n
    JOIN matricula m  ON m.id_matricula = n.id_matricula
    JOIN turma t      ON t.id_turma = m.id_turma
    JOIN ano_letivo a ON a.id_ano_letivo = t.id_ano_letivo
    JOIN pessoa p     ON p.id_pessoa = m.id_aluno
    WHERE a.ano = 2026 AND n.valor IS NOT NULL
    GROUP BY t.id_turma, t.codigo, p.id_pessoa, p.nome
) AS ranking
WHERE posicao <= 3
ORDER BY turma, posicao;

-- C14 — Pergunta: qual a situacao vigente de cada aluno e ha quanto tempo
--       ela vale? (uso do atributo temporal: registro em aberto =
--       situacao atual — RN20)
SELECT p.nome         AS aluno,
       h.situacao     AS situacao_vigente,
       h.data_inicio  AS desde,
       h.motivo
FROM historico_situacao_aluno h
JOIN pessoa p ON p.id_pessoa = h.id_aluno
WHERE h.data_fim IS NULL
  AND h.situacao <> 'ATIVO'
ORDER BY h.data_inicio DESC;

-- C15 — Pergunta de negocio nao trivial: quais alunos estao em risco de
--       reprovacao? Considera-se em risco quem tem media PONDERADA pelo
--       peso das avaliacoes abaixo de 6,0 em alguma disciplina do ano
--       corrente, ou que tenha faltado a alguma avaliacao aplicada.
--       (subconsulta correlacionada + EXISTS + agregacao ponderada)
SELECT p.nome    AS aluno,
       t.codigo  AS turma,
       d.nome    AS disciplina,
       ROUND(SUM(n.valor * av.peso) / SUM(av.peso), 2) AS media_ponderada,
       (SELECT COUNT(*)
          FROM nota nf
         WHERE nf.id_matricula = m.id_matricula
           AND nf.id_alocacao  = al.id_alocacao
           AND nf.faltou = TRUE) AS faltas_em_avaliacao
FROM nota n
JOIN avaliacao av ON av.id_alocacao = n.id_alocacao
                 AND av.numero_avaliacao = n.numero_avaliacao
JOIN alocacao al  ON al.id_alocacao = n.id_alocacao
JOIN disciplina d ON d.id_disciplina = al.id_disciplina
JOIN matricula m  ON m.id_matricula = n.id_matricula
JOIN turma t      ON t.id_turma = m.id_turma
JOIN ano_letivo a ON a.id_ano_letivo = t.id_ano_letivo
JOIN pessoa p     ON p.id_pessoa = m.id_aluno
WHERE a.ano = 2026
  AND m.situacao = 'ATIVA'
  AND n.valor IS NOT NULL
  AND EXISTS (SELECT 1 FROM avaliacao av2
               WHERE av2.id_alocacao = al.id_alocacao
                 AND av2.data_aplicacao IS NOT NULL)
GROUP BY p.id_pessoa, p.nome, t.codigo, d.nome, m.id_matricula, al.id_alocacao
HAVING SUM(n.valor * av.peso) / SUM(av.peso) < 6.0
ORDER BY media_ponderada ASC, aluno
LIMIT 30;
