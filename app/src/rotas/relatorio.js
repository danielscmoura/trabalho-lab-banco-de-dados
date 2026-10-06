// Tela de relatorio consolidado, alimentada por VISAO criada no banco
// (B1). A aplicacao nao refaz a juncao de sete tabelas nem recalcula a
// media ponderada: isso esta em vw_boletim_turma, em sql/04_visoes.sql.
// Aqui so se filtra e se exibe.
//
// Vale notar por que a visao importa alem de organizar o codigo: o
// perfil CONSULTA nao tem SELECT em nenhuma tabela base. Para ele, a
// visao nao e conveniencia — e o unico caminho ate o dado.
'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();
const ouNulo = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const numOuNulo = (v) => (ouNulo(v) === null ? null : Number(v));

const SQL_BOLETIM = `
SELECT ano_letivo, turma, serie, turno, aluno, matricula, disciplina,
       avaliacoes_previstas, notas_lancadas, faltas, media_ponderada,
       situacao_matricula
  FROM vw_boletim_turma
 WHERE (? IS NULL OR ano_letivo = ?)
   AND (? IS NULL OR turma      = ?)
   AND (? IS NULL OR aluno LIKE CONCAT('%', ?, '%'))
   AND (? IS NULL OR media_ponderada < ?)
 ORDER BY turma, aluno, disciplina
 LIMIT 500`;

// Resumo por turma, tambem a partir da visao.
const SQL_RESUMO = `
SELECT turma, serie, turno,
       COUNT(DISTINCT id_aluno)       AS alunos,
       ROUND(AVG(media_ponderada), 2) AS media_da_turma,
       SUM(CASE WHEN media_ponderada < 6 THEN 1 ELSE 0 END) AS situacoes_abaixo_de_6,
       SUM(faltas)                    AS faltas
  FROM vw_boletim_turma
 WHERE (? IS NULL OR ano_letivo = ?)
   AND (? IS NULL OR turma      = ?)
 GROUP BY turma, serie, turno
 ORDER BY media_da_turma ASC
 LIMIT 100`;

router.get('/', async (req, res, next) => {
  try {
    const u = req.session.usuario;
    const f = {
      ano: numOuNulo(req.query.ano) ?? 2026,
      turma: ouNulo(req.query.turma),
      aluno: ouNulo(req.query.aluno),
      mediaAbaixo: numOuNulo(req.query.media_abaixo),
    };

    const [linhas, resumo, turmas] = await db.comConexao(u.pool, u.login, async (conn) => {
      const [l] = await conn.execute(SQL_BOLETIM,
        [f.ano, f.ano, f.turma, f.turma, f.aluno, f.aluno, f.mediaAbaixo, f.mediaAbaixo]);
      const [r] = await conn.execute(SQL_RESUMO, [f.ano, f.ano, f.turma, f.turma]);
      const [t] = await conn.execute(
        `SELECT DISTINCT turma FROM vw_boletim_turma WHERE (? IS NULL OR ano_letivo = ?) ORDER BY turma`,
        [f.ano, f.ano]);
      return [l, r, t.map((x) => x.turma)];
    });

    const anos = (await db.consultar(u.pool, u.login,
      'SELECT DISTINCT ano_letivo FROM vw_boletim_turma ORDER BY ano_letivo DESC')).map((r) => r.ano_letivo);

    res.render('relatorio', { titulo: 'Boletim consolidado', f, anos, turmas, linhas, resumo });
  } catch (e) { next(e); }
});

module.exports = router;
