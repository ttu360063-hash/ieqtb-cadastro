# TODO: Integração Supabase IEQTB

## ✅ 1. Preparação (Usuário)
- [x] Criar tabela \`inscricoes\` no Supabase  
- [x] Configurar RLS: INSERT/SELECT anon OK, DELETE/UPDATE bloqueado

## ✅ 2. Atualizar scripts/supabase.js [OK]\n\n## ✅ 3. Atualizar app.js [OK]\n\n## 🔄 4. Testes
- [ ] Corrigir ADMIN_PASSWORD = \"IEQTB1245\"
- [ ] Form submit: normalizar (trim, lowercase só email/igreja/telefone pra grouping)
- [ ] Admin refresh: usar groupChurches() pro contador igrejas
- [ ] Realtime subscribe no admin pra auto-update

## ⬜ 4. Testes
- [ ] Form → insert no Supabase dashboard
- [ ] Admin realtime updates
- [ ] Smart church count
- [ ] CSV export

## ⬜ 5. Finalizar
- [ ] attempt_completion

