type ImageProvider = "openai" | "compatible" | "custom";
type OpenAIImageModel = "gpt-image-2" | "gpt-image-1.5" | "gpt-image-1" | "gpt-image-1-mini";

type ImageGenerateResponse = {
  image?: string;
  url?: string;
  b64_json?: string;
  output?: string | string[];
  images?: string[];
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

const openAIEndpoint = "https://api.openai.com/v1/images/generations";
const allowedOpenAIModels = new Set<OpenAIImageModel>(["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"]);
const allowedProviders = new Set<ImageProvider>(["openai", "compatible", "custom"]);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeProvider(value: unknown): ImageProvider {
  const provider = readString(value) as ImageProvider;
  return allowedProviders.has(provider) ? provider : "openai";
}

function safeOpenAIModel(value: unknown): OpenAIImageModel {
  const model = readString(value) as OpenAIImageModel;
  return allowedOpenAIModels.has(model) ? model : "gpt-image-1-mini";
}

function safeModel(value: unknown) {
  return readString(value).slice(0, 80) || "image-model";
}

function safeExternalEndpoint(value: unknown) {
  const endpoint = readString(value);

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeImage(value: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

function firstImage(data: ImageGenerateResponse) {
  const output = Array.isArray(data.output) ? data.output[0] : data.output;
  const image = data.data?.[0]?.b64_json || data.data?.[0]?.url || data.image || data.url || data.b64_json || data.images?.[0] || output || "";

  return normalizeImage(image);
}

function openAIBody(model: string, prompt: string) {
  return {
    model,
    prompt: prompt.slice(0, 3900),
    n: 1,
    size: "1536x1024",
    quality: "low",
    output_format: "png",
    moderation: "auto",
  };
}

function customBody(model: string, prompt: string) {
  return {
    model,
    prompt: prompt.slice(0, 3900),
    aspect_ratio: "16:9",
    size: "1536x1024",
    quality: "low",
    style: "black and white storyboard line art",
  };
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "请求格式不正确，请重新生成。" }, { status: 400 });
  }

  const apiKey = readString(payload.apiKey);
  const prompt = readString(payload.prompt);
  const provider = safeProvider(payload.provider);
  const model = provider === "openai" ? safeOpenAIModel(payload.model) : safeModel(payload.model);
  const endpoint = provider === "openai" ? openAIEndpoint : safeExternalEndpoint(payload.endpoint);

  if (!apiKey) {
    return Response.json({ error: "请先填写当前接口的 API Key，再生成线稿图。" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "缺少线稿提示词，请先生成分镜。" }, { status: 400 });
  }

  if (!endpoint) {
    return Response.json({ error: "请填写有效的 https 图片接口地址。" }, { status: 400 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(provider === "custom" ? customBody(model, prompt) : openAIBody(model, prompt)),
    });

    const data = (await response.json().catch(() => ({}))) as ImageGenerateResponse;

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "图片接口调用失败，请检查 API Key、接口地址、模型权限或账户余额。" },
        { status: response.status },
      );
    }

    const image = firstImage(data);

    if (!image) {
      return Response.json({ error: "图片接口没有返回可用图片，请确认返回字段包含 image、url、b64_json、images 或 data[0]。" }, { status: 502 });
    }

    return Response.json({ image });
  } catch {
    return Response.json({ error: "无法连接图片接口，请检查网络、接口地址或稍后重试。" }, { status: 502 });
  }
}
