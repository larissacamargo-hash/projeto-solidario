"""
app.py — Projeto Solidário Tech (Streamlit)
Execute com: streamlit run app.py
"""

from datetime import date
import pandas as pd
import streamlit as st

import database as db
import graficos

st.set_page_config(
    page_title="Projeto Solidário Tech",
    page_icon="💻",
    layout="wide",
)

db.init_db()
db.popular_dados_exemplo()

st.title("Projeto Solidário Tech")
st.caption("Sistema de Gerenciamento de Doações Tecnológicas")

menu = st.sidebar.radio(
    "Navegação",
    [
        "Visão Geral & Gráficos",
        "Cadastro de Doações",
        "Itens Disponíveis",
        "Registro de Distribuição",
    ],
)

total_rec, total_disp, total_dist, total_benef = db.resumo_indicadores()

if menu == "Visão Geral & Gráficos":
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Unidades Recebidas", f"{total_rec}")
    col2.metric("Disponíveis em Estoque", f"{total_disp}")
    col3.metric("Unidades Distribuídas", f"{total_dist}")
    col4.metric("Beneficiários Atendidos", f"{total_benef}")

    st.divider()
    doacoes = db.listar_doacoes()
    distribuicoes = db.listar_distribuicoes()

    if not doacoes:
        st.info("Cadastre a primeira doação para visualizar os gráficos.")
    else:
        g1, g2 = st.columns(2)
        with g1:
            st.plotly_chart(
                graficos.figura_plotly_mensal(doacoes, distribuicoes),
                use_container_width=True,
            )
        with g2:
            st.plotly_chart(
                graficos.figura_plotly_categorias(doacoes),
                use_container_width=True,
            )

elif menu == "Cadastro de Doações":
    st.subheader("Cadastrar Nova Doação")
    with st.form("form_doacao", clear_on_submit=True):
        c1, c2 = st.columns(2)
        item_nome = c1.text_input("Equipamento / Item *", placeholder="Ex.: Notebook Dell Latitude 5490")
        doador = c2.text_input("Doador ou Empresa Parceira *", placeholder="Ex.: TechCorp Soluções")

        c3, c4, c5 = st.columns(3)
        categoria = c3.selectbox("Categoria", db.CATEGORIAS)
        condicao = c4.selectbox("Condição", db.CONDICOES)
        quantidade = c5.number_input("Quantidade *", min_value=1, step=1, value=1)

        c6, c7 = st.columns(2)
        data_rec = c6.date_input("Data de Recebimento", value=date.today())
        localizacao = c7.text_input("Localização no Estoque", value="Triagem Principal")

        observacoes = st.text_area("Observações", placeholder="Detalhes técnicos, acessórios inclusos...")
        enviado = st.form_submit_button("Registrar Doação", type="primary")

        if enviado:
            try:
                db.cadastrar_doacao(
                    item_nome=item_nome,
                    categoria=categoria,
                    condicao=condicao,
                    quantidade=int(quantidade),
                    doador=doador,
                    data_recebimento=data_rec.isoformat(),
                    localizacao=localizacao,
                    observacoes=observacoes,
                )
                st.success("Doação cadastrada e estoque atualizado com sucesso!")
                st.rerun()
            except ValueError as err:
                st.error(str(err))

    st.subheader("Histórico de Doações Recebidas")
    st.dataframe(pd.DataFrame(db.listar_doacoes()), use_container_width=True, hide_index=True)

elif menu == "Itens Disponíveis":
    st.subheader("Controle de Itens Disponíveis")
    somente_disp = st.checkbox("Mostrar apenas itens com saldo positivo", value=True)
    itens = db.listar_estoque(apenas_disponiveis=somente_disp)

    if not itens:
        st.warning("Nenhum item encontrado para o filtro selecionado.")
    else:
        df_estoque = pd.DataFrame(itens)[
            [
                "id",
                "nome",
                "categoria",
                "condicao",
                "quantidade_disponivel",
                "total_recebido",
                "total_distribuido",
                "localizacao",
            ]
        ]
        st.dataframe(df_estoque, use_container_width=True, hide_index=True)

elif menu == "Registro de Distribuição":
    st.subheader("Registrar Distribuição para Beneficiário")
    disponiveis = db.listar_estoque(apenas_disponiveis=True)

    if not disponiveis:
        st.warning("Não há itens disponíveis em estoque no momento.")
    else:
        opcoes = {
            f"{item['nome']} (Disponível: {item['quantidade_disponivel']} un.)": item
            for item in disponiveis
        }
        with st.form("form_distribuicao", clear_on_submit=True):
            escolha = st.selectbox("Item em Estoque *", list(opcoes.keys()))
            item_sel = opcoes[escolha]

            c1, c2 = st.columns(2)
            quantidade = c1.number_input(
                "Quantidade a Distribuir *",
                min_value=1,
                max_value=int(item_sel["quantidade_disponivel"]),
                step=1,
                value=1,
            )
            tipo_benef = c2.selectbox("Perfil do Beneficiário", db.TIPOS_BENEFICIARIO)

            c3, c4 = st.columns(2)
            beneficiario = c3.text_input("Nome do Beneficiário / Instituição *")
            responsavel = c4.text_input("Responsável pela Entrega *")

            data_dist = st.date_input("Data da Distribuição", value=date.today())
            obs = st.text_area("Observações da Entrega")

            if st.form_submit_button("Confirmar Distribuição", type="primary"):
                try:
                    db.registrar_distribuicao(
                        estoque_id=item_sel["id"],
                        quantidade=int(quantidade),
                        beneficiario=beneficiario,
                        tipo_beneficiario=tipo_benef,
                        responsavel=responsavel,
                        data_distribuicao=data_dist.isoformat(),
                        observacoes=obs,
                    )
                    st.success("Distribuição registrada e saldo atualizado!")
                    st.rerun()
                except ValueError as err:
                    st.error(str(err))

    st.subheader("Histórico de Distribuições")
    st.dataframe(pd.DataFrame(db.listar_distribuicoes()), use_container_width=True, hide_index=True)
