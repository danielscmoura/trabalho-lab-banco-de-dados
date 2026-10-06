-- =====================================================================
-- Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)
-- Etapa 2 — Usuarios da aplicacao e perfis de acesso (B5)
-- Arquivo: 06_usuarios_perfis.sql   |   Executar APOS 05_auditoria.sql
-- =====================================================================
-- Sao duas camadas distintas de identidade, e vale separa-las:
--
--   usuario_app   quem usa a APLICACAO. Senha com bcrypt (hash + sal).
--   usuarios do   com que privilegio a aplicacao FALA COM O BANCO.
--   MySQL         Um pool por perfil: o professor logado nao tem, na
--                 conexao, permissao de apagar aluno — nao porque a tela
--                 esconde o botao, mas porque o SGBD recusa.
--
-- E o segundo ponto que importa: se alguem contornar a interface, o
-- limite continua de pe.
--
-- !! SENHAS DE DESENVOLVIMENTO !!
-- As senhas dos usuarios MySQL abaixo sao de desenvolvimento local e
-- estao aqui porque o GRANT precisa ser legivel na correcao. Em uso
-- real elas seriam trocadas e ficariam so no .env, que nao e versionado
-- (ver app/.env.example). A aplicacao nunca le este arquivo: ela pega as
-- credenciais do ambiente.
-- =====================================================================

USE escola_ucb;

-- ---------------------------------------------------------------------
-- 1. USUARIO_APP — contas de quem usa a interface
--    A senha nunca e armazenada em texto claro. O bcrypt ja embute o sal
--    no proprio hash ($2b$<custo>$<sal 22 chars><digest 31 chars>), e a
--    restricao ck_usuario_app_hash impede que uma senha crua entre aqui
--    por descuido de quem escreve o INSERT.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS usuario_app;

CREATE TABLE usuario_app (
  id_usuario     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  login          VARCHAR(40)  NOT NULL,
  nome_exibicao  VARCHAR(120) NOT NULL,
  senha_hash     CHAR(60)     NOT NULL,
  perfil         ENUM('SECRETARIA','PROFESSOR','CONSULTA') NOT NULL,
  id_pessoa      INT UNSIGNED NULL,
  ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso  DATETIME     NULL,
  CONSTRAINT pk_usuario_app PRIMARY KEY (id_usuario),
  CONSTRAINT uq_usuario_app_login UNIQUE (login),
  KEY idx_usuario_app_pessoa (id_pessoa),
  CONSTRAINT fk_usuario_app_pessoa FOREIGN KEY (id_pessoa)
    REFERENCES pessoa (id_pessoa)
    ON DELETE SET NULL ON UPDATE CASCADE,
  -- bcrypt sempre comeca com $2a$, $2b$ ou $2y$. Senha em texto claro
  -- nao passa por aqui.
  CONSTRAINT ck_usuario_app_hash CHECK (senha_hash LIKE '$2%$%')
) ENGINE = InnoDB;

-- Contas de desenvolvimento. As senhas correspondentes estao em
-- app/.env.example, e servem so para a demonstracao.
--   secretaria / secretaria123    professor / professor123    consulta / consulta123
INSERT INTO usuario_app (login, nome_exibicao, senha_hash, perfil, id_pessoa) VALUES
  ('secretaria', 'Secretaria Academica',
   '$2b$10$3C/Vbp5WM7mGkXtdQaekKOA8Gp2p2CDo.I/IJfDPl0mkQYzvMcR0i', 'SECRETARIA', NULL),
  ('professor',  'Natalia Ribeiro Ibrahim',
   '$2b$10$UCMa97TKWXaB37MtzrrrK.gH9rvLYm1KKO2OLciNfELkw0GDX8Zt2', 'PROFESSOR', 1),
  ('consulta',   'Portal de Consulta',
   '$2b$10$CZ9z3MAeZ.57rA9Qs6gK2eKLhl7UoCUS7EtQUPyIjvgKjkCQ5tmxO', 'CONSULTA', NULL);

-- ---------------------------------------------------------------------
-- 2. PERFIS DE ACESSO NO SGBD
-- ---------------------------------------------------------------------
DROP USER IF EXISTS 'escola_auth'@'localhost';
DROP USER IF EXISTS 'escola_secretaria'@'localhost';
DROP USER IF EXISTS 'escola_professor'@'localhost';
DROP USER IF EXISTS 'escola_consulta'@'localhost';

