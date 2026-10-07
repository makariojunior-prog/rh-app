# 🔧 GUIA UNIVERSAL: REPLICAR SISTEMA DE BACKUP SUPABASE

## OBJETIVO
Implementar backup automático diário (JSON) de projeto Supabase rodando em Docker no NAS Ugreen, com retenção de 60 dias.

---

## FASE 1: ENTENDER O PROJETO-ALVO

### Perguntas de Diagnóstico (Fazer essas perguntas primeiro)

Quando você estiver em outro projeto, comece respondendo estas perguntas:

```
1. PROJETO SUPABASE
   □ URL do projeto: https://seu-projeto.supabase.co
   □ Chave anônima (anon_key): [obtém em Project Settings → API]
   □ Nome da empresa/empresa_id: [valor que filtra os dados]
   
2. ESTRUTURA DO BANCO
   □ Quantas tabelas tem?
   □ Quais são os nomes exatos das tabelas?
   □ Todas têm coluna "empresa_id"? (SIM/NÃO)
   
3. NAS / ARMAZENAMENTO
   □ Tem Docker instalado no NAS? (SIM/NÃO)
   □ Caminho disponível para backup: /volume1/seu-projeto/dados
   □ Espaço disponível no NAS: quantos GB?
   
4. HORÁRIO
   □ Em qual timezone está o NAS?
   □ Que horário quer fazer backup? (ex: 02:00 AM)
```

---

## FASE 2: EXPLORAR PROJETO ATUAL (RH-APP)

### Comandos para Claude entender a estrutura existente

```bash
# 1. VER ARQUIVOS DE BACKUP
ls -la backup/

# 2. LER backup.js (ver quais tabelas estão sendo feitas backup)
head -n 50 backup/backup.js
grep "nome: '" backup/backup.js

# 3. LER docker-compose.yml (ver configurações)
cat backup/docker-compose.yml

# 4. VER HISTÓRICO DE BACKUPS NO NAS
ls -lh /volume1/rh-backup/dados/ | tail -10

# 5. VER TAMANHO DOS BACKUPS RECENTES
du -sh /volume1/rh-backup/dados/$(date +%Y-%m-%d)
```

---

## FASE 3: ADAPTAR PARA NOVO PROJETO

### 3.1 Identificar as tabelas do novo projeto

**Para o novo projeto, você precisa LISTAR as tabelas no Supabase:**

```bash
# Via CLI Supabase
supabase db ls

# Ou ir em: https://seu-novo-projeto.supabase.co
# → Database → Tables → Copiar nomes das tabelas
```

**Formato esperado (exemplo):**
```javascript
const TABELAS = [
  { nome: 'tabela1', order: 'id', limit: 10000 },
  { nome: 'tabela2', order: 'id', limit: 10000 },
  { nome: 'tabela3', order: 'data', limit: 50000 }, // se tem muitos registros
];
```

---

### 3.2 Criar pasta de backup no novo projeto

```bash
# Assumindo que você está na raiz do novo projeto
mkdir -p backup/

# Você vai colocar 4 arquivos nessa pasta:
# - backup.js
# - scheduler.js
# - Dockerfile
# - docker-compose.yml
```

---

### 3.3 Adaptar backup.js

**Alterações necessárias no arquivo:**

```javascript
// LINHA ~29: Ajustar lista de tabelas

// ANTES (RH-App)
const TABELAS = [
  { nome: 'colaboradores', order: 'id', limit: 10000 },
  { nome: 'atestados', order: 'id', limit: 10000 },
  // ... etc
];

// DEPOIS (Seu novo projeto)
const TABELAS = [
  { nome: 'sua_tabela_1', order: 'id', limit: 10000 },
  { nome: 'sua_tabela_2', order: 'id', limit: 10000 },
  // ... adicionar TODAS as tabelas
];
```

**Regras:**
- ✅ Cada tabela precisa ter coluna `empresa_id` para ser filtrada
- ⚠️ Se tabela não tem `empresa_id`, remove do backup (ou remove o filtro `empresa_id=eq.EMPRESA_ID`)
- 📊 Se tabela tem > 50k registros, mude `limit: 50000`
- 🔤 Use `order` que faz sentido: `id`, `data`, `periodo`, etc

---

### 3.4 Adaptar docker-compose.yml

**Alterações necessárias:**

