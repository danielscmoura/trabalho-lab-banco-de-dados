// Duas telas de consulta parametrizada (B1).
//
// O usuario informa os filtros; a aplicacao devolve o resultado de uma
// consulta com juncao e agregacao. Todo filtro entra como parametro,
// inclusive os opcionais: o padrao `(? IS NULL OR coluna = ?)` deixa o
// SQL fixo e permite que o mesmo prepared statement sirva com ou sem o
// filtro preenchido. Em nenhum momento um valor digitado vira texto de
// consulta.
'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();
const ouNulo = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const numOuNulo = (v) => (ouNulo(v) === null ? null : Number(v));

// =====================================================================
// 1. Desempenho por turma e disciplina
//    Seis tabelas, agregacao com media ponderada e HAVING sobre o
//    resultado agregado.
// =====================================================================
const SQL_DESEMPENHO = `
SELECT anl.ano                              AS ano_letivo,
       t.codigo                             AS turma,
       d.nome                               AS disciplina,
       COUNT(DISTINCT m.id_matricula)       AS alunos,
       COUNT(n.valor)                       AS notas_lancadas,
       ROUND(AVG(n.valor), 2)               AS media_simples,
       ROUND(SUM(n.valor * av.peso) / NULLIF(SUM(CASE WHEN n.valor IS NOT NULL THEN av.peso END), 0), 2)
                                            AS media_ponderada,
       SUM(n.faltou)                        AS faltas
  FROM alocacao alo
  JOIN turma      t   ON t.id_turma        = alo.id_turma
  JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo
  JOIN disciplina d   ON d.id_disciplina   = alo.id_disciplina
  JOIN avaliacao  av  ON av.id_alocacao    = alo.id_alocacao
  JOIN nota       n   ON n.id_alocacao     = av.id_alocacao
                     AND n.numero_avaliacao = av.numero_avaliacao
  JOIN matricula  m   ON m.id_matricula    = n.id_matricula
 WHERE (? IS NULL OR anl.ano  = ?)
   AND (? IS NULL OR t.codigo = ?)
   AND (? IS NULL OR t.serie  = ?)
 GROUP BY anl.ano, t.codigo, d.nome
HAVING (? IS NULL OR ROUND(AVG(n.valor), 2) <= ?)
 ORDER BY media_ponderada ASC, turma, disciplina
 LIMIT 300`;

router.get('/desempenho', async (req, res, next) => {
  try {
    const u = req.session.usuario;
    const f = {
      ano: numOuNulo(req.query.ano),
      turma: ouNulo(req.query.turma),
      serie: ouNulo(req.query.serie),
      mediaMax: numOuNulo(req.query.media_max),
    };
    const executou = Object.values(f).some((v) => v !== null) || req.query.executar === '1';

    const [anos, series] = await db.comConexao(u.pool, u.login, async (conn) => [
      (await conn.execute('SELECT ano FROM ano_letivo ORDER BY ano DESC'))[0].map((r) => r.ano),
      ['6ANO', '7ANO', '8ANO', '9ANO', '1EM'],
    ]);

    const linhas = executou
      ? await db.consultar(u.pool, u.login, SQL_DESEMPENHO,
          [f.ano, f.ano, f.turma, f.turma, f.serie, f.serie, f.mediaMax, f.mediaMax])
      : null;

    res.render('consulta-desempenho', { titulo: 'Desempenho por turma e disciplina', f, anos, series, linhas, sql: SQL_DESEMPENHO });
  } catch (e) { next(e); }
});

// =====================================================================
// 2. Carga horaria por professor
//    Verifica sobrecarga: quantas turmas, quantas disciplinas e quantas
//    aulas por semana cada professor acumula no ano escolhido.
// =====================================================================
const SQL_CARGA = `
SELECT p.nome                            AS professor,
       pr.titulacao,
       COUNT(DISTINCT alo.id_turma)      AS turmas,
       COUNT(DISTINCT alo.id_disciplina) AS disciplinas,
       SUM(alo.carga_horaria_semanal)    AS aulas_semana,
       COUNT(DISTINCT reg.id_turma)      AS turmas_que_rege
  FROM professor  pr
  JOIN pessoa     p   ON p.id_pessoa     = pr.id_pessoa
  JOIN alocacao   alo ON alo.id_professor = pr.id_pessoa
  JOIN turma      t   ON t.id_turma      = alo.id_turma
  JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo
  LEFT JOIN turma reg ON reg.id_professor_regente = pr.id_pessoa
                     AND reg.id_ano_letivo = anl.id_ano_letivo
 WHERE (? IS NULL OR anl.ano      = ?)
   AND (? IS NULL OR pr.titulacao = ?)
   AND (? IS NULL OR pr.data_desligamento IS NULL)
 GROUP BY p.id_pessoa, p.nome, pr.titulacao
HAVING (? IS NULL OR SUM(alo.carga_horaria_semanal) >= ?)
 ORDER BY aulas_semana DESC, professor
 LIMIT 300`;

router.get('/carga-professor', async (req, res, next) => {
  try {
    const u = req.session.usuario;
    const f = {
      ano: numOuNulo(req.query.ano),
      titulacao: ouNulo(req.query.titulacao),
      soAtivos: req.query.so_ativos === 'on' ? 1 : null,
      cargaMin: numOuNulo(req.query.carga_min),
    };
    const executou = Object.values(f).some((v) => v !== null) || req.query.executar === '1';

    const anos = (await db.consultar(u.pool, u.login, 'SELECT ano FROM ano_letivo ORDER BY ano DESC')).map((r) => r.ano);

    const linhas = executou
      ? await db.consultar(u.pool, u.login, SQL_CARGA,
          [f.ano, f.ano, f.titulacao, f.titulacao, f.soAtivos, f.cargaMin, f.cargaMin])
      : null;

    res.render('consulta-carga', { titulo: 'Carga horaria por professor', f, anos, linhas, sql: SQL_CARGA });
  } catch (e) { next(e); }
});

module.exports = router;
