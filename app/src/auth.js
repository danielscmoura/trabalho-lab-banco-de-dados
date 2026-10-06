// Autenticacao da aplicacao.
//
// A verificacao da senha usa o pool AUTH, que no MySQL so enxerga as
// colunas de login de usuario_app — nem aluno, nem nota, nem nada. Se
// este trecho tiver um bug, o estrago possivel e pequeno por construcao.
//
// A senha e comparada com bcrypt: o hash guardado ja carrega o sal e o
// custo. Nunca se compara texto com texto, e o banco nunca viu a senha.
'use strict';
const bcrypt = require('bcryptjs');
const db = require('./db');

// Mapeia o perfil da conta no perfil de conexao com o banco. E aqui que
// "quem voce e" vira "o que a sua conexao pode fazer".
const POOL_DO_PERFIL = {
  SECRETARIA: 'SECRETARIA',
  PROFESSOR: 'PROFESSOR',
  CONSULTA: 'CONSULTA',
};

async function autenticar(login, senha) {
  if (!login || !senha) return null;

  const usuario = await db.consultarUm(
    'AUTH', 'login',
    `SELECT id_usuario, login, nome_exibicao, senha_hash, perfil, id_pessoa, ativo
       FROM usuario_app
      WHERE login = ?`,
    [login]
  );

  // Compara o hash mesmo quando o login nao existe, com um hash
  // descartavel, para que a resposta demore o mesmo tanto nos dois
  // casos. Sem isso, o tempo de resposta diria se o login existe.
  const hash = usuario ? usuario.senha_hash : '$2b$10$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalido12';
  const confere = await bcrypt.compare(senha, hash);

  if (!usuario || !confere || !usuario.ativo) return null;

  await db.executar('AUTH', login,
    'UPDATE usuario_app SET ultimo_acesso = NOW() WHERE id_usuario = ?', [usuario.id_usuario]);

  return {
    id: usuario.id_usuario,
    login: usuario.login,
    nome: usuario.nome_exibicao,
    perfil: usuario.perfil,
    idPessoa: usuario.id_pessoa,
    pool: POOL_DO_PERFIL[usuario.perfil],
  };
}

// --- middlewares ------------------------------------------------------

function exigirLogin(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  next();
}

// Restringe uma rota a determinados perfis. A interface tambem esconde
// o que o perfil nao pode fazer, mas a checagem de verdade e esta — e,
// abaixo dela, o GRANT no proprio banco.
function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.session.usuario) return res.redirect('/login');
    if (!perfis.includes(req.session.usuario.perfil)) {
      return res.status(403).render('erro', {
        usuario: req.session.usuario,
        titulo: 'Acesso negado',
        mensagem: `Esta tela e restrita ao perfil ${perfis.join(' ou ')}. Voce esta como ${req.session.usuario.perfil}.`,
      });
    }
    next();
  };
}

module.exports = { autenticar, exigirLogin, exigirPerfil };
