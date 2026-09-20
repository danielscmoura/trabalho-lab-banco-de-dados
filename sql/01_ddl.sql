-- =====================================================================
-- Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)
-- Etapa 1 — Script fisico (DDL)
-- Dominio: Sistema academico de escola de educacao basica
-- SGBD: MySQL 8.0+
-- Arquivo: 01_ddl.sql
-- Execucao: mysql -u root -p < 01_ddl.sql
-- =====================================================================
-- Convencao de nomes de restricoes:
--   pk_  chave primaria      uq_  unicidade
--   fk_  chave estrangeira   ck_  verificacao
--   idx_ indice              trg_ gatilho
-- =====================================================================
-- NOTA DE IMPLEMENTACAO (limitacao do MySQL 8)
-- O MySQL 8 proibe CHECK sobre colunas que participam de chave
-- estrangeira com acao referencial (CASCADE, SET NULL). Tentar as duas
-- coisas ao mesmo tempo produz o erro 3823. As duas regras do modelo que
-- caem nesse caso — RN08 (professor nao coordena a si mesmo) e RN14
-- (disciplina nao e pre-requisito de si mesma) — sao portanto
-- implementadas por gatilho na secao 15, preservando as acoes
-- referenciais justificadas no relatorio.
-- =====================================================================

SET NAMES utf8mb4;

DROP DATABASE IF EXISTS escola_ucb;
CREATE DATABASE escola_ucb
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE escola_ucb;

-- =====================================================================
-- 1. PESSOA — supertipo da especializacao (total e exclusiva)
--    Atende RN01 (CPF unico), RN02 (data de nascimento valida),
--    RN03 (toda pessoa e aluno ou professor, nunca os dois).
--    Endereco e um atributo composto, decomposto em colunas atomicas
--    para preservar a 1FN.
-- =====================================================================
CREATE TABLE pessoa (
  id_pessoa        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cpf              CHAR(11)      NOT NULL,
  nome             VARCHAR(120)  NOT NULL,
  data_nascimento  DATE          NOT NULL,
  sexo             ENUM('F','M','N') NULL,
  email            VARCHAR(120)  NULL,
  telefone         VARCHAR(20)   NULL,
  end_logradouro   VARCHAR(120)  NULL,
  end_numero       VARCHAR(10)   NULL,
  end_complemento  VARCHAR(40)   NULL,
  end_bairro       VARCHAR(60)   NULL,
  end_cidade       VARCHAR(60)   NULL,
  end_uf           CHAR(2)       NULL,
  end_cep          CHAR(8)       NULL,
  tipo_pessoa      ENUM('ALUNO','PROFESSOR') NOT NULL,
  criado_em        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_pessoa PRIMARY KEY (id_pessoa),
  CONSTRAINT uq_pessoa_cpf UNIQUE (cpf),
  KEY idx_pessoa_nome (nome),
  -- RN01: CPF deve conter exatamente 11 digitos numericos
  CONSTRAINT ck_pessoa_cpf CHECK (cpf REGEXP '^[0-9]{11}$'),
  -- RN02: nascimento em faixa plausivel (limite superior fixo porque o
  -- MySQL nao aceita funcoes nao deterministicas em CHECK)
  CONSTRAINT ck_pessoa_nascimento
    CHECK (data_nascimento BETWEEN '1930-01-01' AND '2026-12-31'),
  CONSTRAINT ck_pessoa_email CHECK (email IS NULL OR email LIKE '%@%.%'),
  CONSTRAINT ck_pessoa_uf CHECK (end_uf IS NULL OR end_uf REGEXP '^[A-Z]{2}$'),
  -- CEP brasileiro tem exatamente oito digitos (dicionario de dados)
  CONSTRAINT ck_pessoa_cep CHECK (end_cep IS NULL OR end_cep REGEXP '^[0-9]{8}$')
) ENGINE = InnoDB;

-- =====================================================================
-- 2. ALUNO — subclasse de PESSOA (mapeamento por tabela por subclasse)
--    RN04: matricula academica unica.
-- =====================================================================
CREATE TABLE aluno (
  id_pessoa      INT UNSIGNED NOT NULL,
  matricula      VARCHAR(12)  NOT NULL,
  data_ingresso  DATE         NOT NULL,
  bolsista       BOOLEAN      NOT NULL DEFAULT FALSE,
  percentual_bolsa DECIMAL(5,2) NULL,
  observacao     VARCHAR(255) NULL,
  CONSTRAINT pk_aluno PRIMARY KEY (id_pessoa),
  CONSTRAINT uq_aluno_matricula UNIQUE (matricula),
  CONSTRAINT fk_aluno_pessoa FOREIGN KEY (id_pessoa)
    REFERENCES pessoa (id_pessoa)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- RN05: percentual de bolsa so existe para aluno bolsista
  CONSTRAINT ck_aluno_bolsa CHECK (
      (bolsista = FALSE AND percentual_bolsa IS NULL)
   OR (bolsista = TRUE  AND percentual_bolsa > 0 AND percentual_bolsa <= 100)
  )
) ENGINE = InnoDB;

