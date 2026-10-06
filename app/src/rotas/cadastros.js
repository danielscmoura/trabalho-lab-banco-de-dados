// CRUD de quatro entidades: aluno, professor, turma e disciplina.
//
// O SQL de cada entidade esta escrito por extenso, com '?' em todo
// valor que vem do usuario. O que a fabrica `montar` compartilha e
// apenas o encanamento HTTP (listar / formulario / gravar / excluir),
// nunca a montagem da consulta.
//
// ALUNO e PROFESSOR gravam em duas tabelas — pessoa e a subclasse —
// porque a especializacao foi mapeada em tabela por subclasse na
// Etapa 1. Os dois usam transacao: uma pessoa sem a linha
// correspondente em aluno seria um registro orfao, proibido pela RN03.
'use strict';
const express = require('express');
const db = require('../db');
const { exigirPerfil } = require('../auth');

const router = express.Router();

// '' vindo de <input> vazio significa "nao informado", nao string vazia.
const ouNulo = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const numOuNulo = (v) => (ouNulo(v) === null ? null : Number(v));
const bool = (v) => (v === 'on' || v === 'true' || v === '1' || v === true);

// =====================================================================
// Definicao de cada entidade
// =====================================================================
const ENTIDADES = {};

// --- 1. ALUNO ---------------------------------------------------------
ENTIDADES.alunos = {
  titulo: 'Alunos', chave: 'id_pessoa',
  singular: 'aluno',
  colunasLista: [
    { campo: 'matricula', rotulo: 'Matricula' },
    { campo: 'nome', rotulo: 'Nome' },
    { campo: 'data_nascimento', rotulo: 'Nascimento' },
    { campo: 'data_ingresso', rotulo: 'Ingresso' },
    { campo: 'bolsa', rotulo: 'Bolsa' },
  ],
  listar: (conn, busca) => conn.execute(
    `SELECT a.id_pessoa, a.matricula, p.nome, p.data_nascimento, a.data_ingresso,
            CASE WHEN a.bolsista THEN CONCAT(a.percentual_bolsa, '%') ELSE '--' END AS bolsa
       FROM aluno a
       JOIN pessoa p ON p.id_pessoa = a.id_pessoa
      WHERE (? IS NULL OR p.nome LIKE CONCAT('%', ?, '%') OR a.matricula LIKE CONCAT('%', ?, '%'))
      ORDER BY p.nome
      LIMIT 200`,
    [busca, busca, busca]).then(([r]) => r),
  obter: (conn, id) => conn.execute(
    `SELECT a.id_pessoa, a.matricula, a.data_ingresso, a.bolsista, a.percentual_bolsa,
            a.observacao, p.cpf, p.nome, p.data_nascimento, p.sexo, p.email, p.telefone,
            p.end_logradouro, p.end_numero, p.end_bairro, p.end_cidade, p.end_uf, p.end_cep
       FROM aluno a JOIN pessoa p ON p.id_pessoa = a.id_pessoa
      WHERE a.id_pessoa = ?`, [id]).then(([r]) => r[0] || null),
  campos: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'text', obrigatorio: true },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'text', obrigatorio: true, ajuda: '11 digitos, so numeros' },
    { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', obrigatorio: true },
    { nome: 'sexo', rotulo: 'Sexo', tipo: 'select', opcoes: [['', '--'], ['F', 'F'], ['M', 'M'], ['N', 'Nao informado']] },
    { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'text' },
    { nome: 'matricula', rotulo: 'Matricula academica', tipo: 'text', obrigatorio: true },
    { nome: 'data_ingresso', rotulo: 'Data de ingresso', tipo: 'date', obrigatorio: true },
    { nome: 'bolsista', rotulo: 'Bolsista', tipo: 'checkbox' },
    { nome: 'percentual_bolsa', rotulo: 'Percentual da bolsa', tipo: 'number', ajuda: 'Só para bolsista; entre 0 e 100' },
    { nome: 'end_logradouro', rotulo: 'Logradouro', tipo: 'text' },
    { nome: 'end_numero', rotulo: 'Numero', tipo: 'text' },
    { nome: 'end_bairro', rotulo: 'Bairro', tipo: 'text' },
    { nome: 'end_cidade', rotulo: 'Cidade', tipo: 'text' },
    { nome: 'end_uf', rotulo: 'UF', tipo: 'text', ajuda: 'Duas letras maiusculas' },
    { nome: 'end_cep', rotulo: 'CEP', tipo: 'text', ajuda: '8 digitos' },
    { nome: 'observacao', rotulo: 'Observacao', tipo: 'text' },
  ],
  // Duas tabelas, uma transacao.
  inserir: async (conn, c) => {
    const [p] = await conn.execute(
      `INSERT INTO pessoa (cpf, nome, data_nascimento, sexo, email, telefone,
                           end_logradouro, end_numero, end_bairro, end_cidade, end_uf, end_cep, tipo_pessoa)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ALUNO')`,
      [ouNulo(c.cpf), ouNulo(c.nome), ouNulo(c.data_nascimento), ouNulo(c.sexo), ouNulo(c.email),
       ouNulo(c.telefone), ouNulo(c.end_logradouro), ouNulo(c.end_numero), ouNulo(c.end_bairro),
       ouNulo(c.end_cidade), ouNulo(c.end_uf), ouNulo(c.end_cep)]);
    const ehBolsista = bool(c.bolsista);
    await conn.execute(
      `INSERT INTO aluno (id_pessoa, matricula, data_ingresso, bolsista, percentual_bolsa, observacao)
       VALUES (?,?,?,?,?,?)`,
      [p.insertId, ouNulo(c.matricula), ouNulo(c.data_ingresso), ehBolsista,
       ehBolsista ? numOuNulo(c.percentual_bolsa) : null, ouNulo(c.observacao)]);
    return p.insertId;
  },
  atualizar: async (conn, id, c) => {
    await conn.execute(
      `UPDATE pessoa SET cpf=?, nome=?, data_nascimento=?, sexo=?, email=?, telefone=?,
              end_logradouro=?, end_numero=?, end_bairro=?, end_cidade=?, end_uf=?, end_cep=?
        WHERE id_pessoa=?`,
      [ouNulo(c.cpf), ouNulo(c.nome), ouNulo(c.data_nascimento), ouNulo(c.sexo), ouNulo(c.email),
       ouNulo(c.telefone), ouNulo(c.end_logradouro), ouNulo(c.end_numero), ouNulo(c.end_bairro),
       ouNulo(c.end_cidade), ouNulo(c.end_uf), ouNulo(c.end_cep), id]);
    const ehBolsista = bool(c.bolsista);
    await conn.execute(
      `UPDATE aluno SET matricula=?, data_ingresso=?, bolsista=?, percentual_bolsa=?, observacao=?
        WHERE id_pessoa=?`,
      [ouNulo(c.matricula), ouNulo(c.data_ingresso), ehBolsista,
       ehBolsista ? numOuNulo(c.percentual_bolsa) : null, ouNulo(c.observacao), id]);
  },
  // ON DELETE CASCADE de aluno -> pessoa faz o resto; se houver
  // matricula, fk_matricula_aluno (RESTRICT) barra, e erros.js traduz.
  excluir: (conn, id) => conn.execute('DELETE FROM pessoa WHERE id_pessoa = ?', [id]),
};

