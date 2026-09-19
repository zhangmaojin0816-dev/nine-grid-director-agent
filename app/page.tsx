"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { FileUp, ImagePlus, LoaderCircle, Copy, Check, RefreshCw } from "lucide-react";
import { durationSeconds, shotTimeline, fitShotDurations, validateTargetSeconds, replaceSingleShot, MAX_REFERENCE_ASSETS, type ReferenceAsset } from "../lib/storyboard-settings";
import { readPromptDocument, validatePromptDocument, interpretPromptDocument, resolveDocumentInput, documentKindLabels, MAX_DOCUMENT_CHARS, MAX_IMPORTED_DOCUMENT_CHARS, type PromptDocument, type DocumentMode } from "../lib/prompt-document";

type VideoTypeId = "moodfilm" | "suspense" | "drama" | "commercial" | "knowledge";
type BudgetMode = "lean" | "balanced" | "premium";
type Platform = "seedance" | "kling" | "runway" | "luma";
type SketchStatus = "idle" | "generating" | "ready" | "error";
type ImageProvider = "openai" | "compatible" | "custom";
type ImageModel = "gpt-image-2" | "gpt-image-1.5" | "gpt-image-1" | "gpt-image-1-mini";
type TextProvider = "openai" | "deepseek" | "qwen" | "doubao" | "zhipu" | "kimi" | "openrouter" | "groq" | "custom";
type PromptStatus = "idle" | "generating" | "ready" | "error";
type MoodTone = "lonely" | "warm" | "premium" | "tense" | "documentary";
type WorkspaceTab = "setup" | "board" | "prompt";
type ShotCount = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type ShotRole =
  | "establish"
  | "character"
  | "detail"
  | "approach"
  | "conflict"
  | "reaction"
  | "reveal"
  | "escalate"
  | "ending";

type VideoType = {
  id: VideoTypeId;
  label: string;
  short: string;
  summary: string;
  keywords: string[];
  grammar: string[];
  avoid: string[];
  shotRules: Omit<Shot, "id" | "subject" | "sceneDetail" | "action" | "expression" | "directorNote" | "sketchPrompt" | "videoPrompt" | "cost" | "risk">[];
};

type Shot = {
  id: number;
  role: ShotRole;
  title: string;
  duration: string;
  scale: string;
  camera: string;
  motion: string;
  purpose: string;
  subject: string;
  sceneDetail: string;
  action: string;
  expression: string;
  directorNote: string;
  sketchPrompt: string;
  videoPrompt: string;
  cost: "低" | "中" | "高";
  risk: "低" | "中" | "高";
};

type StoryContext = {
  source: string;
  subject: string;
  protagonist: string;
  setting: string;
  action: string;
  emotionalState: string;
  pressure: string;
  visualAnchor: string;
  continuityObject: string;
};

type GeneratedShotDraft = Partial<
  Pick<Shot, "duration" | "scale" | "camera" | "motion" | "title" | "subject" | "sceneDetail" | "action" | "expression" | "directorNote" | "sketchPrompt" | "videoPrompt">
>;

const initialStory =
  "小明一个人在走夜路。";

const shotCountOptions: ShotCount[] = [2, 3, 4, 5, 6, 7, 8, 9];

const videoTypes: VideoType[] = [
  {
    id: "moodfilm",
    label: "氛围感人物短片",
    short: "人物气质先行、动作微妙、情绪递进",
    summary: "适合孤独、治愈、清冷、高级感、宿命感等氛围片。先塑造人物形象和环境质感，再用动作和神态推动情绪。",
    keywords: ["氛围", "清晨", "海边", "孤独", "安静", "宿命", "治愈", "高级", "冷感", "情绪", "人物", "肖像"],
    grammar: ["先定人物气质", "用环境光塑造情绪", "动作要小但具体", "神态变化要可见", "镜头运动必须有情绪动机"],
    avoid: ["只写空泛美感", "每个镜头都同一种表情", "无动作的连续站桩", "突然更换人物造型"],
    shotRules: [
      {
        role: "establish",
        title: "氛围开场",
        duration: "4s",
        scale: "远景",
        camera: "低机位或平视远距离",
        motion: "缓慢推近",
        purpose: "先让环境定义人物的情绪处境",
      },
      {
        role: "character",
        title: "人物亮相",
        duration: "3s",
        scale: "中景",
        camera: "侧逆光",
        motion: "轻微横移",
        purpose: "交代人物外形、姿态和气质",
      },
      {
        role: "detail",
        title: "身体细节",
        duration: "2s",
        scale: "手部或衣物特写",
        camera: "近距离平视",
        motion: "轻微推近",
        purpose: "用一个细小动作替代直白解释",
      },
      {
        role: "approach",
        title: "情绪靠近",
        duration: "3s",
        scale: "中近景",
        camera: "肩侧跟拍",
        motion: "稳定跟随",
        purpose: "让观众进入人物的内心节奏",
      },
      {
        role: "conflict",
        title: "内在波动",
        duration: "3s",
        scale: "近景",
        camera: "轻微仰角",
        motion: "短促停顿后继续推近",
        purpose: "让人物出现一次明显但克制的情绪变化",
      },
      {
        role: "reaction",
        title: "神态停留",
        duration: "2s",
        scale: "面部特写",
        camera: "平视",
        motion: "静止",
        purpose: "把情绪落到眼神、呼吸和嘴角变化上",
      },
      {
        role: "reveal",
        title: "环境回应",
        duration: "3s",
        scale: "广角中景",
        camera: "人物背后",
        motion: "缓慢拉开",
        purpose: "让环境像在回应人物情绪",
      },
      {
        role: "escalate",
        title: "情绪峰值",
        duration: "3s",
        scale: "近景",
        camera: "逆光剪影",
        motion: "环绕小半圈",
        purpose: "把氛围推到最有记忆点的一刻",
      },
      {
        role: "ending",
        title: "余韵收束",
        duration: "4s",
        scale: "远景",
        camera: "固定机位",
        motion: "静止或极慢拉远",
        purpose: "留下人物和环境之间的余韵",
      },
    ],
  },
  {
    id: "suspense",
    label: "悬疑剧情短片",
    short: "慢节奏、压迫构图、少跳切",
    summary: "适合未知、危险、孤独、反常事件。镜头要先建立空间，再让观众跟着人物靠近异常。",
    keywords: ["悬疑", "恐怖", "雨夜", "医院", "废弃", "失踪", "异常", "秘密", "未知", "末日", "孤独"],
    grammar: ["先环境后人物", "中慢速推进", "用细节制造异常", "反应镜头必须保留", "少换场景，多换视角"],
    avoid: ["连续大场景跳转", "每个镜头都强运动", "过早揭示答案", "一镜塞入多个复杂动作"],
    shotRules: [
      {
        role: "establish",
        title: "孤立空间建立",
        duration: "4s",
        scale: "远景",
        camera: "高机位",
        motion: "缓慢推进",
        purpose: "让观众先知道人物要进入一个不安全的空间",
      },
      {
        role: "character",
        title: "人物进入画面",
        duration: "3s",
        scale: "中远景",
        camera: "背后跟拍",
        motion: "稳定跟随",
        purpose: "把观众绑定到主角视角，减少突兀感",
      },
      {
        role: "detail",
        title: "异常细节",
        duration: "2s",
        scale: "特写",
        camera: "低机位",
        motion: "轻微推近",
        purpose: "用一个小物件或光源告诉观众这里不正常",
      },
      {
        role: "approach",
        title: "靠近异常",
        duration: "3s",
        scale: "中景",
        camera: "侧后方",
        motion: "慢速横移",
        purpose: "把紧张感从环境推到人物行动",
      },
      {
        role: "conflict",
        title: "短暂揭示",
        duration: "2s",
        scale: "近景",
        camera: "门缝视角",
        motion: "几乎静止",
        purpose: "给出一点信息，但不要解释完整",
      },
      {
        role: "reaction",
        title: "人物反应",
        duration: "2s",
        scale: "面部特写",
        camera: "平视",
        motion: "轻微推近",
        purpose: "让观众确认主角意识到危险",
      },
      {
        role: "reveal",
        title: "空间变化",
        duration: "3s",
        scale: "广角中景",
        camera: "走廊纵深",
        motion: "缓慢后退",
        purpose: "展示环境正在变得不可信",
      },
      {
        role: "escalate",
        title: "压迫升级",
        duration: "2s",
        scale: "近景",
        camera: "倾斜构图",
        motion: "短促推进",
        purpose: "用画面不稳定感制造高潮前的压力",
      },
      {
        role: "ending",
        title: "留白结尾",
        duration: "3s",
        scale: "远景",
        camera: "固定机位",
        motion: "静止",
        purpose: "留下悬念，避免用昂贵镜头硬解释",
      },
    ],
  },
  {
    id: "drama",
    label: "短剧爆点视频",
    short: "前 3 秒有钩子、反应强、信息密",
    summary: "适合反转、冲突、爽点、人物关系。镜头要服务信息推进，每一格都要让观众更想看下一格。",
    keywords: ["短剧", "反转", "复仇", "总裁", "打脸", "冲突", "误会", "秘密", "爽文", "爆款", "对白"],
    grammar: ["首镜给冲突", "反应镜头更大", "近景和特写占比高", "每 2-3 秒推进一个信息", "结尾必须留钩子"],
    avoid: ["开场铺垫太久", "空镜过多", "人物关系不清", "一个镜头里多人复杂调度"],
    shotRules: [
      {
        role: "establish",
        title: "爆点开场",
        duration: "2s",
        scale: "近景",
        camera: "正反打起手",
        motion: "快速推近",
        purpose: "第一眼就抛出冲突或异常",
      },
      {
        role: "character",
        title: "主角反应",
        duration: "2s",
        scale: "面部特写",
        camera: "平视",
        motion: "轻微晃动",
        purpose: "让观众马上读懂立场和情绪",
      },
      {
        role: "detail",
        title: "关键证据",
        duration: "2s",
        scale: "插入特写",
        camera: "俯拍",
        motion: "快速压近",
        purpose: "把剧情矛盾落到一个可见物件上",
      },
      {
        role: "approach",
        title: "对峙推进",
        duration: "3s",
        scale: "双人中景",
        camera: "肩后视角",
        motion: "轻微横移",
        purpose: "交代冲突双方的位置关系",
      },
      {
        role: "conflict",
        title: "误会升级",
        duration: "2s",
        scale: "中近景",
        camera: "压低机位",
        motion: "快速切入",
        purpose: "让压力上升，逼近反转",
      },
      {
        role: "reaction",
        title: "二次反应",
        duration: "2s",
        scale: "特写",
        camera: "侧脸",
        motion: "静止",
        purpose: "给观众情绪确认点",
      },
      {
        role: "reveal",
        title: "反转揭示",
        duration: "3s",
        scale: "中景",
        camera: "正面",
        motion: "稳定推近",
        purpose: "交代新信息，改写前面判断",
      },
      {
        role: "escalate",
        title: "众人震惊",
        duration: "2s",
        scale: "群像近景",
        camera: "快速扫过",
        motion: "短摇",
        purpose: "放大爽点和传播性",
      },
      {
        role: "ending",
        title: "下集钩子",
        duration: "2s",
        scale: "极近特写",
        camera: "平视",
        motion: "突然停住",
        purpose: "卡在新问题出现的一刻",
      },
    ],
  },
  {
    id: "commercial",
    label: "广告产品短片",
    short: "干净稳定、卖点明确、画面可信",
    summary: "适合品牌、产品、服务、活动宣传。镜头要围绕痛点、产品出现、使用结果和品牌收束。",
    keywords: ["广告", "产品", "品牌", "卖点", "电商", "发布", "营销", "种草", "客户", "门店", "服务"],
    grammar: ["痛点先行", "产品必须早出现", "稳定镜头优先", "多用特写和使用场景", "结尾回到品牌印象"],
    avoid: ["镜头炫但看不清产品", "情绪画面过多", "卖点分散", "复杂手部动作"],
    shotRules: [
      {
        role: "establish",
        title: "痛点场景",
        duration: "3s",
        scale: "中景",
        camera: "平视",
        motion: "稳定推进",
        purpose: "把用户问题可视化",
      },
      {
        role: "character",
        title: "用户困扰",
        duration: "2s",
        scale: "近景",
        camera: "侧面",
        motion: "静止",
        purpose: "让观众代入真实使用情境",
      },
      {
        role: "detail",
        title: "产品出现",
        duration: "2s",
        scale: "产品特写",
        camera: "45 度俯拍",
        motion: "慢速推近",
        purpose: "清楚交代解决方案",
      },
      {
        role: "approach",
        title: "开始使用",
        duration: "3s",
        scale: "手部近景",
        camera: "桌面视角",
        motion: "轻微跟随",
        purpose: "说明产品如何进入流程",
      },
      {
        role: "conflict",
        title: "核心卖点",
        duration: "3s",
        scale: "中近景",
        camera: "正面",
        motion: "环绕半圈",
        purpose: "把最重要的卖点放在画面中心",
      },
      {
        role: "reaction",
        title: "效果反馈",
        duration: "2s",
        scale: "表情近景",
        camera: "平视",
        motion: "静止",
        purpose: "展示使用后的即时变化",
      },
      {
        role: "reveal",
        title: "细节质感",
        duration: "2s",
        scale: "微距特写",
        camera: "低角度",
        motion: "慢速掠过",
        purpose: "建立品质感和可信度",
      },
      {
        role: "escalate",
        title: "生活方式",
        duration: "3s",
        scale: "广角中景",
        camera: "自然光侧面",
        motion: "平滑横移",
        purpose: "把产品放入理想结果",
      },
      {
        role: "ending",
        title: "品牌收束",
        duration: "2s",
        scale: "静物特写",
        camera: "正面固定",
        motion: "静止",
        purpose: "让观众记住产品和行动指令",
      },
    ],
  },
  {
    id: "knowledge",
    label: "知识解说视频",
    short: "画面辅助理解、复用多、省成本",
    summary: "适合科普、教程、商业分析、观点表达。镜头不必追求复杂实拍，更应该用示意画面和低成本动效组织信息。",
    keywords: ["知识", "教程", "科普", "解释", "分析", "课程", "方法", "步骤", "观点", "清单", "案例"],
    grammar: ["问题先抛出", "镜头服务概念", "多用符号化画面", "用重复构图建立秩序", "优先静图和动效复用"],
    avoid: ["每句话都生成视频", "抽象概念硬拍真人", "复杂叙事场景", "无意义空镜"],
    shotRules: [
      {
        role: "establish",
        title: "问题钩子",
        duration: "2s",
        scale: "中景",
        camera: "平视",
        motion: "快速推入",
        purpose: "把观众的问题摆到第一屏",
      },
      {
        role: "character",
        title: "概念引入",
        duration: "3s",
        scale: "示意中景",
        camera: "正面",
        motion: "静止",
        purpose: "用一个易懂画面承接主题",
      },
      {
        role: "detail",
        title: "核心类比",
        duration: "3s",
        scale: "插画特写",
        camera: "俯拍",
        motion: "轻微推近",
        purpose: "让抽象概念变得可见",
      },
      {
        role: "approach",
        title: "步骤一",
        duration: "3s",
        scale: "流程中景",
        camera: "平视",
        motion: "横向移动",
        purpose: "开始建立方法结构",
      },
      {
        role: "conflict",
        title: "常见错误",
        duration: "2s",
        scale: "对比画面",
        camera: "固定机位",
        motion: "静止",
        purpose: "指出用户会踩的坑",
      },
      {
        role: "reaction",
        title: "纠正方法",
        duration: "3s",
        scale: "中近景",
        camera: "正面",
        motion: "轻微推近",
        purpose: "给出明确替代做法",
      },
      {
        role: "reveal",
        title: "结果展示",
        duration: "3s",
        scale: "结果全景",
        camera: "高机位",
        motion: "缓慢拉开",
        purpose: "让观众看到方法带来的变化",
      },
      {
        role: "escalate",
        title: "关键提醒",
        duration: "2s",
        scale: "特写",
        camera: "居中",
        motion: "静止",
        purpose: "强化最值得记住的一句话",
      },
      {
        role: "ending",
        title: "总结收束",
        duration: "2s",
        scale: "分镜回看",
        camera: "俯视",
        motion: "轻微拉远",
        purpose: "把内容整理成可复述的结论",
      },
    ],
  },
];

