-- =====================================================================
-- Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)
-- Etapa 2 — Visoes
-- Arquivo: 04_visoes.sql   |   Executar APOS 01_ddl.sql e 02_carga.sql
-- =====================================================================
-- Duas visoes, com propositos diferentes:
--
--   vw_boletim_turma      alimenta a tela de relatorio consolidado da
--                         aplicacao (B1). Concentra num lugar so a
--                         juncao de sete tabelas e a media ponderada,
--                         que a aplicacao nao precisa saber calcular.
--
--   vw_aluno_publico      restringe COLUNAS (B5). E a unica coisa que o
--                         perfil de consulta enxerga: nome, matricula e
--                         turma, sem CPF, sem data de nascimento e sem
--                         endereco.
-- =====================================================================

USE escola_ucb;

-- ---------------------------------------------------------------------
-- 1. vw_boletim_turma — relatorio consolidado por aluno e disciplina
--    A media e PONDERADA pelo peso de cada avaliacao, e o denominador
--    considera apenas as avaliacoes efetivamente lancadas: uma prova
--    ainda sem nota nao pode puxar a media para baixo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_boletim_turma AS
SELECT
    anl.ano                                   AS ano_letivo,
    t.id_turma,
    t.codigo                                  AS turma,
    t.serie,
    t.turno,
    p.id_pessoa                               AS id_aluno,
    p.nome                                    AS aluno,
    a.matricula,
    m.id_matricula,
    m.situacao                                AS situacao_matricula,
    d.id_disciplina,
    d.nome                                    AS disciplina,
    COUNT(av.numero_avaliacao)                AS avaliacoes_previstas,
    COUNT(n.valor)                            AS notas_lancadas,
    COALESCE(SUM(n.faltou), 0)                AS faltas,
    ROUND(
        SUM(n.valor * av.peso)
        / NULLIF(SUM(CASE WHEN n.valor IS NOT NULL THEN av.peso END), 0)
    , 2)                                      AS media_ponderada
FROM matricula m
JOIN turma       t   ON t.id_turma       = m.id_turma
JOIN ano_letivo  anl ON anl.id_ano_letivo = t.id_ano_letivo
JOIN aluno       a   ON a.id_pessoa      = m.id_aluno
JOIN pessoa      p   ON p.id_pessoa      = a.id_pessoa
JOIN alocacao    alo ON alo.id_turma     = t.id_turma
JOIN disciplina  d   ON d.id_disciplina  = alo.id_disciplina
LEFT JOIN avaliacao av ON av.id_alocacao = alo.id_alocacao
LEFT JOIN nota      n  ON n.id_matricula = m.id_matricula
                      AND n.id_alocacao  = av.id_alocacao
                      AND n.numero_avaliacao = av.numero_avaliacao
GROUP BY anl.ano, t.id_turma, t.codigo, t.serie, t.turno,
         p.id_pessoa, p.nome, a.matricula, m.id_matricula, m.situacao,
         d.id_disciplina, d.nome;

-- ---------------------------------------------------------------------
-- 2. vw_aluno_publico — restricao de COLUNAS para o perfil de consulta
--    O perfil escola_consulta nao recebe SELECT em nenhuma tabela base:
--    so nesta visao. Assim o dado pessoal (CPF, nascimento, endereco,
--    telefone) fica inacessivel por construcao, e nao por disciplina de
--    quem escreve a consulta.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_aluno_publico AS
SELECT
    a.id_pessoa          AS id_aluno,
    p.nome               AS aluno,
    a.matricula,
    a.data_ingresso,
    t.codigo             AS turma_atual,
    t.serie,
    t.turno,
    anl.ano              AS ano_letivo
FROM aluno a
JOIN pessoa p ON p.id_pessoa = a.id_pessoa
LEFT JOIN matricula m   ON m.id_aluno = a.id_pessoa AND m.situacao = 'ATIVA'
LEFT JOIN turma     t   ON t.id_turma = m.id_turma
LEFT JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo;

-- =====================================================================
-- Fim do script. 2 visoes criadas.
-- =====================================================================
