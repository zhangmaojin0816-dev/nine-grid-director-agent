import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const compile = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString("base64")}`;
const settingsUrl = compile(await readFile(new URL("../lib/storyboard-settings.ts", import.meta.url), "utf8"));
const { durationSeconds, shotTimeline, validateAssets, fitShotDurations, validateTargetSeconds, replaceSingleShot } = await import(settingsUrl);
const requireMammoth = createRequire(import.meta.resolve("mammoth"));
const documentSource = (await readFile(new URL("../lib/prompt-document.ts", import.meta.url), "utf8"))
  .replace('import("mammoth")', `import(${JSON.stringify(pathToFileURL(requireMammoth.resolve("mammoth/mammoth.browser.js")).href)})`);
const documentUrl = compile(documentSource);
const { readPromptDocument, validatePromptDocument, interpretPromptDocument, resolveDocumentInput, withDocumentTimeout } = await import(documentUrl);
const routeSource = (await readFile(new URL("../app/api/generate-storyboard/route.ts", import.meta.url), "utf8"))
  .replace('"../../../lib/prompt-document"', JSON.stringify(documentUrl))
  .replace('"../../../lib/storyboard-settings"', JSON.stringify(settingsUrl));
const { POST } = await import(compile(routeSource));
const asset = { name: "actor.png", kind: "人物", description: "保留蓝色外套", dataUrl: "data:image/png;base64,aGVsbG8=" };

test("integrated prompt has three sections and preserves character, shots and current timing", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const builder = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "buildFullVideoPrompt");
  assert.ok(builder);
  const { buildFullVideoPrompt } = await import(compile(`import { shotTimeline } from ${JSON.stringify(settingsUrl)};\nexport ${builder.getText(ast)}`));
  const shots = [1, 2].map((id) => ({ id, duration: id === 1 ? "4s" : "7s", title: `镜头${id}`, sceneDetail: "车站", subject: "小红", action: "抬头看时钟", expression: "眉头微皱", scale: "近景", camera: "平视", motion: "缓慢推近", directorNote: "突出等待" }));
  const text = buildFullVideoPrompt({ label: "剧情" }, shots, "seedance", "warm", {}, "大模型分镜", "自然光，低饱和", [asset], "小红，短发，蓝色外套");
  assert.deepEqual(text.match(/^[一二三]、.+$/gm), ["一、美术风格", "二、人物设定", "三、分镜"]);
  assert.match(text, /小红，短发，蓝色外套/);
  assert.match(text, /整片总时长：11 秒/);
  assert.match(text, /4–11 秒｜时长 7 秒/);
  assert.match(text, /抬头看时钟/);
  assert.match(text, /参考图 1/);
  assert.doesNotMatch(text, /原始文案：|分镜来源：/);
});

test("duration normalization and cumulative timeline survive a manual duration change", () => {
  assert.equal(durationSeconds("6 秒"), 6);
  for (const value of [0, -2, 100, "4–8秒", "oops", Infinity]) assert.equal(durationSeconds(value), 4);
  assert.deepEqual(shotTimeline([{ duration: "3s" }, { duration: "7s" }, { duration: "5s" }]), [
    { start: 0, end: 3, seconds: 3 }, { start: 3, end: 10, seconds: 7 }, { start: 10, end: 15, seconds: 5 },
  ]);
});

test("asset validation rejects unsupported, oversized and excessive images", () => {
  assert.equal(validateAssets([asset])[0].description, asset.description);
  assert.deepEqual(validateAssets(undefined), []);
  assert.equal(validateAssets(Array(15).fill(asset)).length, 15);
  assert.throws(() => validateAssets(Array(16).fill(asset)), /最多上传 15/);
  assert.throws(() => validateAssets([{ ...asset, dataUrl: "data:image/svg+xml;base64,abcd" }]));
  assert.throws(() => validateAssets([{ ...asset, dataUrl: `data:image/png;base64,${"a".repeat(4 * 1024 * 1024 + 100)}` }]));
});

const request = (extras = {}) => new Request("http://localhost/api/generate-storyboard", {
  method: "POST", body: JSON.stringify({ apiKey: "test-key", provider: "custom", endpoint: "https://example.com/chat/completions", story: "小明骑单车", shotCount: 2, ...extras }),
});
const modelReply = (content) => Response.json({ choices: [{ message: { content } }] });
const shot = { title: "脚踏细节", action: "脚踩踏板", durationSeconds: 6, scale: "特写", camera: "侧面", motion: "跟拍" };

test("single-shot replacement preserves every other shot and locks identity and timing", () => {
  const original = [1, 2, 3].map((id) => ({ id, duration: `${id + 2}s`, action: `动作${id}`, videoPrompt: `提示词${id}` }));
  const before = structuredClone(original);
  const updated = replaceSingleShot(original, 2, { id: 99, duration: "30s", action: "握紧车把", videoPrompt: "固定近景" });
  assert.deepEqual(original, before);
  assert.strictEqual(updated[0], original[0]);
  assert.strictEqual(updated[2], original[2]);
  assert.equal(updated[1].id, 2);
  assert.equal(updated[1].duration, "4s");
  assert.equal(updated[1].action, "握紧车把");
});

const rewriteShot = { ...shot, duration: "4s", subject: "小红", sceneDetail: "海边车道", expression: "目光警惕", sketchPrompt: "pencil sketch", videoPrompt: "固定近景，手握车把" };

test("rewrite sends neighbor context and instructions, returns only requested shot with fixed duration", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const content = JSON.parse(init.body).messages[1].content;
    assert.match(content, /只重写原始分镜 2/);
    assert.match(content, /前镜到达海边/);
    assert.match(content, /后镜继续骑行/);
    assert.match(content, /不要回头/);
    assert.match(content, /固定美术设定：写实蓝灰/);
    return modelReply(JSON.stringify({ artDirection: "不应覆盖的风格", shots: [{ ...rewriteShot, durationSeconds: 20 }] }));
  });
  const response = await POST(request({ artDirection: "写实蓝灰", characterSetting: "小红蓝色外套", rewrite: {
    shotId: 2, instruction: "不要回头，目光看向前方", shots: [{ ...rewriteShot, action: "前镜到达海边" }, rewriteShot, { ...rewriteShot, action: "后镜继续骑行" }],
  } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.shotId, 2);
  assert.equal(body.shot.duration, "4s");
  assert.equal(body.artDirection, undefined);
  assert.equal(body.shots, undefined);
});

test("invalid, incomplete, or multi-shot rewrite responses cannot replace existing shots", async (t) => {
  let reply = { shots: [rewriteShot, rewriteShot] };
  t.mock.method(globalThis, "fetch", async () => modelReply(JSON.stringify(reply)));
  const rewrite = { shotId: 2, instruction: "修改眼神", shots: [rewriteShot, rewriteShot] };
  assert.equal((await POST(request({ rewrite: { ...rewrite, shotId: 3 } }))).status, 400);
  assert.equal((await POST(request({ rewrite: { ...rewrite, instruction: "" } }))).status, 400);
  assert.equal((await POST(request({ rewrite }))).status, 502);
  reply = { shots: [{}] };
  assert.equal((await POST(request({ rewrite }))).status, 502);
});

test("free provider presets route text and image requests to the correct services", async (t) => {
  const cases = [
    { provider: "zhipu", model: "glm-4.7-flash", endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions", assets: [] },
    { provider: "zhipu", model: "glm-4.6v-flash", endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions", assets: [asset] },
    { provider: "openrouter", model: "openrouter/free", endpoint: "https://openrouter.ai/api/v1/chat/completions", assets: [asset] },
    { provider: "groq", model: "openai/gpt-oss-120b", endpoint: "https://api.groq.com/openai/v1/chat/completions", assets: [] },
  ];
  let current;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(url, current.endpoint);
    assert.equal(body.model, current.model);
    assert.equal(init.headers.Authorization, "Bearer test-key");
    assert.equal(Array.isArray(body.messages[1].content), current.assets.length > 0);
    return modelReply(JSON.stringify({ artDirection: "写实", characterSetting: "小明", shots: [shot, shot] }));
  });
  for (current of cases) assert.equal((await POST(request(current))).status, 200);
});

test("free entry rejects paid models and incompatible images without an upstream call", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("must not call"); });
  assert.equal((await POST(request({ provider: "openrouter", model: "paid/model" }))).status, 400);
  for (const [provider, model] of [["zhipu", "glm-4.7-flash"], ["groq", "openai/gpt-oss-120b"]]) {
    const response = await POST(request({ provider, model, assets: [asset] }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /不支持参考图片/);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("quota errors remain explicit and never trigger a paid fallback", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "Rate limit exceeded" } }, { status: 429 }));
  const response = await POST(request({ provider: "openrouter", model: "openrouter/free" }));
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /限额/);
  assert.equal(mock.mock.callCount(), 1);
});

test("prompt documents preserve text, reject empty/oversized/unsupported input", async () => {
  const doc = await readPromptDocument(new File(["# 故事\n女孩在车站等车。"], "story.md"));
  assert.match(doc.text, /女孩在车站/);
  assert.throws(() => validatePromptDocument({ text: "  " }));
  assert.throws(() => validatePromptDocument({ text: "文".repeat(20001) }));
  await assert.rejects(readPromptDocument(new File(["hello"], "story.pdf")), /支持 DOCX/);
  await assert.rejects(readPromptDocument(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "story.txt")), /5 MB/);
});

test("document parser settles with a readable timeout and detailed length errors", async () => {
  await assert.rejects(withDocumentTimeout(new Promise(() => {}), 5), /读取超过/);
  assert.equal(await withDocumentTimeout(Promise.resolve("parsed"), 5), "parsed");
  assert.throws(() => validatePromptDocument({ text: "文".repeat(21000) }), /21,000.*20,000/);
  await assert.rejects(readPromptDocument(new File(["old word"], "old.doc")), /旧版 Word/);
});

test("104KB Markdown imports intact and can use a shorter excerpt without reuploading", async () => {
  const text = '# 故事\n' + '小红在海边骑车。'.repeat(4500);
  const file = new File([text], 'story.md');
  assert.ok(file.size > 104 * 1024);
  const doc = await readPromptDocument(file);
  assert.equal(doc.text, text);
  assert.throws(() => validatePromptDocument(doc), /文档已导入.*20,000/);
  const edited = { ...doc, interpretation: interpretPromptDocument('小红在海边骑车。', 'story') };
  assert.equal(validatePromptDocument(edited).text, text);
  assert.equal(resolveDocumentInput(validatePromptDocument(edited), '').story, '小红在海边骑车。');
});

test("DOCX reader extracts paragraphs with the browser parser", async () => {
  const JSZip = requireMammoth("jszip");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>小红在海边散步。</w:t></w:r></w:p></w:body></w:document>');
  const doc = await readPromptDocument(new File([await zip.generateAsync({ type: "uint8array" })], "story.docx"));
  assert.match(doc.text, /小红在海边散步/);
});

test("document-only generation sends complete document as primary source", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const content = JSON.parse(init.body).messages[1].content;
    assert.match(content, /主要依据：用户上传文档/);
    assert.match(content, /最后场景：海边/);
    assert.match(content, /不能覆盖文档/);
    return modelReply(JSON.stringify({ artDirection: "写实", shots: [shot, shot] }));
  });
  const response = await POST(request({ story: "", document: { name: "故事.txt", text: "故事：\n" + "正文".repeat(2000) + "最后场景：海边" } }));
  assert.equal(response.status, 200);
  assert.equal((await POST(request({ document: { text: "" } }))).status, 400);
});

test("document interpretation separates stories, rules, examples and ambiguous material", () => {
  const story = interpretPromptDocument("小明必须离开车站，他转身跑向街口。");
  assert.equal(story.kind, "story");
  assert.equal(story.needsConfirmation, false);
  const rules = interpretPromptDocument("# 提示词规范\n每个镜头必须描述动作。\n## 故事示例\n小明在夜路行走。");
  assert.equal(rules.kind, "rules");
  assert.equal(rules.storyText, "");
  assert.equal(rules.needsConfirmation, false);
  const input = resolveDocumentInput({ name: "模板", text: rules.rulesText, interpretation: rules }, "小红在海边骑车");
  assert.equal(input.story, "小红在海边骑车");
  assert.match(input.rules, /小明/);
  assert.throws(() => resolveDocumentInput({ name: "模板", text: rules.rulesText, interpretation: rules }, ""), /填写本次/);
  assert.equal(interpretPromptDocument("蓝色的回忆").needsConfirmation, true);
  assert.equal(interpretPromptDocument("蓝色的回忆", "story").confirmed, true);
});

test("mixed sections require confirmation and examples stay outside the formal story", () => {
  const text = "【故事素材】\n小红在海边骑车。\n【创作规范】\n每个镜头写清景别。\n示例：小明走夜路。";
  const interpretation = interpretPromptDocument(text);
  const doc = { name: "混合", text, interpretation };
  assert.equal(interpretation.kind, "mixed");
  assert.doesNotMatch(interpretation.storyText, /小明/);
  assert.match(interpretation.rulesText, /示例/);
  assert.throws(() => resolveDocumentInput(doc, ""), /确认/);
  doc.interpretation = { ...interpretation, confirmed: true };
  assert.match(resolveDocumentInput(validatePromptDocument(doc), "" ).story, /小红/);
  assert.equal(interpretPromptDocument("小红在海边骑车。\n创作规范：每个镜头写清景别。").kind, "mixed");
});

test("rules mode sends only creative input as formal story and blocks unconfirmed mixed requests", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls++;
    const prompt = JSON.parse(init.body).messages[1].content;
    const formal = prompt.split("本次正式故事：\n")[1].split("\n\n创作规范")[0];
    assert.equal(formal, "小红在海边骑车");
    assert.match(prompt, /严禁代入成正式角色/);
    return modelReply(JSON.stringify({ artDirection: "写实", shots: [shot, shot] }));
  });
  const rules = { name: "规范", text: "提示词规范：\n每个镜头必须具体。\n示例：小明走夜路。" };
  assert.equal((await POST(request({ story: "", document: rules }))).status, 400);
  assert.equal((await POST(request({ story: "小红在海边骑车", document: rules }))).status, 200);
  assert.equal((await POST(request({ document: { name: "混合", text: "故事：小红骑车。\n创作规范：近景为主。" } }))).status, 400);
  assert.equal(calls, 1);
});

test("target duration allocation preserves pacing and bounds for every supported total", () => {
  for (let count = 2; count <= 9; count++) {
    const shots = Array.from({ length: count }, (_, i) => ({ duration: `${i + 2}s` }));
    for (let target = count; target <= count * 30; target++) {
      const allocated = fitShotDurations(shots, target).map((s) => durationSeconds(s.duration));
      assert.equal(allocated.reduce((a, b) => a + b, 0), target);
      assert.ok(allocated.every((seconds) => seconds >= 1 && seconds <= 30));
    }
  }
  assert.deepEqual(fitShotDurations([{ duration: "6s" }, { duration: "3s" }], 18), [{ duration: "12s" }, { duration: "6s" }]);
  for (const value of ["", null, 3, 121, 20.5]) assert.throws(() => validateTargetSeconds(value, 4));
});

test("target seconds guide the model and returned durations match the requested total", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.match(JSON.parse(init.body).messages[1].content, /目标总时长：20 秒/);
    return modelReply(JSON.stringify({ artDirection: "写实", shots: [shot, { ...shot, durationSeconds: 3 }] }));
  });
  const response = await POST(request({ targetSeconds: 20 }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.shots.reduce((sum, s) => sum + durationSeconds(s.duration), 0), 20);
  assert.ok(durationSeconds(body.shots[0].duration) > durationSeconds(body.shots[1].duration));
  assert.equal((await POST(request({ targetSeconds: 61 }))).status, 400);
});

test("reference images reach multimodal request and art direction and durations return", async (t) => {
  let outgoing;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    outgoing = JSON.parse(init.body);
    return modelReply(JSON.stringify({ artDirection: "蓝色外套，写实质感", characterSetting: "小红，蓝色外套", shots: [shot, { ...shot, durationSeconds: 3 }] }));
  });
  const response = await POST(request({ assets: [asset], styleBrief: "写实电影" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.artDirection, "蓝色外套，写实质感");
  assert.equal(body.characterSetting, "小红，蓝色外套");
  assert.deepEqual(body.shots.map((s) => s.duration), ["6s", "3s"]);
  assert.equal(body.shots[0].scale, "特写");
  const content = outgoing.messages[1].content;
  assert.equal(content.find((part) => part.type === "image_url").image_url.url, asset.dataUrl);
  assert.match(content[1].text, /保留蓝色外套/);
  assert.match(content[0].text, /写实电影/);
});

test("text-only calls remain text-only; JSON repair preserves visual setup", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(typeof body.messages[1].content, "string");
    calls++;
    return calls === 1 ? modelReply("broken json") : modelReply(JSON.stringify({ artDirection: "黑白电影", shots: [shot, shot] }));
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).artDirection, "黑白电影");
  assert.equal(calls, 2);
});

test("missing art direction is not silently accepted for reference images", async (t) => {
  t.mock.method(globalThis, "fetch", async () => modelReply(JSON.stringify({ shots: [shot, shot] })));
  const response = await POST(request({ assets: [asset] }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /美术设定/);
});