const budgetCopy: Record<BudgetMode, { label: string; description: string; savings: string; strategy: string }> = {
  lean: {
    label: "极省钱",
    description: "优先静图转视频、复用场景，减少高风险动作。",
    savings: "预计少生成 35%-50%",
    strategy: "只保留 4-5 个必须视频化的镜头，其余做线稿、静图推拉或剪辑复用。",
  },
  balanced: {
    label: "平衡",
    description: "关键镜头视频化，过渡镜头用低成本方案。",
    savings: "预计少生成 20%-35%",
    strategy: "人物、异常、反应、结尾保留视频生成，环境和细节可先用图生视频试片。",
  },
  premium: {
    label: "效果优先",
    description: "给电影感和镜头完整性更高权重。",
    savings: "预计少生成 10%-20%",
    strategy: "保留更完整的镜头运动，但每个镜头仍要先用线稿确认构图。",
  },
};

const platformCopy: Record<Platform, { label: string; hint: string }> = {
  seedance: {
    label: "Seedance 2.0",
    hint: "强调中文剧情语义、主体一致、镜头连贯和动作边界。",
  },
  kling: {
    label: "Kling",
    hint: "强调主体一致性、动作边界和镜头运动。",
  },
  runway: {
    label: "Runway",
    hint: "强调摄影语言、画面连续性和材质光影。",
  },
  luma: {
    label: "Luma",
    hint: "强调空间、真实运动和电影质感。",
  },
};

const imageModelCopy: Record<ImageModel, { label: string; hint: string }> = {
  "gpt-image-1-mini": {
    label: "GPT Image Mini",
    hint: "成本更轻，适合先跑分镜线稿草图。",
  },
  "gpt-image-1": {
    label: "GPT Image 1",
    hint: "画面理解更稳，适合关键镜头精修。",
  },
  "gpt-image-1.5": {
    label: "GPT Image 1.5",
    hint: "更适合细节更多的线稿分镜。",
  },
  "gpt-image-2": {
    label: "GPT Image 2",
    hint: "质量优先，适合最终版故事板。",
  },
};

const imageProviderCopy: Record<ImageProvider, { label: string; hint: string; modelPlaceholder: string; endpointPlaceholder: string }> = {
  openai: {
    label: "GPT Image",
    hint: "使用 OpenAI 官方图片接口，最适合当前线稿工作流。",
    modelPlaceholder: "选择 GPT Image 模型",
    endpointPlaceholder: "系统自动使用 OpenAI 图片接口",
  },
  compatible: {
    label: "兼容接口",
    hint: "适合接 OpenAI 格式的中转或第三方图片接口。",
    modelPlaceholder: "例如 provider-image-model",
    endpointPlaceholder: "https://你的域名/v1/images/generations",
  },
  custom: {
    label: "自定义接口",
    hint: "适合接自建服务，返回 image、url、b64_json、images 或 data[0] 即可。",
    modelPlaceholder: "例如 sketch-v1",
    endpointPlaceholder: "https://你的图片生成接口",
  },
};

const textProviderCopy: Record<TextProvider, { label: string; hint: string; defaultModel: string; endpoint: string; endpointPlaceholder: string; freeNote?: string; keyUrl?: string; docsUrl?: string; presets?: { model: string; label: string; vision: boolean }[] }> = {
  openai: {
    label: "OpenAI",
    hint: "适合稳定生成导演式分镜和结构化提示词。",
    defaultModel: "gpt-4.1-mini",
    endpoint: "https://api.openai.com/v1/chat/completions",
    endpointPlaceholder: "系统自动使用 OpenAI Chat Completions",
  },
  deepseek: {
    label: "DeepSeek",
    hint: "中文理解和性价比较好，适合先跑批量分镜。",
    defaultModel: "deepseek-v4-flash",
    endpoint: "https://api.deepseek.com/chat/completions",
    endpointPlaceholder: "系统自动使用 DeepSeek Chat Completions",
  },
  qwen: {
    label: "通义千问",
    hint: "适合中文创作和 OpenAI 兼容调用。",
    defaultModel: "qwen-plus",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    endpointPlaceholder: "系统自动使用 DashScope 兼容模式",
  },
  doubao: {
    label: "豆包火山",
    hint: "适合国内火山方舟模型，模型名通常填控制台里的模型或推理接入点。",
    defaultModel: "doubao-seed-1-6",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    endpointPlaceholder: "系统自动使用火山方舟 Chat Completions",
  },
  zhipu: {
    label: "智谱 · 免费模型",
    hint: "文案或文档可选 GLM-4.7-Flash；有参考图片请选择 GLM-4.6V-Flash。",
    defaultModel: "glm-4.7-flash",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    endpointPlaceholder: "系统自动使用智谱对话补全接口",
    freeNote: "以下 Flash 预设为官方免费模型，仍受账户并发和调用限制；手动填写其他模型可能收费。",
    keyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/start/model-overview",
    presets: [
      { model: "glm-4.7-flash", label: "GLM-4.7-Flash · 免费 · 文字/文档", vision: false },
      { model: "glm-4.6v-flash", label: "GLM-4.6V-Flash · 免费 · 支持参考图", vision: true },
    ],
  },
  kimi: {
    label: "Kimi",
    hint: "适合长文档和较长故事线拆解。",
    defaultModel: "kimi-k2",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    endpointPlaceholder: "系统自动使用 Moonshot Chat Completions",
  },
  openrouter: {
    label: "OpenRouter · 免费",
    hint: "自动从可用免费模型中路由，支持按请求筛选看图模型；模型与效果可能变化。",
    defaultModel: "openrouter/free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    endpointPlaceholder: "系统自动使用 OpenRouter 接口",
    freeNote: "默认免费路由；未充值账户通常为 50 次/天、20 次/分钟，以官方当前限额为准。不会自动切换付费模型；可用性及数据政策随供应商变化。",
    keyUrl: "https://openrouter.ai/settings/keys",
    docsUrl: "https://openrouter.ai/docs/faq",
    presets: [{ model: "openrouter/free", label: "免费模型路由 · 支持按需选择看图模型", vision: true }],
  },
  groq: {
    label: "Groq · 免费额度",
    hint: "默认 GPT-OSS 120B，仅支持文字和已提取正文的文档，不支持参考图片。长文档可能触发 token 限额。",
    defaultModel: "openai/gpt-oss-120b",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    endpointPlaceholder: "系统自动使用 Groq 兼容接口",
    freeNote: "仅 Free 套餐额度内免费，受每分钟/每天请求和 token 限制；已升级付费套餐的账户按其套餐计费。",
    keyUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs/rate-limits",
    presets: [{ model: "openai/gpt-oss-120b", label: "GPT-OSS 120B · Free 套餐可用 · 仅文字", vision: false }],
  },
  custom: {
    label: "自定义兼容",
    hint: "适合接中转、私有模型或任何 OpenAI-compatible 文本接口。",
    defaultModel: "storyboard-model",
    endpoint: "",
    endpointPlaceholder: "https://你的域名/v1/chat/completions",
  },
};

const moodToneCopy: Record<MoodTone, { label: string; palette: string; character: string; performance: string; light: string }> = {
  lonely: {
    label: "孤独冷感",
    palette: "灰蓝、冷白、低饱和",
    character: "清瘦安静的人物，深色长外套，头发被风吹乱，姿态收紧，像刚经历过一场沉默的告别",
    performance: "动作慢，先犹豫再移动，手指会无意识攥紧衣角，眼神常常避开镜头",
    light: "清晨冷光、薄雾、背光边缘光，背景留出大面积空白",
  },
  warm: {
    label: "温柔治愈",
    palette: "柔白、浅金、低对比",
    character: "干净亲和的人物，浅色针织或棉麻衣物，神态疲惫但逐渐松弛",
    performance: "动作轻，抬头、触碰、停顿都要柔和，表情从紧绷慢慢转为安心",
    light: "窗边自然光、晨光、暖色反光，画面边缘柔和",
  },
  premium: {
    label: "高级克制",
    palette: "黑白灰、金属色、干净色块",
    character: "轮廓清晰的人物，剪裁利落的服装，站姿稳定，情绪不外放但眼神有压迫感",
    performance: "动作少而准，转身、停步、抬眼都有明确节奏，避免夸张表演",
    light: "硬边侧光、简洁背景、浅景深，强调线条和材质",
  },
  tense: {
    label: "恐怖场景",
    palette: "冷绿、暗灰、局部高光",
    character: "普通年轻男性，深色外套，衣领微微立起，肩颈僵硬，像正在确认某个危险是否逼近",
    performance: "动作短促但克制，回头、屏息、放慢脚步、攥紧手指都要清楚，眼神快速搜索两侧黑暗",
    light: "夜路低照度、远处路灯闪烁、两侧阴影浓重，空间纵深强",
  },
  documentary: {
    label: "纪实真实",
    palette: "自然肤色、环境原色、轻微颗粒",
    character: "生活感强的人物，普通衣着，有真实疲惫和细碎习惯动作",
    performance: "动作自然不摆拍，走路、整理物品、抬眼反应都像被偶然捕捉",
    light: "可用光、手持感、轻微晃动，保留真实环境杂质",
  },
};

function scoreType(story: string, type: VideoType) {
  const normalized = story.toLowerCase();
  const isNarrative = isNarrativeStory(story);
  const isKnowledge = hasKnowledgeIntent(story);
  const keywordScore = type.keywords.reduce((score, keyword) => {
    return normalized.includes(keyword.toLowerCase()) ? score + 3 : score;
  }, 0);
  const narrativeScore =
    isNarrative && type.id === "moodfilm"
      ? 7
      : isNarrative && type.id === "drama"
        ? 3
        : isNarrative && type.id === "suspense" && /夜|危险|害怕|恐惧|悬疑|异常/.test(story)
          ? 5
          : 0;

  const toneScore =
    type.id === "moodfilm" && /氛围|清晨|海|风|孤|安静|宿命|治愈|高级|情绪|人物|肖像/.test(story)
      ? 5
      : type.id === "suspense" && /雨|夜|空|废|孤|秘密|异常|医院|危险/.test(story)
      ? 4
      : type.id === "drama" && /他|她|我|反转|真相|竟然|发现|背叛/.test(story)
        ? 3
        : type.id === "commercial" && /产品|品牌|用户|客户|购买|店|卖点|省钱/.test(story)
          ? 4
          : type.id === "knowledge" && isKnowledge
            ? 4
            : 0;

  const knowledgePenalty = type.id === "knowledge" && isNarrative && !isKnowledge ? -8 : 0;

  return keywordScore + toneScore + narrativeScore + knowledgePenalty;
}

function pickVideoType(story: string, manualType: VideoTypeId | "auto") {
  if (manualType !== "auto") {
    return videoTypes.find((type) => type.id === manualType) || videoTypes[0];
  }

  return [...videoTypes].sort((a, b) => scoreType(story, b) - scoreType(story, a))[0];
}

function hasKnowledgeIntent(story: string) {
  return /为什么|如何|怎么|方法|步骤|原因|原理|知识|解释一下|科普|教程|教你|盘点/.test(story);
}

function isNarrativeStory(story: string) {
  const hasCharacter = /小明|小红|老张|女孩|男孩|女人|男人|母亲|父亲|学生|医生|摄影师|主角|老人|少年|少女|他|她|我/.test(story);
  const hasAction = /走|跑|骑|骑车|骑单车|骑自行车|单车|自行车|坐|站|看|回头|等待|寻找|发现|穿过|经过|过马路|躲|推开|拿起|放下|进入|离开/.test(story);

  return hasCharacter && hasAction && !hasKnowledgeIntent(story);
}

