import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: server } = await import(workerUrl.href);

  const request = new Request("http://localhost/", {
    headers: { accept: "text/html" },
  });
  if (typeof server === "function") return server(request);
  return server.fetch(request, {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, {
    waitUntil() {},
    passThroughOnException() {},
  });
}

test("server-renders the storyboard agent shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /九格导演 Agent/);
  assert.match(html, /AI 视频分镜工作台/);
});

test("page source contains the core agent workflow", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /先从一句话开始/);
  assert.match(page, /WorkspaceTab/);
  assert.match(page, /ShotCount/);
  assert.match(page, /shotCountOptions/);
  assert.match(page, /分镜数量/);
  assert.match(page, /2 到 9 个镜头/);
  assert.match(page, /文案设定/);
  assert.match(page, /分镜预览/);
  assert.match(page, /镜头提示词/);
  assert.match(page, /小明一个人在走夜路/);
  assert.match(page, /场景氛围/);
  assert.match(page, /恐怖场景/);
  assert.match(page, /心理情况/);
  assert.match(page, /两边脸颊有少许汗水/);
  assert.match(page, /氛围感人物短片/);
  assert.match(page, /MoodTone/);
  assert.match(page, /人物形象/);
  assert.match(page, /具体场景/);
  assert.match(page, /人物动作/);
  assert.match(page, /神态描写/);
  assert.match(page, /导演备注/);
  assert.match(page, /buildCharacterProfile/);
  assert.match(page, /parseStoryContext/);
  assert.match(page, /StoryContext/);
  assert.match(page, /isNarrativeStory/);
  assert.match(page, /hasKnowledgeIntent/);
  assert.match(page, /visualAnchor/);
  assert.match(page, /pressure/);
  assert.match(page, /潮湿反光/);
  assert.match(page, /手机冷光/);
  assert.match(page, /过马路/);
  assert.match(page, /斑马线/);
  assert.match(page, /红绿灯/);
  assert.match(page, /车灯扫过路面/);
  assert.match(page, /骑单车/);
  assert.match(page, /自行车道/);
  assert.match(page, /车把/);
  assert.match(page, /前轮转动/);
  assert.match(page, /脚踏节奏/);
  assert.match(page, /performanceForShot/);
  assert.match(page, /SketchStatus/);
  assert.match(page, /文字分镜提示词/);
  assert.match(page, /整片总提示词/);
  assert.match(page, /复制整片提示词/);
  assert.match(page, /复制当前镜头提示词/);
  assert.match(page, /buildFullVideoPrompt/);
  assert.match(page, /完整分镜/);
  assert.match(page, /即时生成结果/);
  assert.match(page, /setup-prompt-list/);
  assert.match(page, /已生成/);
  assert.match(page, /不填文字模型 Key/);
  assert.match(page, /查看规则版文字分镜/);
  assert.match(page, /用文字模型生成分镜/);
  assert.match(page, /尚未生成分镜图/);
  assert.match(page, /尚未调用图片接口/);
  assert.match(page, /分镜图按需生成/);
  assert.match(page, /分镜图状态/);
  assert.match(page, /一键生成分镜图/);
  assert.match(page, /生成当前分镜图/);
  assert.match(page, /文字模型接口中心/);
  assert.match(page, /OpenAI/);
  assert.match(page, /DeepSeek/);
  assert.match(page, /通义千问/);
  assert.match(page, /豆包火山/);
  assert.match(page, /智谱 GLM/);
  assert.match(page, /Kimi/);
  assert.match(page, /自定义兼容/);
  assert.match(page, /\/api\/generate-storyboard/);
  assert.match(page, /图片接口中心/);
  assert.match(page, /图片接口 API Key/);
  assert.match(page, /GPT Image Mini/);
  assert.match(page, /兼容接口/);
  assert.match(page, /自定义接口/);
  assert.match(page, /customEndpoint/);
  assert.match(page, /\/api\/generate-sketch/);
  assert.match(page, /pickVideoType/);
  assert.match(page, /buildShots/);
  assert.match(page, /buildSketchPrompt/);
  assert.match(page, /shot-prompt-preview/);
  assert.match(page, /Kling/);
  assert.match(page, /Runway/);
  assert.match(page, /Luma/);
  assert.match(page, /Seedance 2\.0/);
});

test("storyboard route supports multiple text model interfaces", async () => {
  const route = await readFile(new URL("../app/api/generate-storyboard/route.ts", import.meta.url), "utf8");

  assert.match(route, /https:\/\/api\.openai\.com\/v1\/chat\/completions/);
  assert.match(route, /https:\/\/api\.deepseek\.com\/chat\/completions/);
  assert.match(route, /https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1\/chat\/completions/);
  assert.match(route, /https:\/\/ark\.cn-beijing\.volces\.com\/api\/v3\/chat\/completions/);
  assert.match(route, /https:\/\/open\.bigmodel\.cn\/api\/paas\/v4\/chat\/completions/);
  assert.match(route, /https:\/\/api\.moonshot\.cn\/v1\/chat\/completions/);
  assert.match(route, /response_format/);
  assert.match(route, /normalizeShots/);
  assert.match(route, /repairBody/);
  assert.match(route, /readDraftField/);
  assert.match(route, /storyboard/);
  assert.match(route, /sceneDetail/);
  assert.match(route, /具体场景/);
  assert.match(route, /线稿提示词/);
  assert.match(route, /文字模型 API Key/);
});

test("sketch route supports multiple image interfaces", async () => {
  const route = await readFile(new URL("../app/api/generate-sketch/route.ts", import.meta.url), "utf8");

  assert.match(route, /https:\/\/api\.openai\.com\/v1\/images\/generations/);
  assert.match(route, /Authorization/);
  assert.match(route, /ImageProvider/);
  assert.match(route, /compatible/);
  assert.match(route, /custom/);
  assert.match(route, /safeExternalEndpoint/);
  assert.match(route, /firstImage/);
  assert.match(route, /gpt-image-1-mini/);
  assert.match(route, /请先填写当前接口的 API Key/);
  assert.doesNotMatch(route, /process\.env\.OPENAI_API_KEY/);
});
