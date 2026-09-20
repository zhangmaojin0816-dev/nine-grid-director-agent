export const MAX_REFERENCE_ASSETS = 15;

export type ReferenceAsset = {
  id: string;
  name: string;
  kind: string;
  description: string;
  dataUrl: string;
};

export function durationSeconds(value: unknown, fallback = 4): number {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\s*\d+(?:\.\d+)?\s*(?:s|秒)?\s*$/i.test(value) ? Number.parseFloat(value) : NaN;
  return Number.isFinite(number) && number >= 1 && number <= 30 ? Math.round(number) : fallback;
}

export function validateTargetSeconds(value: unknown, count: number): number {
  const seconds = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(seconds) || seconds < count || seconds > count * 30) {
    throw new Error(`${count} 个镜头的目标总时长需为 ${count}–${count * 30} 秒的整数（每镜 1–30 秒）。`);
  }
  return seconds;
}

export function fitShotDurations<T extends { duration: string }>(shots: T[], target: number): T[] {
  validateTargetSeconds(target, shots.length);
  const weights = shots.map((shot) => durationSeconds(shot.duration));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === target) return shots;
  const durations = shots.map(() => 1);
  // Distribute whole seconds toward the proposed pacing, respecting each shot's cap.
  for (let remaining = target - shots.length; remaining > 0; remaining--) {
    let best = -1;
    for (let i = 0; i < shots.length; i++) {
      if (durations[i] < 30 && (best < 0 || weights[i] * target / sum - durations[i] > weights[best] * target / sum - durations[best])) best = i;
    }
    durations[best]++;
  }
  return shots.map((shot, index) => ({ ...shot, duration: `${durations[index]}s` }));
}

export function shotTimeline(shots: { duration: string }[]) {
  let elapsed = 0;
  return shots.map((shot) => {
    const seconds = durationSeconds(shot.duration);
    const start = elapsed;
    elapsed += seconds;
    return { start, end: elapsed, seconds };
  });
}

export function replaceSingleShot<T extends { id: number; duration: string }>(shots: T[], shotId: number, patch: Partial<T>): T[] {
  if (!shots.some((shot) => shot.id === shotId)) throw new Error("待修改的镜头已不存在。");
  return shots.map((shot) => shot.id === shotId ? { ...shot, ...patch, id: shot.id, duration: shot.duration } : shot);
}

export function validateAssets(value: unknown): ReferenceAsset[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_REFERENCE_ASSETS) throw new Error(`最多上传 ${MAX_REFERENCE_ASSETS} 张参考图片。`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || typeof item.dataUrl !== "string" ||
        item.dataUrl.length > 4 * 1024 * 1024 + 100 ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.dataUrl)) {
      throw new Error("参考图片须为 PNG、JPEG 或 WebP，每张不超过 3 MB。");
    }
    const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
    return { id: String(index + 1), name: text(item.name, 120), kind: text(item.kind, 20), description: text(item.description, 1000), dataUrl: item.dataUrl };
  });
}