function extractSubject(story: string, type: VideoType) {
  const clean = story.replace(/\s+/g, " ").trim();
  const firstSentence = clean.split(/[。！？.!?]/)[0] || clean;
  const clipped = firstSentence.length > 42 ? `${firstSentence.slice(0, 42)}...` : firstSentence;

  if (!clipped) {
    return type.id === "commercial" ? "一个需要被清楚展示的产品或服务" : "一个人物面对明确变化的场景";
  }

  return clipped;
}

function parseStoryContext(story: string, type: VideoType, tone: MoodTone): StoryContext {
  const subject = extractSubject(story, type);
  const protagonistMatch = story.match(/小明|小红|老张|女孩|男孩|女人|男人|母亲|父亲|学生|医生|摄影师|主角|老人|少年|少女/);
  const protagonist =
    protagonistMatch?.[0] ||
    (type.id === "commercial" ? "使用者" : type.id === "knowledge" ? "讲述者" : "主角");
  const isNightRoad = /夜路|夜晚.*路|走夜路|晚上.*路|黑夜.*路/.test(story);
  const isCrossingRoad = /过马路|穿过马路|斑马线|人行横道|路口|红绿灯/.test(story);
  const isCycling = /骑单车|骑自行车|骑车|单车|自行车|共享单车|公路车/.test(story);
  const isSea = /海边|沙滩|海/.test(story);
  const isHospital = /医院/.test(story);
  const setting = isNightRoad
    ? "一条偏僻的夜路，路面有潮湿反光，两侧树影和楼体阴影压向画面，远处只有一盏忽明忽暗的路灯"
    : isCrossingRoad
      ? "城市路口的人行横道，斑马线白线被车灯切开，红绿灯倒计时在路面反光里跳动，远处车辆低速经过"
      : isCycling
        ? "城市清晨或傍晚的自行车道，路边树影掠过车轮，远处车流和街灯形成连续纵深，地面有细碎反光"
      : isSea
        ? "清晨海边，湿沙反射微光，海平线被薄雾压低，风声比人声更明显"
        : isHospital
          ? "废弃医院走廊，墙面斑驳，灯管间歇闪烁，门缝里有无法确认的暗影"
          : story.includes("房间")
            ? "一间安静但带有情绪重量的房间，桌面、窗帘和角落光线都保留生活痕迹"
            : "一个贴合原文情绪的真实空间，环境细节围绕主角当前动作展开";
  const action = isCrossingRoad
    ? `${protagonist}站在斑马线边，先看一眼红绿灯倒计时，再确认左右来车，随后加快脚步穿过马路`
    : isCycling
      ? `${protagonist}骑着单车沿自行车道向前，双手握住车把，身体微微前倾，脚下踏频稳定但带着一点犹豫`
    : /走|行走|走路|走夜路/.test(story)
    ? `${protagonist}独自向前走，步伐比平时慢，身体始终保持轻微防备`
    : /寻找|找/.test(story)
      ? `${protagonist}一边观察环境一边寻找目标，动作谨慎，视线不断确认细节`
      : /等待|等/.test(story)
        ? `${protagonist}停在原地等待，手部有细小动作，目光反复看向可能出现变化的方向`
        : /发现|看到|看见/.test(story)
          ? `${protagonist}注意到异常后停住，先用眼神确认，再做出克制反应`
          : `${protagonist}围绕“${subject}”做一个清楚、可拍、可连续的动作`;
  const emotionalState =
    tone === "tense"
      ? `${protagonist}表面强装镇定，内心已经开始怀疑身后或暗处有东西靠近`
      : tone === "warm"
        ? `${protagonist}情绪逐渐放松，动作从拘谨转向柔和`
        : tone === "premium"
          ? `${protagonist}情绪克制，表情不外放，只用眼神和停顿传递判断`
          : `${protagonist}内心有一层不愿直接说出的情绪，主要通过呼吸、停步和视线变化表现`;
  const pressure = isNightRoad
    ? "道路尽头和身后都不明确，路灯闪烁、树影晃动、远处细响共同制造压迫"
    : isCrossingRoad
      ? "车流距离、红绿灯倒计时和主角独自穿越路口的空旷感形成轻微压力"
      : isCycling
        ? "速度、车流距离、路面起伏和主角独自骑行的方向感形成持续但不夸张的压力"
      : /危险|恐惧|害怕|悬疑|秘密|异常/.test(story)
        ? "画面中存在一个不能过早揭示的未知压力源"
        : /想|希望|寻找|等待|失去/.test(story)
          ? "主角有一个明确的内心目标，但现实环境不断拖慢他接近目标"
          : "压力来自主角和环境之间的情绪落差";
  const visualAnchor = isNightRoad
    ? "手机冷光、潮湿路面反光、忽明忽暗的路灯、两侧黑影"
    : isCrossingRoad
      ? "斑马线白线、红绿灯倒计时、车灯扫过路面、主角手里的手机或背包带"
      : isCycling
        ? "车把、前轮转动、脚踏节奏、路边树影、远处车灯"
      : isSea
        ? "湿沙反光、海风吹动的衣角、低云和远处海线"
        : isHospital
          ? "闪烁灯管、斑驳墙面、半开的门缝、地面拖痕"
          : "一个能反复出现的手部动作、光源或随身物件";

  return {
    source: story,
    subject,
    protagonist,
    setting,
    action,
    emotionalState,
    pressure,
    visualAnchor,
    continuityObject: `${protagonist}的服装轮廓、发型、随身物件和行动方向必须连续`,
  };
}

function inferMoodTone(story: string, manualTone: MoodTone | "auto") {
  if (manualTone !== "auto") {
    return manualTone;
  }

  if (/治愈|温柔|暖|阳光|家|拥抱|释然/.test(story)) {
    return "warm";
  }

  if (/高级|克制|品牌|质感|时尚|冷淡/.test(story)) {
    return "premium";
  }

  if (/悬疑|危险|压迫|恐惧|废弃|夜|秘密/.test(story)) {
    return "tense";
  }

  if (/纪实|真实|生活|街头|采访|日常/.test(story)) {
    return "documentary";
  }

  return "lonely";
}

function buildCharacterProfile(story: string, type: VideoType, tone: MoodTone) {
  const context = parseStoryContext(story, type, tone);
  const mood = moodToneCopy[tone];
  const identity =
    /小明/.test(story)
      ? "小明，二十多岁的普通年轻男性"
      : type.id === "commercial"
      ? "产品使用者或品牌主角"
      : type.id === "knowledge"
        ? "讲述者或概念化人物"
        : context.subject.includes("女孩")
          ? "二十多岁的年轻女性"
          : context.subject.includes("男")
            ? "三十岁左右的男性"
            : "二十多岁到三十岁之间的核心人物";

  return {
    identity,
    appearance: mood.character,
    innerState: context.emotionalState,
    continuity: `${context.continuityObject}；反复使用${context.visualAnchor}作为视觉锚点；主色为${mood.palette}。`,
  };
}

function sceneForShot(type: VideoType, role: ShotRole, context: StoryContext, tone: MoodTone) {
  const mood = moodToneCopy[tone];
  const shouldUseExplainerSpace = type.id === "knowledge" && hasKnowledgeIntent(context.source);
  const base =
    type.id === "moodfilm"
      ? `场景是${context.setting}，${mood.light}；视觉锚点是${context.visualAnchor}`
      : type.id === "suspense"
        ? `场景是${context.setting}；压力源是${context.pressure}；使用阴影、门框、道路纵深和局部光源`
        : type.id === "commercial"
          ? `围绕“${context.subject}”设置干净可信的使用场景，让产品或结果始终清楚`
          : shouldUseExplainerSpace
            ? `围绕“${context.subject}”设置可解释的示意空间，背景要简洁有秩序`
            : `场景是${context.setting}，${mood.light}；所有镜头都围绕“${context.subject}”的具体动作推进`;

  const roleScene: Record<ShotRole, string> = {
    establish: `${base}。画面先交代${context.protagonist}在空间中的位置、行进方向和可疑区域。`,
    character: `${base}。${context.protagonist}进入主要光线，服装轮廓、身体姿态和当前心理压力必须清楚。`,
    detail: `${base}。只聚焦${context.visualAnchor}中的一个细节，用它替代对白说明。`,
    approach: `${base}。镜头沿${context.protagonist}的视线或行动方向靠近，不突然换轴。`,
    conflict: `${base}。把${context.protagonist}和${context.pressure}放在同一画面关系里。`,
    reaction: `${base}。背景退后，让${context.protagonist}的面部、眼神和呼吸成为画面重心。`,
    reveal: `${base}。空间露出一个新信息，但仍保持同一地理关系和同一视觉锚点。`,
    escalate: `${base}。用更强的明暗关系或构图压迫感推高${context.protagonist}的情绪。`,
    ending: `${base}。回到${context.protagonist}和空间的关系，留下余韵或悬念。`,
  };

  return roleScene[role];
}

function performanceForShot(role: ShotRole, tone: MoodTone, context: StoryContext) {
  const mood = moodToneCopy[tone];
  if (tone === "tense") {
    const horrorAction: Record<ShotRole, string> = {
      establish: `${context.protagonist}独自出现在${context.setting}中，${context.action}，身体微微缩起，手里贴近${context.visualAnchor}。`,
      character: `${context.protagonist}经过主要光源时停半拍，慢慢转头看向压力最强的方向，肩膀下意识绷紧。`,
      detail: `特写${context.visualAnchor}中的一个细节，手指或物件边缘轻微发抖，汗水或反光让紧张感变得可见。`,
      approach: `${context.protagonist}小心翼翼地继续${context.action.replace(context.protagonist, "")}，先探出半步，又迅速收回目光扫向身后。`,
      conflict: `${context.pressure}突然变得更明确，${context.protagonist}猛地停住，身体重心后撤半步，呼吸变浅但没有立刻逃跑。`,
      reaction: `近景展示${context.protagonist}惶恐的神情，眼睛逐渐变得警惕，瞳孔微微扩大，两边脸颊有少许汗水，嘴唇抿紧。`,
      reveal: `${context.protagonist}缓慢抬头看向画面深处，${context.visualAnchor}打在脸部或手部边缘，动作僵在半空。`,
      escalate: `${context.protagonist}察觉身后或侧面出现细微变化，猛地回头，衣角或发丝被环境带动，眼神从害怕变成高度戒备。`,
      ending: `${context.protagonist}背对镜头停在光线边缘，压力从画面边缘逼近，他只轻轻偏头，没有完全回头。`,
    };
    const horrorExpression: Record<ShotRole, string> = {
      establish: "表情看不清，只能从僵硬背影和缓慢步伐看出不安。",
      character: "眉头轻皱，眼神从路面移到黑暗处，脸部肌肉开始紧绷。",
      detail: "不拍完整面部，用手汗和指节压力表现心理紧张。",
      approach: "眼神左右快速扫动，呼吸被压住，嘴角轻微下沉。",
      conflict: "眼睛突然定住，喉结轻动，脸颊肌肉短暂抽紧。",
      reaction: "惶恐但不崩溃，眼睛警惕地睁大，两侧脸颊有细汗，嘴唇发干。",
      reveal: "困惑和害怕混在一起，眼神向上追随未知声源。",
      escalate: "惊吓后的警惕感增强，眼神变硬，眉间压低。",
      ending: "神态留白，恐惧不说破，只靠停顿和半回头传达。",
    };

    return {
      action: horrorAction[role],
      expression: horrorExpression[role],
    };
  }

  const actionByRole: Record<ShotRole, string> = {
    establish: `${context.protagonist}停在${context.setting}的边缘，先不急着行动，${context.action}。`,
    character: `${context.protagonist}缓慢进入画面，动作围绕“${context.subject}”展开，抬头看向最重要的光源或目标。`,
    detail: `镜头抓住${context.visualAnchor}，让手指、衣料、道具或光线变化承担一个清楚信息点。`,
    approach: `${context.protagonist}顺着视线向前推进两步，中途短暂停顿，随后继续靠近“${context.subject}”的关键位置。`,
    conflict: `${context.protagonist}突然停住，${context.pressure}压到画面前景，身体重心后移半步但眼睛仍盯着前方。`,
    reaction: `${context.protagonist}不说话，只用一次吞咽、一次眨眼和微微发颤的嘴角回应“${context.subject}”。`,
    reveal: `${context.protagonist}转头看向空间深处，手臂慢慢垂下，像刚意识到“${context.subject}”已经改变。`,
    escalate: `${context.protagonist}向光线或阴影中迈出一步，环境细节带动衣角，动作坚定但仍有迟疑。`,
    ending: `${context.protagonist}背对镜头停住，最后只回头一点点，让“${context.subject}”留在画面余韵里。`,
  };
  const expressionByRole: Record<ShotRole, string> = {
    establish: "表情不可夸张，眼神放空，眉间有轻微疲惫。",
    character: "眼神安静但戒备，嘴唇微抿，脸上没有明显笑意。",
    detail: "看不完整张脸，用手部紧张感暗示人物情绪。",
    approach: "目光从犹豫变得专注，眉头轻轻收紧。",
    conflict: "瞳孔方向固定，脸部肌肉短暂僵住，像听见了某个不该出现的声音。",
    reaction: "眼眶微湿或眼神微颤，情绪压住不爆发。",
    reveal: "从困惑转为理解，表情非常轻，但眼神明显沉下去。",
    escalate: "眼神变亮或变冷，嘴角收紧，像做出决定。",
    ending: "表情留白，观众只能从背影和停顿感读出情绪。",
  };

  return {
    action: `${actionByRole[role]} ${mood.performance}`,
    expression: expressionByRole[role],
  };
}

function directorNoteForShot(role: ShotRole) {
  const notes: Record<ShotRole, string> = {
    establish: "先交代空间地理关系，让观众知道人物从哪里来、要往哪里去。",
    character: "人物第一次清楚出现时，要固定造型识别点，后续镜头都围绕这个识别点保持一致。",
    detail: "细节镜头只承担一个信息点，不要同时出现多个需要理解的物件。",
    approach: "镜头运动必须由人物视线或动作驱动，避免为了炫技而移动。",
    conflict: "把压力放在画面方向里，让观众知道人物害怕或渴望的对象在哪里。",
    reaction: "情绪片最怕跳过反应，反应镜头要给足停顿。",
    reveal: "揭示不是解释全部，只给一个新信息，保留下一镜的观看动力。",
    escalate: "高潮镜头可以加强运动和明暗，但不要破坏人物和空间连续性。",
    ending: "结尾用留白，不用台词和字幕解释情绪。",
  };

  return notes[role];
}

