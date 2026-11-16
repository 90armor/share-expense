# CLAUDE.md

## Project

Share Expense — group အသုံးစရိတ် မျှဝေမှု balance တွက်ပေးတဲ့ practice project။ Scope နဲ့ MVP feature list အတွက် README.md ကိုကြည့်ပါ (feature ၅ ခုပဲ — ဒီထက်မပိုရ)။

## Intended Stack (Phase 1 မှာ scaffold လုပ်မယ်)

- Next.js + TypeScript
- SQLite + Prisma
- Tailwind CSS
- Vitest (unit), Playwright (e2e)
- ESLint + Prettier
- GitHub Actions (CI)

## Commands

_Phase 1 မှာ ဖြည့်မယ်။_

## Naming & Structure Conventions

_Phase 1 မှာ ဖြည့်မယ်။_

## Git Workflow

- `main` ကို တိုက်ရိုက် push/commit မလုပ်ရ။
- Branch ဆောက်ပြီး PR ဖြင့်သာ merge လုပ်ရမယ်။
- Commit message တိုတို ရှင်းလင်းစွာ ရေးပါ။

## Working Rules

- Code ရေး/ပြင်ခင်း plan ကို အရင်ပြပြီး user OK မှ စလုပ်ပါ။
- အသစ်မရေးခင်း existing code/utility ရှိ/မရှိ အရင်ရှာပါ။
- Feature/fix အသစ်တိုင်းမှာ test ပါရမယ်။
- Test fail ရင် root cause ကိုရှာဖြေရှင်းပါ — test ကိုပြင်ပြီး force pass မလုပ်ပါနဲ့။
- တောင်းထားတာထက် ပိုမလုပ်ပါနဲ့ (over-engineering, unnecessary refactor, speculative feature မလုပ်ပါ)။
- မသေချာတာရှိရင် မှန်းဆမလုပ်ဘဲ မေးပါ။

## Absolute Don'ts

- `.env` / `.env.*` ဖိုင်များကို ဖတ်/ဖွင့်မည်မဟုတ်ပါ။
- `git push --force` (သို့) destructive git command များကို user ရှင်းလင်းစွာ ခွင့်ပြုမှသာ အသုံးပြုမည်။
- User မတောင်းထားသော dependency/package ကို ထည့်မည်မဟုတ်ပါ။
