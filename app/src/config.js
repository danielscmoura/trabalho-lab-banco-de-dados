// Leitura da configuracao. Nenhuma credencial mora no codigo-fonte:
// tudo vem do ambiente (.env, nao versionado). Se faltar variavel, o
// processo morre no boot com a lista do que falta — melhor do que subir
// e falhar na primeira consulta.
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OBRIGATORIAS = [
  'SESSION_SECRET',
  'DB_HOST', 'DB_PORT', 'DB_NAME',
  'DB_AUTH_USER', 'DB_AUTH_PASSWORD',
  'DB_SECRETARIA_USER', 'DB_SECRETARIA_PASSWORD',
  'DB_PROFESSOR_USER', 'DB_PROFESSOR_PASSWORD',
  'DB_CONSULTA_USER', 'DB_CONSULTA_PASSWORD',
];

const faltando = OBRIGATORIAS.filter((v) => !process.env[v]);
if (faltando.length) {
  console.error('\nFaltam variaveis de ambiente:\n  ' + faltando.join('\n  '));
  console.error('\nCopie app/.env.example para app/.env e preencha.\n');
  process.exit(1);
}

const base = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4',
  // datas como string 'YYYY-MM-DD': evita o fuso do Node deslocar um dia
  dateStrings: true,
};

module.exports = {
  porta: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET,
  nomeBanco: process.env.DB_NAME,
  // Um conjunto de credenciais por perfil. O mapa perfil -> pool fica
  // em db.js; aqui so as credenciais.
  conexoes: {
    AUTH:       { ...base, user: process.env.DB_AUTH_USER,       password: process.env.DB_AUTH_PASSWORD },
    SECRETARIA: { ...base, user: process.env.DB_SECRETARIA_USER, password: process.env.DB_SECRETARIA_PASSWORD },
    PROFESSOR:  { ...base, user: process.env.DB_PROFESSOR_USER,  password: process.env.DB_PROFESSOR_PASSWORD },
    CONSULTA:   { ...base, user: process.env.DB_CONSULTA_USER,   password: process.env.DB_CONSULTA_PASSWORD },
  },
};