function costForShot(index: number, mode: BudgetMode, role: ShotRole) {
  if (mode === "premium") {
    return role === "conflict" || role === "reveal" || role === "escalate" ? "高" : "中";
  }

  if (mode === "lean") {
    return index === 0 || role === "detail" || role === "ending" ? "低" : role === "conflict" ? "中" : "低";
  }

  return role === "conflict" || role === "reveal" ? "高" : role === "reaction" || role === "approach" ? "中" : "低";
}

function riskForShot(role: ShotRole, mode: BudgetMode) {
  if (role === "escalate" || role === "conflict") {
    return mode === "lean" ? "中" : "高";
  }

  if (role === "approach" || role === "reveal") {
    return "中";
  }

  return "低";
}

function buildSketchPrompt(type: VideoType, shot: Shot, character: ReturnType<typeof buildCharacterProfile>, tone: MoodTone) {
  const mood = moodToneCopy[tone];
  return [
    "black and white storyboard line art",
    "clean pencil sketch",
    "16:9 cinematic frame",
    "simple grayscale shading",
    "no color",
    "no text",
    `${type.label}, ${shot.scale}, ${shot.camera}`,
    `character: ${character.identity}, ${character.appearance}`,
    `scene: ${shot.sceneDetail}`,
    `action: ${shot.action}`,
    `facial expression: ${shot.expression}`,
    `${shot.title}: ${shot.subject}`,
    `mood palette: ${mood.palette}`,
    `camera motion note: ${shot.motion}`,
  ].join(", ");
}

function buildVideoPrompt(type: VideoType, shot: Shot, platform: Platform) {
  const platformLead =
    platform === "seedance"
      ? "Seedance 2.0 提示词：使用清楚的中文剧情语义，强调主体一致、镜头连贯、动作边界明确。"
      : platform === "kling"
      ? "Keep the character and scene consistent, avoid sudden morphing, clear subject action."
      : platform === "runway"
        ? "Cinematic continuity, realistic lighting, controlled camera language."
        : "Natural spatial motion, coherent depth, film-like realism.";

  return `${platformLead}
视频类型：${type.label}
分镜：${String(shot.id).padStart(2, "0")} / ${shot.title}
开头场景与氛围：${shot.sceneDetail}
人物与画面主体：${shot.subject}
具体动作：${shot.action}
神态描写：${shot.expression}
镜头：${shot.scale}，${shot.camera}，${shot.motion}
导演意图：${shot.purpose}
执行要求：保持人物造型、空间方向、光线气质连续；动作只做一个清楚变化；不要字幕，不要 logo，不要突然新增人物。`;
}

function buildFullVideoPrompt(
  type: VideoType,
  shots: Shot[],
  platform: Platform,
  tone: MoodTone,
  character: ReturnType<typeof buildCharacterProfile>,
  sourceLabel: string,
  artDirection: string,
  assets: ReferenceAsset[],
  characterSetting: string,
) {
  const platformLead =
    platform === "seedance"
      ? "Seedance 2.0 整片提示词：使用清楚的中文剧情语义，强调主体一致、镜头连贯、动作边界明确。"
      : platform === "kling"
      ? "Kling whole-video prompt: keep character identity, scene direction, camera movement and action boundaries consistent."
      : platform === "runway"
        ? "Runway whole-video prompt: cinematic continuity, realistic lighting, controlled camera language, coherent character performance."
        : "Luma whole-video prompt: natural spatial motion, coherent depth, film-like realism, stable subject identity.";

  const timeline = shotTimeline(shots);
  const shotLines = shots
    .map((shot, index) => {
      return `分镜 ${String(shot.id).padStart(2, "0")}｜${shot.title}｜${timeline[index].start}–${timeline[index].end} 秒｜时长 ${timeline[index].seconds} 秒
场景：${shot.sceneDetail}
画面主体：${shot.subject}
人物动作：${shot.action}
神态描写：${shot.expression}
镜头语言：${shot.scale}，${shot.camera}，${shot.motion}
导演意图：${shot.directorNote}`;
    })
    .join("\n\n");

  const characterText = characterSetting || (sourceLabel === "规则分镜"
    ? `${character.identity}；${character.appearance}\n心理状态：${character.innerState}\n连续性要求：${character.continuity}`
    : `人物与画面主体：${Array.from(new Set(shots.map((shot) => shot.subject).filter(Boolean))).join("；")}\n人物外观与服装沿用美术设定和参考图片，心理变化按下方分镜执行，不额外添加人物。`);
  const assetText = assets.map((asset, index) => `参考图 ${index + 1}（${asset.name}，${asset.kind}）：${asset.description || "以图片可见特征为准"}`);

  return `一、美术风格
${artDirection || `${moodToneCopy[tone].palette}；${moodToneCopy[tone].light}`}
视频类型：${type.label}
${platformLead}
开场环境：
${shots[0]?.sceneDetail || "根据原始文案建立真实、连续、可拍摄的开场空间。"}
${assetText.length ? `参考资产：${assetText.join("；")}\n` : ""}
二、人物设定
${characterText}
同一角色在所有镜头中保持面部特征、发型、服装和关键道具一致。

三、分镜
整片总时长：${timeline.at(-1)?.end || 0} 秒；共 ${shots.length} 个镜头
完整分镜：
${shotLines}

镜头衔接：依照上述场景、人物和动作顺序自然转场，保持视线与运动方向连续，不擅自增加人物或情节；无额外字幕、水印或 logo。`;
}

function shotRuleIndexesForCount(count: ShotCount) {
  const presets: Record<ShotCount, number[]> = {
    2: [0, 8],
    3: [0, 5, 8],
    4: [0, 1, 5, 8],
    5: [0, 1, 2, 5, 8],
    6: [0, 1, 2, 4, 5, 8],
    7: [0, 1, 2, 3, 4, 5, 8],
    8: [0, 1, 2, 3, 4, 5, 6, 8],
    9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  };

  return presets[count];
}

function buildShots(type: VideoType, story: string, mode: BudgetMode, platform: Platform, tone: MoodTone, count: ShotCount): Shot[] {
  const context = parseStoryContext(story, type, tone);
  const character = buildCharacterProfile(story, type, tone);
  const selectedRules = shotRuleIndexesForCount(count).map((index) => type.shotRules[index]);

  return selectedRules.map((rule, index) => {
    const performance = performanceForShot(rule.role, tone, context);
    const shotBase = {
      ...rule,
      id: index + 1,
      subject: subjectByRole(context, rule.role, type),
      sceneDetail: sceneForShot(type, rule.role, context, tone),
      action: performance.action,
      expression: performance.expression,
      directorNote: directorNoteForShot(rule.role),
      cost: costForShot(index, mode, rule.role),
      risk: riskForShot(rule.role, mode),
    } as Shot;

    shotBase.sketchPrompt = buildSketchPrompt(type, shotBase, character, tone);
    shotBase.videoPrompt = buildVideoPrompt(type, shotBase, platform);

    return shotBase;
  });
}

function cleanDraftText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mergeGeneratedShots(baseShots: Shot[], drafts: GeneratedShotDraft[] | null): Shot[] {
  if (!drafts?.length) {
    return baseShots;
  }

  return baseShots.map((shot, index) => {
    const draft = drafts[index] || {};
    return {
      ...shot,
      duration: `${durationSeconds(draft.duration, durationSeconds(shot.duration))}s`,
      scale: cleanDraftText(draft.scale) || shot.scale,
      camera: cleanDraftText(draft.camera) || shot.camera,
      motion: cleanDraftText(draft.motion) || shot.motion,
      title: cleanDraftText(draft.title) || shot.title,
      subject: cleanDraftText(draft.subject) || shot.subject,
      sceneDetail: cleanDraftText(draft.sceneDetail) || shot.sceneDetail,
      action: cleanDraftText(draft.action) || shot.action,
      expression: cleanDraftText(draft.expression) || shot.expression,
      directorNote: cleanDraftText(draft.directorNote) || shot.directorNote,
      sketchPrompt: cleanDraftText(draft.sketchPrompt) || shot.sketchPrompt,
      videoPrompt: cleanDraftText(draft.videoPrompt) || shot.videoPrompt,
    };
  });
}

function subjectByRole(context: StoryContext, role: ShotRole, type: VideoType) {
  const shouldUseExplainerRule = type.id === "knowledge" && hasKnowledgeIntent(context.source);
  const continuityRule =
    type.id === "suspense"
      ? "保持同一雨夜空间和同一主角"
      : type.id === "commercial"
        ? "保持同一产品、同一使用场景和干净背景"
        : shouldUseExplainerRule
          ? "用清晰示意画面表达同一个主题"
          : "保持同一真实空间、同一主角和同一行动方向";

  const roleText: Record<ShotRole, string> = {
    establish: `${context.protagonist}在${context.setting}中进入故事，${continuityRule}`,
    character: `${context.protagonist}执行“${context.action}”这一核心动作，${continuityRule}`,
    detail: `${context.visualAnchor}成为解释“${context.subject}”的关键细节，${continuityRule}`,
    approach: `${context.protagonist}顺着行动方向靠近“${context.subject}”的关键变化，${continuityRule}`,
    conflict: `${context.protagonist}被“${context.pressure}”压住，${continuityRule}`,
    reaction: `${context.protagonist}对“${context.subject}”产生可见反应，${continuityRule}`,
    reveal: `${context.subject}背后的新信息被露出一点，${continuityRule}`,
    escalate: `${context.protagonist}的情绪、压力或价值感被推高，${continuityRule}`,
    ending: `${context.protagonist}用一个停顿为“${context.subject}”留下收束或悬念，${continuityRule}`,
  };

  return roleText[role];
}

function continuityNotes(type: VideoType, shots: Shot[], mode: BudgetMode) {
  const highRiskCount = shots.filter((shot) => shot.risk === "高").length;
  const lowCostCount = shots.filter((shot) => shot.cost === "低").length;

  return [
    `类型判断：${type.label}。${type.summary}`,
    `镜头语法：${type.grammar.slice(0, 3).join(" / ")}。`,
    `生成策略：${budgetCopy[mode].strategy}`,
    `风险提示：当前有 ${highRiskCount} 个高风险镜头，${lowCostCount} 个可低成本处理镜头。`,
  ];
}

