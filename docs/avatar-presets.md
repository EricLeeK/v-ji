# V 记预设头像 · 第一辑

2026-09-26，使用用户指定的 ip-as-logo 技能及内置 ImageGen，独立单次生成 18 张图：12 生肖 + 包子、饺子、粽子、汤圆、油条、月饼。沿用参考图的大色块、圆润轮廓与角落构图；每种基底提供一张，不筛选、不重画。

## 交付

- [全部头像预览](../output/avatar-presets/gallery.html) · [预览图](../output/avatar-presets/gallery.png)
- 原图：18 张 1254 × 1254 PNG，位于 output/avatar-presets/originals，保留生成结果。
- 页面用图：18 张 256 × 256 WebP，位于 public/avatars/v1；只缩小和编码以降低加载开销，完整保留构图。总计 54,950 字节（53.7 KiB），最大单张 3.8 KiB。
- [图片尺寸、体积及原图 SHA-256](../output/avatar-presets/assets.json)

## 生成说明

主体使用两个语义颜色，配合一个纯色背景；突出幼态、大轮廓、小五官和 32 × 32 下的辨识度。生肖提供熟悉的动物身份，食物提供日常亲切感。左下与右下各 9 张。生成方式是内置 image_gen，未指定或推测底层模型名称；约束以 main-prompt constraints 写入提示词，没有单独 negative 参数。

[共用提示词模板、每张主题、特征及配色](../output/avatar-presets/art-direction.json)。每张实际完整提示词与工具返回源路径分别记录于 [Z01–Z06](../output/avatar-presets/zodiac-first-results.json)、[Z07–Z12](../output/avatar-presets/zodiac-second-results.json)、[F01–F06](../output/avatar-presets/food-results.json)。

| 编号 | 名称 | 分组 | 指定构图 | 背景 | 主体两色 | 文件 |
|---|---|---|---|---|---|---|
| Z01 | 团团鼠 | 生肖 | 左下 | #A5B7D4 | #E5DBF5 / #514365 | [原图](../output/avatar-presets/originals/rat.png) · [WebP](../public/avatars/v1/rat.webp) |
| Z02 | 憨憨牛 | 生肖 | 右下 | #809E8C | #F3DDA7 / #523D34 | [原图](../output/avatar-presets/originals/ox.png) · [WebP](../public/avatars/v1/ox.webp) |
| Z03 | 小橘虎 | 生肖 | 左下 | #ADA6CD | #F6B449 / #583A31 | [原图](../output/avatar-presets/originals/tiger.png) · [WebP](../public/avatars/v1/tiger.webp) |
| Z04 | 糯糯兔 | 生肖 | 右下 | #8CAFA1 | #FFF0D6 / #985C53 | [原图](../output/avatar-presets/originals/rabbit.png) · [WebP](../public/avatars/v1/rabbit.webp) |
| Z05 | 团子龙 | 生肖 | 左下 | #CB8872 | #BED99A / #365846 | [原图](../output/avatar-presets/originals/dragon.png) · [WebP](../public/avatars/v1/dragon.webp) |
| Z06 | 弯弯蛇 | 生肖 | 右下 | #86ABB3 | #F4D17D / #765439 | [原图](../output/avatar-presets/originals/snake.png) · [WebP](../public/avatars/v1/snake.webp) |
| Z07 | 栗栗马 | 生肖 | 左下 | #B1BBDD | #D79861 / #51382F | [原图](../output/avatar-presets/originals/horse.png) · [WebP](../public/avatars/v1/horse.webp) |
| Z08 | 绵绵羊 | 生肖 | 右下 | #88A9BF | #F8EAC8 / #756243 | [原图](../output/avatar-presets/originals/goat.png) · [WebP](../public/avatars/v1/goat.webp) |
| Z09 | 桃桃猴 | 生肖 | 左下 | #C4A0B0 | #95624B / #F6D79A | [原图](../output/avatar-presets/originals/monkey.png) · [WebP](../public/avatars/v1/monkey.webp) |
| Z10 | 啾啾鸡 | 生肖 | 右下 | #809BBA | #FFE09A / #AE5945 | [原图](../output/avatar-presets/originals/rooster.png) · [WebP](../public/avatars/v1/rooster.webp) |
| Z11 | 旺旺狗 | 生肖 | 左下 | #929FC5 | #F5D285 / #68483C | [原图](../output/avatar-presets/originals/dog.png) · [WebP](../public/avatars/v1/dog.webp) |
| Z12 | 呼噜猪 | 生肖 | 右下 | #91B5A5 | #F1B1A8 / #955761 | [原图](../output/avatar-presets/originals/pig.png) · [WebP](../public/avatars/v1/pig.webp) |
| F01 | 软软包 | 食物 | 左下 | #BF8C98 | #FBE5BB / #715442 | [原图](../output/avatar-presets/originals/bao.png) · [WebP](../public/avatars/v1/bao.webp) |
| F02 | 弯弯饺 | 食物 | 右下 | #89A6C1 | #F9EBC9 / #3E6865 | [原图](../output/avatar-presets/originals/dumpling.png) · [WebP](../public/avatars/v1/dumpling.webp) |
| F03 | 青青粽 | 食物 | 左下 | #D7A077 | #527E55 / #F5DEAA | [原图](../output/avatar-presets/originals/zongzi.png) · [WebP](../public/avatars/v1/zongzi.webp) |
| F04 | 圆圆汤 | 食物 | 右下 | #BF7F79 | #F7EDDA / #494849 | [原图](../output/avatar-presets/originals/tangyuan.png) · [WebP](../public/avatars/v1/tangyuan.webp) |
| F05 | 金金条 | 食物 | 左下 | #72A79A | #E6AF57 / #845231 | [原图](../output/avatar-presets/originals/youtiao.png) · [WebP](../public/avatars/v1/youtiao.webp) |
| F06 | 甜甜饼 | 食物 | 右下 | #8191B6 | #DCAD62 / #815139 | [原图](../output/avatar-presets/originals/mooncake.png) · [WebP](../public/avatars/v1/mooncake.webp) |

