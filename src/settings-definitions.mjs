/** Our page and field definitions; availability is resolved from live DSH contributions. */
import {decorationKind} from './settings-decorations.mjs'
export const guiPages = [
 ['general','常规','使用体验','settings'],['conversation','对话与输入','使用体验','chat'],['shortcuts','快捷键','使用体验','keyboard'],['notifications','通知','使用体验','bell'],
 ['appearance','主题','外观与个性化','palette'],['wallpaper','皮肤','外观与个性化','image'],['fonts','字体','外观与个性化','fonts'],['mascot','吉祥物','外观与个性化','pet'],['effects','效果','外观与个性化','activity'],
 ['models','模型与服务','模型与连接','models'],['network','网络与访问','模型与连接','network'],
 ['privacy','权限与隐私','安全与隐私','shield'],['storage','数据与存储','运行维护','folder'],['environment','运行环境','运行维护','layers'],['diagnostics','诊断与维护','运行维护','activity'],['about','关于与更新','运行维护','info'],
 ['archive','已归档的聊天','会话管理','archive'],
].map(([id,title,group,icon])=>({id,title,group,icon}))

/** Navigation groups reflect related tasks; fields keep their stable page IDs. */
export const guiNavigation=[
 {title:'常规',icon:'settings',pages:['general','conversation','shortcuts','notifications']},
 {title:'外观',icon:'palette',pages:['appearance','wallpaper','fonts','mascot','effects']},
 {title:'模型',icon:'models',pages:['models']},
 {title:'网络',icon:'network',pages:['network']},
 {title:'权限',icon:'shield',pages:['privacy']},
 {title:'数据',icon:'folder',pages:['storage']},
 {title:'维护',icon:'activity',pages:['diagnostics','environment','about']},
 {title:'插件配置',icon:'layers',pages:['extensions']},
 {title:'已归档的聊天',icon:'archive',pages:['archive']},
]

const field=(ns,key,label,page,extra={})=>({ns,path:[key],label,page,...extra})
export const guiFields = [
 field('locale','preference','界面语言','general',{options:['zh','en'],optionLabels:['中文','English']}),
 field('ui-theme','preference','明暗模式','appearance',{appearance:true,options:['light','dark','system'],optionLabels:['浅色','深色','跟随系统']}),
 field('ui-theme','textFontFamily','正文字体','fonts',{control:'font'}),field('ui-theme','fontSize','正文字号','fonts',{type:'number',min:10,max:22,unit:'px'}),
 field('ui-theme','codeFontFamily','代码字体','fonts',{control:'font'}),field('ui-theme','codeFontSize','代码字号','fonts',{type:'number',min:10,max:16,unit:'px'}),
 field('ui-theme','terminalFontFamily','终端字体','fonts',{control:'font'}),field('ui-theme','terminalFontSize','终端字号','fonts',{type:'number',min:10,max:20,unit:'px'}),
 field('ui-conversation','busyEnter','运行中发送消息','conversation',{options:['queue','steer'],optionLabels:['排队发送','补充指令']}),
 field('ui-chat','transcriptView','工作步骤展示','conversation',{options:['compact','standard','detailed','verbose'],optionLabels:['精简','标准','详细','完整']}),
 field('ui-chat','collapseTiming','工作步骤收起','conversation',{options:['completion','next-input'],optionLabels:['回答结束后','下次输入时']}),
 field('ui-chat','linkOpening','链接打开位置','conversation',{options:['sidebar','new-tab'],optionLabels:['应用内侧栏','新窗口']}),
 field('ui-chat','performanceUsage','用量信息显示','conversation',{options:['compact','detailed'],optionLabels:['简洁','详细']}),
 field('ui-settings','enabled','代码工作视图','conversation',{type:'boolean'}),
 field('permission','defaultPreset','新会话默认权限','privacy',{permission:true}),
 field('session-log-deepseek','enabled','上传会话日志','privacy',{type:'boolean',hint:'此项属于当前模型服务；仅影响该服务支持的日志上传。'}),
]

