"""
graficos.py — Projeto Solidário Tech
Módulo de visualização de doações recebidas por categoria, evolução mensal
e comparativo entre entradas e distribuições.
"""

from typing import Dict, List
import matplotlib.pyplot as plt
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


PALETA_CATEGORIAS = {
    "Notebooks & PCs": "#0F766E",
    "Periféricos": "#0284C7",
    "Smartphones & Tablets": "#2563EB",
    "Redes & Cabos": "#D97706",
    "Componentes & Peças": "#475569",
    "Outros": "#64748B",
}


def figura_plotly_categorias(doacoes: List[Dict]) -> go.Figure:
    """Gráfico de barras horizontais com total de unidades doadas por categoria."""
    df = pd.DataFrame(doacoes)
    agrupado = (
        df.groupby("categoria", as_index=False)["quantidade"]
        .sum()
        .sort_values("quantidade", ascending=True)
    )
    fig = px.bar(
        agrupado,
        x="quantidade",
        y="categoria",
        orientation="h",
        text="quantidade",
        color="categoria",
        color_discrete_map=PALETA_CATEGORIAS,
        title="Doações Recebidas por Categoria",
    )
    fig.update_layout(
        showlegend=False,
        xaxis_title="Unidades Recebidas",
        yaxis_title="",
        plot_bgcolor="white",
        margin=dict(l=10, r=20, t=50, b=30),
    )
    fig.update_traces(textposition="outside")
    return fig


def figura_plotly_mensal(doacoes: List[Dict], distribuicoes: List[Dict]) -> go.Figure:
    """Comparativo mensal entre doações recebidas e itens distribuídos."""
    df_don = pd.DataFrame(doacoes)
    df_dist = pd.DataFrame(distribuicoes)

    df_don["mes"] = df_don["data_recebimento"].str.slice(0, 7)
    rec_mes = df_don.groupby("mes")["quantidade"].sum().rename("Recebidas")

    if not df_dist.empty:
        df_dist["mes"] = df_dist["data_distribuicao"].str.slice(0, 7)
        dist_mes = df_dist.groupby("mes")["quantidade"].sum().rename("Distribuídas")
    else:
        dist_mes = pd.Series(dtype=int, name="Distribuídas")

    combinado = pd.concat([rec_mes, dist_mes], axis=1).fillna(0).sort_index()

    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            x=combinado.index,
            y=combinado["Recebidas"],
            name="Doações Recebidas",
            marker_color="#0F766E",
        )
    )
    fig.add_trace(
        go.Bar(
            x=combinado.index,
            y=combinado["Distribuídas"],
            name="Itens Distribuídos",
            marker_color="#0284C7",
        )
    )
    fig.update_layout(
        barmode="group",
        title="Evolução Mensal: Recebimentos vs. Distribuições",
        xaxis_title="Mês (AAAA-MM)",
        yaxis_title="Unidades",
        plot_bgcolor="white",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    return fig


def exibir_graficos_matplotlib(doacoes: List[Dict], distribuicoes: List[Dict]) -> None:
    """Exibe painel duplo com Matplotlib para execução local via terminal."""
    if not doacoes:
        print("Nenhuma doação registrada para gerar gráficos.")
        return

    df_don = pd.DataFrame(doacoes)
    por_cat = df_don.groupby("categoria")["quantidade"].sum().sort_values()

    df_don["mes"] = df_don["data_recebimento"].str.slice(0, 7)
    rec_mes = df_don.groupby("mes")["quantidade"].sum()

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Projeto Solidário Tech — Análise de Doações", fontsize=14, fontweight="bold")

    cores = [PALETA_CATEGORIAS.get(cat, "#475569") for cat in por_cat.index]
    por_cat.plot(kind="barh", ax=ax1, color=cores)
    ax1.set_title("Doações Recebidas por Categoria")
    ax1.set_xlabel("Quantidade (unidades)")
    ax1.grid(axis="x", linestyle="--", alpha=0.4)

    rec_mes.plot(kind="bar", ax=ax2, color="#0F766E", label="Recebidas")
    if distribuicoes:
        df_dist = pd.DataFrame(distribuicoes)
        df_dist["mes"] = df_dist["data_distribuicao"].str.slice(0, 7)
        dist_mes = df_dist.groupby("mes")["quantidade"].sum().reindex(rec_mes.index, fill_value=0)
        dist_mes.plot(kind="line", marker="o", ax=ax2, color="#0284C7", linewidth=2, label="Distribuídas")

    ax2.set_title("Evolução Mensal")
    ax2.set_ylabel("Unidades")
    ax2.legend()
    ax2.grid(axis="y", linestyle="--", alpha=0.4)

    plt.tight_layout()
    plt.show()