// --- 2. PROFESSOR -----------------------------------------------------
ENTIDADES.professores = {
  titulo: 'Professores', chave: 'id_pessoa',
  singular: 'professor',
  colunasLista: [
    { campo: 'registro_funcional', rotulo: 'Registro' },
    { campo: 'nome', rotulo: 'Nome' },
    { campo: 'titulacao', rotulo: 'Titulacao' },
    { campo: 'data_admissao', rotulo: 'Admissao' },
    { campo: 'situacao', rotulo: 'Situacao' },
  ],
  listar: (conn, busca) => conn.execute(
    `SELECT pr.id_pessoa, pr.registro_funcional, p.nome, pr.titulacao, pr.data_admissao,
            CASE WHEN pr.data_desligamento IS NULL THEN 'Ativo'
                 ELSE CONCAT('Desligado em ', pr.data_desligamento) END AS situacao
       FROM professor pr
       JOIN pessoa p ON p.id_pessoa = pr.id_pessoa
      WHERE (? IS NULL OR p.nome LIKE CONCAT('%', ?, '%') OR pr.registro_funcional LIKE CONCAT('%', ?, '%'))
      ORDER BY p.nome
      LIMIT 200`,
    [busca, busca, busca]).then(([r]) => r),
  obter: (conn, id) => conn.execute(
    `SELECT pr.id_pessoa, pr.registro_funcional, pr.titulacao, pr.data_admissao,
            pr.data_desligamento, pr.id_coordenador, p.cpf, p.nome, p.data_nascimento,
            p.sexo, p.email, p.telefone
       FROM professor pr JOIN pessoa p ON p.id_pessoa = pr.id_pessoa
      WHERE pr.id_pessoa = ?`, [id]).then(([r]) => r[0] || null),
  opcoes: async (conn) => ({
    id_coordenador: [['', '-- sem coordenador --']].concat(
      (await conn.execute(
        `SELECT pr.id_pessoa, p.nome FROM professor pr
           JOIN pessoa p ON p.id_pessoa = pr.id_pessoa
          WHERE pr.data_desligamento IS NULL ORDER BY p.nome`))[0]
        .map((r) => [String(r.id_pessoa), r.nome])),
  }),
  campos: [
    { nome: 'nome', rotulo: 'Nome completo', tipo: 'text', obrigatorio: true },
    { nome: 'cpf', rotulo: 'CPF', tipo: 'text', obrigatorio: true, ajuda: '11 digitos, so numeros' },
    { nome: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'date', obrigatorio: true },
    { nome: 'sexo', rotulo: 'Sexo', tipo: 'select', opcoes: [['', '--'], ['F', 'F'], ['M', 'M'], ['N', 'Nao informado']] },
    { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'text' },
    { nome: 'registro_funcional', rotulo: 'Registro funcional', tipo: 'text', obrigatorio: true },
    { nome: 'titulacao', rotulo: 'Titulacao', tipo: 'select', obrigatorio: true,
      opcoes: [['GRADUACAO', 'Graduacao'], ['ESPECIALIZACAO', 'Especializacao'], ['MESTRADO', 'Mestrado'], ['DOUTORADO', 'Doutorado']] },
    { nome: 'data_admissao', rotulo: 'Data de admissao', tipo: 'date', obrigatorio: true },
    { nome: 'data_desligamento', rotulo: 'Data de desligamento', tipo: 'date', ajuda: 'Em branco enquanto ativo' },
    { nome: 'id_coordenador', rotulo: 'Coordenador de area', tipo: 'select', dinamico: true },
  ],
  inserir: async (conn, c) => {
    const [p] = await conn.execute(
      `INSERT INTO pessoa (cpf, nome, data_nascimento, sexo, email, telefone, tipo_pessoa)
       VALUES (?,?,?,?,?,?, 'PROFESSOR')`,
      [ouNulo(c.cpf), ouNulo(c.nome), ouNulo(c.data_nascimento), ouNulo(c.sexo),
       ouNulo(c.email), ouNulo(c.telefone)]);
    await conn.execute(
      `INSERT INTO professor (id_pessoa, registro_funcional, titulacao, data_admissao, data_desligamento, id_coordenador)
       VALUES (?,?,?,?,?,?)`,
      [p.insertId, ouNulo(c.registro_funcional), ouNulo(c.titulacao), ouNulo(c.data_admissao),
       ouNulo(c.data_desligamento), numOuNulo(c.id_coordenador)]);
    return p.insertId;
  },
  atualizar: async (conn, id, c) => {
    await conn.execute(
      `UPDATE pessoa SET cpf=?, nome=?, data_nascimento=?, sexo=?, email=?, telefone=? WHERE id_pessoa=?`,
      [ouNulo(c.cpf), ouNulo(c.nome), ouNulo(c.data_nascimento), ouNulo(c.sexo),
       ouNulo(c.email), ouNulo(c.telefone), id]);
    // RN08 (ninguem coordena a si mesmo) e garantida pelo gatilho
    // trg_professor_autocoord_bu; se vier id igual, o banco recusa e a
    // mensagem do SIGNAL chega a tela.
    await conn.execute(
      `UPDATE professor SET registro_funcional=?, titulacao=?, data_admissao=?,
              data_desligamento=?, id_coordenador=? WHERE id_pessoa=?`,
      [ouNulo(c.registro_funcional), ouNulo(c.titulacao), ouNulo(c.data_admissao),
       ouNulo(c.data_desligamento), numOuNulo(c.id_coordenador), id]);
  },
  excluir: (conn, id) => conn.execute('DELETE FROM pessoa WHERE id_pessoa = ?', [id]),
};