export const namespaceTitles = {
 'llm-deepseek':'DeepSeek','llm-pi-ai':'模型服务','web':'网页服务','web-search-deepseek':'网页搜索','web-deepseek-api':'搜索 API','agent-loop':'执行循环','subagent':'子代理','subagent-model-selection-settings':'子代理模型','pwsh-sandbox':'PowerShell','bash-sandbox':'终端执行器',
 'web-ui-task-board':'任务看板','web-ui-task-board-github':'GitHub 任务同步','web-ui-task-board-team':'团队任务','web-ui-agents':'智能体团队','web-ui-liangshen':'预设增强','web-ui-usage':'用量统计','web-ui-session-archive':'会话归档','web-ui-ssh':'SSH 连接','web-ui-git-graph':'Git 工作树','web-ui-browser-view':'浏览器连接','web-ui-market':'资源市场','web-ui-pet':'桌面宠物','web-ui-skin-center':'皮肤中心',
}

export function namespacePage(ns) {
 if(decorationKind(ns))return ({pet:'mascot',wallpaper:'wallpaper',startup:'effects'})[decorationKind(ns)]
 if(/skin|theme/.test(ns))return 'appearance'
 if(/^llm-|model/.test(ns))return 'models'
 return 'extensions'
}

export const configLabels = {
 enabled:'启用功能',announceToAgent:'向智能体提供此能力',timeoutMs:'执行超时（毫秒）',maxOutputBytes:'输出上限（字节）',maxParallelToolCalls:'并行工具数',maxDepth:'子代理层级',maxActiveSubagents:'同时运行的子代理',allowedModels:'允许使用的模型',baseURL:'服务地址',apiKeyEnv:'凭据引用',count:'搜索结果数',maxUses:'搜索调用上限',
 maxSubtaskDepth:'子任务深度',sessionPollSeconds:'状态更新间隔（秒）',runLaunchWidth:'任务启动并发数',spendBudgetTokens:'每日 Token 预算',goalRunEnabled:'启用目标任务',cardDefaultMode:'新任务默认预设',cardDefaultPermission:'新任务默认权限',cardDefaultModel:'新任务默认模型',cardDefaultReasoningEffort:'新任务推理档位',goalVerification:'任务验收',goalVerificationModel:'验收模型',goalVerificationReasoningEffort:'验收推理档位',goalVerificationCallTimeoutSeconds:'验收请求超时（秒）',goalVerificationBudgetSeconds:'验收总时限（秒）',preventIdleSleep:'任务运行时防止休眠',
 autoArchiveEnabled:'自动归档',autoArchiveDays:'闲置归档天数',autoDeleteEnabled:'自动删除归档',autoDeleteDays:'归档保留天数',recordManualArchive:'纳入手动归档的会话',checkIntervalMin:'检查间隔（分钟）',pollIntervalSec:'用量更新间隔（秒）',retainDays:'记录保留天数',spendCurrency:'显示币种',cnyPerUsd:'显示换算汇率',
 realBrowserEnabled:'连接本机浏览器',cdpEndpoint:'浏览器调试地址',terminalFontFamily:'终端字体',connectTimeoutMs:'连接超时（毫秒）',autoIsolate:'新会话自动创建工作树',autoBaseline:'新工作树基线',agentTool:'允许智能体使用 Git 工具',installTimeoutSec:'安装超时（秒）',installRetries:'安装重试次数',presentation:'工具呈现方式',dispatcher:'任务调度模式',
 visible:'显示宠物',petId:'当前宠物',size:'显示大小',right:'距离右侧',bottom:'距离底部',bubbleScale:'气泡大小',models:'模型列表',name:'名称',id:'型号 ID',contextWindow:'上下文窗口',maxTokens:'最大输出 Token',
}
