# Share Expense

Share Expense ဟာ group ထဲက အသုံးစရိတ်တွေကို မျှဝေပြီး ဘယ်သူက ဘယ်သူ့ကို ဘယ်လောက်ပေးရမလဲ (balance) ကို တွက်ပေးတဲ့ practice project ဖြစ်ပါတယ်။

## MVP Scope

ဒီ project က အောက်ပါ feature (၅) ခုပဲ ပါမယ် — **ဒီထက်မပိုရ**:

1. Group ဆောက်ခြင်း (create group)
2. Member ထည့်/ဖျက်ခြင်း (add/remove member)
3. Expense ထည့်ခြင်း (add expense)
4. Balance ကြည့်ခြင်း (view balance — ဘယ်သူက ဘယ်သူ့ကို ဘယ်လောက်ပေးရမလဲ)
5. Settle ခြင်း (mark as settled)

အခြား feature (recurring expense, multi-currency, notification, auth providers, စသည်) ကို ဒီ scope အတွင်း ထည့်မည်မဟုတ်ပါ။

## Git Workflow

- `main` ပေါ်မှာ **တိုက်ရိုက် commit/push လုပ်ခွင့်မရှိပါ**။
- အလုပ်တိုင်းကို branch အသစ်ဆောက်ပြီး PR ဖြင့်သာ `main` ထဲ merge လုပ်ပါ (`feat/...`, `fix/...`, `chore/...`)။
- Merge မလုပ်မီ review လိုအပ်ပါတယ်။

## Phase 0 Checklist

- [x] README.md — project scope + git rules
- [x] CLAUDE.md — AI assistant working rules
- [x] .gitignore — Node/Next.js baseline
- [x] .claude/settings.json — permission guardrails (.env deny, read-only git allow)
- [ ] Phase 1 — Next.js + TypeScript scaffold, Prisma + SQLite, Tailwind, Vitest, Playwright, ESLint/Prettier, GitHub Actions CI
