#!/usr/bin/env python3
"""Gera sql/02_carga.sql de forma deterministica (dados ficticios)."""
import os
import random
from datetime import date, timedelta

random.seed(20260920)
# caminho relativo ao proprio script: tools/ -> ../sql/02_carga.sql
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   os.pardir, "sql", "02_carga.sql")
L = []
def w(s=""):
    L.append(s)

def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, date):
        return "'%s'" % v.isoformat()
    return "'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'"

def bulk(table, cols, rows, chunk=50):
    for i in range(0, len(rows), chunk):
        part = rows[i:i + chunk]
        w("INSERT INTO %s (%s) VALUES" % (table, ", ".join(cols)))
        w(",\n".join("  (%s)" % ", ".join(q(v) for v in r) for r in part) + ";")
        w()

# ---------------------------------------------------------------- nomes
PRE_F = ["Ana","Carla","Elisa","Gabriela","Isabela","Karina","Mariana","Olivia",
"Quezia","Sabrina","Ursula","Wanessa","Yasmin","Amanda","Camila","Eduarda","Giovana",
"Ingrid","Larissa","Natalia","Patricia","Simone","Valeria","Alice","Debora","Flavia",
"Helena","Juliana","Leticia","Nubia","Roberta"]
PRE_M = ["Bruno","Diego","Fabio","Heitor","Joao","Lucas","Nelson","Paulo","Rafael",
"Tiago","Vitor","Zeca","Bernardo","Daniel","Felipe","Hugo","Julio","Marcos","Otavio",
"Renato","Thiago","Wesley","Caio","Erick","Gustavo","Icaro","Kleber","Murilo","Pedro"]
PRE = PRE_F + PRE_M
SEXO_DO_PRENOME = dict([(n, "F") for n in PRE_F] + [(n, "M") for n in PRE_M])

def sexo_de(n):
    """Sexo coerente com o primeiro nome — sortear os dois de forma
    independente produzia registros como 'Mariana ... M', que a banca
    leria como descuido na geracao dos dados."""
    return SEXO_DO_PRENOME[n.split()[0]]
SOB = ["Almeida","Barbosa","Carvalho","Dias","Esteves","Ferreira","Gomes","Henriques",
"Ibrahim","Jardim","Klein","Lima","Machado","Nogueira","Oliveira","Pereira",
"Queiroz","Ribeiro","Santos","Teixeira","Uchoa","Vasconcelos","Xavier","Zanetti",
"Andrade","Brito","Cardoso","Duarte","Fonseca","Guimaraes","Moreira","Rocha",
"Siqueira","Tavares","Verissimo","Azevedo","Bezerra","Camargo","Damasceno"]
BAIRROS = ["Taguatinga Sul","Aguas Claras","Ceilandia Norte","Samambaia Sul","Guara II",
"Vicente Pires","Riacho Fundo I","Planaltina","Sobradinho II","Gama Leste"]
RUAS = ["QS 07 Conjunto A","Rua 12 Norte","QNM 34 Conjunto D","QR 405 Conjunto 8",
"QE 40 Conjunto J","Rua das Pitangueiras","Quadra 302 Lote 5","Avenida Comercial Norte"]

used_names = set()
def nome():
    while True:
        n = "%s %s %s" % (random.choice(PRE), random.choice(SOB), random.choice(SOB))
        if n not in used_names:
            used_names.add(n)
            return n

cpf_seq = 10000000000
def cpf():
    global cpf_seq
    cpf_seq += random.randint(101, 997)
    return str(cpf_seq)[:11]

def email_de(n, dom):
    p = n.lower().split()
    return "%s.%s@%s" % (p[0], p[-1], dom)

def fone():
    return "(61) 9%04d-%04d" % (random.randint(1000, 9999), random.randint(1000, 9999))

def cep():
    """CEP do DF: oito digitos, como exige o dicionario de dados e a
    coluna CHAR(8) de pessoa.end_cep."""
    return "72%06d" % random.randint(0, 999999)

