# Projeto Final — Laboratório de Banco de Dados (GPE17M40083)

**Etapa 1 — Projeto e construção do banco**
Universidade Católica de Brasília — Bacharelado em Engenharia de Software — 2026/2
Professor: Samuel Novais Moura Júnior

## Tema

**Sistema acadêmico de uma escola de educação básica** (6º ano do fundamental ao 1º ano do ensino médio).

O banco registra pessoas (alunos e professores, com especialização total e exclusiva), responsáveis legais, anos letivos, turmas, matrículas, disciplinas com pré-requisitos, a alocação de disciplina e professor a cada turma, as avaliações de cada alocação e as notas dos alunos, além do histórico datado da situação acadêmica de cada aluno.

## Integrantes

| Nome | Matrícula | Papel principal |
|---|---|---|
| Daniel Santos Correa Moura | UC25100419 | Analista de domínio e administrador do banco — **interlocutor** |
| Helenna Sales Teixeira Alves | UC23103128 | Modeladora de dados e desenvolvedora da aplicação (Etapa 2) |

Os quatro papéis sugeridos no item 3 do enunciado foram distribuídos entre os dois integrantes, duas frentes para cada um. Como o próprio enunciado registra, a divisão é organizacional: na apresentação qualquer integrante responde por qualquer parte do trabalho.

## Requisitos técnicos

- **SGBD:** MySQL 8.0 ou superior (a escolha não muda na Etapa 2)
- **Diagramação:** draw.io — notação de Engenharia da Informação (pé de galinha)
- **Documentação:** fonte em Markdown (`docs/src/`), entrega em PDF

## Como reconstruir o banco do zero

```bash
mysql -u root -p < sql/01_ddl.sql      # cria o banco escola_ucb, as 14 tabelas e os 4 gatilhos
mysql -u root -p < sql/02_carga.sql    # popula com dados fictícios
mysql -u root -p < sql/03_consultas.sql  # executa as 15 consultas de verificação
```

O primeiro script começa com `DROP DATABASE IF EXISTS escola_ucb`, então roda em base limpa quantas vezes for preciso.

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
└── sql/
    ├── 01_ddl.sql                script físico
    ├── 02_carga.sql              carga de dados
    └── 03_consultas.sql          15 consultas comentadas
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
