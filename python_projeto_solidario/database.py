"""
database.py — Projeto Solidário Tech
Persistência em SQLite3 para cadastro de doações, controle de estoque
disponível e registro de distribuições.
"""

import sqlite3
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DB_PATH = Path(__file__).parent / "solidario_tech.db"

CATEGORIAS = [
    "Notebooks & PCs",
    "Periféricos",
    "Smartphones & Tablets",
    "Redes & Cabos",
    "Componentes & Peças",
    "Outros",
]

CONDICOES = ["Novo", "Revisado / Funcional", "Para Reparo"]

TIPOS_BENEFICIARIO = [
    "Estudante",
    "Escola Pública",
    "ONG / Projeto Social",
    "Família",
]


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Cria as tabelas iniciais caso ainda não existam."""
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS estoque (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                categoria TEXT NOT NULL,
                condicao TEXT NOT NULL,
                quantidade_disponivel INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_disponivel >= 0),
                total_recebido INTEGER NOT NULL DEFAULT 0 CHECK (total_recebido >= 0),
                total_distribuido INTEGER NOT NULL DEFAULT 0 CHECK (total_distribuido >= 0),
                localizacao TEXT NOT NULL DEFAULT 'Triagem Principal',
                atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                UNIQUE(nome, categoria, condicao)
            );

            CREATE TABLE IF NOT EXISTS doacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                estoque_id INTEGER NOT NULL,
                item_nome TEXT NOT NULL,
                categoria TEXT NOT NULL,
                condicao TEXT NOT NULL,
                quantidade INTEGER NOT NULL CHECK (quantidade > 0),
                doador TEXT NOT NULL,
                data_recebimento TEXT NOT NULL,
                observacoes TEXT DEFAULT '',
                criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (estoque_id) REFERENCES estoque(id)
            );

            CREATE TABLE IF NOT EXISTS distribuicoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                estoque_id INTEGER NOT NULL,
                item_nome TEXT NOT NULL,
                categoria TEXT NOT NULL,
                quantidade INTEGER NOT NULL CHECK (quantidade > 0),
                beneficiario TEXT NOT NULL,
                tipo_beneficiario TEXT NOT NULL,
                responsavel TEXT NOT NULL,
                data_distribuicao TEXT NOT NULL,
                observacoes TEXT DEFAULT '',
                criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (estoque_id) REFERENCES estoque(id)
            );
            """
        )