# ---------------------------------------------------------------- cabecalho
w("-- =====================================================================")
w("-- Projeto Final — Laboratorio de Banco de Dados (GPE17M40083)")
w("-- Etapa 1 — Script de carga (DML)")
w("-- Arquivo: 02_carga.sql   |   Executar APOS 01_ddl.sql")
w("-- Todos os dados sao ficticios, gerados sinteticamente.")
w("-- Ordem de insercao respeita a dependencia entre as tabelas.")
w("-- =====================================================================")
w("USE escola_ucb;")
w("SET autocommit = 0;")
w("START TRANSACTION;")
w()

# ---------------------------------------------------------------- ano letivo
w("-- ---------- ANO_LETIVO ----------")
anos = [2023, 2024, 2025, 2026]
rows = []
for i, a in enumerate(anos, start=1):
    sit = "ENCERRADO" if a < 2026 else "EM_ANDAMENTO"
    rows.append([i, a, date(a, 2, 1), date(a, 12, 15), sit])
bulk("ano_letivo", ["id_ano_letivo","ano","data_inicio","data_fim","situacao"], rows)
ANO_ID = {a: i for i, a in enumerate(anos, start=1)}

# ---------------------------------------------------------------- pessoas
N_PROF, N_ALU = 45, 130
pessoas, professores, alunos = [], [], []
pid = 0

w("-- ---------- PESSOA (professores 1..45, alunos 46..175) ----------")
for i in range(N_PROF):
    pid += 1
    n = nome()
    professores.append(pid)
    pessoas.append([pid, cpf(), n, date(random.randint(1965, 1995), random.randint(1,12),
        random.randint(1,28)), sexo_de(n), email_de(n, "escola.edu.br"),
        fone(), random.choice(RUAS), str(random.randint(1,999)), None,
        random.choice(BAIRROS), "Brasilia", "DF", cep(),
        "PROFESSOR"])
for i in range(N_ALU):
    pid += 1
    n = nome()
    alunos.append(pid)
    pessoas.append([pid, cpf(), n, date(random.randint(2008, 2015), random.randint(1,12),
        random.randint(1,28)), "N" if i % 4 == 1 else sexo_de(n),
        # casos de contorno: parte dos alunos sem e-mail e sem telefone
        None if i % 7 == 0 else email_de(n, "aluno.escola.edu.br"),
        None if i % 5 == 0 else fone(),
        random.choice(RUAS), str(random.randint(1,999)),
        "Apto %d" % random.randint(101, 908) if i % 4 == 0 else None,
        random.choice(BAIRROS), "Brasilia", "DF", cep(),
        "ALUNO"])
bulk("pessoa", ["id_pessoa","cpf","nome","data_nascimento","sexo","email","telefone",
    "end_logradouro","end_numero","end_complemento","end_bairro","end_cidade",
    "end_uf","end_cep","tipo_pessoa"], pessoas)

# ---------------------------------------------------------------- professor
w("-- ---------- PROFESSOR (4 coordenadores de area inseridos primeiro) ----------")
coords = professores[:4]
rows = []
for k, p in enumerate(professores):
    adm = date(random.randint(2005, 2024), random.randint(1,12), random.randint(1,28))
    desl = None
    if k in (27, 41):                      # caso de contorno: professores desligados
        desl = date(2025, random.randint(6,12), 20)
    rows.append([p, "PR%04d" % (1000 + p), random.choice(
        ["GRADUACAO","ESPECIALIZACAO","MESTRADO","DOUTORADO"]), adm, desl,
        None if p in coords else random.choice(coords)])
rows.sort(key=lambda r: (r[5] is not None, r[0]))   # coordenadores primeiro
bulk("professor", ["id_pessoa","registro_funcional","titulacao","data_admissao",
    "data_desligamento","id_coordenador"], rows)
desligados = {r[0] for r in rows if r[4] is not None}
ativos = [p for p in professores if p not in desligados]

