-- Bucket `curriculos` deixa de ser público: currículo (dado pessoal) só abre por link
-- assinado gerado no RH. Aplicar DEPOIS do deploy do index.html com abrirCurriculo().
-- (A política curriculos_rh_read já foi aplicada em 2026-10-16; falta virar o bucket.)
-- O site de vagas continua só enviando (política anon_upload_curriculos, INSERT) e gravando a
-- URL "pública" em candidatos.curriculo_url, de onde o RH extrai o caminho.
update storage.buckets set public = false where id = 'curriculos';

drop policy if exists curriculos_rh_read on storage.objects;
create policy curriculos_rh_read on storage.objects for select to authenticated
  using (bucket_id = 'curriculos' and (select public.rh_is_member()));
