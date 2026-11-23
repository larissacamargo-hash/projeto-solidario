# Projeto Solidário Tech (Python)

Sistema de gerenciamento de doações tecnológicas com persistência em SQLite3.

## Funcionalidades
- Cadastro de doações com atualização automática de estoque
- Controle de itens disponíveis por categoria e condição
- Registro de distribuição com validação de saldo disponível
- Gráficos de doações recebidas (Plotly e Matplotlib)

## Como executar

1. Crie e ative um ambiente virtual:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux / macOS:
   source .venv/bin/activate
   ```

2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

3. Execute a versão Web (Streamlit):
   ```bash
   streamlit run app.py
   ```

4. Ou execute a versão Terminal (CLI + Matplotlib):
   ```bash
   python solidario_cli.py
   ```