// --- 3. TURMA ---------------------------------------------------------
ENTIDADES.turmas = {
  titulo: 'Turmas', chave: 'id_turma',
  singular: 'turma',
  colunasLista: [
    { campo: 'codigo', rotulo: 'Codigo' },
    { campo: 'ano', rotulo: 'Ano letivo' },
    { campo: 'serie', rotulo: 'Serie' },
    { campo: 'turno', rotulo: 'Turno' },
    { campo: 'ocupacao', rotulo: 'Ocupacao' },
    { campo: 'regente', rotulo: 'Regente' },
  ],
  listar: (conn, busca) => conn.execute(
    `SELECT t.id_turma, t.codigo, anl.ano, t.serie, t.turno,
            CONCAT(COUNT(CASE WHEN m.situacao = 'ATIVA' THEN 1 END), ' / ', t.capacidade) AS ocupacao,
            COALESCE(p.nome, '-- sem regente --') AS regente
       FROM turma t
       JOIN ano_letivo anl ON anl.id_ano_letivo = t.id_ano_letivo
       LEFT JOIN pessoa p    ON p.id_pessoa = t.id_professor_regente
       LEFT JOIN matricula m ON m.id_turma = t.id_turma
      WHERE (? IS NULL OR t.codigo LIKE CONCAT('%', ?, '%'))
      GROUP BY t.id_turma, t.codigo, anl.ano, t.serie, t.turno, t.capacidade, p.nome
      ORDER BY anl.ano DESC, t.codigo
      LIMIT 200`,
    [busca, busca]).then(([r]) => r),
  obter: (conn, id) => conn.execute(
    `SELECT id_turma, id_ano_letivo, codigo, serie, turno, sala, capacidade, id_professor_regente
       FROM turma WHERE id_turma = ?`, [id]).then(([r]) => r[0] || null),
  opcoes: async (conn) => ({
    id_ano_letivo: (await conn.execute('SELECT id_ano_letivo, ano FROM ano_letivo ORDER BY ano DESC'))[0]
      .map((r) => [String(r.id_ano_letivo), String(r.ano)]),
    id_professor_regente: [['', '-- sem regente --']].concat(
      (await conn.execute(
        `SELECT pr.id_pessoa, p.nome FROM professor pr
           JOIN pessoa p ON p.id_pessoa = pr.id_pessoa
          WHERE pr.data_desligamento IS NULL ORDER BY p.nome`))[0]
        .map((r) => [String(r.id_pessoa), r.nome])),
  }),
  campos: [
    { nome: 'id_ano_letivo', rotulo: 'Ano letivo', tipo: 'select', obrigatorio: true, dinamico: true },
    { nome: 'codigo', rotulo: 'Codigo da turma', tipo: 'text', obrigatorio: true, ajuda: 'Unico dentro do ano letivo' },
    { nome: 'serie', rotulo: 'Serie', tipo: 'select', obrigatorio: true,
      opcoes: [['6ANO', '6o ano'], ['7ANO', '7o ano'], ['8ANO', '8o ano'], ['9ANO', '9o ano'], ['1EM', '1o EM']] },
    { nome: 'turno', rotulo: 'Turno', tipo: 'select', obrigatorio: true,
      opcoes: [['MATUTINO', 'Matutino'], ['VESPERTINO', 'Vespertino']] },
    { nome: 'sala', rotulo: 'Sala', tipo: 'text' },
    { nome: 'capacidade', rotulo: 'Capacidade', tipo: 'number', obrigatorio: true, ajuda: 'Entre 5 e 45' },
    { nome: 'id_professor_regente', rotulo: 'Professor regente', tipo: 'select', dinamico: true },
  ],
  inserir: async (conn, c) => {
    const [r] = await conn.execute(
      `INSERT INTO turma (id_ano_letivo, codigo, serie, turno, sala, capacidade, id_professor_regente)
       VALUES (?,?,?,?,?,?,?)`,
      [numOuNulo(c.id_ano_letivo), ouNulo(c.codigo), ouNulo(c.serie), ouNulo(c.turno),
       ouNulo(c.sala), numOuNulo(c.capacidade), numOuNulo(c.id_professor_regente)]);
    return r.insertId;
  },
  atualizar: (conn, id, c) => conn.execute(
    `UPDATE turma SET id_ano_letivo=?, codigo=?, serie=?, turno=?, sala=?, capacidade=?, id_professor_regente=?
      WHERE id_turma=?`,
    [numOuNulo(c.id_ano_letivo), ouNulo(c.codigo), ouNulo(c.serie), ouNulo(c.turno),
     ouNulo(c.sala), numOuNulo(c.capacidade), numOuNulo(c.id_professor_regente), id]),
  excluir: (conn, id) => conn.execute('DELETE FROM turma WHERE id_turma = ?', [id]),
};

