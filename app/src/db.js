// Acesso ao banco.
//
// Duas regras que valem para o arquivo inteiro:
//
//  1. Toda instrucao passa por conn.execute(sql, parametros), que usa
//     prepared statement de verdade no protocolo do MySQL. Nao existe
//     neste projeto uma unica consulta montada por concatenacao de
//     string — o valor digitado pelo usuario viaja fora do texto SQL e
//     nunca e interpretado como comando.
//
//  2. Cada perfil de acesso tem o seu proprio pool, com o seu proprio
//     usuario MySQL. A secretaria e o professor nao usam a mesma
//     conexao com privilegios diferentes: sao conexoes diferentes.
'use strict';
const mysql = require('mysql2/promise');
const config = require('./config');

const pools = new Map();

function pool(perfil) {
  if (!config.conexoes[perfil]) throw new Error(`Perfil desconhecido: ${perfil}`);
  if (!pools.has(perfil)) pools.set(perfil, mysql.createPool(config.conexoes[perfil]));
  return pools.get(perfil);
}

// Pega uma conexao do pool do perfil, carimba quem e o usuario da
// aplicacao (os gatilhos de auditoria leem @app_usuario) e devolve a
// conexao ao pool no fim, aconteca o que acontecer.
async function comConexao(perfil, usuarioApp, fn) {
  const conn = await pool(perfil).getConnection();
  try {
    await conn.execute('SET @app_usuario = ?', [usuarioApp || 'anonimo']);
    return await fn(conn);
  } finally {
    conn.release();
  }
}

// Consulta avulsa. `parametros` nunca entra no texto do SQL.
async function consultar(perfil, usuarioApp, sql, parametros = []) {
  return comConexao(perfil, usuarioApp, async (conn) => {
    const [linhas] = await conn.execute(sql, parametros);
    return linhas;
  });
}

async function consultarUm(perfil, usuarioApp, sql, parametros = []) {
  const linhas = await consultar(perfil, usuarioApp, sql, parametros);
  return linhas[0] || null;
}

// Comando que altera dados; devolve o ResultSetHeader (insertId,
// affectedRows).
async function executar(perfil, usuarioApp, sql, parametros = []) {
  return comConexao(perfil, usuarioApp, async (conn) => {
    const [resultado] = await conn.execute(sql, parametros);
    return resultado;
  });
}

// Transacao explicita. O callback recebe a conexao e faz varios
// comandos; qualquer excecao dispara ROLLBACK e e repassada para cima.
// Nao ha COMMIT implicito em lugar nenhum: ou o callback termina
// inteiro, ou nada do que ele fez permanece.
async function transacao(perfil, usuarioApp, fn) {
  return comConexao(perfil, usuarioApp, async (conn) => {
    await conn.beginTransaction();
    try {
      const resultado = await fn(conn);
      await conn.commit();
      return resultado;
    } catch (erro) {
      await conn.rollback();
      throw erro;
    }
  });
}

async function encerrar() {
  for (const p of pools.values()) await p.end();
  pools.clear();
}

module.exports = { pool, comConexao, consultar, consultarUm, executar, transacao, encerrar };
