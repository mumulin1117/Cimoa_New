# Cimoa 官网静态部署包

本交付将最新官网设计整理为可独立托管的静态网站。部署不需要 Node.js、依赖安装、数据库或服务端渲染，也不需要在服务器上执行构建命令。技术格式整理不代表运营事实、隐私披露或 App Store 审核已经完成验收。

## 上传哪一层

将 **`public/` 内部的所有文件和目录** 上传至网站文档根目录，保持目录层级不变。网站根目录应直接出现 `index.html`，而不是 `public/index.html`。

不要把本 README、`PUBLICATION-REVIEW.md` 或 `deployment/` 示例上传为公开网站内容。`deployment/` 仅供服务器管理员按实际平台选择配置，不是网站运行依赖。

正式域名为 **https://cimoabeam.online**。部署平台、DNS、TLS 证书和服务器文档根目录仍需由运营方配置。本包未上传或修改任何线上服务。

## 目录结构

```text
public/
  index.html
  about.html
  privacy.html
  terms.html
  support.html
  safety.html
  404.html
  en/                  同名七个英文页面
  assets/
    css/               style.css、fonts.css、assets.css、static.css
    js/main.js
    images/
    fonts/
    licenses/
  robots.txt
  sitemap.xml
deployment/
  nginx.conf.example
  security-headers.conf
  static-headers
README.md
URLS.txt
PUBLICATION-REVIEW.md
```

图片、字体、样式和脚本随包提供。不要只上传 HTML，也不要把站内链接替换为电脑文件路径。保留 `assets/licenses/` 中的许可和来源资料。

## 平台选择

当前托管平台尚未确认，以下是二选一的部署参考，不能视为已经生效的线上配置。

### Nginx

1. 上传 `public/` 内部文件至实际文档根目录。
2. 将 `deployment/security-headers.conf` 安装为 `/etc/nginx/snippets/cimoa-security-headers.conf`，或同步调整示例中的 `include` 路径。
3. 在 `deployment/nginx.conf.example` 中替换明确标出的文档根目录、证书和私钥路径。证书应覆盖 `cimoabeam.online`。
4. 将示例按现有服务器结构合并，避免重复监听和与其他站点冲突；由管理员执行配置校验后再重载。
5. 示例使用真实 404 状态，不将所有未知 URL 回退成首页；英文目录使用对应的英文 404 页面。

不要直接加载仍含 `REPLACE_WITH_` 路径的示例。若 TLS 由反向代理或托管平台终止，应按实际架构调整，不再重复套用证书路径。

### Cloudflare Pages 静态托管

若最终选用 Cloudflare Pages，将 `deployment/static-headers` **复制并重命名为 `public/_headers`**，再上传 `public/` 内容。该示例针对静态响应，不代表 Pages Functions、Workers 或其他主机也会读取它。

Pages 可能将 `.html` 地址规范化为无扩展名地址。配置同时覆盖页面的 `.html` 和无扩展名路径；部署后检查 canonical、重定向和最终状态码。不需要为这个多页面网站启用 SPA 通配重写。

其他平台请在控制台或服务器中设置同等响应头、缓存策略及 404。不要误以为上传 `static-headers` 原文件名后便会自动生效。

## 缓存与安全策略

- HTML 使用 `Cache-Control: no-cache`，允许缓存但要求复用前验证，便于协议和文案及时更新。
- `assets/` 使用 `public, max-age=86400`，不使用 `immutable`；文件名未变时，更新后应按平台能力清理 CDN 缓存。
- 示例限制脚本、字体和网络资源至本站，不允许后台接口请求、内嵌外部框架或表单提交；图片另允许 `data:`。仅样式保留 `unsafe-inline` 以兼容原设计的行内动画变量，不放开行内脚本。
- 配置提供 CSP、`nosniff`、Referrer-Policy 和禁用相机、麦克风、定位的 Permissions-Policy。官网不需要这些设备权限；未来增加表单、统计或第三方服务时，必须先审核相应披露，再精确调整策略。
- HTTPS、实际 HTTP 安全头、正确 MIME、缓存和重定向只能由部署后的请求结果证明，不能由 HTML 文件存在证明。

## 部署后逐项确认

1. DNS 指向正确服务，HTTPS 证书有效，HTTP 请求正确跳转到 HTTPS。
2. 首页、About、Privacy、Terms、Support、Safety 和英文页可直接访问；浏览器刷新不依赖首页导航。
3. 随机不存在路径返回 **404**，不是状态码 200 的首页；检查根目录和 `/en/` 各一条路径。
4. 样式、字体、图片、脚本均为 200，响应 MIME 正确，无 CSP 报错和混合内容。
5. 查看响应头，确认 HTML `no-cache`、资源 `max-age=86400` 和安全头真正生效。
6. 检查手机布局、菜单、语言切换、页面内锚点、协议跳转和键盘访问。
7. 确认域名、robots、sitemap、canonical 指向正式站点，且没有开发电脑或临时平台地址。
8. 从 `CimoaTeam@gmail.com` 完成真实收发验证，再将其作为已验证支持渠道；本包不宣称已验证收件。
9. 完成 `PUBLICATION-REVIEW.md` 所列运营与法律事实确认，再单独判断是否适合正式公开发布和提交审核。

平台参考：[Cloudflare Pages 响应头](https://developers.cloudflare.com/pages/configuration/headers/)、[Cloudflare Pages 静态页面与 404](https://developers.cloudflare.com/pages/configuration/serving-pages/)、[Nginx 响应头模块](https://nginx.org/en/docs/http/ngx_http_headers_module.html)。