// --- 4. DISCIPLINA ----------------------------------------------------
ENTIDADES.disciplinas = {
  titulo: 'Disciplinas', chave: 'id_disciplina',
  singular: 'disciplina',
  colunasLista: [
    { campo: 'codigo', rotulo: 'Codigo' },
    { campo: 'nome', rotulo: 'Nome' },
    { campo: 'serie', rotulo: 'Serie' },
    { campo: 'carga_horaria_anual', rotulo: 'Carga anual' },
    { campo: 'turmas_ofertando', rotulo: 'Turmas' },
    { campo: 'estado', rotulo: 'Estado' },
  ],
  listar: (conn, busca) => conn.execute(
    `SELECT d.id_disciplina, d.codigo, d.nome, d.serie, d.carga_horaria_anual,
            COUNT(a.id_alocacao) AS turmas_ofertando,
            CASE WHEN d.ativa THEN 'Ativa' ELSE 'Inativa' END AS estado
       FROM disciplina d
       LEFT JOIN alocacao a ON a.id_disciplina = d.id_disciplina
      WHERE (? IS NULL OR d.nome LIKE CONCAT('%', ?, '%') OR d.codigo LIKE CONCAT('%', ?, '%'))
      GROUP BY d.id_disciplina, d.codigo, d.nome, d.serie, d.carga_horaria_anual, d.ativa
      ORDER BY d.serie, d.nome
      LIMIT 200`,
    [busca, busca, busca]).then(([r]) => r),
  obter: (conn, id) => conn.execute(
    `SELECT id_disciplina, codigo, nome, serie, carga_horaria_anual, ementa, ativa
       FROM disciplina WHERE id_disciplina = ?`, [id]).then(([r]) => r[0] || null),
  campos: [
    { nome: 'codigo', rotulo: 'Codigo', tipo: 'text', obrigatorio: true },
    { nome: 'nome', rotulo: 'Nome', tipo: 'text', obrigatorio: true, ajuda: 'Nao se repete dentro da mesma serie' },
    { nome: 'serie', rotulo: 'Serie', tipo: 'select', obrigatorio: true,
      opcoes: [['6ANO', '6o ano'], ['7ANO', '7o ano'], ['8ANO', '8o ano'], ['9ANO', '9o ano'], ['1EM', '1o EM']] },
    { nome: 'carga_horaria_anual', rotulo: 'Carga horaria anual', tipo: 'number', obrigatorio: true, ajuda: 'Entre 20 e 400' },
    { nome: 'ementa', rotulo: 'Ementa', tipo: 'textarea' },
    { nome: 'ativa', rotulo: 'Ativa', tipo: 'checkbox' },
  ],
  inserir: async (conn, c) => {
    const [r] = await conn.execute(
      `INSERT INTO disciplina (codigo, nome, serie, carga_horaria_anual, ementa, ativa)
       VALUES (?,?,?,?,?,?)`,
      [ouNulo(c.codigo), ouNulo(c.nome), ouNulo(c.serie), numOuNulo(c.carga_horaria_anual),
       ouNulo(c.ementa), bool(c.ativa)]);
    return r.insertId;
  },
  atualizar: (conn, id, c) => conn.execute(
    `UPDATE disciplina SET codigo=?, nome=?, serie=?, carga_horaria_anual=?, ementa=?, ativa=?
      WHERE id_disciplina=?`,
    [ouNulo(c.codigo), ouNulo(c.nome), ouNulo(c.serie), numOuNulo(c.carga_horaria_anual),
     ouNulo(c.ementa), bool(c.ativa), id]),
  excluir: (conn, id) => conn.execute('DELETE FROM disciplina WHERE id_disciplina = ?', [id]),
};

