// ESTUDO DE DESEMPENHO — artefato B4.
//
//   node scripts/estudo-indices.js
//
// Para cada consulta critica: plano de execucao ANTES, criacao do
// indice, plano DEPOIS, e tempo medido nas duas situacoes. O tempo e a
// MEDIANA de varias execucoes, nao uma medicao unica — a primeira
// execucao de qualquer consulta paga o custo de encher o buffer pool e
// mediria o cache, nao o indice.
//
// O terceiro caso existe de proposito para o indice NAO ajudar. Nem
// toda coluna merece indice, e saber reconhecer isso vale tanto quanto
// acertar os outros dois.
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const REPETICOES = 41;        // impar: a mediana cai numa medicao real

const CASOS = [
  {
    nome: '1. Conferencia de vaga na turma (RN30)',
    porque:
      'Roda em toda matricula, dentro da transacao e com a linha da turma travada. ' +
      'Enquanto ela demora, as outras secretarias esperam — e a consulta mais sensivel do sistema.',
    // A consulta real da aplicacao e uma linha so:
    //    SELECT COUNT(*) FROM matricula WHERE id_turma = ? AND situacao = 'ATIVA'
    // Medida isolada, ela leva menos de 0,3ms — e esse numero e quase
    // todo ida e volta de rede, nao acesso a dados. Para medir o ACESSO,
    // a consulta abaixo repete a mesma busca uma vez por turma dentro de
    // uma unica viagem ao servidor: o custo do plano aparece multiplicado
    // por 40 e a sobrecarga de protocolo continua sendo paga uma vez so.
    sql: `SELECT SUM(ocupacao) AS total FROM (
            SELECT (SELECT COUNT(*) FROM matricula m
                     WHERE m.id_turma = t.id_turma AND m.situacao = 'ATIVA') AS ocupacao
              FROM turma t) AS z`,
    params: [],
    // Duas instrucoes, e a segunda e a que faz diferenca. Na primeira
    // tentativa criamos so o composto, e o otimizador continuou
    // escolhendo idx_matricula_turma: os dois servem para o `ref` em
    // id_turma, e ele ficou com o que ja conhecia. O indice antigo e
    // PREFIXO do novo — entao nao e so redundante, e concorrente.
    indice: [
      'CREATE INDEX idx_matricula_turma_situacao ON matricula (id_turma, situacao)',
      'DROP INDEX idx_matricula_turma ON matricula',
    ],
    remover: [
      'CREATE INDEX idx_matricula_turma ON matricula (id_turma)',
      'DROP INDEX idx_matricula_turma_situacao ON matricula',
    ],
    justificativa:
      'Composto (id_turma, situacao), nessa ordem: id_turma e o filtro de igualdade que mais ' +
      'reduz o conjunto, e situacao refina dentro dele. O indice de coluna unica da Etapa 1 e ' +
      'prefixo deste e foi removido no mesmo passo: mantido, ele continuaria sendo escolhido ' +
      'pelo otimizador e o composto nunca entraria em uso.',
  },
  {
    nome: '2. Situacao vigente de todos os alunos (RN20)',
    porque:
      'Alimenta o painel da secretaria e o relatorio de evasao. O registro vigente e aquele ' +
      'com data_fim nula — sem indice, nao ha como achar os nulos a nao ser varrendo a tabela.',
    sql: `SELECT h.id_aluno, h.situacao, h.data_inicio
            FROM historico_situacao_aluno h
           WHERE h.data_fim IS NULL AND h.situacao <> 'ATIVO'`,
    params: [],
    indice: 'CREATE INDEX idx_historico_vigente ON historico_situacao_aluno (data_fim, situacao)',
    remover: 'DROP INDEX idx_historico_vigente ON historico_situacao_aluno',
    justificativa:
      'data_fim primeiro porque IS NULL e um predicado de igualdade que o InnoDB resolve pelo ' +
      'indice; situacao em segundo para que o filtro <> seja avaliado sem voltar a tabela.',
  },
  {
    nome: '3. Media das notas lancadas (caso de controle)',
    porque:
      'Agregacao que varre quase a tabela inteira de notas. A hipotese testada e que um indice ' +
      'em valor aceleraria o filtro IS NOT NULL.',
    sql: `SELECT ROUND(AVG(valor), 2) AS media, COUNT(*) AS n FROM nota WHERE valor IS NOT NULL`,
    params: [],
    indice: 'CREATE INDEX idx_nota_valor ON nota (valor)',
    remover: 'DROP INDEX idx_nota_valor ON nota',
    justificativa:
      'Hipotese deliberadamente fraca: o filtro aceita a grande maioria das linhas, entao o ' +
      'otimizador tende a preferir a varredura sequencial. Esperamos ganho nulo ou negativo.',
  },
];

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function medir(cx, sql, params) {
  for (let i = 0; i < 10; i++) await cx.execute(sql, params);   // aquecimento, descartado
  const tempos = [];
  for (let i = 0; i < REPETICOES; i++) {
    const t = process.hrtime.bigint();
    await cx.execute(sql, params);
    tempos.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  return { mediana: mediana(tempos), min: Math.min(...tempos), max: Math.max(...tempos) };
}

async function plano(cx, sql, params) {
  const [linhas] = await cx.query(
    'EXPLAIN ' + mysql.format(sql, params));
  return linhas.map((l) =>
    `    tabela=${l.table ?? '-'}  tipo=${l.type ?? '-'}  indice=${l.key ?? '(nenhum)'}  ` +
    `linhas=${l.rows ?? '-'}  filtrado=${l.filtered ?? '-'}%  extra=${l.Extra ?? '-'}`).join('\n');
}

(async () => {
  const cx = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: 'root', password: '', dateStrings: true,
  });

  console.log('='.repeat(76));
  console.log('ESTUDO DE INDICES — plano e tempo, antes e depois');
  console.log('='.repeat(76));
  const [volumes] = await cx.execute(
    `SELECT table_name AS tabela, table_rows AS linhas
       FROM information_schema.tables
      WHERE table_schema = ? AND table_type = 'BASE TABLE'
      ORDER BY table_rows DESC LIMIT 6`, [process.env.DB_NAME]);
  console.log('volume aproximado das maiores tabelas:');
  volumes.forEach((v) => console.log(`  ${String(v.tabela).padEnd(26)} ~${v.linhas} linhas`));
  console.log(`medicao: mediana de ${REPETICOES} execucoes, apos 10 execucoes de aquecimento\n`);

  const resumo = [];
  for (const caso of CASOS) {
    console.log('-'.repeat(76));
    console.log(caso.nome);
    console.log('-'.repeat(76));
    console.log(`por que importa: ${caso.porque}\n`);

    for (const cmd of [].concat(caso.remover)) await cx.query(cmd).catch(() => {});  // garante o estado inicial

    console.log('  PLANO ANTES');
    console.log(await plano(cx, caso.sql, caso.params));
    const antes = await medir(cx, caso.sql, caso.params);
    console.log(`  TEMPO ANTES  mediana ${antes.mediana.toFixed(3)}ms  (min ${antes.min.toFixed(3)} / max ${antes.max.toFixed(3)})\n`);

    for (const cmd of [].concat(caso.indice)) console.log('  ' + cmd);
    console.log(`  justificativa: ${caso.justificativa}\n`);
    for (const cmd of [].concat(caso.indice)) await cx.query(cmd);
    await cx.query(`ANALYZE TABLE ${[].concat(caso.indice)[0].match(/ON (\w+)/)[1]}`);

    console.log('  PLANO DEPOIS');
    console.log(await plano(cx, caso.sql, caso.params));
    const depois = await medir(cx, caso.sql, caso.params);
    console.log(`  TEMPO DEPOIS mediana ${depois.mediana.toFixed(3)}ms  (min ${depois.min.toFixed(3)} / max ${depois.max.toFixed(3)})`);

    const variacao = ((antes.mediana - depois.mediana) / antes.mediana) * 100;
    const veredito = variacao > 15 ? 'GANHO' : variacao < -15 ? 'PIOROU' : 'SEM DIFERENCA RELEVANTE';
    console.log(`  VEREDITO: ${veredito} (${variacao >= 0 ? '-' : '+'}${Math.abs(variacao).toFixed(1)}% no tempo)\n`);
    resumo.push({ nome: caso.nome, antes: antes.mediana, depois: depois.mediana, variacao, veredito });
  }

  console.log('='.repeat(76));
  console.log('RESUMO');
  console.log('='.repeat(76));
  resumo.forEach((r) => console.log(
    `${r.nome.padEnd(46)} ${r.antes.toFixed(3)}ms -> ${r.depois.toFixed(3)}ms   ${r.veredito}`));
  console.log('\nOs indices criados aqui permanecem no banco. Para deixa-los definitivos no');
  console.log('repositorio, eles estao em sql/07_indices.sql — menos o que nao se justificou.\n');

  await cx.end();
})().catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
