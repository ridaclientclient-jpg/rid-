@echo off
echo Running replace secrets
powershell.exe -Command "(Get-Content src/claudeCodeIntegration.ts -Raw) -replace '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', 'REMOVED' | Set-Content src/claudeCodeIntegration.ts"
powershell.exe -Command "(Get-Content src/app/admin/settings/page.tsx -Raw) -replace 'sk_live_5123456789abcdefghijklmnopqrstuvwx', 'REMOVED' -replace 'AIzaSyD1234567890abcdefghijklmnopqrstuvwx', 'REMOVED' -replace 'https://xyzabc.supabase.co', 'REMOVED' | Set-Content src/app/admin/settings/page.tsx"
echo Done