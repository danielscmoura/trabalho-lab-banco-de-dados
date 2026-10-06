// EXPERIMENTO DE CONCORRENCIA — artefato B3.
//
//   node scripts/experimento-concorrencia.js
//
// Duas sessoes tentam ocupar a ULTIMA vaga da mesma turma ao mesmo
// tempo. E o caso classico de leitura-decisao-escrita: as duas leem
// "39 de 40", as duas concluem que ha vaga, e as duas gravam. O
// resultado seria 41 matriculas numa turma de 40 — uma violacao da
// RN30 que nenhuma restricao declarativa do MySQL pegaria, porque a
// regra compara linhas de tabelas diferentes.
//
// O experimento roda o cenario DUAS vezes:
//
//   SEM TRAVA  a transacao le a contagem com SELECT comum. As duas
//              sessoes passam pela verificacao e gravam. A turma
//              estoura.
//
//   COM TRAVA  a transacao trava a linha da turma com
//              SELECT ... FOR UPDATE antes de contar, que e o que a
//              aplicacao faz em src/rotas/matricula.js. A segunda
//              sessao ESPERA a primeira terminar, reconta, ve que
//              acabou a vaga e recusa.
//
// O que o experimento registra: quem esperou, quanto tempo, qual foi o
// desfecho e sob qual nivel de isolamento.
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const conf = {
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_SECRETARIA_USER, password: process.env.DB_SECRETARIA_PASSWORD,
  dateStrings: true,
};
const admin = { ...conf, user: 'root', password: '' };

