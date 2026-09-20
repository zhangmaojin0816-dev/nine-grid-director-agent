export const MAX_DOCUMENT_CHARS = 20000;
export const MAX_IMPORTED_DOCUMENT_CHARS = 200000;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type DocumentKind = "story" | "rules" | "mixed";
export type DocumentMode = "auto" | DocumentKind;
export const documentKindLabels: Record<DocumentKind, string> = { story: "故事／剧本", rules: "提示词规范／模板", mixed: "混合文档" };
export type DocumentInterpretation = {
  mode: DocumentMode;
  kind: DocumentKind;
  storyText: string;
  rulesText: string;
  needsConfirmation: boolean;
  confirmed: boolean;
  reason: string;
};
export type PromptDocument = { name: string; text: string; interpretation?: DocumentInterpretation };

export function interpretPromptDocument(text: string, mode: DocumentMode = "auto"): DocumentInterpretation {
  const storyLines: string[] = [];
  const ruleLines: string[] = [];
  const openingLines: string[] = [];
  const narrativePattern = /走|骑|跑|站在|坐在|看见|听见|转身|回头|说[：:“"]|来到|离开|等待|发现|散步|等车|[内外]景|第[一二三四五六七八九十\d]+场/;
  let section: "story" | "rules" | null = null;
  let hasStoryHeading = false;
  let hasRulesHeading = false;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim().replace(/^#{1,6}\s*|^[一二三四五六七八九十\d]+[、.．)）]\s*/g, "").replace(/\*\*/g, "").replace(/^【([^】]+)】/, "$1：");
    if (/^(?:故事|剧情|分镜|提示词)?(?:示例|范例|例子|样例)|^例如[：:]/.test(heading)) {
      section = "rules";
      hasRulesHeading = true;
    } else if (/^(?:故事(?:素材|内容|正文|梗概)?|剧本(?:正文|内容)?|剧情(?:内容|正文|大纲)?|正式文案|创意文案|实际故事)(?:\s*[：:]|\s*$)/.test(heading)) {
      section = "story";
      hasStoryHeading = true;
    } else if (/^(?:创作规范|写作规范|提示词(?:规范|模板|规则|要求)?|输出(?:格式|要求)|分镜(?:规则|规范)|格式要求|规则|规范|模板)(?:\s*[：:]|\s*$)/.test(heading)) {
      section = "rules";
      hasRulesHeading = true;
    }
    (section === "story" ? storyLines : section === "rules" ? ruleLines : openingLines).push(line);
  }
  const openingStory = !hasStoryHeading && hasRulesHeading && narrativePattern.test(openingLines.join("\n")) && !/提示词|模板|示例|规范/.test(openingLines.join("\n"));
  if (openingStory) { storyLines.unshift(...openingLines); hasStoryHeading = true; }
  else ruleLines.unshift(...openingLines);
  const ruleSignals = text.match(/提示词|输出格式|输出要求|创作规范|写作规范|格式要求|每个镜头(?:必须|应|要)|请(?:按|使用).{0,8}(?:格式|模板)|模板|示例/g) || [];
  const narrative = narrativePattern.test(text);
  let kind: DocumentKind = hasStoryHeading && hasRulesHeading ? "mixed" : hasRulesHeading || ruleSignals.length >= 2 ? "rules" : "story";
  let needsConfirmation = kind === "mixed" || (!hasStoryHeading && !hasRulesHeading && (kind === "story" ? !narrative : narrative));
  if (mode !== "auto") { kind = mode; needsConfirmation = mode === "mixed"; }
  return {
    mode, kind,
    storyText: kind === "story" ? text.trim() : kind === "mixed" ? storyLines.join("\n").trim() : "",
    rulesText: kind === "rules" ? text.trim() : kind === "mixed" ? ruleLines.join("\n").trim() : "",
    needsConfirmation, confirmed: !needsConfirmation,
    reason: mode !== "auto" ? "已按你选择的文档用途处理。" : kind === "mixed" ? "发现故事和规范分区，已初步拆分，请确认。" : needsConfirmation ? "文档用途不够明确，请确认类型与内容。" : kind === "rules" ? "识别到规范、模板或示例内容，仅用于约束写法。" : "识别到故事或剧本内容，将作为剧情依据。",
  };
}

export function resolveDocumentInput(document: PromptDocument | null, creative: string) {
  if (!document) return { story: creative.trim(), rules: "", supplement: "", kind: null };
  const interpretation = document.interpretation || interpretPromptDocument(document.text);
  if (interpretation.needsConfirmation && !interpretation.confirmed) throw new Error("请先确认文档识别结果和故事／规范拆分。");
  if (interpretation.kind === "mixed" && (!interpretation.storyText.trim() || !interpretation.rulesText.trim())) throw new Error("混合文档需要分别填写故事素材和创作规范，或改选单一文档类型。");
  const story = interpretation.kind === "rules" ? creative.trim() : interpretation.storyText.trim();
  if (!story) throw new Error(interpretation.kind === "rules" ? "这份文档是创作规范，请在创意输入中填写本次要拍的故事。" : "请填写文档中的故事素材。");
  return { story, rules: interpretation.rulesText.trim(), supplement: interpretation.kind === "rules" ? "" : creative.trim(), kind: interpretation.kind };
}

export function validatePromptDocument(value: unknown, importing = false): PromptDocument | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || !("text" in value) || typeof value.text !== "string") throw new Error("文档内容格式不正确，请重新上传。");
  const text = value.text.trim();
  if (!text) throw new Error("文档没有可读取的正文，请填写正文或移除文档。");
  if (text.length > MAX_IMPORTED_DOCUMENT_CHARS) throw new Error("文档超过导入上限 200,000 字符，请拆分后导入；内容未被截断。");
  const name = "name" in value && typeof value.name === "string" ? value.name.slice(0, 160) : "提示词文档";
  let interpretation = interpretPromptDocument(text);
  if ("interpretation" in value && value.interpretation !== undefined) {
    const item = value.interpretation as DocumentInterpretation;
    if (!item || !["auto", "story", "rules", "mixed"].includes(item.mode) || !["story", "rules", "mixed"].includes(item.kind) ||
        typeof item.storyText !== "string" || typeof item.rulesText !== "string" || typeof item.needsConfirmation !== "boolean" || typeof item.confirmed !== "boolean") {
      throw new Error("文档识别结果格式不正确，请重新识别。");
    }
    interpretation = { ...item, reason: typeof item.reason === "string" ? item.reason.slice(0, 200) : "", needsConfirmation: item.kind === "mixed" || item.needsConfirmation };
    if (item.kind === "rules") interpretation.storyText = "";
    if (item.kind === "story") interpretation.rulesText = "";
  }
  const usedCharacters = interpretation.storyText.length + interpretation.rulesText.length;
  if (!importing && usedCharacters > MAX_DOCUMENT_CHARS) throw new Error(`文档已导入，本次故事与规范共 ${usedCharacters.toLocaleString("zh-CN")} 字符，超过单次生成上限 20,000 字符。请在下方故事／规范框中精简本次内容；原文保留，无需重新上传。`);
  return { name, text, interpretation };
}

