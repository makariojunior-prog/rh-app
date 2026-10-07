# ⚡ CHECKLIST VISUAL - SETUP BACKUP EM NOVO PROJETO

## FASE 1️⃣: PREPARAÇÃO

```
☐ Tenho URL do Supabase? (https://seu-projeto.supabase.co)
☐ Tenho a chave anónima? (Project Settings → API)
☐ Listei TODAS as tabelas do banco?
☐ Defini o valor de empresa_id?
☐ Verifiquei timezone do NAS?
☐ Escolhi horário para backup? (padrão: 02:00)
☐ Tenho caminho no NAS? (/volume1/seu-projeto/dados)
```

**→ Quando tudo marcado:** Copie BACKUP_PROMPT_PARA_COLAR.txt na nova conversa

---

## FASE 2️⃣: CLAUDE CRIA ARQUIVOS

Claude vai criar 4 arquivos. Marque conforme receber:

```
☐ backup.js           (adaptado com suas tabelas)
☐ scheduler.js        (adaptado com seu horário)
☐ Dockerfile          (genérico, ok copiar)
☐ docker-compose.yml  (adaptado com credenciais)
```

**→ Quando tudo criado:** Teste localmente antes do NAS

---

## FASE 3️⃣: TESTE LOCAL

### Executar na sua máquina:

```bash
# Entrar na pasta
cd backup

# Instalar dependências (Node.js)
npm install  # (ou já vem com Node.js)

# Testar backup
node backup.js
```

✅ **Esperado:**
```
╔══════════════════════════════════════════════════╗
║  [seu-projeto] Backup  —  2026-06-06 ...  ║
╚══════════════════════════════════════════════════╝

✓ tabela1        42 registros
✓ tabela2       156 registros
✓ tabela3        89 registros
...
✅ Backup concluído com sucesso!
```

❌ **Se falhar:**
- `HTTP 401` → Chave errada
- `ENOTFOUND` → URL Supabase errada
- Outro erro → Ver BACKUP_SETUP_GUIDE.md FASE 7

```
☐ Backup local funcionou sem erros
☐ Pasta dados/$(date +%Y-%m-%d)/ foi criada
☐ Arquivo _resumo.json existe
☐ Arquivo _backup_completo.json existe
```

**→ Quando tudo ok:** Fazer deploy no NAS

---

## FASE 4️⃣: DEPLOY NO NAS

### Copiar pasta backup/ para NAS:

```bash
# Via SCP (SSH)
scp -r backup/ admin@192.168.1.100:/volume1/seu-projeto/

# Ou via UI do NAS: File Manager → Upload
```

### Navegar no NAS e iniciar:

```bash
# SSH no NAS
ssh admin@192.168.1.100

# Ir para pasta
cd /volume1/seu-projeto

# Iniciar Docker (background, auto-restart)
docker-compose up -d

# Ver container rodando
docker ps | grep backup
```

✅ **Esperado:**
```
CONTAINER ID   STATUS
abc123def456   Up 30 seconds
```

```
☐ Container está rodando (docker ps)
☐ Caminho /volume1/seu-projeto/dados existe
☐ Pasta dados/ tem permissão de escrita
```

**→ Quando container rodando:** Monitorar primeira execução

---

## FASE 5️⃣: MONITORAR PRIMEIRA EXECUÇÃO

### Ver logs em tempo real:

```bash
docker logs -f seu-novo-projeto-backup
```

**Vai aparecer em ~1 min:**

```
[Scheduler] Executando backup inicial de verificação...

╔══════════════════════════════════════════════════╗
║  [seu-projeto] Backup  —  2026-06-06 ...  ║
╚══════════════════════════════════════════════════╝

✓ tabela1        42 registros
✓ tabela2       156 registros
...
✅ Backup concluído com sucesso!

[Scheduler] Próximo backup em 1h 45min
```

```
☐ Vejo "✓" para cada tabela
☐ Vejo "✅ Backup concluído com sucesso!"
☐ Vejo "Próximo backup em X horas"
```

