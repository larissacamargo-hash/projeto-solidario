"""
solidario_cli.py — Projeto Solidário Tech (Terminal / CLI)
Execute com: python solidario_cli.py
"""

import database as db
import graficos


def exibir_menu() -> None:
    print("\n=== PROJETO SOLIDÁRIO TECH ===")
    print("1. Cadastrar nova doação")
    print("2. Listar itens disponíveis em estoque")
    print("3. Registrar distribuição")
    print("4. Visualizar gráficos de doações recebidas")
    print("5. Resumo de indicadores")
    print("0. Sair")


def fluxo_cadastro() -> None:
    print("\n--- Cadastro de Doação ---")
    nome = input("Nome do equipamento: ").strip()
    print("Categorias:", ", ".join(db.CATEGORIAS))
    categoria = input("Categoria: ").strip() or "Notebooks & PCs"
    if categoria not in db.CATEGORIAS:
        categoria = "Outros"

    print("Condições:", ", ".join(db.CONDICOES))
    condicao = input("Condição: ").strip() or "Revisado / Funcional"
    if condicao not in db.CONDICOES:
        condicao = "Revisado / Funcional"

    qtd = int(input("Quantidade: "))
    doador = input("Nome do doador / empresa: ").strip()
    obs = input("Observações (opcional): ").strip()

    db.cadastrar_doacao(nome, categoria, condicao, qtd, doador, observacoes=obs)
    print("Doação registrada com sucesso!")


def fluxo_estoque() -> None:
    print("\n--- Itens Disponíveis ---")
    itens = db.listar_estoque(apenas_disponiveis=True)
    if not itens:
        print("Nenhum item disponível no momento.")
        return
    for item in itens:
        print(
            f"[{item['id']}] {item['nome']} | {item['categoria']} | "
            f"Disp.: {item['quantidade_disponivel']} un. ({item['condicao']})"
        )


def fluxo_distribuicao() -> None:
    fluxo_estoque()
    estoque_id = int(input("\nID do item a distribuir: "))
    qtd = int(input("Quantidade: "))
    beneficiario = input("Beneficiário / Instituição: ").strip()
    print("Perfis:", ", ".join(db.TIPOS_BENEFICIARIO))
    tipo = input("Perfil: ").strip() or "Estudante"
    if tipo not in db.TIPOS_BENEFICIARIO:
        tipo = "Família"
    responsavel = input("Responsável pela entrega: ").strip()

    db.registrar_distribuicao(estoque_id, qtd, beneficiario, tipo, responsavel)
    print("Distribuição registrada com sucesso!")


def main() -> None:
    db.init_db()
    db.popular_dados_exemplo()

    while True:
        exibir_menu()
        opcao = input("Escolha uma opção: ").strip()
        try:
            if opcao == "1":
                fluxo_cadastro()
            elif opcao == "2":
                fluxo_estoque()
            elif opcao == "3":
                fluxo_distribuicao()
            elif opcao == "4":
                graficos.exibir_graficos_matplotlib(
                    db.listar_doacoes(),
                    db.listar_distribuicoes(),
                )
            elif opcao == "5":
                rec, disp, dist, benef = db.resumo_indicadores()
                print(
                    f"\nRecebidas: {rec} | Disponíveis: {disp} | "
                    f"Distribuídas: {dist} | Beneficiários: {benef}"
                )
            elif opcao == "0":
                print("Encerrando Projeto Solidário Tech.")
                break
            else:
                print("Opção inválida.")
        except Exception as exc:
            print(f"Erro: {exc}")


if __name__ == "__main__":
    main()