// =====================================================================
// Encanamento HTTP, igual para as quatro entidades
// =====================================================================
const soLeitura = exigirPerfil('SECRETARIA', 'PROFESSOR');
const podeGravar = exigirPerfil('SECRETARIA');

for (const [slug, ent] of Object.entries(ENTIDADES)) {
  // listar
  router.get(`/${slug}`, soLeitura, async (req, res, next) => {
    try {
      const u = req.session.usuario;
      const busca = ouNulo(req.query.busca);
      const linhas = await db.comConexao(u.pool, u.login, (conn) => ent.listar(conn, busca));
      res.render('lista', { titulo: ent.titulo, slug, ent, linhas, busca: busca || '' });
    } catch (e) { next(e); }
  });

  // formulario de inclusao
  router.get(`/${slug}/novo`, podeGravar, async (req, res, next) => {
    try {
      const u = req.session.usuario;
      const opcoes = ent.opcoes ? await db.comConexao(u.pool, u.login, ent.opcoes) : {};
      res.render('formulario', { titulo: `Novo ${ent.singular}`, slug, ent, registro: {}, opcoes, id: null });
    } catch (e) { next(e); }
  });

  // formulario de edicao
  router.get(`/${slug}/:id/editar`, podeGravar, async (req, res, next) => {
    try {
      const u = req.session.usuario;
      const { registro, opcoes } = await db.comConexao(u.pool, u.login, async (conn) => ({
        registro: await ent.obter(conn, req.params.id),
        opcoes: ent.opcoes ? await ent.opcoes(conn) : {},
      }));
      if (!registro) return res.status(404).render('erro', { titulo: 'Nao encontrado', mensagem: `Nenhum ${ent.singular} com id ${req.params.id}.` });
      res.render('formulario', { titulo: `Editar ${ent.singular}`, slug, ent, registro, opcoes, id: req.params.id });
    } catch (e) { next(e); }
  });

  // gravar (inclusao ou alteracao). O Express 5 nao aceita mais
  // parametro opcional na rota (`/:id?`), entao sao dois caminhos para
  // o mesmo handler.
  const gravar = async (req, res, next) => {
    try {
      const u = req.session.usuario;
      const id = req.params.id || null;
      await db.transacao(u.pool, u.login, async (conn) => {
        if (id) await ent.atualizar(conn, id, req.body);
        else await ent.inserir(conn, req.body);
      });
      req.session.aviso = id ? `${ent.titulo}: registro atualizado.` : `${ent.titulo}: registro incluido.`;
      res.redirect(`/cadastros/${slug}`);
    } catch (e) { next(e); }
  };
  router.post(`/${slug}`, podeGravar, gravar);
  router.post(`/${slug}/:id`, podeGravar, gravar);

  // excluir
  router.post(`/${slug}/:id/excluir`, podeGravar, async (req, res, next) => {
    try {
      const u = req.session.usuario;
      await db.transacao(u.pool, u.login, (conn) => ent.excluir(conn, req.params.id));
      req.session.aviso = `${ent.titulo}: registro excluido.`;
      res.redirect(`/cadastros/${slug}`);
    } catch (e) { next(e); }
  });
}

module.exports = router;
