// Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)
// Etapa 2 — aplicacao web sobre o banco escola_ucb.
//
//   node server.js        (depois de copiar .env.example para .env)
'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');

const config = require('./src/config');
const db = require('./src/db');
const { traduzir } = require('./src/erros');
const { exigirLogin, exigirPerfil, autenticar } = require('./src/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 },
}));

// Recado de uma requisicao para a seguinte (padrao "flash"), usado
// depois dos redirects de gravacao.
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.aviso = req.session.aviso || null;
  res.locals.erro = req.session.erroFlash || null;
  delete req.session.aviso;
  delete req.session.erroFlash;
  next();
});

// --- login ------------------------------------------------------------
app.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/');
  res.render('login', { titulo: 'Entrar', erro: res.locals.erro });
});

app.post('/login', async (req, res, next) => {
  try {
    const usuario = await autenticar(req.body.login, req.body.senha);
    if (!usuario) {
      req.session.erroFlash = 'Login ou senha invalidos.';
      return res.redirect('/login');
    }
    req.session.usuario = usuario;
    res.redirect('/');
  } catch (e) { next(e); }
});

app.post('/sair', (req, res) => req.session.destroy(() => res.redirect('/login')));

// --- painel -----------------------------------------------------------
app.get('/', exigirLogin, async (req, res, next) => {
  try {
    const u = req.session.usuario;
    // O perfil CONSULTA nao tem privilegio em tabela base: o painel dele
    // sai da visao.
    const numeros = u.perfil === 'CONSULTA'
      ? await db.consultar(u.pool, u.login,
          `SELECT 'Alunos com matricula ativa' AS rotulo, COUNT(*) AS valor
             FROM vw_aluno_publico WHERE turma_atual IS NOT NULL`)
      : await db.consultar(u.pool, u.login,
          `SELECT 'Alunos' AS rotulo, COUNT(*) AS valor FROM aluno
           UNION ALL SELECT 'Professores', COUNT(*) FROM professor
           UNION ALL SELECT 'Turmas', COUNT(*) FROM turma
           UNION ALL SELECT 'Disciplinas', COUNT(*) FROM disciplina
           UNION ALL SELECT 'Matriculas ativas', COUNT(*) FROM matricula WHERE situacao = 'ATIVA'
           UNION ALL SELECT 'Notas lancadas', COUNT(*) FROM nota WHERE valor IS NOT NULL`);
    res.render('painel', { titulo: 'Painel', numeros });
  } catch (e) { next(e); }
});

// --- modulos ----------------------------------------------------------
app.use('/cadastros', exigirLogin, require('./src/rotas/cadastros'));
app.use('/consultas', exigirLogin, require('./src/rotas/consultas'));
app.use('/relatorio', exigirLogin, require('./src/rotas/relatorio'));
app.use('/matricular', exigirLogin, exigirPerfil('SECRETARIA'), require('./src/rotas/matricula'));
app.use('/auditoria', exigirLogin, exigirPerfil('SECRETARIA'), require('./src/rotas/auditoria'));

// --- 404 --------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('erro', {
    titulo: 'Pagina nao encontrada',
    mensagem: `Nao existe nada em ${req.originalUrl}.`,
  });
});

// --- tratamento de erro ----------------------------------------------
// Ponto unico por onde passa toda falha. O usuario recebe a frase
// traduzida; o SQL cru fica no log do servidor.
app.use((erro, req, res, _next) => {
  const { mensagem, detalhe, status } = traduzir(erro);
  console.error(`[${status}] ${req.method} ${req.originalUrl} -> ${detalhe}`);
  res.status(status).render('erro', { titulo: 'Nao deu certo', mensagem });
});

if (require.main === module) {
  const servidor = app.listen(config.porta, () => {
    console.log(`Aplicacao no ar: http://localhost:${config.porta}`);
    console.log(`Banco: ${config.conexoes.AUTH.host}:${config.conexoes.AUTH.port}/${config.nomeBanco}`);
  });
  const parar = async () => { await db.encerrar(); servidor.close(() => process.exit(0)); };
  process.on('SIGINT', parar);
  process.on('SIGTERM', parar);
}

module.exports = app;
