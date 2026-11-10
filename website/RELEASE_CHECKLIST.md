# Cimoa 官网内容交付与发布条件

本文件仅用于项目交付，不嵌入公开官网。内容调整不等于法国正式发布法律验收，也不证明服务端已部署。

## 本次采用的已确认信息

- 官网：https://cimoabeam.online。
- 市场：法国；平台：仅 iOS；面向 18 岁及以上大学生。
- 统一支持、隐私及安全联系邮箱：CimoaTeam@gmail.com。
- Cimoa Developer Team 仅为对外团队名称，不作为已确认的公司或数据控制者法律身份。
- 用户确认不使用广告追踪，并表示应用数据由自有服务端存放。后者是用户提供的发布配置，不是本次完成的服务端接入或托管审计。
- 文字与语音介绍均为 10 金币；Auto Match 每日 3 次免费，UTC 零点重置，额外入池 10 金币；Priority Match 为 20 金币 / 15 分钟，同一有效入池资格的继续搜索不重复计费。

## 已调整的公开内容

- 保持原始 CSS、内嵌图片、字体、图标资源和第三方许可证不变。
- 更新英文和法文首页、FAQ、关于、联系、用户条款及隐私政策；首次访问默认法语，保留已选英语。
- 仅保留 App Store 入口；没有真实商店链接时仍显示可用性说明，不伪造下载地址。
- 移除无依据的学生认证、已开通视频通话和“所有核心功能免费”等承诺。
- 完善账号条件、相互同意、内容权限、禁止行为、举报与拉黑、线下活动安全、金币费用及消费者权利。
- 说明浏览器语言偏好、无广告追踪、权限、功能信息、信息可见范围、邮箱处理、保存限制、删除与隐私权利，以及 CNIL 投诉渠道。
- 无开发环境提示，无虚构经营主体、托管商、欧盟服务器地址、加密能力、审核时限、支付成功或服务认证。

## 正式发布前仍须解决

1. **实际经营者和网站法定信息。** 确认经营者法定姓名或公司名称、主体类型、可公开业务地址、国家和适用的登记/税务信息，以及依法需要的联系电话、发布负责人等信息。团队对外名称和邮箱不能替代这些身份信息。
2. **网站托管与应用数据流。** 确认网站托管商名称、地址及联系方式；另行确认应用服务器国家、托管商、实际访问方和服务商。核实邮件渠道的处理方；不能用“自有服务器”推出“没有外部接收方/没有跨境处理”。根据实际数据流补充向欧洲经济区外传输的情况和所需保障。
3. **实际保存和删除规则。** 当前公开文字仅表述保存限制及一般判断标准，尚未核对账号、照片、音频、消息、安全记录、金币记录与备份的具体必要期限、删除结果及例外。不得仅凭文字声明已完成删除验收。
4. **处理活动与合法性。** 将每类数据的用途、法律依据、必填/选填及不提供的影响与真实产品逐项对应。宗教等敏感资料须单独评估适用条件和必要的明确同意；匹配推荐须核对其处理方式和透明说明。根据实际经营地点判断是否需要欧盟代表或 DPO，不编造任命。
5. **功能与政策一致。** 本次没有改动 App 的数据处理、认证、举报投递、消息/视频服务或支付接入。现有 App 法律文档和实际处理方式必须与最终官网披露逐项统一后才发布，不能以官网文字代替后端和安全措施。UGC 的过滤、举报受理、处理及申诉、拉黑和可联系渠道需在真实运行环境核验。
6. **商店与收费条件。** 补充真实 App Store 地址；配置实际内购产品、货币价格、交易条件、金币规则及适用退款/撤回权，不作一律不退款的免责。涉及消费者交易时，核对适用的法国消费争议调解要求并提供真实调解渠道，不加入已关闭的欧盟 ODR 平台链接。
7. **部署验证。** 核验域名的 HTTPS、静态文件服务、移动端、语言保存、邮件地址收件能力和所有公开路径。此次浏览器测试使用文件 URL，并不验证域名已上线、邮箱可送达或实际云端数据流。

公开页面未加入“待填写”或占位法律信息；这不表示以上必要信息可以省略。确认实际事实后，再更新公开条款并复核。

## 可复现的输出与验证

源码配置：`website/cimoa-content.json`。

```sh
node scripts/build-cimoa-website.mjs "/absolute/path/to/original.html"
node scripts/cimoa-website.test.mjs
CIMOA_BROWSER_MODULE=/absolute/path/to/playwright node scripts/cimoa-website.test.mjs --browser
```

输出与原件备份位于忽略目录 `artifacts/cimoa-website/`。重建时使用该目录中的 `original-*.html` 原件备份；不要将已生成的文件再次作为原件输入。浏览器验证只打开文件，不启动服务，结束时关闭测试浏览器。

## 核查依据

- [法国经济部：网站法定信息及隐私披露义务](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter)
- [CNIL：信息告知和透明原则](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence)
- [CNIL：GDPR 第三章，特别是第 12–14 条](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3)
- [法国经济部：经营者的消费调解义务](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0)
- [Apple App Review Guidelines：1.2、3.1、5.1](https://developer.apple.com/app-store/review/guidelines/)

以上为内容和工程交付核查依据，不是正式法律意见或审核通过保证。