const t0 = Date.now();
const log = (quem, msg) => console.log(`  [${String(Date.now() - t0).padStart(5)}ms] ${quem.padEnd(9)} ${msg}`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Prepara o palco: escolhe uma turma com matriculas ativas e ajusta a
// capacidade para que sobre exatamente UMA vaga.
async function prepararCenario(cx) {
  const [[turma]] = await cx.execute(
    `SELECT t.id_turma, t.codigo, t.capacidade,
            COUNT(CASE WHEN m.situacao='ATIVA' THEN 1 END) AS ativas
       FROM turma t
       JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo
       LEFT JOIN matricula m ON m.id_turma = t.id_turma
      WHERE anl.ano = 2026
      GROUP BY t.id_turma, t.codigo, t.capacidade
     HAVING ativas BETWEEN 5 AND 40
      ORDER BY ativas DESC LIMIT 1`);
  if (!turma) throw new Error('Nenhuma turma de 2026 com matriculas ativas suficientes.');

  const novaCapacidade = Number(turma.ativas) + 1;      // sobra 1 vaga
  await cx.execute('UPDATE turma SET capacidade = ? WHERE id_turma = ?', [novaCapacidade, turma.id_turma]);

  // dois alunos que ainda nao estao nessa turma
  const [candidatos] = await cx.execute(
    `SELECT a.id_pessoa, p.nome FROM aluno a
       JOIN pessoa p ON p.id_pessoa = a.id_pessoa
      WHERE a.id_pessoa NOT IN (SELECT id_aluno FROM matricula WHERE id_turma = ?)
      LIMIT 2`, [turma.id_turma]);
  if (candidatos.length < 2) throw new Error('Nao ha dois alunos fora dessa turma.');

  return { ...turma, capacidadeOriginal: turma.capacidade, capacidade: novaCapacidade, candidatos };
}

// Uma tentativa de matricula. `travar` decide se a contagem acontece
// sob SELECT ... FOR UPDATE.
async function tentarMatricular(nome, cenario, aluno, travar, atrasoAntesDoCommit) {
  const cx = await mysql.createConnection(conf);
  const inicio = Date.now();
  try {
    await cx.execute("SET @app_usuario = ?", [`experimento-${nome}`]);
    await cx.beginTransaction();
    log(nome, 'BEGIN');

    if (travar) {
      log(nome, `SELECT ... FOR UPDATE na turma ${cenario.codigo}`);
      await cx.execute('SELECT id_turma FROM turma WHERE id_turma = ? FOR UPDATE', [cenario.id_turma]);
      log(nome, 'obteve a trava da linha da turma');
    }

    const [[{ ativas }]] = await cx.execute(
      `SELECT COUNT(*) AS ativas FROM matricula WHERE id_turma = ? AND situacao = 'ATIVA'`, [cenario.id_turma]);
    log(nome, `contou ${ativas} ativas para ${cenario.capacidade} vagas`);

    if (ativas >= cenario.capacidade) {
      await cx.rollback();
      log(nome, 'RECUSOU: turma lotada (RN30) -> ROLLBACK');
      return { nome, desfecho: 'recusada', esperou: Date.now() - inicio };
    }

    await cx.execute(
      `INSERT INTO matricula (id_aluno, id_turma, data_matricula, situacao)
       VALUES (?, ?, CURDATE(), 'ATIVA')`, [aluno.id_pessoa, cenario.id_turma]);
    log(nome, `INSERT em matricula para ${aluno.nome}`);

    if (atrasoAntesDoCommit) {
      log(nome, `segurando a transacao por ${atrasoAntesDoCommit}ms (simula o tempo de uma tela real)`);
      await dormir(atrasoAntesDoCommit);
    }

    await cx.commit();
    log(nome, 'COMMIT');
    return { nome, desfecho: 'gravou', esperou: Date.now() - inicio };
  } catch (e) {
    await cx.rollback().catch(() => {});
    const deadlock = e.errno === 1213, timeout = e.errno === 1205;
    log(nome, `ERRO ${e.code} -> ROLLBACK${deadlock ? ' (DEADLOCK)' : timeout ? ' (LOCK WAIT TIMEOUT)' : ''}`);
    return { nome, desfecho: deadlock ? 'deadlock' : timeout ? 'timeout' : 'erro', erro: e.code, esperou: Date.now() - inicio };
  } finally {
    await cx.end();
  }
}

async function rodada(titulo, cenario, travar, cxAdmin) {
  console.log(`\n--- ${titulo} ---`);
  const antes = (await cxAdmin.execute(
    `SELECT COUNT(*) n FROM matricula WHERE id_turma=? AND situacao='ATIVA'`, [cenario.id_turma]))[0][0].n;
  console.log(`  estado inicial: ${antes} ativas / ${cenario.capacidade} vagas\n`);

  // A comeca; B entra 150ms depois, ainda dentro da transacao de A.
  const a = tentarMatricular('SESSAO-A', cenario, cenario.candidatos[0], travar, 1200);
  await dormir(150);
  const b = tentarMatricular('SESSAO-B', cenario, cenario.candidatos[1], travar, 0);
  const [ra, rb] = await Promise.all([a, b]);

  const depois = (await cxAdmin.execute(
    `SELECT COUNT(*) n FROM matricula WHERE id_turma=? AND situacao='ATIVA'`, [cenario.id_turma]))[0][0].n;

  console.log(`\n  resultado: A ${ra.desfecho} (${ra.esperou}ms), B ${rb.desfecho} (${rb.esperou}ms)`);
  console.log(`  ativas: ${antes} -> ${depois} para ${cenario.capacidade} vagas`);
  const estourou = depois > cenario.capacidade;
  console.log(`  ${estourou ? '>>> RN30 VIOLADA: a turma estourou a capacidade' : 'RN30 preservada'}`);

  // desfaz as matriculas criadas nesta rodada
  await cxAdmin.execute(
    `DELETE FROM matricula WHERE id_turma=? AND id_aluno IN (?, ?)`,
    [cenario.id_turma, cenario.candidatos[0].id_pessoa, cenario.candidatos[1].id_pessoa]);
  return { estourou, ra, rb };
}

(async () => {
  const cxAdmin = await mysql.createConnection(admin);
  const [[iso]] = await cxAdmin.execute('SELECT @@transaction_isolation AS nivel');
  const [[lockWait]] = await cxAdmin.execute('SELECT @@innodb_lock_wait_timeout AS s');

  console.log('='.repeat(72));
  console.log('EXPERIMENTO DE CONCORRENCIA — duas sessoes, a ultima vaga');
  console.log('='.repeat(72));
  console.log(`nivel de isolamento em vigor : ${iso.nivel}`);
  console.log(`innodb_lock_wait_timeout     : ${lockWait.s}s`);

  const cenario = await prepararCenario(cxAdmin);
  console.log(`turma do experimento         : ${cenario.codigo} (id ${cenario.id_turma})`);
  console.log(`capacidade ajustada para     : ${cenario.capacidade} (${cenario.ativas} ativas, 1 vaga)`);
  console.log(`candidatos                   : ${cenario.candidatos.map((c) => c.nome).join(' | ')}`);

  const semTrava = await rodada('RODADA 1 — SEM trava (SELECT comum)', cenario, false, cxAdmin);
  const comTrava = await rodada('RODADA 2 — COM trava (SELECT ... FOR UPDATE)', cenario, true, cxAdmin);

  await cxAdmin.execute('UPDATE turma SET capacidade = ? WHERE id_turma = ?',
    [cenario.capacidadeOriginal, cenario.id_turma]);

  console.log('\n' + '='.repeat(72));
  console.log('CONCLUSAO');
  console.log('='.repeat(72));
  console.log(`Sem trava : ${semTrava.estourou ? 'a turma ESTOUROU — as duas sessoes gravaram' : 'nao reproduziu (tente de novo)'}`);
  console.log(`Com trava : ${!comTrava.estourou ? 'a RN30 resistiu — a segunda sessao esperou e foi recusada' : 'ATENCAO: estourou mesmo com trava'}`);
  console.log(`\nA sessao B esperou ${comTrava.rb.esperou}ms na rodada 2 contra ${semTrava.rb.esperou}ms na rodada 1:`);
  console.log('a diferenca e o tempo que ela ficou bloqueada na trava da linha da turma.');
  console.log(`\nIsolamento: ${iso.nivel} (padrao do InnoDB). Discussao no relatorio — secao B3.`);
  console.log('Capacidade da turma restaurada. Nenhuma matricula do experimento permaneceu.\n');

  await cxAdmin.end();
})().catch((e) => { console.error('\nFalhou:', e.message); process.exit(1); });