# ---------------------------------------------------------------- aluno
w("-- ---------- ALUNO ----------")
SERIES = ["6ANO","7ANO","8ANO","9ANO","1EM"]
serie_do_aluno, ingresso_do_aluno, data_ingresso_do_aluno = {}, {}, {}
rows = []
for k, a in enumerate(alunos):
    s = k % 5                                   # serie cursada em 2026
    anos_casa = min(s, random.randint(0, 3))
    ano_ing = 2026 - anos_casa
    serie_do_aluno[a] = s
    ingresso_do_aluno[a] = ano_ing
    # a data de ingresso e reaproveitada como data da primeira matricula:
    # sortear as duas separadamente gerava aluno matriculado antes de
    # ingressar na escola
    data_ingresso_do_aluno[a] = date(ano_ing, 2, random.randint(1, 10))
    bols = (k % 11 == 0)
    rows.append([a, "%d%04d" % (ano_ing, 1000 + k), data_ingresso_do_aluno[a],
        bols, round(random.choice([25, 50, 75, 100]), 2) if bols else None,
        "Aluno com plano de apoio pedagogico individual." if k % 23 == 0 else None])
bulk("aluno", ["id_pessoa","matricula","data_ingresso","bolsista","percentual_bolsa",
    "observacao"], rows)

# ---------------------------------------------------------------- responsavel
w("-- ---------- RESPONSAVEL ----------")
N_RESP = 130
rows, resp_ids = [], []
PROFISSOES = ["Servidor publico","Comerciante","Enfermeira","Motorista","Advogado",
"Autonomo","Analista de sistemas","Professora","Contador","Vendedora"]
for i in range(1, N_RESP + 1):
    n = nome()
    resp_ids.append(i)
    rows.append([i, cpf(), n, fone(),
        None if i % 6 == 0 else email_de(n, "email.com.br"),
        None if i % 9 == 0 else random.choice(PROFISSOES)])
bulk("responsavel", ["id_responsavel","cpf","nome","telefone","email","profissao"], rows)

# ---------------------------------------------------------------- vinculo
w("-- ---------- ALUNO_RESPONSAVEL (N:N com atributos proprios) ----------")
rows = []
for k, a in enumerate(alunos):
    r1 = resp_ids[k % N_RESP]
    rows.append([a, r1, random.choice(["MAE","PAI"]), True, True,
                 data_ingresso_do_aluno[a]])
    if k % 3 == 0:                                # segundo responsavel
        r2 = resp_ids[(k + 37) % N_RESP]
        if r2 != r1:
            rows.append([a, r2, random.choice(["PAI","AVO","TIO","TUTOR"]),
                         False, k % 6 == 0, data_ingresso_do_aluno[a]])
bulk("aluno_responsavel", ["id_aluno","id_responsavel","grau_parentesco",
    "responsavel_financeiro","autoriza_saida","data_vinculo"], rows)

# ---------------------------------------------------------------- disciplina
w("-- ---------- DISCIPLINA (8 componentes x 5 series = 40) ----------")
COMP = [("MAT","Matematica",200),("POR","Lingua Portuguesa",200),("CIE","Ciencias",120),
        ("HIS","Historia",80),("GEO","Geografia",80),("ING","Lingua Inglesa",80),
        ("EDF","Educacao Fisica",80),("ART","Arte",40)]
SUF = {"6ANO":"6","7ANO":"7","8ANO":"8","9ANO":"9","1EM":"EM"}
rows, disc_id = [], {}
did = 0
for si, s in enumerate(SERIES):
    for sigla, nomed, ch in COMP:
        did += 1
        disc_id[(s, sigla)] = did
        rows.append([did, "%s-%s" % (sigla, SUF[s]), nomed, s, ch,
            "Conteudos de %s previstos para o %s conforme a matriz curricular da escola."
            % (nomed, s.replace("ANO"," ano").replace("1EM","1o ano do ensino medio")),
            False if (sigla == "ART" and s == "1EM") else True])
# caso de contorno: disciplina ativa aprovada na matriz, ainda sem turma alocada
did += 1
rows.append([did, "ENR-EM", "Ensino Religioso", "1EM", 40,
    "Componente optativo aprovado pelo conselho, sem oferta no ano corrente.", True])
bulk("disciplina", ["id_disciplina","codigo","nome","serie","carga_horaria_anual",
    "ementa","ativa"], rows)