### Validar arquivos criados:

```bash
# Ver pasta criada
ls /volume1/seu-projeto/dados/

# Ver conteúdo
ls -lh /volume1/seu-projeto/dados/$(date +%Y-%m-%d)/

# Deve ter:
# - tabela1.json
# - tabela2.json
# - _backup_completo.json
# - _resumo.json
```

```
☐ Pasta com data de hoje existe
☐ Todos os .json estão presentes
☐ Arquivo _resumo.json tem no máximo 1-2 KB
```

### Verificar se não houve erros:

```bash
cat /volume1/seu-projeto/dados/$(date +%Y-%m-%d)/_resumo.json
```

**Esperado:**
```json
{
  "data": "2026-06-06",
  "hora": "02-15-30",
  "empresa": "sua-empresa",
  "tabelas": {
    "tabela1": 42,
    "tabela2": 156,
    ...
  },
  "erro": null
}
```

```
☐ Campo "erro" é null (sem erros)
☐ Todas as tabelas têm contagem > 0
```

**→ Quando tudo validado:** Backup funcionando! ✅

---

## FASE 6️⃣: ACOMPANHAMENTO MENSAL

### 1º de cada mês:

```bash
# Ver tamanho dos backups
du -sh /volume1/seu-projeto/dados/*/

# Contar quantos dias tem
ls /volume1/seu-projeto/dados/ | wc -l
# Deve estar perto de 30-60 (conforme MANTER_DIAS)

# Ver último backup
ls -lh /volume1/seu-projeto/dados/ | tail -2
```

```
☐ Espaço em disco está normal (~300-500 MB total)
☐ Backup de ontem existe
☐ Contagem de dias = ~60 (conforme MANTER_DIAS)
```

### Se quiser trocar horário ou dias:

Editar `docker-compose.yml`:
```yaml
environment:
  MANTER_DIAS: "90"   # trocar aqui
```

Depois:
```bash
docker-compose restart
```

```
☐ Atualizei MANTER_DIAS se necessário
☐ Reiniciei container com docker-compose restart
```

---

## ❌ TROUBLESHOOTING RÁPIDO

| Problema | Comando para diagnosticar | Solução |
|----------|---------------------------|---------|
| Container não roda | `docker ps` | Ver `docker logs seu-app` |
| Sem permissão NAS | `ls -la /volume1/seu-projeto/` | `chmod 755` pasta |
| Backup falhou | `cat _resumo.json` | Ver campo "erro" |
| Espaço cheio | `du -sh /volume1/seu-projeto/` | Reduzir MANTER_DIAS |
| Quer trocar horário | `grep setHours scheduler.js` | Editar e reiniciar |

```
☐ Problema diagnosticado
☐ Solução aplicada
☐ Container reiniciado se necessário
```

---

## ✨ STATUS FINAL

```
✅ Sistema de backup funcionando
✅ Docker rodando 24/7 no NAS
✅ Backup automático diário às [SEU_HORÁRIO]
✅ Histórico de 60 dias mantido
✅ Todos os arquivos JSON gerados corretamente
✅ Zero erros nos últimos backups

🎉 PRONTO PARA PRODUÇÃO!
```

---

## 📋 REFERÊNCIA DE ARQUIVOS

Se precisar verificar algo:

| Preciso de... | Abro arquivo... |
|---------------|-----------------|
| Entender tudo | BACKUP_REPLICATION_README.md |
| Guia detalhado | BACKUP_SETUP_GUIDE.md |
| Templates dos 4 arquivos | BACKUP_FILES_TEMPLATE.md |
| Esse checklist | BACKUP_QUICK_CHECKLIST.md |
| Código real (referência) | backup/ (arquivos originais) |

---

**Última atualização:** 2026-06-06  
**Sistema de referência:** RH-App  
**Próximos projetos:** Cole BACKUP_PROMPT_PARA_COLAR.txt em nova conversa
