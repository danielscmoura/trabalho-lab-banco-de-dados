// OPERACAO DE NEGOCIO TRANSACIONAL — o item central da Etapa 2 (B1/B3).
//
// "Matricular aluno em turma" nao e um INSERT. Sao tres tabelas que
// precisam mudar juntas ou nao mudar:
//
//   1. matricula                 cria o vinculo aluno x turma
//   2. historico_situacao_aluno  fecha a situacao anterior e abre
//                                'ATIVO' a partir de hoje (RN20: so um
//                                registro em aberto por aluno)
//   3. nota                      abre uma linha vazia para cada
//                                avaliacao ja cadastrada na turma, para
//                                que o diario do professor nasca
//                                completo
//
// Se a terceira falhar, as duas primeiras nao podem ficar de pe: o
// aluno apareceria matriculado, com a situacao trocada, e sem diario.
// Dai a transacao explicita.
//
// CONTROLE DE CONCORRENCIA
// A RN30 (matriculas ativas <= capacidade da turma) compara linhas de
// tabelas diferentes e nao cabe em CHECK. Ela e verificada aqui — e,
// para que a verificacao valha sob concorrencia, a transacao trava a
// linha da turma com SELECT ... FOR UPDATE antes de contar. Sem essa
// trava, duas secretarias matriculando ao mesmo tempo na ultima vaga
// leriam "39 de 40" as duas e gravariam as duas.
'use strict';
const express = require('express');
const db = require('../db');
const { ErroDeRegra } = require('../erros');

const router = express.Router();

async function carregarFormulario(conn) {
  const [turmas] = await conn.execute(
    `SELECT t.id_turma, t.codigo, t.serie, t.turno, t.capacidade, anl.ano,
            COUNT(CASE WHEN m.situacao = 'ATIVA' THEN 1 END) AS ativas
       FROM turma t
       JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo
       LEFT JOIN matricula m ON m.id_turma = t.id_turma
      WHERE anl.situacao <> 'ENCERRADO'
      GROUP BY t.id_turma, t.codigo, t.serie, t.turno, t.capacidade, anl.ano
      ORDER BY anl.ano DESC, t.codigo`);
  const [alunos] = await conn.execute(
    `SELECT a.id_pessoa, a.matricula, p.nome
       FROM aluno a JOIN pessoa p ON p.id_pessoa = a.id_pessoa
      ORDER BY p.nome`);
  return { turmas, alunos };
}

router.get('/', async (req, res, next) => {
  try {
    const u = req.session.usuario;
    const { turmas, alunos } = await db.comConexao(u.pool, u.login, carregarFormulario);
    res.render('matricular', { titulo: 'Matricular aluno', turmas, alunos, resultado: null });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  const u = req.session.usuario;
  const idAluno = Number(req.body.id_aluno);
  const idTurma = Number(req.body.id_turma);
  const dataMatricula = req.body.data_matricula || new Date().toISOString().slice(0, 10);
  // Caixa marcada na tela para a demonstracao de B3: provoca uma falha
  // DEPOIS que as tres tabelas ja foram alteradas, para mostrar que o
  // ROLLBACK devolve o banco ao estado anterior.
  const simularFalha = req.body.simular_falha === 'on';

  try {
    const passos = await db.transacao(u.pool, u.login, async (conn) => {
      const registro = [];

      // -- 1. trava a turma e confere a vaga (RN30) --------------------
      const [[turma]] = await conn.execute(
        `SELECT t.id_turma, t.codigo, t.capacidade, t.serie, anl.ano, anl.situacao AS situacao_ano
           FROM turma t JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo
          WHERE t.id_turma = ?
          FOR UPDATE`, [idTurma]);
      if (!turma) throw new ErroDeRegra('Turma nao encontrada.');
      if (turma.situacao_ano === 'ENCERRADO') {
        throw new ErroDeRegra(`O ano letivo de ${turma.ano} esta encerrado e nao aceita novas matriculas.`);
      }
      registro.push(`SELECT ... FOR UPDATE na turma ${turma.codigo} (linha travada)`);

      const [[{ ativas }]] = await conn.execute(
        `SELECT COUNT(*) AS ativas FROM matricula WHERE id_turma = ? AND situacao = 'ATIVA'`, [idTurma]);
      if (ativas >= turma.capacidade) {
        throw new ErroDeRegra(
          `A turma ${turma.codigo} esta lotada: ${ativas} matriculas ativas para ${turma.capacidade} vagas (RN30).`);
      }
      registro.push(`RN30 conferida: ${ativas} de ${turma.capacidade} vagas ocupadas`);

      // -- 2. cria a matricula ----------------------------------------
      // uq_matricula_aluno_turma (RN18) barra a matricula repetida; se
      // acontecer, erros.js traduz a violacao para o usuario.
      const [resMat] = await conn.execute(
        `INSERT INTO matricula (id_aluno, id_turma, data_matricula, situacao)
         VALUES (?, ?, ?, 'ATIVA')`, [idAluno, idTurma, dataMatricula]);
      registro.push(`INSERT em matricula (id ${resMat.insertId})`);

      // -- 3. move o historico de situacao (RN20) ----------------------
      // Fecha o registro em aberto, se houver, e abre o novo. O par
      // (id_aluno, data_inicio) e unico, entao rematricular no mesmo dia
      // seria barrado por uq_historico_aluno_inicio.
      const [fechou] = await conn.execute(
        `UPDATE historico_situacao_aluno
            SET data_fim = ?
          WHERE id_aluno = ? AND data_fim IS NULL AND data_inicio <= ?`,
        [dataMatricula, idAluno, dataMatricula]);
      if (fechou.affectedRows) registro.push(`fechou ${fechou.affectedRows} situacao(oes) anterior(es)`);

      await conn.execute(
        `INSERT INTO historico_situacao_aluno (id_aluno, situacao, data_inicio, motivo)
         VALUES (?, 'ATIVO', ?, ?)`,
        [idAluno, dataMatricula, `Matricula na turma ${turma.codigo}`]);
      registro.push(`INSERT em historico_situacao_aluno (ATIVO desde ${dataMatricula})`);

      // -- 4. abre o diario: uma linha de nota por avaliacao -----------
      const [resNotas] = await conn.execute(
        `INSERT INTO nota (id_matricula, id_alocacao, numero_avaliacao, valor, faltou)
         SELECT ?, av.id_alocacao, av.numero_avaliacao, NULL, FALSE
           FROM avaliacao av
           JOIN alocacao alo ON alo.id_alocacao = av.id_alocacao
          WHERE alo.id_turma = ?`, [resMat.insertId, idTurma]);
      registro.push(`INSERT em nota: ${resNotas.affectedRows} lancamento(s) em aberto`);

      // -- 5. falha proposital (so na demonstracao) --------------------
      if (simularFalha) {
        throw new ErroDeRegra(
          'FALHA SIMULADA depois de alterar as tres tabelas. ' +
          'A transacao foi desfeita: confira que o aluno NAO ficou matriculado.');
      }

      registro.push('COMMIT');
      return { registro, turma: turma.codigo, idMatricula: resMat.insertId };
    });

    req.session.aviso =
      `Matricula ${passos.idMatricula} criada na turma ${passos.turma}. Passos: ${passos.registro.join(' -> ')}`;
    res.redirect('/matricular');
  } catch (e) { next(e); }
});

module.exports = router;