```yaml
# ANTES (RH-App)
services:
  rh-backup:
    build: .
    container_name: rh-app-backup
    environment:
      SUPABASE_URL: "https://taicaxtjtikdajmhtsxc.supabase.co"
      SUPABASE_KEY: "eyJhbGciOiJS..."  # chave original
      EMPRESA_ID: "cantina"
      MANTER_DIAS: "60"
      TZ: "America/Sao_Paulo"
      BACKUP_DIR: "/backups"
    volumes:
      - /volume1/rh-backup/dados:/backups

# DEPOIS (Seu novo projeto)
services:
  seu-projeto-backup:  # TROCAR NOME
    build: .
    container_name: seu-projeto-backup  # TROCAR NOME
    environment:
      SUPABASE_URL: "https://seu-novo-projeto.supabase.co"  # ← TROCAR
      SUPABASE_KEY: "sua-chave-anon-do-novo-projeto"  # ← TROCAR
      EMPRESA_ID: "sua-empresa-id"  # ← TROCAR
      MANTER_DIAS: "60"
      TZ: "America/Sao_Paulo"  # TROCAR timezone se necessário
      BACKUP_DIR: "/backups"
    volumes:
      - /volume1/seu-novo-projeto/dados:/backups  # ← TROCAR caminho NAS
```

---

### 3.5 Scheduler.js (SEM alterações necessárias)

O arquivo `scheduler.js` é genérico e funciona para qualquer projeto. 

⚠️ Se você quer horário diferente de 02:00 AM, altere:

```javascript
// LINHA ~13: Horário do backup
prox.setHours(2, 0, 0, 0);  // Alterar para setHours(XX, 0, 0, 0)
// Exemplo: setHours(22, 0, 0, 0) para 22:00 (10 PM)
```

---

### 3.6 Dockerfile (SEM alterações necessárias)

Use exatamente como está. É universal.

---

## FASE 4: CHECKLIST DE VALIDAÇÃO

Antes de fazer deploy no NAS, execute TODOS esses testes:

### 4.1 Testar credenciais Supabase

```bash
# Vai testar se consegue conectar ao Supabase
node backup.js

# Esperado:
# ✓ tabela1          42 registros
# ✓ tabela2         156 registros
# ...
# ✅ Backup concluído com sucesso!
```

### 4.2 Validar formato JSON

```bash
# Verificar se JSON foi criado corretamente
ls -la dados/$(date +%Y-%m-%d)/

# Validar JSON (nenhum erro deve aparecer)
jq . dados/$(date +%Y-%m-%d)/_resumo.json

# Ver tamanho total do backup
du -sh dados/$(date +%Y-%m-%d)
```

### 4.3 Testar scheduler (opcional)

```bash
# Roda backup inicial + agenda próximo
node scheduler.js

# Vai imprimir:
# ====================================================
#  RH-App Backup Scheduler
#  Backup diário agendado para 02:00 (America/Sao_Paulo)
# ====================================================
# [Scheduler] Executando backup inicial de verificação...
```

### 4.4 Testar em Docker

```bash
# Construir imagem
docker build -t seu-projeto-backup .

# Rodar container
docker run -it \
  -e SUPABASE_URL="https://seu-projeto.supabase.co" \
  -e SUPABASE_KEY="sua-chave" \
  -e EMPRESA_ID="sua-empresa" \
  -e BACKUP_DIR="/backups" \
  -v $(pwd)/dados:/backups \
  seu-projeto-backup

# Esperado: backup executado com sucesso
```

---

## FASE 5: DEPLOY NO NAS

### 5.1 Copiar para NAS

```bash
# Via SCP (se acesso SSH)
scp -r backup/ admin@192.168.1.100:/volume1/seu-novo-projeto/

# Ou via UI do NAS: File Manager → upload pasta backup/
```

### 5.2 Iniciar com docker-compose

```bash
# SSH no NAS
ssh admin@192.168.1.100

# Navegar até pasta
cd /volume1/seu-novo-projeto

# Iniciar (em background, auto-restart)
docker-compose up -d

# Ver container rodando
docker ps | grep backup
```

### 5.3 Monitorar primeira execução

```bash
# Ver logs em tempo real
docker logs -f seu-novo-projeto-backup

# Esperado dentro de ~1 minuto:
# ✓ tabela1
# ✓ tabela2
# ...
# ✅ Backup concluído com sucesso!
```

### 5.4 Validar primeira execução

```bash
# Ver pasta criada
ls /volume1/seu-novo-projeto/dados/

# Ver conteúdo
ls /volume1/seu-novo-projeto/dados/$(date +%Y-%m-%d)/

# Deve ter: tabela1.json, tabela2.json, _backup_completo.json, _resumo.json
```

---

