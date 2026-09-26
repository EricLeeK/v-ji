# V 记 UI/UX 性能实测与优化

2026-09-25。本地 Next.js 16.3.5 生产构建，已完成代码修改、浏览器验证与截图检查；未提交 Git，也未发布到线上。

手机模拟环境为 393 × 851、Chrome、CPU 降速 4 倍。对照测试使用同一脚本、同样的 800 张临时问答卡片。桌面环境为 1440 × 1000。各次运行创建并删除自己的测试卡片盒，均读回确认删除成功，原有卡片和设置未修改。评分传输测试主动阻断写入，并读回确认测试卡片 reps 仍为 0。

| 手机模拟环境中的操作 | 优化前 | 最终版本 | 耗时/规模减少 |
| --- | ---: | ---: | ---: |
| 慢保存请求期间，评分后操作解锁 | 1570 ms | 78 ms | 95% |
| 卡片盒筛选更新 | 642 ms | 107 ms | 83% |
| 800 张卡片搜索，5 次中位数 | 83 ms | 34 ms | 59% |
| 卡片盒详情首屏 DOM 节点 | 3633 个 | 374 个 | 90% |
| 初次今日页所需网页字体资源 | 443 KiB | 0 KiB | 100% |
| 普通问答编辑页初始 JS，分包前后独立实测 | 381 KiB | 238 KiB | 38% |

评分测试将请求延迟 1,500 ms 后模拟传输失败。旧版需等待请求结束才能解锁操作，新版在后台保存期间就能继续下一张；这不是数据库写入变快了。最终正常浏览器另测连续 3 次评分，可操作耗时为 86 / 37 / 38 ms；第一笔失败后恢复了全部未确认评分，并停止后续依赖请求。

搜索耗时包含 Playwright 操作开销及两帧绘制等待，5 次样本全部保留，没有挑选最快的一次。筛选和评分解锁指标测的是界面状态可用时间。它们属于实验场景指标，不是线上用户 INP 的第 75 百分位。INP 的定义与现场口径见 [web.dev](https://web.dev/articles/inp)。

最终版本 20 次页签切换的点击至绘制完成，中位数 59 ms，P95 86 ms，范围 42–122 ms。真实 CDP 触摸事件做了 4 轮未越过评分阈值的左右拖动，共采样 243 帧，帧间隔 P95 为 16.8 ms，没有超过 34 ms 的帧，页面纵向位移为 0。这个结果来自桌面 Chrome 的手机模拟，不等于实体手机帧率保证。

弱网追加测试使用 CPU 4 倍降速、150 ms 浏览器网络延迟、1.6 Mbps 下载、750 Kbps 上传，关闭 HTTP 缓存并绕过 Service Worker。Supabase 查询仍通过当前机器的实际网络执行。

| 冷缓存页面 | LCP 样本 | CLS 样本 |
| --- | ---: | ---: |
| /me/settings | 1.08 s | 0 |
| /today | 1.11 s | 0 |
| /decks/:deckId/cards/new | 0.79 s | 0 |
| /me/stats | 1.04 s | 0 |
| /ai/new | 0.76 s | 0 |

本次做了以下修改：

- 复习保存进入串行后台队列，翻卡和下一次评分不等待网络；保留 FSRS 顺序、版本冲突校验、失败检查点恢复和退出前等待。旧会话失败不会覆盖新会话。请求只发送所需字段，不再发送整张笔记或本地回滚快照。
- 卡片盒搜索与筛选在浏览器完成，保留 URL、刷新后的筛选条件和浏览器返回行为。断网时也可筛选已加载的列表。
- 笔记列表先建立索引，卡片关联计算从逐笔记全表扫描变成一次遍历；搜索使用延后渲染，首批只挂载 60 条，向下滚动继续加载，仍可搜索和访问全部 800 条。
- 按用户选择使用系统中文字体，去掉网页字体下载。移除已经不再使用的全局 React Query Provider；普通问答页不提前加载 Tiptap 挖空编辑器，需要时加载，并在悬停或聚焦入口时准备资源。
- 个人页和卡片盒详情将互不依赖的查询并行执行，缩小查询字段；卡片盒概览按 deck_id 一次分组。
- 底部导航固定在可见区域，保留内容占位，避免长页面需要滚到末尾才能切换。今日页与卡片盒详情的主要学习入口预取完整学习页。
- 关闭网络恢复时强制整页刷新的 PWA 默认行为，并关闭无必要的导航缓存消息。验证断网重连不会清空输入或打断当前页面。
- 学习进度动画使用 transform，缩短滑出等待并尊重减少动态效果设置；保留移动端横向手势与卡片内部纵向阅读的边界。

验证结果：73 项单元测试、25 项浏览器回归检查、2 项已有 E2E 测试通过；生产构建通过，ESLint 0 错误、5 条原有警告，git diff --check 通过。正常开启 Service Worker 的浏览器检查没有未捕获 JavaScript 异常。设计检测结果为空，已目视检查手机与桌面的导航、首页和学习页。

对照基准为了排除缓存主动使用 Playwright 的 Service Worker 禁用模式，这会触发 Serwist 注册时的 waiting 异常。原始记录中保留了这些工具条件下的异常；正常浏览器验证单独运行且为 0 异常，未将两种环境混称为同一结果。

覆盖边界：真实成功写入的服务器 RPC 未做变更，本轮浏览器评分测试使用延迟/失败注入来验证交互与恢复，没有为跑速度测试写入真实评分。未运行会改动演示设置或调用付费生成的完整 AI E2E；只测试了 AI 制卡页面加载。尚无线上 RUM、真实 iOS/Android 或百万卡片库数据；索引单测覆盖 2,000 条，浏览器覆盖 800 条。首次进入预取的 80 张学习队列本次测得约 310 ms，因此不声称所有导航都已低于 100 ms。

可复核文件与命令：

- [优化前原始数据](../output/playwright/performance/baseline/metrics.json)、[最终对照数据](../output/playwright/performance/optimized-final/metrics.json)、[25 项浏览器检查与弱网数据](../output/playwright/performance/regression/results.json)。
- [页签点击数据](../output/playwright/performance/navigation-probe.json)、[手势帧间隔](../output/playwright/performance/gesture-probe.json)。
- [手机首页](../output/playwright/performance/regression/mobile--today.png)、[桌面卡片盒](../output/playwright/performance/regression/desktop-decks.png)、[手机学习页](../output/playwright/performance/regression/mobile-study.png)。

运行本地生产服务：npm run build，然后 npm run start -- --port 3100。

运行对照基准：PERF_LABEL=check node scripts/performance-audit.mjs。

运行交互回归：node scripts/performance-regression.mjs。

运行只读补充检查：node scripts/performance-navigation.mjs 和 node scripts/performance-gesture.mjs。

这些脚本默认访问 http://localhost:3100，可用 PERF_BASE_URL 修改地址。基准与交互回归会在演示账号下创建临时测试卡片盒，结束后删除；可用 PERF_EMAIL、PERF_PASSWORD 指定专用测试账号。凭据不写入报告或截图。
