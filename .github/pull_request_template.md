## Summary

<!-- ဘာလုပ်ထားလဲ၊ ဘာကြောင့်လုပ်ရလဲ -->

## How I checked

<!-- run ထားတဲ့ command များ၊ UI ဆိုရင် screenshot -->

## Checklist

- [ ] ရှိပြီးသား code/`src/lib` ကို အရင်ရှာပြီး duplicate မလုပ်ထား
- [ ] shared layer/design token ကို သုံးထား
- [ ] naming/folder structure CLAUDE.md နဲ့ကိုက်
- [ ] logic အသစ်တိုင်းမှာ test ပါ (bug fix ဆိုရင် test အရင်ရေး)
- [ ] test file ပြင်ထားရင် ဘာကြောင့်လဲ ရှင်းပြထား
- [ ] logic/safety check အသစ်ဆိုရင် mutation check လုပ်ထား (code ဖျက် → test fail → Edit နဲ့ပြန်ပြင် → `git diff` ရှင်း)
- [ ] E2E ထည့်ထား၊ ဒါမှမဟုတ် "မလိုပါ" + အကြောင်းပြချက် (FEATURE_PATTERN › E2E)
- [ ] browser-only behaviour ဆိုရင် "How I checked" မှာ manual test table ပါ
- [ ] dev environment ပေါ် side effect (DB, port, container, volume) ရေးထား၊ မရှိရင် "မရှိ"
- [ ] `code-reviewer` run ပြီး finding တစ်ခုချင်း ဘယ်လိုလုပ်ခဲ့လဲ (ပြင် / မပြင် + အကြောင်း) ရေးထား
- [ ] diff သေးပြီး ကိုယ်တိုင်ရှင်းပြနိုင်
- [ ] .env/secret မပါ
- [ ] CI အစိမ်း