-- =====================================================================
-- 3. PROFESSOR — subclasse de PESSOA
--    Autorrelacionamento: um professor pode coordenar outros (RN07).
--    RN08 (ninguem coordena a si mesmo) esta na secao 15: as duas
--    colunas envolvidas participam de FK com acao referencial, o que
--    impede um CHECK (erro 3823 do MySQL 8).
-- =====================================================================
CREATE TABLE professor (
  id_pessoa           INT UNSIGNED NOT NULL,
  registro_funcional  VARCHAR(10)  NOT NULL,
  titulacao           ENUM('GRADUACAO','ESPECIALIZACAO','MESTRADO','DOUTORADO') NOT NULL,
  data_admissao       DATE         NOT NULL,
  data_desligamento   DATE         NULL,
  id_coordenador      INT UNSIGNED NULL,
  CONSTRAINT pk_professor PRIMARY KEY (id_pessoa),
  CONSTRAINT uq_professor_registro UNIQUE (registro_funcional),
  KEY idx_professor_coordenador (id_coordenador),
  CONSTRAINT fk_professor_pessoa FOREIGN KEY (id_pessoa)
    REFERENCES pessoa (id_pessoa)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- RN07: o coordenador de area e ele proprio um professor
  CONSTRAINT fk_professor_coordenador FOREIGN KEY (id_coordenador)
    REFERENCES professor (id_pessoa)
    ON DELETE SET NULL ON UPDATE CASCADE,
  -- RN06: desligamento nunca anterior a admissao
  CONSTRAINT ck_professor_datas CHECK (
    data_desligamento IS NULL OR data_desligamento >= data_admissao
  )
) ENGINE = InnoDB;

-- =====================================================================
-- 4. RESPONSAVEL — responsavel legal/financeiro pelo aluno
-- =====================================================================
CREATE TABLE responsavel (
  id_responsavel INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cpf            CHAR(11)     NOT NULL,
  nome           VARCHAR(120) NOT NULL,
  telefone       VARCHAR(20)  NOT NULL,
  email          VARCHAR(120) NULL,
  profissao      VARCHAR(60)  NULL,
  CONSTRAINT pk_responsavel PRIMARY KEY (id_responsavel),
  CONSTRAINT uq_responsavel_cpf UNIQUE (cpf),
  CONSTRAINT ck_responsavel_cpf CHECK (cpf REGEXP '^[0-9]{11}$')
) ENGINE = InnoDB;

