// Leitura da trilha de auditoria gravada pelos gatilhos de
// sql/05_auditoria.sql.
//
// A secretaria tem SELECT em `auditoria`, mas nao tem INSERT, UPDATE
// nem DELETE — o REVOKE esta explicito no script de perfis. Quem grava
// aqui sao os gatilhos, com o privilegio do DEFINER. Ou seja: a
// aplicacao produz a trilha e nao consegue apaga-la, que e a unica
// forma de a trilha valer alguma coisa.
'use strict';
const express = require('express');
const db = require('../db');

const router = express.Router();
const ouNulo = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

const SQL = `
SELECT id_auditoria, tabela, operacao, chave_registro, campo,
       valor_anterior, valor_novo, usuario_app, usuario_banco, ocorrido_em
  FROM auditoria
 WHERE (? IS NULL OR tabela      = ?)
   AND (? IS NULL OR usuario_app = ?)
 ORDER BY id_auditoria DESC
 LIMIT 300`;

router.get('/', async (req, res, next) => {
  try {
    const u = req.session.usuario;
    const f = { tabela: ouNulo(req.query.tabela), usuario: ouNulo(req.query.usuario) };
    const linhas = await db.consultar(u.pool, u.login, SQL, [f.tabela, f.tabela, f.usuario, f.usuario]);
    res.render('auditoria', { titulo: 'Trilha de auditoria', f, linhas });
  } catch (e) { next(e); }
});

module.exports = router;
