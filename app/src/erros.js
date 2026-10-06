// Traducao de erro do banco para frase de gente.
//
// O enunciado pede que uma restricao violada chegue ao usuario como
// mensagem compreensivel, e nao como excecao crua do driver. A ideia
// aqui e que as restricoes da Etapa 1 nao sao detalhe de implementacao:
// cada uma delas corresponde a uma regra de negocio, e e a regra que o
// usuario precisa ler na tela.
//
// O mapa e indexado pelo NOME da restricao — por isso a Etapa 1 nomeou
// todas. Quando o nome nao esta no mapa, cai num texto generico por
// codigo de erro, que ainda assim nao vaza SQL para a tela.
'use strict';

const POR_RESTRICAO = {
  // --- unicidade -----------------------------------------------------
  uq_pessoa_cpf:            'Ja existe uma pessoa cadastrada com esse CPF.',
  uq_responsavel_cpf:       'Ja existe um responsavel cadastrado com esse CPF.',
  uq_aluno_matricula:       'Essa matricula academica ja pertence a outro aluno.',
  uq_professor_registro:    'Esse registro funcional ja pertence a outro professor.',
  uq_ano_letivo_ano:        'Esse ano letivo ja foi cadastrado.',
  uq_disciplina_codigo:     'Ja existe uma disciplina com esse codigo.',
  uq_disciplina_nome_serie: 'Essa serie ja tem uma disciplina com esse nome.',
  uq_turma_codigo_ano:      'Ja existe uma turma com esse codigo neste ano letivo.',
  uq_matricula_aluno_turma: 'Esse aluno ja esta matriculado nesta turma.',
  uq_alocacao_turma_disciplina: 'Essa disciplina ja esta na grade desta turma.',
  uq_historico_aluno_inicio: 'Ja existe um registro de situacao para esse aluno nessa data.',
  uq_usuario_app_login:     'Esse login ja esta em uso.',

  // --- verificacao ---------------------------------------------------
  ck_pessoa_cpf:          'O CPF deve ter exatamente 11 digitos numericos, sem pontos nem traco.',
  ck_pessoa_nascimento:   'A data de nascimento esta fora da faixa aceita (1930 em diante).',
  ck_pessoa_email:        'O e-mail informado nao parece valido.',
  ck_pessoa_uf:           'A UF deve ter duas letras maiusculas.',
  ck_pessoa_cep:          'O CEP deve ter exatamente 8 digitos.',
  ck_aluno_bolsa:         'Percentual de bolsa so vale para aluno bolsista, e precisa ficar entre 0 e 100.',
  ck_professor_datas:     'A data de desligamento nao pode ser anterior a de admissao.',
  ck_ano_letivo_periodo:  'O fim do ano letivo tem de ser posterior ao inicio.',
  ck_ano_letivo_ano:      'O ano letivo deve estar entre 2000 e 2100.',
  ck_disciplina_carga:    'A carga horaria anual deve ficar entre 20 e 400 horas.',
  ck_turma_capacidade:    'A capacidade da turma deve ficar entre 5 e 45 alunos.',
  ck_matricula_encerramento: 'O encerramento nao pode ser anterior a data da matricula.',
  ck_historico_periodo:   'A data de fim nao pode ser anterior a data de inicio.',
  ck_alocacao_carga:      'A carga horaria semanal deve ficar entre 1 e 10 aulas.',
  ck_avaliacao_numero:    'O numero da avaliacao deve ficar entre 1 e 8.',
  ck_avaliacao_peso:      'O peso da avaliacao deve ser maior que zero e no maximo 5.',
  ck_avaliacao_valor_max: 'O valor maximo da avaliacao deve ser maior que zero e no maximo 10.',
  ck_nota_valor:          'A nota deve ficar entre 0 e 10.',
  ck_nota_falta:          'Aluno marcado como ausente nao pode receber nota numerica.',
  ck_usuario_app_hash:    'A senha precisa ser gravada com hash — nunca em texto claro.',

  // --- chave estrangeira ---------------------------------------------
  fk_matricula_aluno:     'Esse aluno tem matricula registrada e nao pode ser excluido. Encerre as matriculas antes.',
  fk_matricula_turma:     'Essa turma tem alunos matriculados e nao pode ser excluida.',
  fk_alocacao_professor:  'Esse professor esta alocado em pelo menos uma turma e nao pode ser excluido.',
  fk_alocacao_disciplina: 'Essa disciplina esta na grade de alguma turma e nao pode ser excluida.',
  fk_turma_ano_letivo:    'Esse ano letivo tem turmas vinculadas e nao pode ser excluido.',
  fk_alunoresp_responsavel: 'Esse responsavel ainda responde por algum aluno e nao pode ser excluido.',
  fk_prereq_requisito:    'Essa disciplina e pre-requisito de outra e nao pode ser excluida.',
};

