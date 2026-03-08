# SE·CMS — Dashboard Secretaria Executiva
**Conselho Municipal de Saúde · Montes Claros — MG**

Sistema de gestão operacional PWA com offline-first, backend Google Sheets e deploy GitHub Pages.

---

## 📁 Estrutura de arquivos

```
cms-dashboard/
├── index.html          ← App principal (PWA)
├── manifest.json       ← Manifesto PWA (instalar como app)
├── sw.js               ← Service Worker (offline-first)
├── icons/              ← Ícones gerados (72 → 512px)
│   ├── icon-32.png
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-192.png
│   └── icon-512.png
└── gas/
    └── Code.gs         ← Google Apps Script (backend API)
```

---

## 🚀 PASSO A PASSO — DEPLOY COMPLETO

### 1. Configurar o Google Sheets (Backend)

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma nova planilha
2. Anote o **ID** da planilha — está na URL:
   ```
   https://docs.google.com/spreadsheets/d/[ID_AQUI]/edit
   ```
3. No Google Sheets: **Extensões → Apps Script**
4. Apague o código padrão e cole o conteúdo de `gas/Code.gs`
5. Substitua `YOUR_GOOGLE_SHEET_ID_HERE` pelo ID anotado
6. Salve (Ctrl+S)
7. No menu superior: **Executar → Executar função → setup** (primeira vez, para criar as abas)
8. Authorize as permissões quando solicitado

### 2. Deploy do Google Apps Script

1. Clique em **Implantar → Nova implantação**
2. Selecione tipo: **Aplicativo da Web**
3. Configure:
   - **Executar como**: Eu (sua conta)
   - **Quem tem acesso**: Qualquer pessoa *(ou "Qualquer pessoa com conta Google" para mais segurança)*
4. Clique **Implantar** e copie a **URL do aplicativo da Web**
   - Formato: `https://script.google.com/macros/s/[ID]/exec`

### 3. Configurar o Frontend

1. Abra `index.html` e localize esta linha no JavaScript:
   ```javascript
   const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
   ```
2. Substitua pela URL copiada no passo anterior

### 4. Deploy no GitHub Pages

1. Crie um repositório no GitHub (pode ser privado)
2. Faça upload de TODOS os arquivos (incluindo a pasta `icons/`)
3. Vá em **Settings → Pages**
4. Em "Source", selecione **main branch / root**
5. Aguarde o deploy (1-2 minutos)
6. Sua URL será: `https://[seu-usuario].github.io/[repositorio]/`

### 5. Instalar como App (PWA)

**No celular (Android/Chrome):**
- Acesse o site → Menu do Chrome (⋮) → "Adicionar à tela inicial" → "Instalar"

**No iOS (Safari):**
- Acesse o site → Compartilhar (□↑) → "Adicionar à Tela de Início"

**No Desktop (Chrome/Edge):**
- Barra de endereços → ícone de instalação (⊕) no canto direito → "Instalar"

---

## ⚙️ Funcionalidades

| Módulo | Funcionalidades |
|--------|----------------|
| **Dashboard** | Stats em tempo real, urgências, log recente, resumo por categoria |
| **Kanban** | 3 colunas (A Fazer / Em Andamento / Concluído), filtros por categoria e prioridade |
| **Tarefas** | Título, categoria, prioridade, responsável, prazo, descrição, checklist, notas, histórico |
| **Pendências** | Notas rápidas com cor, categoria e data |
| **Log** | Histórico completo com filtros por data/tipo, exportação CSV |
| **Biblioteca** | Grid/lista, filtros, thumbnail automático via favicon, upload de imagem |
| **Offline** | Service Worker + localStorage — funciona sem internet |
| **Sync** | Botão manual de sincronização com Google Sheets |
| **PWA** | Manifesto + Service Worker — instalável como app nativo |

---

## 🔁 Arquitetura de dados

```
┌─────────────┐    Sincroniza    ┌─────────────────┐
│  GitHub     │ ←────────────── │  Google Sheets   │
│  Pages      │                 │  (Planilha)      │
│  (Frontend) │ ──────────────→ │  tabs: tasks,    │
│  PWA        │    GAS API      │  notes, log,     │
└─────────────┘                 │  library         │
       │                        └─────────────────┘
       │ localStorage                     ↑
       ▼                                  │
┌─────────────┐                  ┌────────────────┐
│  Service    │                  │  Google Apps   │
│  Worker     │                  │  Script (API)  │
│  (offline)  │                  └────────────────┘
└─────────────┘
```

**Offline-First:** Os dados são sempre salvos no `localStorage` primeiro. O botão "Sincronizar" puxa dados do Sheets e envia as alterações. Sem internet, tudo continua funcionando normalmente.

---

## 🏷️ Categorias e tags

- **Plenárias** — Reuniões plenárias ordinárias e extraordinárias
- **Comissões** — Trabalho das comissões temáticas
- **Documentos** — Resoluções, ofícios, atas, pareceres
- **Comunicação** — Publicações, notas, campanhas
- **Administrativo** — Gestão interna, infraestrutura

---

## 📌 Dicas de uso

- **Crie tarefas** no botão "+ Nova Tarefa" ou clique em qualquer coluna do Kanban
- **Edite uma tarefa** clicando nela — abre o painel lateral completo
- **Biblioteca**: cole qualquer URL — o favicon é carregado automaticamente
- **Exportar log**: página Log → botão "Exportar" → gera CSV
- **Sincronizar**: clique "Sincronizar" na barra superior a qualquer momento
- **Instalar**: após publicar no GitHub Pages, instale como app no celular/desktop

---

## 🔒 Segurança

Para uso com dados sensíveis, recomenda-se:
1. Restrinja o GAS para "Qualquer pessoa com conta Google" 
2. Use um repositório GitHub **privado**
3. Adicione autenticação via Google OAuth no GAS (consulte a documentação)

---

*SE·CMS v1.0 — Montes Claros · 2026*
