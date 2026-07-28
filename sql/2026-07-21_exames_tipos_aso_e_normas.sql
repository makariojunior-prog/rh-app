-- =====================================================================
-- RH-App · Migração 2026-07-21
-- (1) Separa "Tipo (ASO)" de "Procedimento" no módulo Exames
-- (2) Cria a biblioteca de Normas (NRs e obrigações) + destaques no texto
-- Aditiva: não altera nem apaga nenhum dado existente.
-- Rode no Supabase → SQL Editor. Pode rodar mais de uma vez com segurança.
-- =====================================================================

-- ── 1) Tipo (ASO) x Procedimento ────────────────────────────────────
-- Modelo pai-filho: tipos_exame = TIPO do ASO (Admissional, Periódico, Demissional...)
-- e procedimentos_exame = os procedimentos daquele tipo (Glicose, ECG, Raio-X...).
create table if not exists public.procedimentos_exame (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  tipo_exame_id text not null,
  nome text not null,
  valor_estimado numeric,
  ativo boolean not null default true,
  ordem integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_proc_exame_empresa on public.procedimentos_exame(empresa_id);
create index if not exists idx_proc_exame_tipo on public.procedimentos_exame(tipo_exame_id);

alter table public.procedimentos_exame enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='procedimentos_exame') then
    create policy "authenticated full access procedimentos_exame"
      on public.procedimentos_exame for all to authenticated using (true) with check (true);
  end if;
end $pol$;

-- Procedimentos efetivamente realizados ficam registrados no exame do colaborador.
alter table public.colaborador_exames add column if not exists procedimentos jsonb;
-- Clínica/prestador que realizou o exame.
alter table public.colaborador_exames add column if not exists prestador text;

-- Tipos de ASO previstos na NR-7.
insert into public.tipos_exame (empresa_id, nome, tem_vencimento, recorrencia_valor, recorrencia_unidade, ativo, ordem, obs)
select e.emp, v.nome, v.venc, v.rec, case when v.venc then 'meses' else null end, true, v.ord, v.obs
from (values ('cantina'), ('lumar')) as e(emp)
cross join (values
  ('Admissional',                  false, null::integer, 1, 'Antes de o trabalhador iniciar suas atividades (NR-7).'),
  ('Periódico',                    true,  12,            2, 'Anual para expostos a risco ocupacional ou portadores de doença crônica; a cada 2 anos para os demais (NR-7).'),
  ('Retorno ao Trabalho',          false, null,          3, 'Obrigatório após afastamento por 30 dias ou mais por doença/acidente, e no retorno de licença-maternidade (NR-7).'),
  ('Mudança de Risco Ocupacional', false, null,          4, 'Antes da mudança que altere a exposição do trabalhador a riscos (NR-7).'),
  ('Demissional',                  false, null,          5, 'No encerramento do contrato, dentro dos prazos da NR-7.')
) as v(nome, venc, rec, ord, obs)
where not exists (
  select 1 from public.tipos_exame t
  where t.empresa_id = e.emp and t.nome = v.nome
);

-- ── 2) Biblioteca de Normas ─────────────────────────────────────────
create table if not exists public.normas_sst (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  codigo text not null,
  titulo text not null,
  orgao text,
  categoria text,              -- 'NR' | 'Sanitária' | 'Lei' | 'eSocial'
  prioridade text,             -- 'critica' | 'alta' | 'media'
  aplicabilidade text,
  resumo text,
  texto text,                  -- parágrafos separados por linha em branco
  link_oficial text,
  ultima_atualizacao text,
  ativo boolean not null default true,
  ordem integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_normas_empresa on public.normas_sst(empresa_id);

create table if not exists public.normas_destaques (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  norma_id text not null,
  paragrafo_idx integer not null,
  trecho text,
  tipo text not null,          -- 'critico' | 'importante' | 'prazo' | 'atencao'
  nota text,
  criado_por text,
  created_at timestamptz not null default now()
);
create index if not exists idx_destaques_norma on public.normas_destaques(norma_id);

alter table public.normas_sst enable row level security;
alter table public.normas_destaques enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='normas_sst') then
    create policy "authenticated full access normas_sst"
      on public.normas_sst for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='normas_destaques') then
    create policy "authenticated full access normas_destaques"
      on public.normas_destaques for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ── 3) Conteúdo inicial: normas vigentes para indústria de alimentos ──