def cadastrar_doacao(
    item_nome: str,
    categoria: str,
    condicao: str,
    quantidade: int,
    doador: str,
    data_recebimento: Optional[str] = None,
    localizacao: str = "Triagem Principal",
    observacoes: str = "",
) -> int:
    """Registra uma doação e atualiza o saldo disponível no estoque."""
    if quantidade <= 0:
        raise ValueError("A quantidade doada deve ser maior que zero.")

    data_ref = data_recebimento or date.today().isoformat()
    nome_limpo = item_nome.strip()
    doador_limpo = doador.strip()

    if len(nome_limpo) < 2 or len(doador_limpo) < 2:
        raise ValueError("Informe o nome do equipamento e do doador.")

    with get_connection() as conn:
        cur = conn.cursor()
        row = cur.execute(
            """
            SELECT id FROM estoque
            WHERE LOWER(nome) = LOWER(?) AND categoria = ? AND condicao = ?
            """,
            (nome_limpo, categoria, condicao),
        ).fetchone()

        if row:
            estoque_id = row["id"]
            cur.execute(
                """
                UPDATE estoque
                SET quantidade_disponivel = quantidade_disponivel + ?,
                    total_recebido = total_recebido + ?,
                    atualizado_em = datetime('now', 'localtime')
                WHERE id = ?
                """,
                (quantidade, quantidade, estoque_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO estoque (
                    nome, categoria, condicao, quantidade_disponivel,
                    total_recebido, total_distribuido, localizacao
                ) VALUES (?, ?, ?, ?, ?, 0, ?)
                """,
                (nome_limpo, categoria, condicao, quantidade, quantidade, localizacao.strip()),
            )
            estoque_id = cur.lastrowid

        cur.execute(
            """
            INSERT INTO doacoes (
                estoque_id, item_nome, categoria, condicao,
                quantidade, doador, data_recebimento, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                estoque_id,
                nome_limpo,
                categoria,
                condicao,
                quantidade,
                doador_limpo,
                data_ref,
                observacoes.strip(),
            ),
        )
        return cur.lastrowid


def registrar_distribuicao(
    estoque_id: int,
    quantidade: int,
    beneficiario: str,
    tipo_beneficiario: str,
    responsavel: str,
    data_distribuicao: Optional[str] = None,
    observacoes: str = "",
) -> int:
    """Registra a saída de equipamentos validando a disponibilidade em estoque."""
    if quantidade <= 0:
        raise ValueError("A quantidade distribuída deve ser maior que zero.")

    data_ref = data_distribuicao or date.today().isoformat()

    with get_connection() as conn:
        cur = conn.cursor()
        item = cur.execute(
            "SELECT id, nome, categoria, quantidade_disponivel FROM estoque WHERE id = ?",
            (estoque_id,),
        ).fetchone()

        if not item:
            raise ValueError("Item não encontrado no estoque.")

        if item["quantidade_disponivel"] < quantidade:
            raise ValueError(
                f"Estoque insuficiente. Disponível: {item['quantidade_disponivel']} unidade(s)."
            )

        cur.execute(
            """
            UPDATE estoque
            SET quantidade_disponivel = quantidade_disponivel - ?,
                total_distribuido = total_distribuido + ?,
                atualizado_em = datetime('now', 'localtime')
            WHERE id = ?
            """,
            (quantidade, quantidade, estoque_id),
        )

        cur.execute(
            """
            INSERT INTO distribuicoes (
                estoque_id, item_nome, categoria, quantidade,
                beneficiario, tipo_beneficiario, responsavel,
                data_distribuicao, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                estoque_id,
                item["nome"],
                item["categoria"],
                quantidade,
                beneficiario.strip(),
                tipo_beneficiario,
                responsavel.strip(),
                data_ref,
                observacoes.strip(),
            ),
        )
        return cur.lastrowid


def listar_estoque(apenas_disponiveis: bool = False) -> List[Dict]:
    query = "SELECT * FROM estoque"
    if apenas_disponiveis:
        query += " WHERE quantidade_disponivel > 0"
    query += " ORDER BY quantidade_disponivel DESC, nome ASC"
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(query).fetchall()]


def listar_doacoes() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM doacoes ORDER BY data_recebimento DESC, id DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def listar_distribuicoes() -> List[Dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM distribuicoes ORDER BY data_distribuicao DESC, id DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def resumo_indicadores() -> Tuple[int, int, int, int]:
    """Retorna (total_recebido, disponivel_atual, total_distribuido, beneficiarios_unicos)."""
    with get_connection() as conn:
        tot = conn.execute(
            """
            SELECT
                COALESCE(SUM(total_recebido), 0) AS rec,
                COALESCE(SUM(quantidade_disponivel), 0) AS disp,
                COALESCE(SUM(total_distribuido), 0) AS dist
            FROM estoque
            """
        ).fetchone()
        benef = conn.execute(
            "SELECT COUNT(DISTINCT beneficiario) AS total FROM distribuicoes"
        ).fetchone()
        return tot["rec"], tot["disp"], tot["dist"], benef["total"]


def popular_dados_exemplo() -> None:
    """Insere dados iniciais de demonstração caso o banco esteja vazio."""
    if listar_doacoes():
        return

    exemplos = [
        ("Notebook Dell Latitude 5490", "Notebooks & PCs", "Revisado / Funcional", 12, "TechCorp Soluções", "2026-06-15"),
        ("Monitor LED LG 24 Full HD", "Periféricos", "Revisado / Funcional", 18, "Banco Horizonte", "2026-07-08"),
        ("Kit Teclado e Mouse USB", "Periféricos", "Novo", 30, "Distribuidora Paulista", "2026-07-22"),
        ("Smartphone Moto G53 128GB", "Smartphones & Tablets", "Revisado / Funcional", 16, "Campanha Conectada", "2026-08-14"),
        ("Roteador TP-Link Archer C6", "Redes & Cabos", "Novo", 14, "Instituto Fibra Aberta", "2026-09-09"),
        ("SSD Kingston 240GB", "Componentes & Peças", "Novo", 20, "Voluntários Tech", "2026-10-06"),
    ]
    for nome, cat, cond, qtd, doador, dt in exemplos:
        cadastrar_doacao(nome, cat, cond, qtd, doador, dt)

    estoque = {item["nome"]: item["id"] for item in listar_estoque()}
    registrar_distribuicao(estoque["Notebook Dell Latitude 5490"], 8, "E.E. Paulo Freire", "Escola Pública", "Mariana Costa", "2026-07-10")
    registrar_distribuicao(estoque["Monitor LED LG 24 Full HD"], 12, "ONG Código Aberto", "ONG / Projeto Social", "Rafael Nogueira", "2026-08-19")
    registrar_distribuicao(estoque["Smartphone Moto G53 128GB"], 11, "Turma Jovem Aprendiz", "Estudante", "Camila Ferreira", "2026-09-18")