## FASE 6: MONITORAMENTO CONTÍNUO

### Checklist de acompanhamento (fazer 1x/mês)

```bash
# 1. Backup rodou hoje?
ls -lh /volume1/seu-novo-projeto/dados/$(date +%Y-%m-%d)/

# 2. Tamanho está normal?
du -sh /volume1/seu-novo-projeto/dados/$(date +%Y-%m-%d)
# (Comparar com dia anterior: du -sh /volume1/seu-novo-projeto/dados/*/  | tail -5)

# 3. Houve erros?
cat /volume1/seu-novo-projeto/dados/$(date +%Y-%m-%d)/_resumo.json | jq .erro

# 4. Container está saudável?
docker ps | grep seu-novo-projeto-backup
# Status deve ser "Up"

# 5. Discos antigos foram removidos? (deve ter máx 60 dias)
ls /volume1/seu-novo-projeto/dados/ | wc -l
# (Deve estar perto de 60)
```

---

## FASE 7: TROUBLESHOOTING

### Problema: Backup falhou

```bash
# Ver último erro
docker logs seu-novo-projeto-backup | tail -50

# Causas comuns:
# ❌ SUPABASE_KEY incorreta → Gerar nova em Project Settings
# ❌ EMPRESA_ID não existe → Usar valor real do banco
# ❌ Tabela foi deletada → Remover da lista TABELAS
# ❌ Permissões NAS → Verificar /volume1/seu-novo-projeto é writable
```

### Problema: Espaço em disco cheio

```bash
# Ver quanto espaço usa
du -sh /volume1/seu-novo-projeto/dados/

# Aumentar retenção (ex: 30 dias em vez de 60)
# Editar docker-compose.yml:
# MANTER_DIAS: "30"

# Depois: docker-compose restart
```

### Problema: Quer correr outro horário

```bash
# Editar scheduler.js linha ~13
prox.setHours(HH, 0, 0, 0);  # HH = 0-23

# Exemplo: 22:00
prox.setHours(22, 0, 0, 0);

# Depois: docker-compose restart
```

---

## CHECKLIST FINAL (copia e cola em outra conversa)

Quando for usar em OUTRO PROJETO, cole isso no chat:

```
# PASSO A PASSO PARA REPLICAR BACKUP AUTOMÁTICO

## Respostas às perguntas de diagnóstico:
- URL Supabase: [RESPOSTA]
- Chave anónima: [RESPOSTA]
- Empresa_id: [RESPOSTA]
- Tabelas do banco: [RESPOSTA]
- Timezone: [RESPOSTA]
- Horário preferido para backup: [RESPOSTA]
- Caminho NAS: /volume1/[RESPOSTA]/dados

## Instruções:

1. Você tem os 4 arquivos? (backup.js, scheduler.js, Dockerfile, docker-compose.yml)
   - Sim, adapte TABELAS em backup.js
   - Sim, adapte credenciais em docker-compose.yml
   - Teste com: node backup.js
   - Faça deploy no NAS com: docker-compose up -d
   
2. Validar com: docker logs seu-novo-projeto-backup
```

---

## ESTRUTURA FINAL ESPERADA

```
seu-novo-projeto/
├── backup/
│   ├── backup.js              ✅ ADAPTADO (tabelas, empresa_id)
│   ├── scheduler.js           ✅ OK (genérico)
│   ├── Dockerfile             ✅ OK (genérico)
│   └── docker-compose.yml     ✅ ADAPTADO (credenciais, caminho NAS)
├── seu_codigo_aqui/
└── README.md

NAS (/volume1/seu-novo-projeto/dados/):
├── 2026-06-01/
│   ├── tabela1.json
│   ├── tabela2.json
│   ├── _backup_completo.json
│   └── _resumo.json
├── 2026-06-02/
│   ├── ...
└── 2026-07-31/
    ├── ... (último de 60 dias)
```

---

## TEMPO ESTIMADO

- Entender estrutura: 5 min
- Adaptar arquivos: 10 min
- Testar localmente: 5 min
- Deploy no NAS: 5 min
- **Total: ~25 minutos**

---

## ARQUIVO-CHAVE PARA SEMPRE VERIFICAR

Quando em dúvida, sempre volte a:
```
/volume1/seu-novo-projeto/dados/$(date +%Y-%m-%d)/_resumo.json
```

Esse arquivo tem TUDO o que você precisa saber sobre o status do backup de hoje.

---

**FIM DO GUIA**

Cole este arquivo em conversas futuras para rapidamente replicar em novos projetos.
