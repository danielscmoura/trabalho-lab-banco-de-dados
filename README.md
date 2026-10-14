# Projeto Final — Laboratório de Banco de Dados (GPE17M40083)

**Etapa 1 — Projeto e construção do banco**
Universidade Católica de Brasília — Bacharelado em Engenharia de Software — 2026/2
Professor: Samuel Novais Moura Júnior

## Tema

**Sistema acadêmico de uma escola de educação básica** (6º ano do fundamental ao 1º ano do ensino médio).

O banco registra pessoas (alunos e professores, com especialização total e exclusiva), responsáveis legais, anos letivos, turmas, matrículas, disciplinas com pré-requisitos, a alocação de disciplina e professor a cada turma, as avaliações de cada alocação e as notas dos alunos, além do histórico datado da situação acadêmica de cada aluno.

## Integrantes

| Nome | Matrícula |
|---|---|
| Daniel Santos Correa Moura | UC25100419 |
| Helenna Sales Teixeira Alves | UC23103128 |

## Requisitos técnicos

- **SGBD:** MySQL 8.0 ou superior (a escolha não muda na Etapa 2)
- **Diagramação:** draw.io — notação de Engenharia da Informação (pé de galinha)
- **Documentação:** fonte em Markdown (`docs/src/`), entrega em PDF

## Como reconstruir o banco do zero

Na ordem. Os scripts 01 a 03 são a Etapa 1; 04 a 07 acrescentam o que a Etapa 2 precisa.

```bash
mysql -u root -p < sql/01_ddl.sql            # banco escola_ucb, 14 tabelas e 4 gatilhos
mysql -u root -p < sql/02_carga.sql          # carga de dados fictícios
mysql -u root -p < sql/03_consultas.sql      # 15 consultas de verificação
mysql -u root -p < sql/04_visoes.sql         # vw_boletim_turma e vw_aluno_publico
mysql -u root -p < sql/05_auditoria.sql      # tabela auditoria e 2 gatilhos
mysql -u root -p < sql/06_usuarios_perfis.sql  # usuario_app e os 4 perfis de acesso
mysql -u root -p < sql/07_indices.sql        # índices justificados pelo estudo de desempenho
```

O primeiro script começa com `DROP DATABASE IF EXISTS escola_ucb`, então roda em base limpa quantas vezes for preciso. Rodar do 01 ao 07 em sequência deixa 16 tabelas, 2 visões, 6 gatilhos e 4 perfis.

## Como subir a aplicação (Etapa 2)

Requer **Node 18 ou superior** e o banco já reconstruído com os sete scripts acima.

```bash
cd app
npm install
cp .env.example .env     # ajuste DB_HOST, DB_PORT e as senhas, se mudou alguma
node server.js
```

A aplicação sobe em `http://localhost:3000`. Contas de demonstração:

| Login | Senha | Perfil | O que alcança |
|---|---|---|---|
| `secretaria` | `secretaria123` | SECRETARIA | Operação completa: CRUD, matrícula, auditoria |
| `professor` | `professor123` | PROFESSOR | Lança e corrige nota; lê o resto |
| `consulta` | `consulta123` | CONSULTA | Só as visões, sem nenhum dado pessoal |    

> O `.env` **não é versionado**. Se faltar alguma variável, a aplicação não sobe — ela aborta no boot listando o que falta, em vez de falhar depois na primeira consulta.

Cada perfil usa um **usuário MySQL diferente**, com privilégios distintos (ver `sql/06_usuarios_perfis.sql`). Entrar como professor e tentar apagar um aluno não falha porque a tela esconde o botão: falha porque o banco recusa.

### Os dois experimentos

```bash
cd app
node scripts/experimento-concorrencia.js   # B3 — duas sessões disputando a última vaga
node scripts/estudo-indices.js             # B4 — plano e tempo, antes e depois do índice
```

Os dois restauram o estado do banco ao terminar. A análise dos resultados está em `docs/src/07-etapa2.md`.

## Estrutura do repositório

```
repositorio/
├── README.md
├── docs/
│   ├── relatorio-etapa1.pdf      relatório único com A1 a A5
│   ├── mer-conceitual.pdf        diagrama ER conceitual
│   ├── mer-conceitual.drawio     arquivo-fonte do diagrama
│   ├── modelo-logico.pdf         esquema relacional e decisões de mapeamento
│   ├── dicionario-dados.pdf      dicionário completo de entidades e atributos
│   └── src/                      fontes em Markdown da documentação
├── sql/
│   ├── 01_ddl.sql                script físico
│   ├── 02_carga.sql              carga de dados
│   ├── 03_consultas.sql          15 consultas comentadas
│   ├── 04_visoes.sql             visão do relatório e visão de restrição
│   ├── 05_auditoria.sql          tabela de auditoria e 2 gatilhos
│   ├── 06_usuarios_perfis.sql    contas da aplicação e GRANT/REVOKE
│   └── 07_indices.sql            índices justificados pelo estudo B4
├── app/                          aplicação da Etapa 2 (Node + Express)
│   ├── server.js                 bootstrap, sessão, tratamento de erro
│   ├── .env.example              modelo de configuração (o .env real não é versionado)
│   ├── src/
│   │   ├── config.js             lê o ambiente; aborta no boot se faltar variável
│   │   ├── db.js                 pools por perfil; só prepared statements
│   │   ├── erros.js              traduz restrição violada em frase de gente
│   │   ├── auth.js               bcrypt, sessão e middleware de perfil
│   │   └── rotas/                cadastros, consultas, relatório, matrícula, auditoria
│   ├── scripts/                  experimento de concorrência e estudo de índices
│   ├── views/                    telas em EJS
│   └── public/estilo.css
└── tools/gerar_carga.py          gerador dos dados fictícios da Etapa 1
```

## Modelo em números

| Item | Quantidade |
|---|---|
| Entidades (sem contar associativas) | 9 |
| Tabelas no total | 14 |
| Gatilhos (RN08 e RN14) | 4 |
| Relacionamentos N:N com atributo próprio | 5 |
| Autorrelacionamentos | 2 |
| Generalização/especialização | 1 (total e exclusiva) |
| Entidade fraca | 1 |
| Regras de negócio | 31 |
| Linhas na tabela de maior movimento (`nota`) | 1.950 |

## Checklist da Etapa 1 (Anexo B)

- [x] Repositório acessível, com a estrutura de pastas prevista
- [x] Banco apagado e `01_ddl.sql` executado do início ao fim sem erro
- [x] `02_carga.sql` executado na sequência, sem erro
- [x] As quinze consultas de `03_consultas.sql` retornam resultado coerente
- [x] Todas as restrições nomeadas com os prefixos `pk_`, `uq_`, `fk_`, `ck_`, `idx_` (mais `trg_` nos gatilhos)
- [x] Toda chave estrangeira com `ON DELETE` e `ON UPDATE` explícitos
- [x] Requisitos mínimos de complexidade do item 4 atendidos
- [x] Regras de negócio numeradas e rastreadas até a implementação
- [x] MER em notação única, do começo ao fim
- [x] Decisões de mapeamento justificadas em texto
- [x] Análise de normalização com as dependências funcionais
- [x] Relatório em PDF reunindo A1 a A5, paginado
- [ ] **Todos os integrantes sabem explicar todas as partes do trabalho** — conferir antes da apresentação de 21/09