const POR_CODIGO = {
  1062: 'Esse valor ja existe e precisa ser unico.',
  1451: 'Esse registro esta sendo usado por outro e nao pode ser excluido.',
  1452: 'Um dos registros relacionados nao existe.',
  1048: 'Um campo obrigatorio ficou em branco.',
  1406: 'Um dos campos ultrapassou o tamanho permitido.',
  1264: 'Um valor numerico ficou fora da faixa aceita pelo campo.',
  3819: 'Os dados informados violam uma regra de validacao do banco.',
  1142: 'Seu perfil de acesso nao permite essa operacao.',
  1143: 'Seu perfil de acesso nao permite ver ou alterar esse campo.',
  1213: 'A operacao conflitou com outra em andamento (deadlock). Tente de novo.',
  1205: 'A operacao esperou demais por um registro travado por outro usuario.',
};

// Extrai o nome da restricao da mensagem do MySQL. Cada codigo de erro
// formata a mensagem de um jeito.
function nomeDaRestricao(erro) {
  const m = String(erro.sqlMessage || '');
  // 1062: Duplicate entry 'x' for key 'tabela.uq_nome'
  let r = m.match(/for key '(?:[^'.]+\.)?([^']+)'/);
  if (r) return r[1];
  // 3819: Check constraint 'ck_nome' is violated
  r = m.match(/[Cc]heck constraint '([^']+)'/);
  if (r) return r[1];
  // 1451/1452: ... CONSTRAINT `fk_nome` FOREIGN KEY ...
  r = m.match(/CONSTRAINT `([^`]+)`/);
  if (r) return r[1];
  return null;
}

// Devolve { mensagem, detalhe, status }. `detalhe` so aparece no log do
// servidor; a tela recebe `mensagem`.
function traduzir(erro) {
  // 1644 = SIGNAL dos nossos gatilhos (RN08, RN14 e as regras da
  // Etapa 2). A mensagem ja foi escrita para ser lida por gente.
  if (erro && erro.errno === 1644) {
    return { mensagem: erro.sqlMessage, detalhe: erro.sqlMessage, status: 400 };
  }

  const restricao = erro && erro.sqlMessage ? nomeDaRestricao(erro) : null;
  if (restricao && POR_RESTRICAO[restricao]) {
    return { mensagem: POR_RESTRICAO[restricao], detalhe: `${restricao}: ${erro.sqlMessage}`, status: 400 };
  }
  if (erro && POR_CODIGO[erro.errno]) {
    const status = erro.errno === 1142 || erro.errno === 1143 ? 403 : 400;
    return { mensagem: POR_CODIGO[erro.errno], detalhe: erro.sqlMessage, status };
  }
  if (erro && erro.eRegra) {
    // regra de negocio validada na aplicacao, antes de chegar ao banco
    return { mensagem: erro.message, detalhe: erro.message, status: 400 };
  }
  return {
    mensagem: 'Nao foi possivel concluir a operacao. Tente novamente; se persistir, avise a secretaria.',
    detalhe: (erro && (erro.sqlMessage || erro.message)) || String(erro),
    status: 500,
  };
}

// Erro de regra de negocio levantado pela propria aplicacao (aquilo que
// o DDL declarativo nao consegue garantir).
class ErroDeRegra extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.eRegra = true;
  }
}

module.exports = { traduzir, ErroDeRegra };