w("-- ---------- PRE_REQUISITO (autorrelacionamento N:N de DISCIPLINA) ----------")
rows = []
for si in range(1, len(SERIES)):
    for sigla, nomed, ch in COMP:
        atual = disc_id[(SERIES[si], sigla)]
        ante = disc_id[(SERIES[si - 1], sigla)]
        rows.append([atual, ante, sigla in ("MAT","POR","CIE"),
            "Continuidade curricular de %s." % nomed])
bulk("pre_requisito", ["id_disciplina","id_disciplina_requisito","obrigatorio",
    "observacao"], rows)

# ---------------------------------------------------------------- turma
w("-- ---------- TURMA (10 turmas por ano letivo x 4 anos = 40) ----------")
rows, turma_id = [], {}
tid = 0
for ano in anos:
    for s in SERIES:
        for letra in ("A", "B"):
            tid += 1
            turma_id[(ano, s)] = turma_id.get((ano, s), [])
            turma_id[(ano, s)].append(tid)
            regente = None if tid % 13 == 0 else random.choice(ativos)
            rows.append([tid, ANO_ID[ano], "%d-%s%s" % (ano, SUF[s], letra), s,
                "MATUTINO" if letra == "A" else "VESPERTINO",
                "Sala %02d" % (10 + (tid % 20)) if tid % 11 else None,
                random.choice([30, 32, 35, 40]), regente])
bulk("turma", ["id_turma","id_ano_letivo","codigo","serie","turno","sala",
    "capacidade","id_professor_regente"], rows)
turma_serie = {r[0]: r[3] for r in rows}
turma_ano = {}
for ano in anos:
    for s in SERIES:
        for t in turma_id[(ano, s)]:
            turma_ano[t] = ano

# ---------------------------------------------------------------- matricula
w("-- ---------- MATRICULA (N:N ALUNO x TURMA com atributos) ----------")
rows, mat_id = [], {}
mid = 0
for k, a in enumerate(alunos):
    s_atual = serie_do_aluno[a]
    for ano in range(ingresso_do_aluno[a], 2027):
        si = s_atual - (2026 - ano)
        if si < 0:
            continue
        s = SERIES[si]
        t = turma_id[(ano, s)][k % 2]
        mid += 1
        mat_id[(a, t)] = mid
        if ano < 2026:
            sit, enc = "CONCLUIDA", date(ano, 12, 15)
        elif k % 29 == 0:
            sit, enc = "TRANCADA", date(2026, 5, random.randint(1, 28))
        elif k % 31 == 0:
            sit, enc = "TRANSFERIDA", date(2026, 4, random.randint(1, 28))
        else:
            sit, enc = "ATIVA", None            # matricula em aberto
        dm = (data_ingresso_do_aluno[a] if ano == ingresso_do_aluno[a]
              else date(ano, 2, random.randint(1, 12)))
        rows.append([mid, a, t, dm, sit, enc])
bulk("matricula", ["id_matricula","id_aluno","id_turma","data_matricula","situacao",
    "data_encerramento"], rows)

# ---------------------------------------------------------------- historico
w("-- ---------- HISTORICO_SITUACAO_ALUNO (atributo temporal) ----------")
rows = []
hid = 0
for k, a in enumerate(alunos):
    ing = ingresso_do_aluno[a]
    hid += 1
    if k % 29 == 0:      # trancou: dois eventos, o ultimo em aberto
        rows.append([hid, a, "ATIVO", date(ing, 2, 5), date(2026, 5, 20),
                     "Solicitacao de trancamento pela familia."])
        hid += 1
        rows.append([hid, a, "TRANCADO", date(2026, 5, 21), None, "Trancamento vigente."])
    elif k % 31 == 0:    # transferido
        rows.append([hid, a, "ATIVO", date(ing, 2, 5), date(2026, 4, 30),
                     "Mudanca de cidade."])
        hid += 1
        rows.append([hid, a, "TRANSFERIDO", date(2026, 5, 1), None,
                     "Transferido para outra unidade escolar."])
    else:
        rows.append([hid, a, "ATIVO", date(ing, 2, 5), None, None])
