# 🚀 COMO REPLICAR O SISTEMA DE BACKUP EM OUTRO PROJETO

Este diretório contém **tudo que você precisa** para replicar o sistema de backup automático em outro projeto.

---

## 📂 ARQUIVOS DISPONÍVEIS

| Arquivo | Descrição | Quando usar |
|---------|-----------|-------------|
| **BACKUP_PROMPT_PARA_COLAR.txt** | Prompt pronto para colar em outra conversa com Claude | Primeiro - na conversa do novo projeto |
| **BACKUP_SETUP_GUIDE.md** | Guia completo em 7 fases | Consulta durante implementação |
| **BACKUP_FILES_TEMPLATE.md** | Templates dos 4 arquivos com placeholders | Criar backup.js, scheduler.js, etc |
| **backup/** | Arquivos reais do RH-App (referência) | Comparação/ajustes finos |

---

## ⚡ FLUXO RÁPIDO (5 PASSOS)

### Passo 1: Abrir nova conversa com Claude
Crie uma nova conversa no Claude.com ou Claude Code.

### Passo 2: Colar o prompt
Copie e cole **TODO O CONTEÚDO** de `BACKUP_PROMPT_PARA_COLAR.txt`

### Passo 3: Responder as 4 perguntas
O prompt vai solicitar:
- URL e chave do seu Supabase
- Nomes das tabelas
- Detalhes do NAS
- Horário preferido

### Passo 4: Claude criará os 4 arquivos
Claude vai gerar:
1. `backup.js` (adaptado para suas tabelas)
2. `scheduler.js` (genérico, mas com seu horário)
3. `Dockerfile` (genérico)
4. `docker-compose.yml` (com suas credenciais)

### Passo 5: Testar e fazer deploy
```bash
node backup.js              # Testar localmente
docker-compose up -d        # Deploy no NAS
docker logs -f seu-app      # Ver logs
```

---

## 📖 GUIAS DETALHADOS

Se você precisa entender **como funciona** ou **encontrou um erro**, consulte:

### Para entender a arquitetura:
→ Ver **BACKUP_SETUP_GUIDE.md** → FASE 1-2 (entendimento)

### Para adaptar os arquivos:
→ Ver **BACKUP_SETUP_GUIDE.md** → FASE 3 (adaptação)

### Para testar:
→ Ver **BACKUP_SETUP_GUIDE.md** → FASE 4 (validação)

### Para fazer deploy no NAS:
→ Ver **BACKUP_SETUP_GUIDE.md** → FASE 5 (deploy)

### Para monitorar:
→ Ver **BACKUP_SETUP_GUIDE.md** → FASE 6 (monitoramento)

### Se algo quebrou:
→ Ver **BACKUP_SETUP_GUIDE.md** → FASE 7 (troubleshooting)

---

## 🔍 REFERÊNCIA RÁPIDA DOS 4 ARQUIVOS

Se você não quer usar Claude para adaptar:

**Use BACKUP_FILES_TEMPLATE.md:**
1. Abra o arquivo
2. Procure por todos os `[PLACEHOLDER]`
3. Substitua pelos seus valores
4. Crie os 4 arquivos na pasta `backup/`
5. Teste com `node backup.js`

---

## ✅ CHECKLIST DE ANTES DE COMEÇAR

Antes de colar o prompt em outra conversa, certifique-se que você tem:

```
☐ URL do seu projeto Supabase (https://seu-projeto.supabase.co)
☐ Chave anónima do Supabase (em Project Settings → API)
☐ Lista de TODAS as tabelas do seu banco
☐ Nome/ID da empresa para filtrar dados
☐ Acesso ao NAS Ugreen (SSH ou UI)
☐ Caminho disponível no NAS (ex: /volume1/seu-projeto)
☐ Docker instalado no NAS (ou vai instalar)
☐ Timezone do NAS (normalmente America/Sao_Paulo)
```

Se tiver TUDO isso, você está pronto!

---

## 🎯 ESTRUTURA FINAL ESPERADA

Depois de seguir os passos, seu novo projeto terá:

```
seu-novo-projeto/
├── backup/                          ← Pasta criada
│   ├── backup.js                   ← ADAPTADO (suas tabelas)
│   ├── scheduler.js                ← ADAPTADO (seu horário)
│   ├── Dockerfile                  ← Genérico (pode copiar)
│   └── docker-compose.yml          ← ADAPTADO (credenciais NAS)
├── seu_codigo_aqui/
└── outros_arquivos/

NAS (/volume1/seu-projeto/dados/):
├── 2026-06-06/
│   ├── tabela1.json
│   ├── tabela2.json
│   ├── _backup_completo.json
│   └── _resumo.json
├── 2026-06-07/
├── ... (até 60 dias atrás)
└── 2026-08-05/
    ├── ... (mais recente)
```

---

## 🔧 TEMPO ESTIMADO

| Tarefa | Tempo |
|--------|-------|
| Entender o sistema | 5 min |
| Colar prompt + responder perguntas | 5 min |
| Claude criar arquivos | 2 min |
| Testar localmente | 5 min |
| Deploy no NAS | 5 min |
| Validar primeiro backup | 2 min |
| **TOTAL** | **~24 min** |

---

## ⚠️ ERROS COMUNS

| Erro | Causa | Solução |
|------|-------|---------|
| `HTTP 401` | Chave Supabase inválida | Verificar em Project Settings → API |
| `ENOTFOUND` | URL Supabase incorreta | Copiar exatamente de seu projeto |
| `No rows returned` | EMPRESA_ID não existe | Usar valor que realmente existe no banco |
| `Connection refused` | NAS não tem Docker | Instalar Docker no NAS (contatar admin) |
| `Permission denied` | Pasta NAS não é writable | Criar `/volume1/seu-projeto/dados` com perms |

---

## 📞 SUPORTE

Se algo não funcionar:

1. **Verifique o _resumo.json:**
   ```bash
   cat /volume1/seu-projeto/dados/$(date +%Y-%m-%d)/_resumo.json
   ```

2. **Veja os logs:**
   ```bash
   docker logs seu-novo-projeto-backup | tail -50
   ```

3. **Consulte BACKUP_SETUP_GUIDE.md → FASE 7** (Troubleshooting)

---

## 🎓 PRÓXIMAS CONVERSAS

Quando for usar em outro projeto:

1. **Abra nova conversa com Claude**
2. **Cole TUDO de BACKUP_PROMPT_PARA_COLAR.txt**
3. **Responda as 4 perguntas**
4. **Claude criará os arquivos adaptados**
5. **Siga as instruções de teste/deploy**

**Pronto!** 🎉

---

**Última atualização:** 2026-06-06
**Sistema de referência:** RH-App (taicaxtjtikdajmhtsxc.supabase.co)
