# 滑记 Web

间隔复习 + 记忆卡片 + 学习社区的 Web 端复刻。技术栈：Next.js 16、Supabase、ts-fsrs。

## 本地运行

1. 复制环境变量：`cp .env.example .env.local`
2. 填入 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. 安装依赖：`npm install`
4. 启动：`npm run dev`

演示账号：`demo@huaji.local` / `huaji123456`

## 功能范围（MVP）

- 今日任务与滑动复习（Again / Hard / Good / Easy + FSRS）
- 卡片盒、多种模板制卡、挖空
- 社区卡册只读浏览与免费加入
- 学习统计、设置（手势 / 朗读 / 新卡上限 / 提醒）