export default function Home() {
  const [story, setStory] = useState(initialStory);
  const [storyEdited, setStoryEdited] = useState(false);
  const [promptDocument, setPromptDocument] = useState<PromptDocument | null>(null);
  const [documentReading, setDocumentReading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentUploadResult, setDocumentUploadResult] = useState<{ name: string; size: number; status: "loading" | "success" | "error"; characters?: number; error?: string } | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [manualType, setManualType] = useState<VideoTypeId | "auto">("auto");
  const [manualTone, setManualTone] = useState<MoodTone | "auto">("auto");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("balanced");
  const [platform, setPlatform] = useState<Platform>("seedance");
  const [shotCount, setShotCount] = useState<ShotCount>(4);
  const [targetSecondsInput, setTargetSecondsInput] = useState("20");
  const targetSeconds = Number(targetSecondsInput);
  let targetError = "";
  try { validateTargetSeconds(targetSecondsInput, shotCount); }
  catch (error) { targetError = (error as Error).message; }
  const [selectedShotId, setSelectedShotId] = useState(1);
  const [sketchStatus, setSketchStatus] = useState<SketchStatus>("idle");
  const [sketchImages, setSketchImages] = useState<Record<number, string>>({});
  const [sketchError, setSketchError] = useState("");
  const [activeGeneratingShotId, setActiveGeneratingShotId] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [imageProvider, setImageProvider] = useState<ImageProvider>("openai");
  const [imageModel, setImageModel] = useState<ImageModel>("gpt-image-1-mini");
  const [customModel, setCustomModel] = useState("image-model");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [textProvider, setTextProvider] = useState<TextProvider>("openai");
  const [textApiKey, setTextApiKey] = useState("");
  const [textModel, setTextModel] = useState(textProviderCopy.openai.defaultModel);
  const [textEndpoint, setTextEndpoint] = useState("");
  const [promptStatus, setPromptStatus] = useState<PromptStatus>("idle");
  const [promptError, setPromptError] = useState("");
  const [generatedShotDrafts, setGeneratedShotDrafts] = useState<GeneratedShotDraft[] | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<"full" | "shot" | null>(null);
  const [copyError, setCopyError] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("setup");
  const [assets, setAssets] = useState<ReferenceAsset[]>([]);
  const [styleBrief, setStyleBrief] = useState("");
  const [artDirection, setArtDirection] = useState("");
  const [characterSetting, setCharacterSetting] = useState("");
  const [assetError, setAssetError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [durationOverrides, setDurationOverrides] = useState<Record<number, number>>({});
  const generationVersion = useRef(0);
  const rewriteRequest = useRef<AbortController | null>(null);
  const [rewritingShotId, setRewritingShotId] = useState<number | null>(null);
  const [rewriteInstructions, setRewriteInstructions] = useState<Record<number, string>>({});
  const [rewriteError, setRewriteError] = useState("");
  const [rewriteNotice, setRewriteNotice] = useState("");

  const documentInterpretation = promptDocument?.interpretation;
  const rulesDocument = documentInterpretation?.kind === "rules";
  const documentCreative = storyEdited ? story.trim() : "";
  const activeStory = promptDocument ? (rulesDocument ? documentCreative : documentInterpretation?.storyText || "") : story.trim() || initialStory;
  let documentValidationError = "";
  try { if (promptDocument) resolveDocumentInput(validatePromptDocument(promptDocument), documentCreative); }
  catch (error) { documentValidationError = (error as Error).message; }
  const selectedType = useMemo(() => pickVideoType(activeStory, manualType), [activeStory, manualType]);
  const selectedTone = useMemo(() => inferMoodTone(activeStory, manualTone), [activeStory, manualTone]);
  const characterProfile = useMemo(() => buildCharacterProfile(activeStory, selectedType, selectedTone), [activeStory, selectedType, selectedTone]);
  const ruleShots = useMemo(
    () => {
      const base = buildShots(selectedType, activeStory, budgetMode, platform, selectedTone, shotCount);
      return targetError ? base : fitShotDurations(base, targetSeconds);
    },
    [selectedType, activeStory, budgetMode, platform, selectedTone, shotCount, targetSeconds, targetError],
  );
  const shots = useMemo(() => mergeGeneratedShots(ruleShots, generatedShotDrafts).map((shot) => ({
    ...shot, duration: `${durationOverrides[shot.id] ?? durationSeconds(shot.duration)}s`,
  })), [ruleShots, generatedShotDrafts, durationOverrides]);
  const timeline = shotTimeline(shots);
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) || shots[0];
  const alternatives = videoTypes
    .filter((type) => type.id !== selectedType.id)
    .map((type) => ({ ...type, score: scoreType(activeStory, type) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  const totalSeconds = shots.reduce((sum, shot) => sum + Number.parseInt(shot.duration, 10), 0);
  const notes = continuityNotes(selectedType, shots, budgetMode);
  const activeImageModel = imageProvider === "openai" ? imageModel : customModel;
  const activeProvider = imageProviderCopy[imageProvider];
  const activeTextProvider = textProviderCopy[textProvider];
  const activeTextModel = textModel.trim() || activeTextProvider.defaultModel;
  const activeTextPreset = activeTextProvider.presets?.find((preset) => preset.model === activeTextModel.toLowerCase());
  const storyboardSourceLabel = generatedShotDrafts ? (promptDocument ? "文档分镜" : "大模型分镜") : "规则分镜";
  const fullVideoPrompt = useMemo(
    () => buildFullVideoPrompt(selectedType, shots, platform, selectedTone, characterProfile, storyboardSourceLabel, artDirection || styleBrief, assets, characterSetting),
    [selectedType, shots, platform, selectedTone, characterProfile, storyboardSourceLabel, artDirection, styleBrief, assets, characterSetting],
  );
  const selectedVideoPrompt = `美术设定：${artDirection || styleBrief || moodToneCopy[selectedTone].palette}\n${assets.length ? `参考资产：${assets.map((asset, index) => `参考图 ${index + 1}（${asset.name}）：${asset.description}`).join("；")}\n` : ""}生成时长：${durationSeconds(selectedShot.duration)} 秒\n${selectedShot.videoPrompt}`;
  const workflowTabs: { id: WorkspaceTab; label: string; hint: string }[] = [
    { id: "setup", label: "1 文案设定", hint: "输入故事，选择类型和氛围" },
    { id: "board", label: "2 分镜预览", hint: `检查 ${shotCount} 个镜头的顺序` },
    { id: "prompt", label: "3 镜头提示词", hint: "审完提示词后按需出图" },
  ];

  function resetSketchOutput() {
    setSketchImages({});
    setSketchError("");
    setActiveGeneratingShotId(null);
    setSketchStatus("idle");
  }

  function resetPromptOutput() {
    rewriteRequest.current?.abort();
    rewriteRequest.current = null;
    setRewritingShotId(null);
    setRewriteInstructions({});
    setRewriteError("");
    setRewriteNotice("");
    generationVersion.current += 1;
    setArtDirection("");
    setCharacterSetting("");
    setDurationOverrides({});
    setCopiedPrompt(null);
    setGeneratedShotDrafts(null);
    setPromptError("");
    setPromptStatus("idle");
    resetSketchOutput();
  }

  function useRuleStoryboard() {
    if (documentReading) return;
    if (promptDocument) { setPromptError("文档优先生成需要文字模型接口，请填写 API Key 后生成。"); return; }
    if (targetError) { setPromptError(targetError); return; }
    if (assets.length) {
      setPromptError("图片资产分析需要支持图片理解的大模型，请填写文字模型接口并生成。");
      return;
    }
    resetPromptOutput();
    setGeneratedShotDrafts(null);
    setPromptError("");
    setPromptStatus("idle");
    setSelectedShotId(1);
    setActiveTab("board");
    resetSketchOutput();
  }

  async function generateAiStoryboard() {
    if (rewriteRequest.current) return;
    if (documentReading) return;
    if (assets.length && activeTextPreset?.vision === false) {
      setPromptStatus("error");
      setPromptError("当前模型仅支持文字。请选智谱 GLM-4.6V-Flash 或支持看图的免费路由，或移除参考图后生成。");
      return;
    }
    try { if (promptDocument) resolveDocumentInput(validatePromptDocument(promptDocument), documentCreative); }
    catch (error) { setPromptError((error as Error).message); return; }
    if (targetError) { setPromptError(targetError); setPromptStatus("error"); return; }
    if (!textApiKey.trim()) {
      useRuleStoryboard();
      return;
    }

    if (textProvider === "custom" && !textEndpoint.trim()) {
      setPromptStatus("error");
      setPromptError("请先填写自定义文字模型接口的 https 地址。");
      return;
    }

    setPromptStatus("generating");
    const version = ++generationVersion.current;
    setPromptError("");
    resetSketchOutput();

    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: textApiKey.trim(),
          provider: textProvider,
          model: activeTextModel,
          endpoint: textEndpoint.trim(),
          story: promptDocument ? (storyEdited ? story.trim() : "") : activeStory,
          document: promptDocument,
          videoType: selectedType.label,
          videoTypeSummary: selectedType.summary,
          tone: moodToneCopy[selectedTone].label,
          toneGuide: moodToneCopy[selectedTone],
          shotCount,
          targetSeconds,
          budgetMode: budgetCopy[budgetMode].label,
          platform: platformCopy[platform].label,
          assets,
          styleBrief,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { shots?: GeneratedShotDraft[]; artDirection?: string; characterSetting?: string; error?: string };
      if (version !== generationVersion.current) return;

      if (!response.ok || !data.shots?.length) {
        throw new Error(data.error || "文字模型没有返回可用分镜，请检查接口、模型名或余额。");
      }

      setGeneratedShotDrafts(data.shots.slice(0, shotCount));
      setArtDirection(data.artDirection || "");
      setCharacterSetting(data.characterSetting || "");
      setDurationOverrides({});
      setCopiedPrompt(null);
      setPromptStatus("ready");
      setSelectedShotId(1);
      setActiveTab("board");
    } catch (error) {
      if (version !== generationVersion.current) return;
      setPromptStatus("error");
      setPromptError(error instanceof Error ? error.message : "文字模型调用失败，请稍后重试。");
    }
  }

  async function rewriteSelectedShot() {
    if (rewriteRequest.current || promptStatus === "generating" || sketchStatus === "generating") return;
    const instruction = (rewriteInstructions[selectedShot.id] || "").trim();
    setRewriteError("");
    setRewriteNotice("");
    if (!instruction) { setRewriteError("请填写当前镜头的具体修改要求。"); return; }
    if (!textApiKey.trim()) { setRewriteError("单镜头修改需要文字模型 API Key，请先在文案设定中填写。"); return; }
    if (documentValidationError) { setRewriteError(documentValidationError); return; }
    if (assets.length && activeTextPreset?.vision === false) { setRewriteError("当前模型不支持参考图片，请先切换支持看图的模型。"); return; }
    const id = selectedShot.id;
    const snapshot = shots;
    const version = generationVersion.current;
    const controller = new AbortController();
    rewriteRequest.current = controller;
    setRewritingShotId(id);
    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: textApiKey.trim(), provider: textProvider, model: activeTextModel, endpoint: textEndpoint.trim(),
          story: promptDocument ? documentCreative : activeStory, document: promptDocument,
          videoType: selectedType.label, videoTypeSummary: selectedType.summary,
          tone: moodToneCopy[selectedTone].label, toneGuide: moodToneCopy[selectedTone],
          budgetMode: budgetCopy[budgetMode].label, platform: platformCopy[platform].label, shotCount,
          assets, styleBrief, artDirection: artDirection || styleBrief,
          characterSetting: characterSetting || `沿用原分镜人物，不新增角色：${Array.from(new Set(snapshot.map((shot) => shot.subject))).join("；")}`,
          rewrite: { shotId: id, instruction, shots: snapshot },
        }),
      });
      const data = await response.json().catch(() => ({})) as { shot?: GeneratedShotDraft; shotId?: number; error?: string };
      if (controller.signal.aborted || generationVersion.current !== version) return;
      if (!response.ok || !data.shot || data.shotId !== id) throw new Error(data.error || "未收到对应镜头的修改结果，原分镜已保留。");
      setGeneratedShotDrafts(replaceSingleShot(snapshot, id, data.shot));
      setSketchImages((current) => { const next = { ...current }; delete next[id]; return next; });
      setSketchStatus("idle");
      setSketchError("");
      setCopiedPrompt(null);
      setCopyError("");
      setRewriteNotice(`分镜 ${id} 已更新，其他镜头和时长保持不变。`);
    } catch (error) {
      if (!controller.signal.aborted && generationVersion.current === version) setRewriteError(`分镜 ${id} 修改失败：${error instanceof Error ? error.message : "请稍后重试"} 原分镜已保留。`);
    } finally {
      if (rewriteRequest.current === controller) { rewriteRequest.current = null; setRewritingShotId(null); }
    }
  }

  async function uploadPromptDocument(file: File | undefined) {
    if (!file) return;
    setDocumentReading(true);
    setDocumentError("");
    setDocumentUploadResult({ name: file.name, size: file.size, status: "loading" });
    resetPromptOutput();
    try {
      // Keep fast local reads visible without delaying the file read itself.
      const [result] = await Promise.allSettled([
        readPromptDocument(file),
        new Promise<void>((resolve) => window.setTimeout(resolve, 450)),
      ]);
      if (result.status === "rejected") throw result.reason;
      const document = result.value;
      setPromptDocument(document);
      setDocumentUploadResult({ name: file.name, size: file.size, status: "success", characters: document.text.length });
      setManualType("auto");
      setManualTone("auto");
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "文档读取失败，请重新选择文件或另存为 DOCX / TXT 后重试。";
      setDocumentError(message);
      setDocumentUploadResult({ name: file.name, size: file.size, status: "error", error: message });
    }
    finally { setDocumentReading(false); }
  }

  function setDocumentMode(mode: DocumentMode) {
    if (!promptDocument) return;
    setPromptDocument({ ...promptDocument, interpretation: interpretPromptDocument(promptDocument.text, mode) });
    setDocumentError("");
    resetPromptOutput();
  }

  function editDocumentPart(field: "storyText" | "rulesText", text: string) {
    if (!promptDocument || !documentInterpretation) return;
    setPromptDocument({ ...promptDocument, interpretation: { ...documentInterpretation, [field]: text, confirmed: !documentInterpretation.needsConfirmation } });
    resetPromptOutput();
  }

  async function addAssets(files: FileList | null) {
    if (!files?.length) return;
    setAssetError("");
    if (files.length + assets.length > MAX_REFERENCE_ASSETS) { setAssetError(`最多上传 ${MAX_REFERENCE_ASSETS} 张参考图片。`); return; }
    setUploading(true);
    try {
      const additions: ReferenceAsset[] = [];
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) {
          throw new Error("请选择不超过 3 MB 的 PNG、JPEG 或 WebP 图片。");
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
          reader.readAsDataURL(file);
        });
        await new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("图片无法解码，请换一张有效图片。"));
          image.src = dataUrl;
        });
        additions.push({ id: crypto.randomUUID(), name: file.name, kind: "人物", description: "", dataUrl });
      }
      setAssets((current) => [...current, ...additions]);
      resetPromptOutput();
    } catch (error) { setAssetError((error as Error).message); }
    finally { setUploading(false); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (textApiKey.trim()) {
      await generateAiStoryboard();
      return;
    }

    useRuleStoryboard();
  }

  function handleShotCountChange(value: string) {
    const nextCount = Number(value) as ShotCount;
    if (!shotCountOptions.includes(nextCount)) {
      return;
    }

    setShotCount(nextCount);
    setSelectedShotId((current) => Math.min(current, nextCount));
    resetPromptOutput();
  }

  async function requestSketchImage(shot: Shot) {
    const response = await fetch("/api/generate-sketch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: apiKey.trim(),
        provider: imageProvider,
        model: activeImageModel,
        endpoint: customEndpoint.trim(),
        prompt: shot.sketchPrompt,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { image?: string; error?: string };

    if (!response.ok || !data.image) {
      throw new Error(data.error || "线稿生成失败，请检查 API Key 或稍后重试。");
    }

    return data.image;
  }

  async function generateSketches() {
    if (rewriteRequest.current) return;
    if (!apiKey.trim()) {
      setSketchStatus("error");
      setSketchError("请先填写当前图片接口的 API Key，再生成线稿。");
      return;
    }

    if (imageProvider !== "openai" && !customEndpoint.trim()) {
      setSketchStatus("error");
      setSketchError("请先填写兼容接口或自定义接口的 https 地址。");
      return;
    }

    setSketchStatus("generating");
    setSketchError("");
    setSketchImages({});

    try {
      for (const shot of shots) {
        setActiveGeneratingShotId(shot.id);
        const image = await requestSketchImage(shot);
        setSketchImages((images) => ({ ...images, [shot.id]: image }));
      }
      setActiveGeneratingShotId(null);
      setSketchStatus("ready");
    } catch (error) {
      setActiveGeneratingShotId(null);
      setSketchStatus("error");
      setSketchError(error instanceof Error ? error.message : "线稿生成失败，请稍后重试。");
    }
  }

  async function regenerateShot(shotId: number) {
    if (rewriteRequest.current) return;
    if (!apiKey.trim()) {
      setSketchStatus("error");
      setSketchError("请先填写当前图片接口的 API Key，再生成当前分镜图。");
      return;
    }

    if (imageProvider !== "openai" && !customEndpoint.trim()) {
      setSketchStatus("error");
      setSketchError("请先填写兼容接口或自定义接口的 https 地址。");
      return;
    }

    const shot = shots.find((item) => item.id === shotId);
    if (!shot) {
      return;
    }

    setSketchStatus("generating");
    setSketchError("");
    setActiveGeneratingShotId(shotId);

    try {
      const image = await requestSketchImage(shot);
      setSketchImages((images) => ({ ...images, [shotId]: image }));
      setSketchStatus("ready");
    } catch (error) {
      setSketchStatus("error");
      setSketchError(error instanceof Error ? error.message : "当前镜头生成失败，请稍后重试。");
    } finally {
      setActiveGeneratingShotId(null);
    }
  }

  async function copyPrompt(text: string, target: "full" | "shot") {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(target);
      window.setTimeout(() => setCopiedPrompt(null), 1600);
    } catch {
      setCopiedPrompt(null);
      setCopyError("复制失败，请选中下方提示词手动复制。");
    }
  }

  const rewritePanel = (
    <section className="shot-rewrite-panel" aria-label="修改单个分镜">
      <div className="full-prompt-head">
        <div><p className="eyebrow">局部修改</p><h2>修改当前分镜</h2></div>
        <select className="select-control" aria-label="选择要修改的分镜" value={selectedShot.id} onChange={(event) => setSelectedShotId(Number(event.target.value))}>
          {shots.map((shot) => <option key={shot.id} value={shot.id}>分镜 {shot.id} · {shot.title} · {durationSeconds(shot.duration)} 秒</option>)}
        </select>
      </div>
      <label className="control-label" htmlFor="shot-rewrite-instruction">分镜 {selectedShot.id} 的修改要求</label>
      <textarea id="shot-rewrite-instruction" rows={3} maxLength={1600} value={rewriteInstructions[selectedShot.id] || ""}
        disabled={rewritingShotId !== null} placeholder="例如：改为侧脸近景，不要回头，用眼神和轻微呼吸表现紧张，机位保持不动。"
        onChange={(event) => { setRewriteInstructions((current) => ({ ...current, [selectedShot.id]: event.target.value })); setRewriteError(""); setRewriteNotice(""); }} />
      <div className="rewrite-actions">
        <button type="button" className="secondary-button" disabled={rewritingShotId !== null || promptStatus === "generating" || sketchStatus === "generating" || !(rewriteInstructions[selectedShot.id] || "").trim()} onClick={rewriteSelectedShot}>
          {rewritingShotId !== null ? <LoaderCircle size={18} className="upload-spinner" aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
          {rewritingShotId !== null ? `正在修改分镜 ${rewritingShotId}…` : `只重新生成分镜 ${selectedShot.id}`}
        </button>
        <span className="microcopy">保留原时长、其他镜头和全局设定；本镜头旧分镜图将失效，不会自动出图。</span>
      </div>
      {rewriteError ? <p className="status-error" role="alert">{rewriteError}</p> : null}
      {rewriteNotice ? <p role="status">{rewriteNotice}</p> : null}
    </section>
  );

  const integratedPromptPanel = (
    <section className="full-prompt-panel" aria-label="整合提示词">
      <div className="full-prompt-head">
        <div><p className="eyebrow">整片总提示词</p><h2>整合提示词</h2><p className="microcopy">美术风格 · 人物设定 · 分镜 ｜ {totalSeconds} 秒</p></div>
        <button className="secondary-button" onClick={() => copyPrompt(fullVideoPrompt, "full")} type="button">
          {copiedPrompt === "full" ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copiedPrompt === "full" ? "已复制" : "复制整片提示词"}
        </button>
      </div>
      <PromptBox text={fullVideoPrompt} />
      {copyError ? <p className="status-error" role="alert">{copyError}</p> : null}
      {assets.length ? <p className="microcopy">参考图需按相同编号另行上传至视频工具。</p> : null}
    </section>
  );

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)]">
      <section className="director-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              9
            </div>
            <div>
              <p className="brand-name">九格导演 Agent</p>
              <p className="brand-subtitle">一句描述，补人物心理、环境和镜头细节</p>
            </div>
          </div>
          <div className="status-strip" aria-label="agent workflow">
            <span>类型诊断</span>
            <span>镜头语法</span>
            <span>2-9 镜头</span>
            <span>分镜图按需生成</span>
          </div>
        </header>

        <nav className="workflow-tabs" aria-label="工作流程分页">
          {workflowTabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.id !== "setup" && (documentReading || (!!promptDocument && !generatedShotDrafts))}
              type="button"
            >
              <span>{tab.label}</span>
              <small>{tab.hint}</small>
            </button>
          ))}
        </nav>

        <div className="workflow-stack">
          {activeTab === "setup" ? (
            <section className="workflow-page setup-page">
              <div className="setup-grid">
                <aside className="control-panel setup-input-panel">
                  <form onSubmit={handleSubmit}>
                    <section className="reference-assets document-input" aria-label="提示词文档">
                      <h3>提示词文档（可选）</h3>
                      <div className="asset-upload-bar document-upload-bar">
                        <button className="asset-upload-button" type="button" disabled={documentReading || promptStatus === "generating"} onClick={() => documentInputRef.current?.click()} aria-describedby="document-upload-help">
                          {documentReading ? <LoaderCircle className="upload-spinner" size={20} aria-hidden="true" /> : <FileUp size={20} aria-hidden="true" />}
                          <span>{documentReading ? "正在读取…" : promptDocument ? "替换文档" : "上传文档"}</span>
                        </button>
                        <div className="asset-upload-info"><strong>{documentInterpretation ? `识别为${documentKindLabels[documentInterpretation.kind]}` : "从提示词文档开始"}</strong><span id="document-upload-help">DOCX / TXT / MD · 最大 5 MB</span></div>
                      </div>
                      <input ref={documentInputRef} hidden aria-label="选择提示词文档" id="prompt-document" type="file" accept=".docx,.txt,.md" disabled={documentReading || promptStatus === "generating"}
                        onChange={(event) => { void uploadPromptDocument(event.target.files?.[0]); event.target.value = ""; }} />
                      <p className="microcopy">可导入最多 200,000 字符；单次生成使用的故事与规范合计最多 20,000 字符。原文完整保留。</p>
                      <div aria-live="polite" aria-atomic="true">
                        {documentUploadResult ? <div className={`document-upload-status ${documentUploadResult.status === "error" ? "failed" : documentUploadResult.status}`}>
                          <strong>{documentUploadResult.status === "error" ? "上传失败" : documentUploadResult.status === "loading" ? "正在读取文档…" : "上传成功"}</strong>
                          <span>{documentUploadResult.name} · {(documentUploadResult.size / 1024).toFixed(1)} KB</span>
                          {documentUploadResult.status === "error" ? <p>{documentUploadResult.error}{promptDocument ? " 当前仍保留下方原文档。" : ""}</p> : documentUploadResult.status === "loading" ? <p>正在提取正文并识别用途，请稍候。</p> : <p>已读取 {documentUploadResult.characters?.toLocaleString("zh-CN")} 字符，可在下方查看识别结果。</p>}
                          {documentUploadResult.status === "error" ? <button type="button" className="secondary-button" onClick={() => documentInputRef.current?.click()}>重新选择文档</button> : null}
                        </div> : null}
                      </div>
                      {promptDocument ? <>
                        <div className="reference-asset-heading">
                          <strong title={promptDocument.name}>{promptDocument.name}</strong>
                          <button className="inline-button" type="button" title="移除文档" aria-label="移除文档" disabled={documentReading || promptStatus === "generating"}
                            onClick={() => { setPromptDocument(null); setDocumentError(""); setDocumentUploadResult(null); resetPromptOutput(); }}>×</button>
                        </div>
                        {documentInterpretation ? <div className="document-interpretation">
                          <label className="control-label" htmlFor="document-mode">文档用途</label>
                          <select id="document-mode" className="select-control" value={documentInterpretation.mode} disabled={documentReading || promptStatus === "generating"}
                            onChange={(event) => setDocumentMode(event.target.value as DocumentMode)}>
                            <option value="auto">自动识别</option>
                            <option value="story">故事／剧本</option><option value="rules">提示词规范／模板</option><option value="mixed">混合文档</option>
                          </select>
                          <p className="microcopy" role="status">{documentKindLabels[documentInterpretation.kind]} · {documentInterpretation.reason}</p>
                          {documentInterpretation.kind !== "rules" ? <>
                            <label className="control-label" htmlFor="document-story">故事素材（正式剧情）</label>
                            <textarea id="document-story" rows={5} maxLength={MAX_DOCUMENT_CHARS} value={documentInterpretation.storyText} disabled={documentReading || promptStatus === "generating"}
                              onChange={(event) => editDocumentPart("storyText", event.target.value)} placeholder="本次要拍摄的故事、人物与事件，不包含模板示例。" />
                          </> : null}
                          {documentInterpretation.kind !== "story" ? <>
                            <label className="control-label" htmlFor="document-rules">创作规范（只约束写法）</label>
                            <textarea id="document-rules" rows={5} maxLength={MAX_DOCUMENT_CHARS} value={documentInterpretation.rulesText} disabled={documentReading || promptStatus === "generating"}
                              onChange={(event) => editDocumentPart("rulesText", event.target.value)} placeholder="镜头语言、提示词结构、风格和表达要求。" />
                          </> : null}
                          {documentInterpretation.needsConfirmation ? <label className="document-confirm">
                            <input type="checkbox" checked={documentInterpretation.confirmed} disabled={documentReading || promptStatus === "generating"}
                              onChange={(event) => { setPromptDocument({ ...promptDocument, interpretation: { ...documentInterpretation, confirmed: event.target.checked } }); resetPromptOutput(); }} />
                            <span>已确认文档用途与内容，示例未被误作正式剧情</span>
                          </label> : null}
                          {documentValidationError ? <p className="status-error">{documentValidationError}</p> : null}
                        </div> : null}
                        <details className="document-original"><summary>查看原始正文 · {promptDocument.text.length} 字符</summary>
                          <label className="control-label" htmlFor="document-text">修改原文后将重新识别</label>
                          <textarea id="document-text" rows={7} value={promptDocument.text} maxLength={MAX_IMPORTED_DOCUMENT_CHARS} disabled={documentReading || promptStatus === "generating"}
                            onChange={(event) => { const text = event.target.value; setPromptDocument({ ...promptDocument, text, interpretation: interpretPromptDocument(text) }); setDocumentError(""); resetPromptOutput(); }} />
                        </details>
                      </> : null}
                    </section>
                    <div className="panel-heading">
                      <p>{promptDocument && !rulesDocument ? "补充要求（可选）" : "输入创意"}</p>
                      <strong>{rulesDocument ? "填写本次故事，文档只约束写法" : promptDocument ? "以故事素材为主，补充细节" : "先从一句话开始"}</strong>
                    </div>
                    <textarea
                      value={promptDocument && !storyEdited ? "" : story}
                      onChange={(event) => {
                        const nextStory = event.target.value;
                        setStory(nextStory);
                        setStoryEdited(true);
                        if (manualType === "knowledge" && isNarrativeStory(nextStory)) {
                          setManualType("auto");
                        }
                        resetPromptOutput();
                      }}
                      aria-label="视频故事或文案"
                      className="story-input"
                      placeholder="例如：小明一个人在走夜路。"
                    />
                    <section className="reference-assets" aria-label="图片资产与美术设定">
                      <h3>图片资产与美术设定</h3>
                      <div className="asset-upload-bar image-upload-bar">
                        <button className="asset-upload-button" type="button" disabled={uploading || promptStatus === "generating" || assets.length >= MAX_REFERENCE_ASSETS} onClick={() => imageInputRef.current?.click()} aria-describedby="image-upload-help">
                          {uploading ? <LoaderCircle className="upload-spinner" size={20} aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
                          <span>{uploading ? "正在读取…" : assets.length >= MAX_REFERENCE_ASSETS ? "图片已满" : assets.length ? "添加图片" : "上传参考图"}</span>
                        </button>
                        <div className="asset-upload-info"><strong>参考图片 {assets.length} / {MAX_REFERENCE_ASSETS}</strong><span id="image-upload-help">PNG / JPEG / WebP · 每张 3 MB</span></div>
                      </div>
                      <input ref={imageInputRef} hidden aria-label="选择参考图片" id="reference-upload" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading || promptStatus === "generating" || assets.length >= MAX_REFERENCE_ASSETS}
                        onChange={(event) => { void addAssets(event.target.files); event.target.value = ""; }} />
                      <p className="microcopy">可多选。图片分析需使用支持图片输入的文字模型；生成时会将所选图片发送至该接口。</p>
                      {uploading ? <p role="status">正在读取图片…</p> : null}
                      {assetError ? <p className="status-error" role="alert">{assetError}</p> : null}
                      {assets.map((asset, index) => (
                        <div className="reference-asset-row" key={asset.id}>
                          <img src={asset.dataUrl} alt={`参考图 ${index + 1}：${asset.name}`} />
                          <div className="reference-asset-fields">
                            <div className="reference-asset-heading"><strong title={asset.name}>参考图 {index + 1} · {asset.name}</strong>
                              <button type="button" className="inline-button" aria-label={`移除参考图 ${index + 1}`} title="移除图片" disabled={uploading || promptStatus === "generating"}
                                onClick={() => { setAssets(assets.filter((item) => item.id !== asset.id)); resetPromptOutput(); }}>×</button>
                            </div>
                            <select className="select-control" aria-label={`参考图 ${index + 1} 用途`} value={asset.kind} disabled={promptStatus === "generating"}
                              onChange={(event) => { setAssets(assets.map((item) => item.id === asset.id ? { ...item, kind: event.target.value } : item)); resetPromptOutput(); }}>
                              {["人物", "场景", "道具", "风格参考"].map((kind) => <option key={kind}>{kind}</option>)}
                            </select>
                            <textarea aria-label={`参考图 ${index + 1} 描述`} rows={3} maxLength={1000} value={asset.description} disabled={promptStatus === "generating"}
                              placeholder="例如：主角沿用图中发型和深色外套，服装不要变化。"
                              onChange={(event) => { setAssets(assets.map((item) => item.id === asset.id ? { ...item, description: event.target.value } : item)); resetPromptOutput(); }} />
                          </div>
                        </div>
                      ))}
                      <label className="control-label" htmlFor="style-brief">美术偏好（可选）</label>
                      <textarea id="style-brief" rows={3} maxLength={1600} value={styleBrief} disabled={promptStatus === "generating"} placeholder="例如：写实电影质感，冷色月光，保留人物参考图的造型。"
                        onChange={(event) => { setStyleBrief(event.target.value); resetPromptOutput(); }} />
                    </section>
                    <button className="primary-button" disabled={rewritingShotId !== null || !!documentValidationError || documentReading || uploading || promptStatus === "generating"} type="submit">
                      {promptStatus === "generating" ? "大模型生成中" : promptDocument ? "根据文档生成分镜" : textApiKey.trim() ? "用文字模型生成分镜" : "查看规则版文字分镜"}
                    </button>
                    {textApiKey.trim() ? (
                      <button className="inline-button" disabled={documentReading || !!promptDocument || uploading || promptStatus === "generating" || assets.length > 0} onClick={useRuleStoryboard} type="button">
                        不调用接口，查看规则版
                      </button>
                    ) : null}
                    <p className="microcopy">不填文字模型 Key 时使用规则版；填入 Key 后会调用大模型生成更细的导演分镜。图片 API 仍然只在生成线稿图时使用。</p>
                    {promptError ? <p className="status-error">{promptError}</p> : null}
                  </form>
                </aside>

                <section className="setup-controls" aria-label="分镜生成设定">
                  <div className="control-panel">
                    <div className="panel-heading">
                      <p>导演判断</p>
                      <strong>先定类型和氛围</strong>
                    </div>

                    <div className="control-group">
                      <p className="control-label">视频类型</p>
                      <div className="segmented vertical">
                        <button
                          className={manualType === "auto" ? "active" : ""}
                          onClick={() => {
                            setManualType("auto");
                            resetPromptOutput();
                          }}
                          type="button"
                        >
                          自动判断
                        </button>
                        {videoTypes.map((type) => (
                          <button
                            key={type.id}
                            className={manualType === type.id ? "active" : ""}
                            onClick={() => {
                              setManualType(type.id);
                              setSelectedShotId(1);
                              resetPromptOutput();
                            }}
                            type="button"
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="control-group">
                      <p className="control-label">场景氛围</p>
                      <div className="segmented vertical">
                        <button
                          className={manualTone === "auto" ? "active" : ""}
                          onClick={() => {
                            setManualTone("auto");
                            resetPromptOutput();
                          }}
                          type="button"
                        >
                          自动塑造
                        </button>
                        {(Object.keys(moodToneCopy) as MoodTone[]).map((tone) => (
                          <button
                            key={tone}
                            className={manualTone === tone ? "active" : ""}
                            onClick={() => {
                              setManualTone(tone);
                              resetPromptOutput();
                            }}
                            title={moodToneCopy[tone].performance}
                            type="button"
                          >
                            {moodToneCopy[tone].label}
                          </button>
                        ))}
                      </div>
                      <p className="microcopy">{moodToneCopy[selectedTone].light}</p>
                    </div>
                  </div>

                  <div className="control-panel">
                    <div className="panel-heading">
                      <p>输出设定</p>
                      <strong>控制镜头数量、成本和平台</strong>
                    </div>

                    <div className="control-group">
                      <label className="control-label" htmlFor="target-seconds">目标总时长（秒）</label>
                      <input id="target-seconds" className="select-control" type="number" min={shotCount} max={shotCount * 30} step={1}
                        value={targetSecondsInput} aria-invalid={!!targetError} aria-describedby="target-seconds-help"
                        onChange={(event) => { setTargetSecondsInput(event.target.value); resetPromptOutput(); }} />
                      <p id="target-seconds-help" className={targetError ? "status-error" : "microcopy"}>
                        {targetError || `共 ${shotCount} 个镜头，平均约 ${(targetSeconds / shotCount).toFixed(1)} 秒／镜头；实际按动作与叙事节奏分配。`}
                      </p>
                    </div>
                    <div className="control-group">
                      <p className="control-label">分镜数量</p>
                      <select
                        aria-label="分镜数量"
                        className="select-control"
                        onChange={(event) => handleShotCountChange(event.target.value)}
                        value={shotCount}
                      >
                        {shotCountOptions.map((count) => (
                          <option key={count} value={count}>
                            {count} 个镜头
                          </option>
                        ))}
                      </select>
                      <p className="microcopy">可自由调节 2 到 9 个镜头；短动作建议 3-5 个镜头，完整叙事再拉到 7-9 个。</p>
                    </div>

                    <div className="control-group">
                      <p className="control-label">预算倾向</p>
                      <div className="segmented">
                        {(Object.keys(budgetCopy) as BudgetMode[]).map((mode) => (
                          <button
                            key={mode}
                            className={budgetMode === mode ? "active" : ""}
                            onClick={() => {
                              setBudgetMode(mode);
                              resetPromptOutput();
                            }}
                            title={budgetCopy[mode].description}
                            type="button"
                          >
                            {budgetCopy[mode].label}
                          </button>
                        ))}
                      </div>
                      <p className="microcopy">{budgetCopy[budgetMode].savings}</p>
                    </div>

                    <div className="control-group">
                      <p className="control-label">提示词平台</p>
                      <div className="segmented">
                        {(Object.keys(platformCopy) as Platform[]).map((item) => (
                          <button
                            key={item}
                            className={platform === item ? "active" : ""}
                            onClick={() => {
                              setPlatform(item);
                              resetPromptOutput();
                            }}
                            title={platformCopy[item].hint}
                            type="button"
                          >
                            {platformCopy[item].label}
                          </button>
                        ))}
                      </div>
                      <p className="microcopy">{platformCopy[platform].hint}</p>
                    </div>
                  </div>

                  <div className="control-panel llm-panel">
                    <div className="panel-heading">
                      <p>文字模型接口中心</p>
                      <strong>让大模型负责拆文案和写分镜</strong>
                    </div>

                    <div className="control-group">
                      <p className="control-label">文字接口</p>
                      <div className="segmented text-provider-switch">
                        {(Object.keys(textProviderCopy) as TextProvider[]).map((provider) => (
                          <button
                            key={provider}
                            className={textProvider === provider ? "active" : ""}
                            disabled={promptStatus === "generating"}
                            onClick={() => {
                              if (provider !== textProvider) setTextApiKey("");
                              setTextProvider(provider);
                              setTextModel(textProviderCopy[provider].defaultModel);
                              setTextEndpoint("");
                              setPromptError("");
                              setPromptStatus("idle");
                            }}
                            title={textProviderCopy[provider].hint}
                            type="button"
                          >
                            {textProviderCopy[provider].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {activeTextProvider.freeNote ? <div className="free-provider-note">
                      <p>{activeTextProvider.freeNote}</p>
                      <div className="provider-links"><a href={activeTextProvider.keyUrl} target="_blank" rel="noopener noreferrer">获取 API Key</a><a href={activeTextProvider.docsUrl} target="_blank" rel="noopener noreferrer">官方额度说明</a></div>
                      <label className="control-label" htmlFor="free-model-preset">免费模型预设</label>
                      <select id="free-model-preset" className="select-control" value={activeTextPreset?.model || ""} disabled={promptStatus === "generating"}
                        onChange={(event) => { if (event.target.value) setTextModel(event.target.value); setPromptError(""); }}>
                        <option value="" disabled>手动填写的模型</option>
                        {activeTextProvider.presets?.map((preset) => <option key={preset.model} value={preset.model}>{preset.label}</option>)}
                      </select>
                      {assets.length && activeTextPreset?.vision === false ? <p className="status-error">已上传参考图片，当前预设不能看图，请切换看图模型。</p> : null}
                      {!activeTextPreset ? <p className="microcopy">当前为手填模型，价格和图片能力需以该模型官方说明为准。</p> : null}
                    </div> : null}
                    <div className="api-extra-fields">
                      <input
                        aria-label="文字模型 API Key"
                        className="api-key-input"
                        onChange={(event) => setTextApiKey(event.target.value)}
                        placeholder="填写文字模型 API Key，生成专业分镜提示词"
                        type="password"
                        value={textApiKey}
                      />
                      <input
                        aria-label="文字模型模型名"
                        className="api-key-input"
                        onChange={(event) => setTextModel(event.target.value)}
                        placeholder={activeTextProvider.defaultModel}
                        type="text"
                        value={textModel}
                      />
                      {textProvider === "custom" ? (
                        <input
                          aria-label="文字模型接口地址"
                          className="api-key-input"
                          onChange={(event) => setTextEndpoint(event.target.value)}
                          placeholder={activeTextProvider.endpointPlaceholder}
                          type="url"
                          value={textEndpoint}
                        />
                      ) : (
                        <p className="endpoint-chip">接口：{activeTextProvider.endpoint}</p>
                      )}
                    </div>
                    <p className="microcopy">文字模型生成的是分镜提示词；图片接口只在你点击生成分镜图时才会调用。{activeTextProvider.hint}</p>
                    <p className="microcopy">
                      当前状态：
                      {promptStatus === "ready"
                        ? "已使用大模型生成"
                        : promptStatus === "generating"
                          ? "正在请求文字模型"
                          : promptStatus === "error"
                            ? "接口需要检查"
                            : "规则版可直接预览"}
                    </p>
                  </div>
                </section>
              </div>

              {promptDocument && !generatedShotDrafts ? <section className="art-direction-output"><h3>{documentValidationError ? "文档待确认或补充" : "文档已就绪，等待生成分镜"}</h3><p>{documentInterpretation ? documentKindLabels[documentInterpretation.kind] : "文档"}：{promptDocument.name}</p></section> : <section className="bottom-lab">
                <div>
                  <p className="eyebrow">即时生成结果</p>
                  <h2>{shotCount} 个{storyboardSourceLabel}提示词已生成</h2>
                  <p>整片总时长 {totalSeconds} 秒</p>
                </div>
                <div className="setup-prompt-list" aria-label="即时文字分镜提示词">
                  {shots.map((shot) => (
                    <article key={shot.id}>
                      <span>镜头 {String(shot.id).padStart(2, "0")} · {durationSeconds(shot.duration)} 秒</span>
                      <strong>{shot.title}</strong>
                      <p>场景：{shot.sceneDetail}</p>
                      <p>动作：{shot.action}</p>
                    </article>
                  ))}
                </div>
              </section>}

              <section className="bottom-lab">
                <div>
                  <p className="eyebrow">备选类型</p>
                  <h2>类型先定，镜头才不会乱</h2>
                </div>
                <div className="alternative-list">
                  {alternatives.map((type) => (
                    <article key={type.id}>
                      <strong>{type.label}</strong>
                      <p>{type.short}</p>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          ) : null}

          {activeTab === "board" ? (
            <section className="workflow-page board-page">
              <section className="storyboard-panel">
                <div className="diagnosis-band">
                  <div>
                    <p className="eyebrow">推荐类型</p>
                    <h1>{selectedType.label}</h1>
                    <p>{selectedType.summary}</p>
                  </div>
                  <div className="runtime-card">
                    <span>{totalSeconds}s</span>
                    <small>{shotCount} 镜头预演</small>
                  </div>
                </div>

                <div className="type-logic">
                  {notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>

                {artDirection ? <section className="art-direction-output"><h3>美术设定</h3><p>{artDirection}</p></section> : <div className="character-board" aria-label="人物形象塑造">
                  <article>
                    <span>人物形象</span>
                    <strong>{characterProfile.identity}</strong>
                    <p>{characterProfile.appearance}</p>
                  </article>
                  <article>
                    <span>心理情况</span>
                    <strong>{moodToneCopy[selectedTone].label}</strong>
                    <p>{characterProfile.innerState}</p>
                  </article>
                  <article>
                    <span>连续性要求</span>
                    <strong>{moodToneCopy[selectedTone].palette}</strong>
                    <p>{characterProfile.continuity}</p>
                  </article>
                </div>}

                <div className="board-actions">
                  <div>
                    <p className="control-label">{shotCount} 镜头分镜提示词</p>
                    <strong>先审文字分镜，满意后再到提示词页生成分镜图</strong>
                  </div>
                  <button className="secondary-button" onClick={() => setActiveTab("prompt")} type="button">
                    查看当前镜头提示词
                  </button>
                </div>

                <div className={`storyboard-grid storyboard-grid-${shotCount}`} aria-label={`${shotCount} 镜头分镜提示词`}>
                  {shots.map((shot) => (
                    <button
                      key={shot.id}
                      className={selectedShot.id === shot.id ? "shot-card selected" : "shot-card"}
                      onClick={() => setSelectedShotId(shot.id)}
                      type="button"
                    >
                      {sketchImages[shot.id] ? (
                        <div className="shot-sketch">
                          <img alt={`镜头 ${shot.id} 分镜图`} src={sketchImages[shot.id]} />
                        </div>
                      ) : (
                        <div className="shot-prompt-preview">
                          <span>文字分镜提示词</span>
                          <strong>场景：{shot.sceneDetail}</strong>
                          <p>动作：{shot.action}</p>
                          <p>神态：{shot.expression}</p>
                          <p>镜头：{shot.scale}，{shot.camera}，{shot.motion}</p>
                        </div>
                      )}
                      <div className="shot-meta">
                        <span>镜头 {String(shot.id).padStart(2, "0")}</span>
                        <strong>{shot.title}</strong>
                        <small>
                          {shot.duration} | {shot.scale} | {shot.motion}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </section>
          ) : null}

          {activeTab === "board" ? <>{rewritePanel}{integratedPromptPanel}</> : null}

          {activeTab === "prompt" ? (
            <section className="workflow-page prompt-page">
              {rewritePanel}
              <section className="art-direction-output">
                <h2>美术设定与镜头时长</h2>
                <label className="control-label" htmlFor="art-direction">整片美术设定</label>
                <textarea id="art-direction" rows={5} value={artDirection || styleBrief} disabled={rewritingShotId !== null}
                  placeholder="生成分镜后显示美术设定，也可以在这里补充。"
                  onChange={(event) => { setArtDirection(event.target.value); setStyleBrief(event.target.value); setCopiedPrompt(null); resetSketchOutput(); }} />
                <label className="control-label" htmlFor="character-setting">人物设定</label>
                <textarea id="character-setting" rows={4} value={characterSetting} disabled={rewritingShotId !== null} placeholder="模型生成的人物设定，可在此调整。"
                  onChange={(event) => { setCharacterSetting(event.target.value); setCopiedPrompt(null); resetSketchOutput(); }} />
                {assets.length ? <p className="microcopy">复制提示词不会携带图片文件，请在视频工具中按相同编号上传参考图。</p> : null}
                <div className="duration-heading"><h3>分镜时长</h3><strong>总时长 {totalSeconds} 秒 · 目标 {targetSecondsInput || "未填写"} 秒</strong></div>
                {!targetError && totalSeconds !== targetSeconds ? <p className="status-error">手动调整后与目标相差 {Math.abs(totalSeconds - targetSeconds)} 秒；复制内容使用当前总时长 {totalSeconds} 秒。</p> : null}
                <div className="duration-list">
                  {shots.map((shot, index) => (
                    <div className="duration-row" key={shot.id}>
                      <button className={selectedShot.id === shot.id ? "inline-button active" : "inline-button"} type="button" onClick={() => setSelectedShotId(shot.id)}>
                        分镜 {shot.id} · {shot.title}
                      </button>
                      <span>{timeline[index].start}–{timeline[index].end} 秒</span>
                      <label>时长 <select aria-label={`分镜 ${shot.id} 时长（秒）`} disabled={rewritingShotId !== null} value={durationSeconds(shot.duration)} onChange={(event) => { setDurationOverrides((current) => ({ ...current, [shot.id]: Number(event.target.value) })); setCopiedPrompt(null); }}>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((seconds) => <option key={seconds} value={seconds}>{seconds} 秒</option>)}
                      </select></label>
                    </div>
                  ))}
                </div>
                <p className="microcopy">时长为成片目标秒数；若视频工具仅支持固定时长档位，可选不短于该镜头的档位并剪辑。</p>
              </section>
              {integratedPromptPanel}

              <div className="prompt-grid">
                <aside className="detail-panel">
                  <div className="panel-heading">
                    <p>当前镜头</p>
                    <strong>
                      {String(selectedShot.id).padStart(2, "0")} / {selectedShot.title}
                    </strong>
                  </div>

                  <div className="shot-specs">
                    <Spec label="时长" value={selectedShot.duration} />
                    <Spec label="景别" value={selectedShot.scale} />
                    <Spec label="机位" value={selectedShot.camera} />
                    <Spec label="运动" value={selectedShot.motion} />
                    <Spec label="成本" value={selectedShot.cost} tone={selectedShot.cost === "高" ? "warn" : "ok"} />
                    <Spec label="风险" value={selectedShot.risk} tone={selectedShot.risk === "高" ? "warn" : "ok"} />
                  </div>

                  <section className="detail-section">
                    <p className="control-label">镜头作用</p>
                    <p>{selectedShot.purpose}</p>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">具体场景</p>
                    <p>{selectedShot.sceneDetail}</p>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">人物动作</p>
                    <p>{selectedShot.action}</p>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">神态描写</p>
                    <p>{selectedShot.expression}</p>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">导演备注</p>
                    <p>{selectedShot.directorNote}</p>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">线稿提示词</p>
                    <PromptBox text={selectedShot.sketchPrompt} />
                    <button className="inline-button" disabled={rewritingShotId !== null || sketchStatus === "generating"} onClick={() => regenerateShot(selectedShot.id)} type="button">
                      {sketchImages[selectedShot.id] ? "重新生成当前分镜图" : "生成当前分镜图"}
                    </button>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">{platformCopy[platform].label} 视频提示词</p>
                    <PromptBox text={selectedVideoPrompt} />
                    <button className="inline-button" onClick={() => copyPrompt(selectedVideoPrompt, "shot")} type="button">
                      {copiedPrompt === "shot" ? "已复制" : "复制当前镜头提示词"}
                    </button>
                  </section>

                  <section className="detail-section">
                    <p className="control-label">不建议做</p>
                    <ul className="avoid-list">
                      {selectedType.avoid.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                </aside>

                <aside className="control-panel prompt-side-panel">
                  <div className="panel-heading">
                    <p>镜头选择</p>
                    <strong>快速切换 {shotCount} 个分镜</strong>
                  </div>
                  <div className="shot-picker" aria-label="选择镜头">
                    {shots.map((shot) => (
                      <button
                        key={shot.id}
                        className={selectedShot.id === shot.id ? "active" : ""}
                        onClick={() => setSelectedShotId(shot.id)}
                        type="button"
                      >
                        {String(shot.id).padStart(2, "0")}
                        <span>{shot.title}</span>
                      </button>
                    ))}
                  </div>

                  <div className="selected-preview">
                    {sketchImages[selectedShot.id] ? (
                      <img alt={`镜头 ${selectedShot.id} 分镜图`} src={sketchImages[selectedShot.id]} />
                    ) : (
                      <div className="sketch-empty-state">
                        <span>尚未生成分镜图</span>
                        <small>当前只生成文字提示词；点击生成后才会调用图片接口。</small>
                      </div>
                    )}
                      </div>

                  <div className="control-group api-control">
                    <p className="control-label">图片接口中心</p>
                    <div className="segmented api-provider-switch">
                      {(Object.keys(imageProviderCopy) as ImageProvider[]).map((provider) => (
                        <button
                          key={provider}
                          className={imageProvider === provider ? "active" : ""}
                          onClick={() => {
                            setImageProvider(provider);
                            resetSketchOutput();
                          }}
                          title={imageProviderCopy[provider].hint}
                          type="button"
                        >
                          {imageProviderCopy[provider].label}
                        </button>
                      ))}
                    </div>
                    <input
                      aria-label="图片接口 API Key"
                      className="api-key-input"
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="填写当前接口 API Key，生成真正线稿"
                      type="password"
                      value={apiKey}
                    />
                    {imageProvider === "openai" ? (
                      <div className="segmented image-model-switch">
                        {(Object.keys(imageModelCopy) as ImageModel[]).map((model) => (
                          <button
                            key={model}
                            className={imageModel === model ? "active" : ""}
                            onClick={() => {
                              setImageModel(model);
                              resetSketchOutput();
                            }}
                            title={imageModelCopy[model].hint}
                            type="button"
                          >
                            {imageModelCopy[model].label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="api-extra-fields">
                        <input
                          aria-label="图片接口地址"
                          className="api-key-input"
                          onChange={(event) => setCustomEndpoint(event.target.value)}
                          placeholder={activeProvider.endpointPlaceholder}
                          type="url"
                          value={customEndpoint}
                        />
                        <input
                          aria-label="图片接口模型名"
                          className="api-key-input"
                          onChange={(event) => setCustomModel(event.target.value)}
                          placeholder={activeProvider.modelPlaceholder}
                          type="text"
                          value={customModel}
                        />
                      </div>
                    )}
                    <p className="microcopy">API Key 只用于本次浏览器请求，不会写入项目文件。{activeProvider.hint}</p>
                  </div>

                  <div className="sketch-toolbar">
                    <div>
                      <p className="control-label">分镜图状态</p>
                      <strong>
                        {sketchStatus === "ready"
                          ? `已生成 ${activeProvider.label} ${shotCount} 张分镜图`
                          : sketchStatus === "generating"
                            ? `正在生成第 ${activeGeneratingShotId || 1} 张分镜图...`
                            : sketchStatus === "error"
                              ? "图片生成需要处理"
                              : "尚未调用图片接口"}
                      </strong>
                      {sketchError ? <small className="status-error">{sketchError}</small> : null}
                    </div>
                    <button className="secondary-button" disabled={rewritingShotId !== null || sketchStatus === "generating"} onClick={generateSketches} type="button">
                      {sketchStatus === "ready" ? "重新生成分镜图" : sketchStatus === "generating" ? "生成中" : "一键生成分镜图"}
                    </button>
                  </div>
                </aside>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Spec({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={tone ? `spec spec-${tone}` : "spec"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PromptBox({ text }: { text: string }) {
  return (
    <div className="prompt-box">
      <p>{text}</p>
    </div>
  );
}

function LineSketch({ role, shotNumber }: { role: ShotRole; shotNumber: number }) {
  const horizon = role === "establish" || role === "ending" ? 74 : 62;
  const subjectX = role === "character" || role === "approach" ? 82 : role === "reaction" ? 136 : 160;
  const subjectY = role === "establish" || role === "ending" ? 86 : 94;

  return (
    <svg viewBox="0 0 320 180" role="img" aria-label={`镜头 ${shotNumber} 线稿`}>
      <rect x="1" y="1" width="318" height="178" rx="3" fill="#fbfaf7" stroke="#1f2926" strokeWidth="2" />
      <path d={`M18 ${horizon} C 72 ${horizon - 16}, 118 ${horizon + 8}, 302 ${horizon - 10}`} fill="none" stroke="#7b827c" strokeWidth="2" />
      <path d="M30 154 C 92 132, 170 136, 292 156" fill="none" stroke="#b6b0a5" strokeWidth="2" />
      <SketchSet role={role} subjectX={subjectX} subjectY={subjectY} />
      <path d="M24 22 L92 22" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 34 L64 34" stroke="#8d8a83" strokeWidth="2" strokeLinecap="round" />
      <circle cx="286" cy="28" r="12" fill="none" stroke="#1f2926" strokeWidth="2" />
      <text x="282" y="32" fill="#1f2926" fontSize="12" fontFamily="Arial" fontWeight="700">
        {shotNumber}
      </text>
    </svg>
  );
}

function SketchSet({ role, subjectX, subjectY }: { role: ShotRole; subjectX: number; subjectY: number }) {
  if (role === "detail") {
    return (
      <g>
        <rect x="106" y="66" width="108" height="62" rx="4" fill="none" stroke="#1f2926" strokeWidth="3" />
        <path d="M124 94 L154 80 L194 112" fill="none" stroke="#1f2926" strokeWidth="2" />
        <path d="M112 142 C 148 132, 190 132, 228 144" fill="none" stroke="#8d8a83" strokeWidth="2" />
        <circle cx="204" cy="76" r="10" fill="none" stroke="#8d8a83" strokeWidth="2" />
      </g>
    );
  }

  if (role === "conflict") {
    return (
      <g>
        <Person x={104} y={96} scale={1.05} />
        <Person x={206} y={96} scale={1.05} flip />
        <path d="M136 70 C 158 58, 184 58, 204 70" fill="none" stroke="#1f2926" strokeWidth="2" />
        <path d="M154 90 L184 90" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }

  if (role === "reaction") {
    return (
      <g>
        <circle cx="158" cy="82" r="34" fill="none" stroke="#1f2926" strokeWidth="3" />
        <path d="M146 76 L147 76" stroke="#1f2926" strokeWidth="5" strokeLinecap="round" />
        <path d="M170 76 L171 76" stroke="#1f2926" strokeWidth="5" strokeLinecap="round" />
        <path d="M148 98 C 158 105, 172 102, 178 94" fill="none" stroke="#1f2926" strokeWidth="2" />
        <path d="M112 158 C 126 128, 196 128, 210 158" fill="none" stroke="#1f2926" strokeWidth="3" />
      </g>
    );
  }

  if (role === "reveal") {
    return (
      <g>
        <path d="M42 158 L138 62 L194 62 L288 158" fill="none" stroke="#1f2926" strokeWidth="3" />
        <path d="M134 64 L134 158" stroke="#8d8a83" strokeWidth="2" />
        <path d="M196 64 L196 158" stroke="#8d8a83" strokeWidth="2" />
        <rect x="146" y="86" width="40" height="54" fill="none" stroke="#1f2926" strokeWidth="2" />
        <Person x={88} y={116} scale={0.65} />
      </g>
    );
  }

  if (role === "escalate") {
    return (
      <g transform="rotate(-5 160 90)">
        <rect x="58" y="54" width="204" height="88" fill="none" stroke="#1f2926" strokeWidth="3" />
        <path d="M72 130 L244 58" stroke="#8d8a83" strokeWidth="2" />
        <Person x={150} y={102} scale={1.08} />
        <path d="M92 42 L112 58 M226 40 L208 58" stroke="#1f2926" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  if (role === "ending") {
    return (
      <g>
        <rect x="118" y="54" width="84" height="92" fill="none" stroke="#1f2926" strokeWidth="3" />
        <path d="M134 64 L186 64 L186 136 L134 136 Z" fill="none" stroke="#8d8a83" strokeWidth="2" />
        <Person x={160} y={118} scale={0.56} />
        <path d="M40 150 C 86 138, 232 138, 284 150" fill="none" stroke="#1f2926" strokeWidth="2" />
      </g>
    );
  }

  return (
    <g>
      <path d="M36 152 L94 80 L132 152" fill="none" stroke="#8d8a83" strokeWidth="2" />
      <path d="M190 152 L236 66 L294 152" fill="none" stroke="#8d8a83" strokeWidth="2" />
      <Person x={subjectX} y={subjectY} scale={role === "establish" ? 0.58 : 0.86} />
      {role === "approach" ? <path d="M80 118 C 116 104, 158 96, 224 94" fill="none" stroke="#1f2926" strokeWidth="2" strokeDasharray="6 6" /> : null}
    </g>
  );
}

function Person({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  const direction = flip ? -1 : 1;

  return (
    <g transform={`translate(${x} ${y}) scale(${direction * scale} ${scale})`}>
      <circle cx="0" cy="-28" r="12" fill="none" stroke="#1f2926" strokeWidth="3" />
      <path d="M0 -16 L0 22" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 -4 L-20 12" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 -4 L20 10" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 22 L-16 48" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 22 L18 48" stroke="#1f2926" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
