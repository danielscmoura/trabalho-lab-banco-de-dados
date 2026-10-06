-- =====================================================================
-- Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)
-- Etapa 2 — Auditoria (B6)
-- Arquivo: 05_auditoria.sql   |   Executar APOS 04_visoes.sql
-- =====================================================================
-- O QUE AUDITAR, E POR QUE ESTES DOIS
--
-- Auditar tudo e o mesmo que nao auditar nada: a tabela cresce, ninguem
-- le, e o dado que importa fica enterrado. A equipe escolheu os dois
-- pontos do dominio em que uma alteracao silenciosa tem consequencia
-- fora do banco:
--
--   nota       Uma nota que muda depois de divulgada e o fato mais
--              contestavel de uma escola. Quando um responsavel
--              questiona, a secretaria precisa responder quem alterou,
--              quando, e de quanto para quanto.
--
--   matricula  A situacao da matricula decide se o aluno e contado no
--              censo, cobrado na mensalidade e certificado no fim do
--              ano. Passar de ATIVA para CANCELADA sem rastro tem efeito
--              administrativo e legal.
--
-- Ambos os gatilhos sao AFTER UPDATE: e a alteracao de um valor que
-- precisa de "antes e depois". A exclusao desses registros ja e barrada
-- por ON DELETE RESTRICT nas chaves estrangeiras da Etapa 1.
--
-- AUTOR DA ALTERACAO
-- A aplicacao executa SET @app_usuario = '<login>' logo que pega uma
-- conexao do pool. O gatilho grava esse login e tambem o CURRENT_USER()
-- do banco, que diz por qual perfil a operacao entrou. Quem mexer pelo
-- Workbench, sem definir a variavel, fica registrado como 'direto-sgbd'
-- — o que tambem e informacao util.
-- =====================================================================

USE escola_ucb;

DROP TABLE IF EXISTS auditoria;

CREATE TABLE auditoria (
  id_auditoria   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tabela         VARCHAR(40)  NOT NULL,
  operacao       ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  chave_registro VARCHAR(80)  NOT NULL,
  campo          VARCHAR(40)  NOT NULL,
  valor_anterior VARCHAR(255) NULL,
  valor_novo     VARCHAR(255) NULL,
  usuario_app    VARCHAR(40)  NOT NULL,
  usuario_banco  VARCHAR(80)  NOT NULL,
  ocorrido_em    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT pk_auditoria PRIMARY KEY (id_auditoria),
  KEY idx_auditoria_tabela_data (tabela, ocorrido_em),
  KEY idx_auditoria_registro (tabela, chave_registro)
) ENGINE = InnoDB;

DELIMITER $$

-- ---------------------------------------------------------------------
-- 1. nota — alteracao de valor lancado ou de ausencia
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_nota_auditoria_au
AFTER UPDATE ON nota FOR EACH ROW
BEGIN
  DECLARE v_chave VARCHAR(80);
  SET v_chave = CONCAT(OLD.id_matricula, '/', OLD.id_alocacao, '/', OLD.numero_avaliacao);

  -- <=> compara com seguranca contra NULL: uma nota que sai de NULL para
  -- 7.5 e uma alteracao, e precisa aparecer na auditoria.
  IF NOT (NEW.valor <=> OLD.valor) THEN
    INSERT INTO auditoria (tabela, operacao, chave_registro, campo,
                           valor_anterior, valor_novo, usuario_app, usuario_banco)
    VALUES ('nota', 'UPDATE', v_chave, 'valor',
            OLD.valor, NEW.valor,
            COALESCE(@app_usuario, 'direto-sgbd'), CURRENT_USER());
  END IF;

  IF NOT (NEW.faltou <=> OLD.faltou) THEN
    INSERT INTO auditoria (tabela, operacao, chave_registro, campo,
                           valor_anterior, valor_novo, usuario_app, usuario_banco)
    VALUES ('nota', 'UPDATE', v_chave, 'faltou',
            OLD.faltou, NEW.faltou,
            COALESCE(@app_usuario, 'direto-sgbd'), CURRENT_USER());
  END IF;
END$$

-- ---------------------------------------------------------------------
-- 2. matricula — alteracao de situacao ou de encerramento
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_matricula_auditoria_au
AFTER UPDATE ON matricula FOR EACH ROW
BEGIN
  IF NOT (NEW.situacao <=> OLD.situacao) THEN
    INSERT INTO auditoria (tabela, operacao, chave_registro, campo,
                           valor_anterior, valor_novo, usuario_app, usuario_banco)
    VALUES ('matricula', 'UPDATE', OLD.id_matricula, 'situacao',
            OLD.situacao, NEW.situacao,
            COALESCE(@app_usuario, 'direto-sgbd'), CURRENT_USER());
  END IF;

  IF NOT (NEW.data_encerramento <=> OLD.data_encerramento) THEN
    INSERT INTO auditoria (tabela, operacao, chave_registro, campo,
                           valor_anterior, valor_novo, usuario_app, usuario_banco)
    VALUES ('matricula', 'UPDATE', OLD.id_matricula, 'data_encerramento',
            OLD.data_encerramento, NEW.data_encerramento,
            COALESCE(@app_usuario, 'direto-sgbd'), CURRENT_USER());
  END IF;
END$$

DELIMITER ;

-- =====================================================================
-- Fim do script. 1 tabela e 2 gatilhos de auditoria criados.
--
-- Nota de seguranca: nenhum perfil da aplicacao recebe INSERT, UPDATE ou
-- DELETE em `auditoria` (ver 06_usuarios_perfis.sql). Os gatilhos gravam
-- com o privilegio do DEFINER, nao do usuario conectado — ou seja, a
-- aplicacao produz trilha de auditoria sem conseguir adulterar a trilha.
-- =====================================================================