bulk("historico_situacao_aluno", ["id_historico","id_aluno","situacao","data_inicio",
    "data_fim","motivo"], rows)

# ---------------------------------------------------------------- alocacao
w("-- ---------- ALOCACAO (N:N TURMA x DISCIPLINA x PROFESSOR) ----------")
pool = {}
for i, (sigla, nomed, ch) in enumerate(COMP):
    pool[sigla] = [ativos[(i * 3 + j) % len(ativos)] for j in range(4)]
rows, aloc_id = [], {}
aid = 0
for t, s in turma_serie.items():
    for j, (sigla, nomed, ch) in enumerate(COMP):
        aid += 1
        aloc_id[(t, sigla)] = aid
        rows.append([aid, t, disc_id[(s, sigla)], pool[sigla][(t + j) % 4],
            max(1, ch // 40), None if aid % 17 == 0 else ["SEG","TER","QUA","QUI","SEX"][j % 5],
            None if aid % 17 == 0 else "%02d:00:00" % (7 + (j % 5))])
bulk("alocacao", ["id_alocacao","id_turma","id_disciplina","id_professor",
    "carga_horaria_semanal","dia_semana","horario_inicio"], rows)

# ---------------------------------------------------------------- avaliacao
w("-- ---------- AVALIACAO (entidade fraca; ano letivo de 2026) ----------")
rows = []
aloc_2026 = [(t, sigla) for (t, sigla) in aloc_id if turma_ano[t] == 2026]
aloc_2026.sort(key=lambda x: aloc_id[x])
for (t, sigla) in aloc_2026:
    a_id = aloc_id[(t, sigla)]
    rows.append([a_id, 1, "Avaliacao do 1o bimestre", "PROVA", date(2026, 4, 10), 1.00, 10.00])
    rows.append([a_id, 2, "Trabalho do 2o bimestre", "TRABALHO", date(2026, 6, 22), 0.50, 10.00])
    # caso de contorno: avaliacao planejada e ainda nao aplicada
    rows.append([a_id, 3, "Avaliacao do 3o bimestre", "PROVA", None, 1.00, 10.00])
bulk("avaliacao", ["id_alocacao","numero_avaliacao","descricao","tipo","data_aplicacao",
    "peso","valor_maximo"], rows)

# ---------------------------------------------------------------- nota
w("-- ---------- NOTA (tabela de maior movimento) ----------")
rows = []
for (a, t), m in mat_id.items():
    if turma_ano[t] != 2026:
        continue
    for j, (sigla, nomed, ch) in enumerate(COMP):
        a_id = aloc_id[(t, sigla)]
        for num in (1, 2):
            # caso de contorno: notas do 2o bimestre de Arte ainda nao lancadas
            if num == 2 and sigla == "ART":
                continue
            faltou = (m + j + num) % 41 == 0
            if faltou:
                rows.append([m, a_id, num, None, None, True, "Ausente na data da avaliacao."])
            else:
                rows.append([m, a_id, num, round(random.uniform(3.0, 10.0), 2),
                    "2026-%02d-%02d 19:%02d:00" % (5 if num == 1 else 7,
                    random.randint(2, 27), random.randint(10, 59)), False,
                    None if (m + j) % 19 else "Nota revista apos recurso do aluno."])
bulk("nota", ["id_matricula","id_alocacao","numero_avaliacao","valor","data_lancamento",
    "faltou","observacao"], rows)

w("COMMIT;")
w()
w("-- ---------- Conferencia de volume ----------")
w("SELECT 'pessoa' AS tabela, COUNT(*) AS linhas FROM pessoa")
for t in ["aluno","professor","responsavel","aluno_responsavel","ano_letivo","disciplina",
          "pre_requisito","turma","matricula","historico_situacao_aluno","alocacao",
          "avaliacao","nota"]:
    w("UNION ALL SELECT '%s', COUNT(*) FROM %s" % (t, t))
w(";")

open(OUT, "w", encoding="utf-8").write("\n".join(L) + "\n")
print("gerado:", OUT)