-- =====================================================================
-- 5. ALUNO_RESPONSAVEL — associativa N:N com atributos proprios
--    RN09: todo aluno tem ao menos um responsavel.
--    RN10: o grau de parentesco e obrigatorio no vinculo.
-- =====================================================================
CREATE TABLE aluno_responsavel (
  id_aluno                INT UNSIGNED NOT NULL,
  id_responsavel          INT UNSIGNED NOT NULL,
  grau_parentesco         ENUM('MAE','PAI','AVO','TIO','IRMAO','TUTOR','OUTRO') NOT NULL,
  responsavel_financeiro  BOOLEAN NOT NULL DEFAULT FALSE,
  autoriza_saida          BOOLEAN NOT NULL DEFAULT FALSE,
  data_vinculo            DATE    NOT NULL,
  CONSTRAINT pk_aluno_responsavel PRIMARY KEY (id_aluno, id_responsavel),
  KEY idx_alunoresp_responsavel (id_responsavel),
  CONSTRAINT fk_alunoresp_aluno FOREIGN KEY (id_aluno)
    REFERENCES aluno (id_pessoa)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_alunoresp_responsavel FOREIGN KEY (id_responsavel)
    REFERENCES responsavel (id_responsavel)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;

-- =====================================================================
-- 6. ANO_LETIVO — periodo letivo ao qual as turmas pertencem
--    RN12: o ano letivo termina depois de comecar e nao se repete.
-- =====================================================================
CREATE TABLE ano_letivo (
  id_ano_letivo SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ano           SMALLINT UNSIGNED NOT NULL,
  data_inicio   DATE NOT NULL,
  data_fim      DATE NOT NULL,
  situacao      ENUM('PLANEJADO','EM_ANDAMENTO','ENCERRADO') NOT NULL DEFAULT 'PLANEJADO',
  CONSTRAINT pk_ano_letivo PRIMARY KEY (id_ano_letivo),
  CONSTRAINT uq_ano_letivo_ano UNIQUE (ano),
  CONSTRAINT ck_ano_letivo_periodo CHECK (data_fim > data_inicio),
  CONSTRAINT ck_ano_letivo_ano CHECK (ano BETWEEN 2000 AND 2100)
) ENGINE = InnoDB;

-- =====================================================================
-- 7. DISCIPLINA — componente curricular de uma serie
--    RN13: codigo unico; nome nao se repete dentro da mesma serie.
-- =====================================================================
CREATE TABLE disciplina (
  id_disciplina       SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo              VARCHAR(10)  NOT NULL,
  nome                VARCHAR(80)  NOT NULL,
  serie               ENUM('6ANO','7ANO','8ANO','9ANO','1EM') NOT NULL,
  carga_horaria_anual SMALLINT UNSIGNED NOT NULL,
  ementa              TEXT NULL,
  ativa               BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT pk_disciplina PRIMARY KEY (id_disciplina),
  CONSTRAINT uq_disciplina_codigo UNIQUE (codigo),
  CONSTRAINT uq_disciplina_nome_serie UNIQUE (nome, serie),
  CONSTRAINT ck_disciplina_carga CHECK (carga_horaria_anual BETWEEN 20 AND 400)
) ENGINE = InnoDB;

-- =====================================================================
-- 8. PRE_REQUISITO — AUTORRELACIONAMENTO N:N de DISCIPLINA
--    RN14 (uma disciplina nunca e pre-requisito de si mesma) esta na
--    secao 15, pelo mesmo motivo da RN08: as colunas participam de FK
--    com acao referencial e nao aceitam CHECK.
-- =====================================================================
CREATE TABLE pre_requisito (
  id_disciplina           SMALLINT UNSIGNED NOT NULL,
  id_disciplina_requisito SMALLINT UNSIGNED NOT NULL,
  obrigatorio             BOOLEAN NOT NULL DEFAULT TRUE,
  observacao              VARCHAR(120) NULL,
  CONSTRAINT pk_pre_requisito PRIMARY KEY (id_disciplina, id_disciplina_requisito),
  KEY idx_prereq_requisito (id_disciplina_requisito),
  CONSTRAINT fk_prereq_disciplina FOREIGN KEY (id_disciplina)
    REFERENCES disciplina (id_disciplina)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prereq_requisito FOREIGN KEY (id_disciplina_requisito)
    REFERENCES disciplina (id_disciplina)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;

-- =====================================================================
-- 9. TURMA — agrupamento de alunos em um ano letivo
--    RN15: o codigo da turma nao se repete dentro do ano letivo.
--    RN16: a capacidade fica entre 5 e 45 alunos.
-- =====================================================================
CREATE TABLE turma (
  id_turma             SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_ano_letivo        SMALLINT UNSIGNED NOT NULL,
  codigo               VARCHAR(12) NOT NULL,
  serie                ENUM('6ANO','7ANO','8ANO','9ANO','1EM') NOT NULL,
  turno                ENUM('MATUTINO','VESPERTINO') NOT NULL,
  sala                 VARCHAR(10) NULL,
  capacidade           TINYINT UNSIGNED NOT NULL,
  id_professor_regente INT UNSIGNED NULL,
  CONSTRAINT pk_turma PRIMARY KEY (id_turma),
  CONSTRAINT uq_turma_codigo_ano UNIQUE (id_ano_letivo, codigo),
  KEY idx_turma_regente (id_professor_regente),
  KEY idx_turma_serie (serie, turno),
  -- RN21: ano letivo com turmas nao pode ser excluido
  CONSTRAINT fk_turma_ano_letivo FOREIGN KEY (id_ano_letivo)
    REFERENCES ano_letivo (id_ano_letivo)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- RN17: o regente e um professor; se ele sai, a turma fica sem regente
  CONSTRAINT fk_turma_regente FOREIGN KEY (id_professor_regente)
    REFERENCES professor (id_pessoa)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_turma_capacidade CHECK (capacidade BETWEEN 5 AND 45)
) ENGINE = InnoDB;

-- =====================================================================
-- 10. MATRICULA — associativa N:N (ALUNO x TURMA) com atributos
--     RN18: um aluno so pode estar matriculado uma vez na mesma turma.
--     RN19: matricula encerrada nunca antes da data de matricula.
-- =====================================================================
CREATE TABLE matricula (
  id_matricula      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_aluno          INT UNSIGNED NOT NULL,
  id_turma          SMALLINT UNSIGNED NOT NULL,
  data_matricula    DATE NOT NULL,
  situacao          ENUM('ATIVA','TRANCADA','TRANSFERIDA','CONCLUIDA','CANCELADA')
                    NOT NULL DEFAULT 'ATIVA',
  data_encerramento DATE NULL,
  CONSTRAINT pk_matricula PRIMARY KEY (id_matricula),
  CONSTRAINT uq_matricula_aluno_turma UNIQUE (id_aluno, id_turma),
  KEY idx_matricula_turma (id_turma),
  KEY idx_matricula_situacao (situacao),
  CONSTRAINT fk_matricula_aluno FOREIGN KEY (id_aluno)
    REFERENCES aluno (id_pessoa)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_matricula_turma FOREIGN KEY (id_turma)
    REFERENCES turma (id_turma)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_matricula_encerramento CHECK (
    data_encerramento IS NULL OR data_encerramento >= data_matricula
  )
) ENGINE = InnoDB;

-- =====================================================================
-- 11. HISTORICO_SITUACAO_ALUNO — ATRIBUTO TEMPORAL
--     Situacao do aluno ao longo do tempo. Registro com data_fim NULL
--     e a situacao vigente (RN20).
--     uq_historico_aluno_inicio ja serve de indice para as consultas
--     por aluno e por data — nao ha indice adicional.
-- =====================================================================
CREATE TABLE historico_situacao_aluno (
  id_historico INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_aluno     INT UNSIGNED NOT NULL,
  situacao     ENUM('ATIVO','TRANCADO','TRANSFERIDO','EVADIDO','FORMADO') NOT NULL,
  data_inicio  DATE NOT NULL,
  data_fim     DATE NULL,
  motivo       VARCHAR(120) NULL,
  CONSTRAINT pk_historico_situacao PRIMARY KEY (id_historico),
  CONSTRAINT uq_historico_aluno_inicio UNIQUE (id_aluno, data_inicio),
  CONSTRAINT fk_historico_aluno FOREIGN KEY (id_aluno)
    REFERENCES aluno (id_pessoa)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_historico_periodo CHECK (
    data_fim IS NULL OR data_fim >= data_inicio
  )
) ENGINE = InnoDB;

-- =====================================================================
-- 12. ALOCACAO — associativa N:N com atributos
--     Liga TURMA, DISCIPLINA e PROFESSOR.
--     RN22: cada disciplina aparece uma unica vez por turma.
--     RN23: professor com vinculo ativo nao pode ser removido enquanto
--           tiver alocacao (ON DELETE RESTRICT).
-- =====================================================================
CREATE TABLE alocacao (
  id_alocacao           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_turma              SMALLINT UNSIGNED NOT NULL,
  id_disciplina         SMALLINT UNSIGNED NOT NULL,
  id_professor          INT UNSIGNED NOT NULL,
  carga_horaria_semanal TINYINT UNSIGNED NOT NULL,
  dia_semana            ENUM('SEG','TER','QUA','QUI','SEX') NULL,
  horario_inicio        TIME NULL,
  CONSTRAINT pk_alocacao PRIMARY KEY (id_alocacao),
  CONSTRAINT uq_alocacao_turma_disciplina UNIQUE (id_turma, id_disciplina),
  KEY idx_alocacao_professor (id_professor),
  KEY idx_alocacao_disciplina (id_disciplina),
  CONSTRAINT fk_alocacao_turma FOREIGN KEY (id_turma)
    REFERENCES turma (id_turma)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_alocacao_disciplina FOREIGN KEY (id_disciplina)
    REFERENCES disciplina (id_disciplina)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_alocacao_professor FOREIGN KEY (id_professor)
    REFERENCES professor (id_pessoa)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- RN24: carga horaria semanal plausivel
  CONSTRAINT ck_alocacao_carga CHECK (carga_horaria_semanal BETWEEN 1 AND 10)
) ENGINE = InnoDB;

-- =====================================================================
-- 13. AVALIACAO — ENTIDADE FRACA
--     Nao existe sem a alocacao que a originou; identificada por
--     dependencia: PK = (id_alocacao, numero_avaliacao) — RN25.
--     RN26: os pesos sao positivos e a nota maxima e 10.
-- =====================================================================
CREATE TABLE avaliacao (
  id_alocacao      INT UNSIGNED NOT NULL,
  numero_avaliacao TINYINT UNSIGNED NOT NULL,
  descricao        VARCHAR(80) NOT NULL,
  tipo             ENUM('PROVA','TRABALHO','SEMINARIO','PROJETO') NOT NULL,
  data_aplicacao   DATE NULL,
  peso             DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  valor_maximo     DECIMAL(4,2) NOT NULL DEFAULT 10.00,
  CONSTRAINT pk_avaliacao PRIMARY KEY (id_alocacao, numero_avaliacao),
  CONSTRAINT fk_avaliacao_alocacao FOREIGN KEY (id_alocacao)
    REFERENCES alocacao (id_alocacao)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_avaliacao_numero CHECK (numero_avaliacao BETWEEN 1 AND 8),
  CONSTRAINT ck_avaliacao_peso CHECK (peso > 0 AND peso <= 5),
  CONSTRAINT ck_avaliacao_valor_max CHECK (valor_maximo > 0 AND valor_maximo <= 10)
) ENGINE = InnoDB;

-- =====================================================================
-- 14. NOTA — associativa N:N (MATRICULA x AVALIACAO)
--     Tabela de maior movimento do modelo.
--     RN27: nota entre 0 e o valor maximo da avaliacao; NULL enquanto
--           nao lancada.
--     RN28: aluno ausente nao recebe nota numerica.
--     RN29 (a matricula tem de pertencer a turma da alocacao) compara
--     linhas de tabelas distintas e fica a cargo da aplicacao/Etapa 2.
-- =====================================================================
CREATE TABLE nota (
  id_matricula     INT UNSIGNED NOT NULL,
  id_alocacao      INT UNSIGNED NOT NULL,
  numero_avaliacao TINYINT UNSIGNED NOT NULL,
  valor            DECIMAL(4,2) NULL,
  data_lancamento  DATETIME NULL,
  faltou           BOOLEAN NOT NULL DEFAULT FALSE,
  observacao       VARCHAR(120) NULL,
  CONSTRAINT pk_nota PRIMARY KEY (id_matricula, id_alocacao, numero_avaliacao),
  KEY idx_nota_avaliacao (id_alocacao, numero_avaliacao),
  CONSTRAINT fk_nota_matricula FOREIGN KEY (id_matricula)
    REFERENCES matricula (id_matricula)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_nota_avaliacao FOREIGN KEY (id_alocacao, numero_avaliacao)
    REFERENCES avaliacao (id_alocacao, numero_avaliacao)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_nota_valor CHECK (valor IS NULL OR (valor >= 0 AND valor <= 10)),
  CONSTRAINT ck_nota_falta CHECK (faltou = FALSE OR valor IS NULL)
) ENGINE = InnoDB;

-- =====================================================================
-- 15. GATILHOS — regras de autorrelacionamento
--     RN08 e RN14 seriam CHECK simples em outro SGBD. No MySQL 8 as
--     colunas envolvidas participam de chave estrangeira com acao
--     referencial (CASCADE / SET NULL), e a combinacao das duas coisas
--     e proibida (erro 3823). Como as acoes referenciais foram
--     escolhidas pela regra de negocio e nao abrimos mao delas, a
--     verificacao passa para gatilhos BEFORE INSERT / BEFORE UPDATE.
-- =====================================================================
DELIMITER $$

-- RN08: nenhum professor coordena a si mesmo
CREATE TRIGGER trg_professor_autocoord_bi
BEFORE INSERT ON professor FOR EACH ROW
BEGIN
  IF NEW.id_coordenador = NEW.id_pessoa THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'RN08: um professor nao pode coordenar a si mesmo';
  END IF;
END$$

CREATE TRIGGER trg_professor_autocoord_bu
BEFORE UPDATE ON professor FOR EACH ROW
BEGIN
  IF NEW.id_coordenador = NEW.id_pessoa THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'RN08: um professor nao pode coordenar a si mesmo';
  END IF;
END$$

-- RN14: uma disciplina nunca e pre-requisito de si mesma
CREATE TRIGGER trg_prereq_ciclo_bi
BEFORE INSERT ON pre_requisito FOR EACH ROW
BEGIN
  IF NEW.id_disciplina = NEW.id_disciplina_requisito THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'RN14: uma disciplina nao pode ser pre-requisito de si mesma';
  END IF;
END$$

CREATE TRIGGER trg_prereq_ciclo_bu
BEFORE UPDATE ON pre_requisito FOR EACH ROW
BEGIN
  IF NEW.id_disciplina = NEW.id_disciplina_requisito THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'RN14: uma disciplina nao pode ser pre-requisito de si mesma';
  END IF;
END$$

DELIMITER ;

-- =====================================================================
-- Fim do script. 14 tabelas e 4 gatilhos criados
-- (9 entidades + 5 associativas).
-- =====================================================================