CREATE USER 'escola_auth'@'localhost'       IDENTIFIED BY 'dev_auth_2026';
CREATE USER 'escola_secretaria'@'localhost' IDENTIFIED BY 'dev_secretaria_2026';
CREATE USER 'escola_professor'@'localhost'  IDENTIFIED BY 'dev_professor_2026';
CREATE USER 'escola_consulta'@'localhost'   IDENTIFIED BY 'dev_consulta_2026';

-- --- 2.1 escola_auth — so autentica -----------------------------------
-- Existe para que a verificacao de senha aconteca ANTES de saber qual
-- perfil usar. E o usuario mais restrito do banco: le as colunas de
-- login de uma unica tabela e carimba a data do ultimo acesso. Nao
-- enxerga aluno, nota, nem qualquer dado academico.
GRANT SELECT (id_usuario, login, senha_hash, perfil, nome_exibicao, ativo, id_pessoa)
  ON escola_ucb.usuario_app TO 'escola_auth'@'localhost';
GRANT UPDATE (ultimo_acesso)
  ON escola_ucb.usuario_app TO 'escola_auth'@'localhost';

-- --- 2.2 escola_secretaria — operacao academica completa --------------
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.pessoa              TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.aluno               TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.professor           TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.responsavel         TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.aluno_responsavel   TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.ano_letivo          TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.disciplina          TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.pre_requisito       TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.turma               TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.matricula           TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.historico_situacao_aluno TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.alocacao            TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.avaliacao           TO 'escola_secretaria'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON escola_ucb.nota                TO 'escola_secretaria'@'localhost';
GRANT SELECT ON escola_ucb.vw_boletim_turma  TO 'escola_secretaria'@'localhost';
GRANT SELECT ON escola_ucb.vw_aluno_publico  TO 'escola_secretaria'@'localhost';
-- le a trilha de auditoria, mas nao escreve nela (ver secao 3)
GRANT SELECT ON escola_ucb.auditoria TO 'escola_secretaria'@'localhost';

-- --- 2.3 escola_professor — lanca nota, le o resto --------------------
-- Nao recebe nada em pessoa, responsavel, turma ou matricula alem de
-- leitura: um professor nao cadastra aluno nem fecha matricula.
GRANT SELECT ON escola_ucb.pessoa      TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.aluno       TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.professor   TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.turma       TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.disciplina  TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.alocacao    TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.avaliacao   TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.matricula   TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.ano_letivo  TO 'escola_professor'@'localhost';
GRANT SELECT, INSERT, UPDATE ON escola_ucb.nota TO 'escola_professor'@'localhost';
GRANT SELECT ON escola_ucb.vw_boletim_turma TO 'escola_professor'@'localhost';

-- --- 2.4 escola_consulta — so as visoes -------------------------------
-- Nenhum privilegio em tabela base. Tudo o que esse perfil ve passa por
-- vw_aluno_publico, que nao expoe CPF, nascimento, telefone nem
-- endereco. A restricao de coluna e estrutural, nao combinada.
GRANT SELECT ON escola_ucb.vw_aluno_publico TO 'escola_consulta'@'localhost';
GRANT SELECT ON escola_ucb.vw_boletim_turma TO 'escola_consulta'@'localhost';

-- ---------------------------------------------------------------------
-- 3. REVOKE — retirando o que foi concedido demais
-- ---------------------------------------------------------------------
-- (a) O professor chegou a receber DELETE em nota na primeira versao do
--     script. Foi retirado: professor CORRIGE nota, nao apaga lancamento.
--     Apagar a linha destruiria o rastro que trg_nota_auditoria_au existe
--     para manter — a auditoria registra UPDATE, nao ressuscita DELETE.
GRANT  DELETE ON escola_ucb.nota TO 'escola_professor'@'localhost';
REVOKE DELETE ON escola_ucb.nota FROM 'escola_professor'@'localhost';

-- (b) Garantia explicita: ninguem escreve na trilha de auditoria. Os
--     gatilhos gravam com o privilegio do DEFINER (root), entao a
--     aplicacao produz a trilha sem poder adultera-la.
REVOKE INSERT, UPDATE, DELETE ON escola_ucb.auditoria FROM 'escola_secretaria'@'localhost';

FLUSH PRIVILEGES;

-- =====================================================================
-- Conferencia rapida (descomente para rodar):
--   SHOW GRANTS FOR 'escola_auth'@'localhost';
--   SHOW GRANTS FOR 'escola_secretaria'@'localhost';
--   SHOW GRANTS FOR 'escola_professor'@'localhost';
--   SHOW GRANTS FOR 'escola_consulta'@'localhost';
-- =====================================================================