## 应用行为与性能

“我的”页面点击头像，或从设置页点击“更换头像”，打开选择面板。点击卡片先预览，保存后写入当前账号的 profiles.avatar_url。保留昵称首字默认头像和原有外部头像显示。保存失败保留选择，可重试；加载图片失败回退为昵称首字。

服务端仅接受预设 ID 或 null，映射为固定本地 URL；使用当前登录用户及 updated_at 并发检查，不覆盖昵称、学习设置或 API Key。并发检查保护本次服务端读写窗口；多个标签页依次保存头像时，最后一次明确保存生效。

选择面板动态导入，关闭时没有头像库图片请求；首页只请求当前头像。所有图片有固定尺寸并异步解码，网格图片懒加载。版本化图片地址使用一年 immutable 缓存；PWA 预缓存明确排除 public/avatars，避免初装下载整套图库。替换图像应使用 v2 目录，不能覆盖已发布的 v1 内容。

## 验证

- 初次完整工作区验收：25 个文件、102 项通过。随后将头像改动独立提取，在干净目录验证待提交内容：18 个文件、81 项通过，包含 13 项头像白名单、清除头像、账号范围、并发与错误处理测试。
- 生产构建及 TypeScript 检查通过；本次改动的 ESLint 检查通过。
- [浏览器验证记录](../output/playwright/avatars/results.json)与[独立提交复验](../output/playwright/avatars/push-results.json)：各 27 项通过，覆盖真实保存后数据库回读、刷新显示、首页显示、设置页回显、取消、失败重试、图片失败回退、缓存及 PWA 行为。测试账号的原头像已恢复，昵称与设置指纹一致。
- 320 / 393 / 430 / 1024 像素下检查页面与操作，移动端使用独立滚动容器避免头像覆盖固定底栏；全部选项及保存按钮可达。
- [手机面板](../output/playwright/avatars/picker-mobile-393.png) · [桌面面板](../output/playwright/avatars/picker-1024.png)。Impeccable 机械检查没有发现确定性问题；它不等于完整无障碍认证。

以上记录验证过的源码与本地行为；生产上线状态以实际部署结果为准。
