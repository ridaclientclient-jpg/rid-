#!/bin/bash
sed -i "s/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/REMOVED/g" src/claudeCodeIntegration.ts
sed -i "s/sk_live_5123456789abcdefghijklmnopqrstuvwx/REMOVED/g" src/app/admin/settings/page.tsx
sed -i "s/AIzaSyD1234567890abcdefghijklmnopqrstuvwx/REMOVED/g" src/app/admin/settings/page.tsx
sed -i "s/https:\/\/xyzabc.supabase.co/REMOVED/g" src/app/admin/settings/page.tsx