export async function withDocumentTimeout<T>(task: Promise<T>, timeoutMs = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("文档读取超过 20 秒，请重新选择文件；若仍失败，请另存为 DOCX 或 TXT 后重试。")), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

export function readPromptDocument(file: File): Promise<PromptDocument> {
  return withDocumentTimeout(parsePromptDocument(file));
}

async function parsePromptDocument(file: File): Promise<PromptDocument> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("文档最多 5 MB，请压缩或拆分后重试。");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["txt", "md", "docx"].includes(extension || "")) throw new Error(`当前不支持 ${extension ? `.${extension}` : "无后缀"} 文件。支持 DOCX、TXT 和 Markdown；${extension === "doc" ? "旧版 Word 请先另存为 .docx。" : "PDF 或扫描件请先提取文字，另存为 DOCX 或 TXT。"}`);
  const buffer = await file.arrayBuffer();
  let text: string;
  if (extension === "docx") {
    const mammoth = await import("mammoth").catch(() => { throw new Error("Word 解析组件加载失败，可能是页面版本已更新。请刷新页面后重新上传，或改用 TXT。"); });
    try { text = (await mammoth.extractRawText({ arrayBuffer: buffer })).value; }
    catch { throw new Error("无法读取 Word 正文，请检查文件是否损坏或加密。仅包含图片的文档需先转为文字。"); }
  } else {
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
    catch { text = new TextDecoder("gb18030").decode(buffer); }
  }
  return validatePromptDocument({ name: file.name, text }, true)!;
}