insert into public.normas_sst (empresa_id, codigo, titulo, orgao, categoria, prioridade, aplicabilidade, resumo, texto, link_oficial, ultima_atualizacao, ordem)
select e.emp, v.codigo, v.titulo, v.orgao, v.categoria, v.prioridade, v.aplic, v.resumo, v.texto, v.link, v.atual, v.ord
from (values ('cantina'), ('lumar')) as e(emp)
cross join (values

('NR-01', 'Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO/PGR)', 'MTE', 'NR', 'critica',
 'Todas as empresas com empregados CLT.',
 'Norma-mãe do sistema de SST. Obriga o Programa de Gerenciamento de Riscos (PGR) e, desde 2025, a inclusão dos riscos psicossociais.',
 $t$A NR-01 estabelece as disposições gerais e as diretrizes do Gerenciamento de Riscos Ocupacionais (GRO). É a norma que organiza todo o restante do sistema de SST da empresa.

O principal documento exigido é o PGR (Programa de Gerenciamento de Riscos), composto pelo Inventário de Riscos e pelo Plano de Ação. Ele deve identificar os perigos, avaliar os riscos e definir medidas de prevenção, com prazos e responsáveis.

ATENÇÃO — RISCOS PSICOSSOCIAIS: a Portaria MTE nº 1.419, de 27/08/2024, incluiu expressamente os riscos psicossociais no GRO. A norma entrou em vigor em maio de 2025, com um ano de caráter educativo/orientativo.

PRAZO CRÍTICO: a partir de 26/05/2026 a fiscalização passa a ter caráter plenamente punitivo. Empresas sem PGR contemplando riscos psicossociais ficam sujeitas a autuação pela Inspeção do Trabalho.

Riscos psicossociais incluem, entre outros: sobrecarga e ritmo excessivo de trabalho, jornadas extensas, metas abusivas, assédio moral e sexual, falta de autonomia e conflitos interpessoais — fatores frequentes em linhas de produção com ritmo acelerado.

O empregador também deve garantir treinamento, capacitação e informação aos trabalhadores sobre os riscos e as medidas de controle, com registro documental.

Microempresas e EPP de grau de risco 1 e 2 podem ter tratamento simplificado, mas a dispensa não alcança empresas de grau de risco 3 e 4 — caso típico da indústria de alimentos.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Portaria MTE 1.419/2024 · fiscalização punitiva a partir de 26/05/2026', 1),

('NR-04', 'Serviços Especializados em Segurança e Medicina do Trabalho (SESMT)', 'MTE', 'NR', 'alta',
 'Dimensionado pelo grau de risco (CNAE) e nº de empregados.',
 'Define se a empresa precisa manter equipe própria de SST (técnico/engenheiro de segurança, médico do trabalho).',
 $t$A NR-04 determina o dimensionamento do SESMT — Serviços Especializados em Engenharia de Segurança e em Medicina do Trabalho — conforme o grau de risco da atividade (CNAE) e o número total de empregados do estabelecimento.

A indústria de alimentos costuma se enquadrar em grau de risco 3, o que antecipa a obrigatoriedade de profissionais de SST em relação a atividades administrativas.

Havendo obrigatoriedade, os profissionais devem ser registrados no órgão competente e suas atividades documentadas.

Mesmo quando não há obrigatoriedade de SESMT próprio, a empresa permanece integralmente responsável pelo cumprimento das demais NRs, normalmente via assessoria externa.

Verifique o dimensionamento sempre que o quadro de empregados crescer — a mudança de faixa gera obrigação imediata.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 2),

('NR-05', 'CIPA — Comissão Interna de Prevenção de Acidentes e de Assédio', 'MTE', 'NR', 'alta',
 'Empresas conforme quadro I da norma (por CNAE e nº de empregados).',
 'Constituição e funcionamento da CIPA, com eleição, treinamento, reuniões mensais e atribuições de prevenção ao assédio.',
 $t$A NR-05 regula a CIPA, que passou a se chamar Comissão Interna de Prevenção de Acidentes e de Assédio após a Lei nº 14.457/2022.

O dimensionamento segue o Quadro I da norma, cruzando o CNAE com o número de empregados do estabelecimento. É obrigatório processo eleitoral com edital, inscrição, votação secreta e ata.

Os membros eleitos e indicados têm direito a treinamento antes da posse, com carga horária definida pela norma, e devem realizar reuniões ordinárias mensais com ata registrada.

ATENÇÃO — ASSÉDIO: a Lei 14.457/2022 acrescentou às atribuições da CIPA a inclusão de regras de conduta contra assédio sexual e demais violências, a fixação de procedimentos de denúncia e a realização de ações de capacitação sobre o tema, no mínimo a cada 12 meses.

O membro eleito titular tem estabilidade provisória no emprego desde o registro da candidatura até um ano após o fim do mandato.

Quando não há obrigatoriedade de CIPA, a empresa deve designar um responsável pelo cumprimento dos objetivos da norma.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Lei 14.457/2022 (assédio) · vigente', 3),

('NR-06', 'Equipamentos de Proteção Individual (EPI)', 'MTE', 'NR', 'alta',
 'Todos os trabalhadores expostos a riscos.',
 'Fornecimento gratuito de EPI com CA válido, treinamento, higienização, substituição e registro de entrega.',
 $t$A NR-06 obriga o empregador a fornecer gratuitamente EPI adequado ao risco, em perfeito estado de conservação e funcionamento, sempre que as medidas de proteção coletiva forem inviáveis ou insuficientes.

Todo EPI deve possuir Certificado de Aprovação (CA) válido. EPI com CA vencido não é aceito pela fiscalização.

É obrigatório registrar a entrega do EPI (ficha física ou eletrônica, com assinatura ou registro biométrico/eletrônico), permitindo comprovar fornecimento, troca e motivo da substituição.

Em ambiente frio e úmido — câmaras e salas climatizadas — a atenção recai sobre vestimenta térmica, luvas térmicas e antricorte, calçado impermeável antiderrapante e proteção auditiva quando houver ruído.

O empregador deve treinar o trabalhador quanto ao uso, guarda e conservação, e exigir o uso efetivo; o trabalhador que se recusa injustificadamente comete ato faltoso.

A higienização e a substituição periódica são responsabilidade do empregador, não do trabalhador.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 4),

('NR-07', 'PCMSO — Programa de Controle Médico de Saúde Ocupacional', 'MTE', 'NR', 'critica',
 'Todas as empresas com empregados CLT.',
 'Define os exames ocupacionais obrigatórios e o ASO. É a norma que sustenta este módulo de Exames.',
 $t$A NR-07 institui o PCMSO, que deve ser elaborado a partir dos riscos identificados no PGR (NR-01). Um não existe sem o outro.

São obrigatórios os exames médicos: ADMISSIONAL, PERIÓDICO, DE RETORNO AO TRABALHO, DE MUDANÇA DE RISCO OCUPACIONAL e DEMISSIONAL.

ADMISSIONAL: deve ser realizado antes que o trabalhador inicie suas atividades.

PERIÓDICO: anual (ou em intervalo menor, a critério do médico) para empregados expostos a riscos ocupacionais identificados no PGR e para portadores de doença crônica; a cada 2 anos para os demais.

RETORNO AO TRABALHO: obrigatório após afastamento por 30 dias ou mais por doença ou acidente, e no retorno da licença-maternidade.

MUDANÇA DE RISCO OCUPACIONAL: deve ocorrer antes da mudança que altere a exposição do trabalhador aos riscos.

DEMISSIONAL: realizado no encerramento do contrato, respeitados os prazos da norma conforme o último exame clínico.

Cada exame gera o ASO — Atestado de Saúde Ocupacional — que registra a aptidão ou inaptidão do trabalhador para a função, considerando os riscos a que está exposto. Uma via é entregue ao trabalhador.

Os registros e prontuários devem ser mantidos por no mínimo 20 anos após o desligamento do trabalhador.

Os eventos de saúde devem ser transmitidos ao eSocial (evento S-2220 — Monitoramento da Saúde do Trabalhador).$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Atualizada em 2022 · vigente', 5),

('NR-09', 'Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos', 'MTE', 'NR', 'alta',
 'Ambientes com ruído, frio, agentes químicos e biológicos.',
 'Define como avaliar e controlar a exposição — base técnica para insalubridade e para o PGR.',
 $t$A NR-09 estabelece os critérios para avaliação e controle das exposições ocupacionais a agentes físicos, químicos e biológicos, integrando o PGR previsto na NR-01.

Na indústria de alimentos congelados, os agentes típicos são: FRIO (câmaras e salas climatizadas), RUÍDO (compressores, empacotadoras, sopradores), AGENTES BIOLÓGICOS (manipulação de matérias-primas) e AGENTES QUÍMICOS (produtos de higienização e amônia em sistemas de refrigeração).

As avaliações devem seguir hierarquia de controle: primeiro medidas de eliminação e de proteção coletiva; o EPI é a última linha.

Os resultados alimentam o LTCAT e a caracterização de insalubridade/periculosidade, além do PPP e do eSocial (evento S-2240 — Condições Ambientais do Trabalho).

Quando houver exposição acima do nível de ação, é obrigatório adotar plano de ação e monitoramento periódico.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 6),

('NR-11', 'Transporte, Movimentação, Armazenagem e Manuseio de Materiais', 'MTE', 'NR', 'alta',
 'Uso de empilhadeiras, paleteiras e armazenagem em altura.',
 'Habilitação de operadores, sinalização, empilhamento seguro e inspeção de equipamentos de movimentação.',
 $t$A NR-11 trata da segurança na movimentação e armazenagem de materiais — atividade constante em expedição, câmaras e estoque de congelados.

Operadores de empilhadeira devem ser capacitados e portar cartão/credencial de identificação com nome e fotografia, válido e visível.

Os equipamentos de transporte motorizado devem ter identificação da capacidade de carga, sinal de advertência sonoro e ser inspecionados periodicamente, com registro.

O empilhamento deve garantir estabilidade, respeitar a capacidade do piso e das estruturas porta-paletes e não obstruir portas de emergência, extintores ou quadros elétricos.

Corredores de circulação devem ser sinalizados e mantidos desobstruídos, com separação segura entre rotas de pedestres e de veículos.

Em rampas e pisos molhados/gelados — comuns em áreas frias — devem ser adotadas medidas contra queda e tombamento.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 7),

('NR-12', 'Segurança no Trabalho em Máquinas e Equipamentos', 'MTE', 'NR', 'critica',
 'Todas as máquinas da produção: misturadores, moedores, fatiadores, esteiras, empacotadoras.',
 'Proteções fixas e móveis intertravadas, dispositivos de parada de emergência, capacitação e inventário de máquinas.',
 $t$A NR-12 é uma das normas mais fiscalizadas e de maior risco de acidente grave na indústria de alimentos. Aplica-se a todas as máquinas e equipamentos, novos ou usados.

Toda zona de perigo deve possuir sistema de segurança — proteção fixa, proteção móvel intertravada ou dispositivo de segurança — que impeça o acesso enquanto houver risco.

Dispositivos de PARADA DE EMERGÊNCIA devem ser de fácil acesso, atuar em toda a extensão do equipamento e não gerar risco adicional ao serem acionados.

É obrigatório procedimento de bloqueio e etiquetagem de energias (lockout/tagout) para manutenção, limpeza e desobstrução — momentos em que ocorre a maior parte das amputações no setor.

A empresa deve manter INVENTÁRIO DE MÁQUINAS atualizado e apreciação de risco documentada por equipamento.

A capacitação dos operadores deve ser específica por máquina, com carga horária e registro, e reciclagem quando houver modificação do equipamento ou mudança de função.

Máquinas de alimentos exigem atenção redobrada em zonas de corte, esmagamento e arraste — moedores, fatiadores, misturadores e transportadores helicoidais.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 8),

('NR-13', 'Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos', 'MTE', 'NR', 'critica',
 'Sistemas de refrigeração por amônia, caldeiras e compressores.',
 'Inspeções periódicas por profissional habilitado, prontuário do equipamento e capacitação de operadores.',
 $t$A NR-13 aplica-se a caldeiras, vasos de pressão e tubulações — e alcança diretamente os SISTEMAS DE REFRIGERAÇÃO POR AMÔNIA (NH3) usados em câmaras de congelados, além de compressores e reservatórios de ar.

Cada equipamento deve possuir PRONTUÁRIO com documentação do fabricante, projeto, registro de segurança e relatórios de inspeção.

As inspeções de segurança (inicial, periódica e extraordinária) devem ser executadas por Profissional Legalmente Habilitado, com periodicidade definida pela norma e pela categoria do equipamento. O vencimento da inspeção é item clássico de autuação.

Operadores de caldeira exigem treinamento específico de segurança na operação, com carga horária definida e reciclagem.

Instalações com amônia devem ter plano de emergência, detectores de vazamento, ventilação adequada, EPI específico (máscara com filtro para NH3) e sinalização.

O vazamento de amônia é emergência grave: exige rota de fuga, ponto de encontro e brigada treinada.

Mantenha um calendário de vencimento das inspeções — este módulo de Exames pode ser espelhado para controlar essas datas.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 9),

('NR-15', 'Atividades e Operações Insalubres', 'MTE', 'NR', 'critica',
 'Trabalho em câmara fria, ruído, agentes químicos e biológicos.',
 'Define os limites de tolerância e o adicional de insalubridade (10%, 20% ou 40%). Anexo 9 trata do FRIO.',
 $t$A NR-15 define as atividades insalubres e os respectivos adicionais: 10% (grau mínimo), 20% (grau médio) e 40% (grau máximo) — calculados sobre o salário mínimo, salvo norma coletiva mais benéfica.

ANEXO 9 — FRIO: as atividades executadas no interior de câmaras frigoríficas, ou em locais com condições similares que exponham o trabalhador ao frio sem proteção adequada, são consideradas insalubres.

ATENÇÃO: o Anexo 9 NÃO fixa limite de tolerância de tempo. Para a caracterização, o que importa é a exposição sem proteção eficaz — não a duração.

O fornecimento de vestimenta térmica adequada e a existência de pausas em ambiente aquecido são os principais elementos para descaracterizar ou reduzir o adicional. Documente rigorosamente a entrega dos EPIs térmicos.

ANEXO 1 e 2 — RUÍDO: limite de tolerância de 85 dB(A) para 8 horas de jornada. Áreas de compressores e empacotadoras costumam ultrapassar.

ANEXO 11 — AGENTES QUÍMICOS: inclui a amônia, com limite de tolerância definido; relevante para as casas de máquinas de refrigeração.

ANEXO 14 — AGENTES BIOLÓGICOS: pode incidir conforme a matéria-prima manipulada.

A caracterização depende de laudo técnico (LTCAT/laudo de insalubridade) elaborado por médico do trabalho ou engenheiro de segurança.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 10),

('NR-17', 'Ergonomia', 'MTE', 'NR', 'alta',
 'Linhas de produção, embalagem, expedição e postos administrativos.',
 'Exige adaptação do trabalho ao trabalhador e Análise Ergonômica do Trabalho (AET) quando indicada.',
 $t$A NR-17 exige que as condições de trabalho sejam adaptadas às características psicofisiológicas dos trabalhadores. Em linhas de produção de alimentos, é a norma que mais gera passivo trabalhista por LER/DORT.

Deve ser realizada a Avaliação Ergonômica Preliminar e, quando identificada necessidade, a ANÁLISE ERGONÔMICA DO TRABALHO (AET) completa, com plano de ação.

Pontos críticos no setor: movimentos repetitivos em ritmo elevado, posturas em pé prolongadas, levantamento manual de cargas, trabalho em bancadas com altura inadequada e uso de força para corte e embalagem.

O mobiliário e os postos devem permitir alternância de postura; assentos devem ser disponibilizados para pausas quando a atividade é executada em pé.

O ritmo de trabalho não pode exigir esforço além da capacidade — metas de produção que induzam sobrecarga têm sido enquadradas também como risco psicossocial (NR-01).

Pausas para recuperação psicofisiológica devem constar da organização do trabalho e ser efetivamente cumpridas e registradas.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 11),

('NR-20', 'Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis', 'MTE', 'NR', 'media',
 'Armazenagem/uso de GLP, óleo diesel e combustíveis de caldeira.',
 'Classifica a instalação e define capacitações obrigatórias conforme a classe.',
 $t$A NR-20 aplica-se às atividades de extração, produção, armazenamento, manuseio e manipulação de inflamáveis e combustíveis — inclusive GLP de empilhadeiras e óleo/lenha/gás usados em caldeiras.

A instalação é classificada (Classe I, II ou III) conforme o tipo e a quantidade armazenada, e a classificação define quais capacitações são exigidas (Integração, Básico, Intermediário ou Avançado).

É necessário manter documentação do projeto da instalação, procedimentos operacionais e plano de resposta a emergências.

Os trabalhadores envolvidos devem ter capacitação específica, com reciclagem periódica definida pela norma.

Verifique a classificação da sua instalação antes de dimensionar treinamentos — capacitação em nível inferior ao exigido é irregularidade comum.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 12),

('NR-23', 'Proteção Contra Incêndios', 'MTE', 'NR', 'alta',
 'Todos os estabelecimentos.',
 'Saídas de emergência, equipamentos de combate a incêndio e treinamento de evacuação.',
 $t$A NR-23 exige que todos os trabalhadores sejam treinados quanto à utilização dos equipamentos de combate a incêndio, aos procedimentos de evacuação e aos dispositivos de alarme.

As saídas de emergência devem estar sinalizadas, desobstruídas e com abertura no sentido do fluxo de saída. Em câmaras frias, o dispositivo de abertura interna é item de segurança de vida.

Extintores e hidrantes devem estar dentro da validade, desobstruídos, sinalizados e com inspeção registrada.

O AVCB/CLCB (auto de vistoria do Corpo de Bombeiros) é exigência estadual complementar — controle o vencimento junto com as demais licenças.

Recomenda-se realizar exercício simulado de abandono periodicamente, com registro de participação.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 13),

('NR-24', 'Condições Sanitárias e de Conforto nos Locais de Trabalho', 'MTE', 'NR', 'media',
 'Vestiários, sanitários, refeitório e área de descanso.',
 'Define instalações sanitárias, vestiários com armários e local para refeições.',
 $t$A NR-24 estabelece os requisitos de instalações sanitárias, vestiários, refeitórios e locais de descanso.

Devem existir instalações sanitárias separadas por sexo, em número proporcional ao contingente, mantidas higienizadas e com material de higiene disponível.

Vestiários são obrigatórios quando a atividade exige troca de roupa, situação padrão na indústria de alimentos — com armários individuais para guarda de pertences e separação entre uniforme e roupa pessoal.

Deve ser garantido local adequado para refeições, fora do posto de trabalho, com condições de higiene e conforto.

Em trabalho com exposição ao frio, o local de descanso aquecido para as pausas é elemento essencial — dialoga diretamente com a NR-36 e com a caracterização de insalubridade da NR-15.

Fornecimento de água potável em condições higiênicas é obrigatório, vedado o uso de copo coletivo.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 14),

('NR-26', 'Sinalização de Segurança', 'MTE', 'NR', 'media',
 'Toda a planta industrial.',
 'Cores de segurança, rotulagem preventiva de produtos químicos (GHS) e FISPQ.',
 $t$A NR-26 padroniza as cores e a sinalização de segurança nos locais de trabalho, incluindo identificação de tubulações, equipamentos e áreas de risco.

Produtos químicos devem ter ROTULAGEM PREVENTIVA conforme o Sistema Globalmente Harmonizado (GHS), com pictogramas, palavra de advertência e frases de perigo.

A FISPQ (Ficha de Informação de Segurança de Produto Químico) deve estar disponível e acessível aos trabalhadores para todos os produtos utilizados — inclusive sanitizantes, detergentes alcalinos e ácidos usados na higienização.

Os trabalhadores devem ser treinados para compreender a rotulagem e as informações da FISPQ.

Tubulações de amônia e demais fluidos devem ser identificadas por cor e sentido de fluxo.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 15),

('NR-33', 'Segurança e Saúde nos Trabalhos em Espaços Confinados', 'MTE', 'NR', 'alta',
 'Tanques, silos, reservatórios e casas de máquinas fechadas.',
 'Permissão de Entrada e Trabalho (PET), vigia, medição de atmosfera e capacitação específica.',
 $t$A NR-33 aplica-se a qualquer espaço não projetado para ocupação humana contínua, com meios limitados de entrada e saída e ventilação insuficiente — como tanques, silos, reservatórios e certas casas de máquinas.

Antes de cada entrada é obrigatória a PERMISSÃO DE ENTRADA E TRABALHO (PET), com avaliação prévia da atmosfera (oxigênio, gases inflamáveis e tóxicos).

É obrigatória a presença de VIGIA permanente fora do espaço, com meio de comunicação e capacidade de acionar resgate.

Capacitação específica é exigida para trabalhadores autorizados, vigias e supervisores de entrada, com reciclagem anual.

Deve existir plano de resgate com equipe e equipamentos disponíveis durante toda a execução — nunca improvisado.

A entrada não autorizada em espaço confinado é uma das principais causas de acidentes fatais múltiplos (vítima + socorristas).$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 16),

('NR-35', 'Trabalho em Altura', 'MTE', 'NR', 'alta',
 'Manutenção de telhados, câmaras, estruturas elevadas e uso de escadas acima de 2 m.',
 'Análise de Risco, Permissão de Trabalho, capacitação e sistema de proteção contra quedas.',
 $t$A NR-35 aplica-se a toda atividade executada acima de 2,00 m do nível inferior onde haja risco de queda — inclui manutenção de telhados, iluminação, estruturas de câmaras e uso de escadas e plataformas.

É obrigatória Análise de Risco (AR) e, para atividades não rotineiras, Permissão de Trabalho (PT) emitida antes do início.

Os trabalhadores devem ser capacitados (carga horária mínima definida na norma) com reciclagem bienal, e considerados aptos por avaliação de saúde específica no PCMSO.

O sistema de proteção contra quedas — coletivo (guarda-corpo) prioritariamente, ou individual (cinturão tipo paraquedista com talabarte e ponto de ancoragem certificado) — deve ser adequado e inspecionado.

Deve existir plano de emergência e resgate específico para trabalho em altura, incluindo prevenção do trauma por suspensão.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes',
 'Vigente', 17),

('NR-36', 'Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados', 'MTE', 'NR', 'critica',
 'Aplicável a empresas de abate e processamento de carnes e derivados — verifique o enquadramento da sua atividade.',
 'Norma setorial mais completa para frigoríficos: mobiliário, ritmo, pausas obrigatórias, ambiente frio e ergonomia.',
 $t$A NR-36 é a norma SETORIAL para empresas de abate e processamento de carnes e derivados. Se a operação envolve processamento de produtos de origem animal, ela é a norma mais detalhada e mais cobrada pela fiscalização.

PAUSAS OBRIGATÓRIAS: a norma prevê pausas para recuperação psicofisiológica ao longo da jornada, em local apropriado, aquecido e fora do ambiente produtivo. O tempo de pausa é computado como tempo de trabalho efetivo.

TRABALHO EM AMBIENTE ARTIFICIALMENTE FRIO: a cada período de trabalho contínuo em ambiente frio deve haver pausa em local aquecido. Câmaras com temperatura igual ou inferior a -18°C devem possuir indicação do TEMPO MÁXIMO DE PERMANÊNCIA no local.

ERGONOMIA: exige Análise Ergonômica do Trabalho detalhada, considerando repetitividade, posturas forçadas, uso de força, altura de bancadas, plataformas ajustáveis e alternância de atividades.

MÁQUINAS E FACAS: proteção específica em serras, moedores e equipamentos de corte; afiação adequada; luvas de malha de aço para atividades com faca; e procedimentos de higienização segura.

O ritmo de trabalho e as metas de produção devem ser compatíveis com a saúde do trabalhador — a norma trata expressamente da organização do trabalho.

Devem existir programas de capacitação específicos e acompanhamento de saúde direcionado aos agravos típicos do setor (osteomusculares e respiratórios).

A NR-36 recebeu atualizações recentes — confirme sempre a versão vigente no portal oficial do MTE antes de auditorias.$t$,
 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-36-nr-36',
 'Atualizada em 2024 · vigente', 18),

('RDC 216/2004', 'Boas Práticas para Serviços de Alimentação', 'ANVISA', 'Sanitária', 'critica',
 'Manipulação, preparo, armazenamento, transporte e distribuição de alimentos.',
 'Regras sanitárias de higiene, controle de temperatura e Manual de Boas Práticas.',
 $t$A RDC nº 216/2004 da ANVISA estabelece as Boas Práticas para Serviços de Alimentação, com foco em higiene, controle de temperatura e rastreabilidade.

CONTROLE DE TEMPERATURA — CONGELADOS: alimentos congelados devem ser mantidos a temperatura igual ou inferior a -18°C. O monitoramento e o registro das temperaturas devem ser rotineiros e documentados.

Alimentos refrigerados ou congelados devem ser armazenados em recipiente adequado e identificados com designação do produto, data de preparo e prazo de validade.

É obrigatório o MANUAL DE BOAS PRÁTICAS e os PROCEDIMENTOS OPERACIONAIS PADRONIZADOS (POPs), no mínimo para: higienização de instalações e equipamentos; controle integrado de vetores e pragas; higienização do reservatório de água; e higiene e saúde dos manipuladores.

MANIPULADORES: devem ter capacitação periódica em higiene pessoal, manipulação higiênica e doenças transmitidas por alimentos, com registro. Uniformes limpos, cabelos protegidos, unhas curtas e sem adornos.

A saúde dos manipuladores deve ser controlada e registrada — ponto de conexão direta com o PCMSO e com este módulo de Exames.

O descongelamento deve ser conduzido sob refrigeração (≤5°C) ou em micro-ondas quando o alimento for imediatamente submetido à cocção; alimentos descongelados não devem ser recongelados.

A empresa deve manter registros de controle por prazo definido e disponibilizá-los à autoridade sanitária.$t$,
 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2004/res0216_15_09_2004.html',
 'Vigente', 19),

('RDC 275/2002', 'POPs e Checklist de Boas Práticas de Fabricação', 'ANVISA', 'Sanitária', 'alta',
 'Indústrias de alimentos.',
 'Exige Procedimentos Operacionais Padronizados e roteiro de inspeção de BPF.',
 $t$A RDC nº 275/2002 dispõe sobre o Regulamento Técnico de Procedimentos Operacionais Padronizados (POPs) aplicados aos estabelecimentos produtores/industrializadores de alimentos, complementando a RDC 216.

Estabelece a lista de verificação (checklist) das Boas Práticas de Fabricação, utilizada pela vigilância sanitária em inspeções.

POPs mínimos: higienização de instalações, equipamentos e móveis; controle da potabilidade da água; higiene e saúde dos manipuladores; manejo de resíduos; manutenção preventiva e calibração de equipamentos; controle integrado de pragas; seleção de matérias-primas; e recolhimento (recall) de alimentos.

Cada POP deve ser aprovado, datado e assinado pelo responsável do estabelecimento, com registros de execução arquivados.

A calibração de termômetros de câmaras e a verificação da potabilidade da água são itens frequentemente apontados em inspeção.$t$,
 'https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/res0275_21_10_2002.html',
 'Vigente', 20),

('eSocial SST', 'Eventos de Saúde e Segurança do Trabalho no eSocial', 'Receita/MTE', 'eSocial', 'critica',
 'Todas as empresas com empregados.',
 'Transmissão obrigatória dos eventos S-2210 (CAT), S-2220 (Monitoramento da Saúde) e S-2240 (Condições Ambientais).',
 $t$Os eventos de SST do eSocial substituíram diversas obrigações em papel e têm prazos curtos de transmissão. O descumprimento gera multa.

S-2210 — COMUNICAÇÃO DE ACIDENTE DE TRABALHO (CAT): deve ser transmitido até o 1º dia útil seguinte ao acidente; em caso de ÓBITO, a comunicação é IMEDIATA.

S-2220 — MONITORAMENTO DA SAÚDE DO TRABALHADOR: informa os ASOs e exames complementares. Deve ser enviado até o dia 15 do mês seguinte ao da realização do exame. É o evento alimentado por este módulo de Exames.

S-2240 — CONDIÇÕES AMBIENTAIS DO TRABALHO / AGENTES NOCIVOS: informa a exposição do trabalhador a agentes nocivos, base para aposentadoria especial e para o PPP eletrônico. Deve ser atualizado sempre que houver alteração de condição ou de função.

O PPP (Perfil Profissiográfico Previdenciário) passou a ser gerado eletronicamente a partir das informações do S-2240 — inconsistências geram passivo previdenciário.

Recomenda-se conciliar mensalmente os exames registrados aqui com o que foi efetivamente transmitido no S-2220, evitando divergências em auditoria.$t$,
 'https://www.gov.br/esocial/pt-br',
 'Vigente', 21),

('Lei 14.457/2022', 'Programa Emprega + Mulheres — Prevenção ao Assédio', 'Congresso Nacional', 'Lei', 'alta',
 'Empresas com CIPA obrigatória.',
 'Obriga canal de denúncia, regras de conduta e capacitação sobre assédio a cada 12 meses.',
 $t$A Lei nº 14.457/2022 alterou a CLT e ampliou as atribuições da CIPA, que passou a incluir a prevenção e o combate ao assédio sexual e demais formas de violência no trabalho.

MEDIDAS OBRIGATÓRIAS: inclusão de regras de conduta sobre assédio sexual nas normas internas, com ampla divulgação e ciência dos empregados.

Deve ser implementado CANAL DE DENÚNCIA com procedimentos de apuração que garantam o anonimato e protejam o denunciante contra retaliação.

CAPACITAÇÃO: ações de treinamento e sensibilização sobre o tema devem ser realizadas no mínimo A CADA 12 MESES, para todos os níveis, inclusive lideranças.

Os prazos dos procedimentos de apuração devem ser definidos e cumpridos, com registro documental das providências adotadas.

O tema conecta-se diretamente à NR-01 (riscos psicossociais) — assédio é fator de risco psicossocial e deve constar do PGR.$t$,
 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14457.htm',
 'Vigente', 22)

) as v(codigo, titulo, orgao, categoria, prioridade, aplic, resumo, texto, link, atual, ord)
where not exists (
  select 1 from public.normas_sst n where n.empresa_id = e.emp and n.codigo = v.codigo
);
