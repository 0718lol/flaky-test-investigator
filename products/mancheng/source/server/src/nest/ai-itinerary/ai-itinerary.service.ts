import { HttpException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { db } from '../../db/database';
import { createPlace } from '../../services/placeService';
import { createAssignment } from '../../services/assignmentService';
import { createTrip, TRIP_SELECT } from '../../services/tripService';
import { listDays } from '../../services/dayService';
import { searchPlaces } from '../../services/mapsService';
import { resolveLlmConfig } from '../llm-parse/llm-config.resolver';
import { safeFetchLlm } from '../../utils/ssrfGuard';
import type { User } from '../../types';

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates')
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, 'Use a valid calendar date');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm times');

export const itineraryInputSchema = z.object({
  destination: z.string().trim().min(1).max(160),
  startDate: dateSchema,
  endDate: dateSchema,
  travelerCount: z.number().int().min(1).max(50),
  budget: z.number().finite().nonnegative().max(100_000_000).optional(),
  arrivalTime: timeSchema.optional(),
  departureTime: timeSchema.optional(),
  baseLocation: z.string().trim().min(1).max(300).optional(),
  transportPreference: z.enum(['mixed', 'public_transit', 'walking', 'taxi', 'self_drive']).default('mixed'),
  interests: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  pace: z.enum(['relaxed', 'balanced', 'packed']).default('balanced'),
  specialRequirements: z.string().trim().max(1000).default(''),
}).superRefine((input, context) => {
  if (input.endDate < input.startDate) {
    context.addIssue({ code: 'custom', message: 'End date must not be before start date', path: ['endDate'] });
  }
  if (input.startDate === input.endDate && input.arrivalTime && input.departureTime && input.departureTime <= input.arrivalTime) {
    context.addIssue({ code: 'custom', message: 'Departure must be after arrival for a day trip', path: ['departureTime'] });
  }
});

const itineraryItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(''),
  address: z.string().trim().max(500).nullable().optional(),
  lat: z.number().finite().min(-90).max(90).nullable().optional(),
  lng: z.number().finite().min(-180).max(180).nullable().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  durationMinutes: z.number().int().min(15).max(720).default(90),
  estimatedCost: z.number().finite().nonnegative().max(100_000_000).optional(),
});

const generatedDaySchema = z.object({
  date: dateSchema,
  title: z.string().trim().max(200).default('行程安排'),
  notes: z.string().trim().max(2000).default(''),
  items: z.array(itineraryItemSchema).max(12).default([]),
});

export const generatedItinerarySchema = z.object({
  title: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(2000).default(''),
  days: z.array(generatedDaySchema).min(1).max(365),
  notes: z.array(z.string().trim().max(500)).max(12).default([]),
});

export type ItineraryInput = z.infer<typeof itineraryInputSchema>;
export type GeneratedItinerary = z.infer<typeof generatedItinerarySchema>;

const regenerateDayInputSchema = z.object({
  input: itineraryInputSchema,
  itinerary: generatedItinerarySchema,
  targetDate: dateSchema,
});

const OPENAI_TIMEOUT_MS = 120_000;
const MAX_ITEMS_TO_GEOCODE = 80;
const generationTimestamps = new Map<number, number[]>();

function dateRange(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days > 365) return [];
  return Array.from({ length: days }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

function assertGenerationAllowed(userId: number): void {
  const now = Date.now();
  const recent = (generationTimestamps.get(userId) ?? []).filter(t => now - t < 10 * 60_000);
  if (recent.length >= 5) throw new HttpException({ error: '生成次数过多，请 10 分钟后再试' }, 429);
  recent.push(now);
  generationTimestamps.set(userId, recent);
}

function parseJson(content: string | undefined): unknown {
  if (!content) return null;
  const stripped = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(stripped); } catch { return null; }
}

function outputSchemaForPrompt(): string {
  return JSON.stringify({
    title: 'string',
    summary: 'string',
    days: [{
      date: 'YYYY-MM-DD',
      title: 'string',
      notes: 'string',
      items: [{
        name: 'string',
        description: 'string',
        address: 'string or null',
        lat: 'number or null; only include when known, never invent coordinates',
        lng: 'number or null; only include when known, never invent coordinates',
        startTime: 'HH:mm or null',
        durationMinutes: 'integer',
        estimatedCost: 'number in CNY for all travelers, or omit when uncertain',
      }],
    }],
    notes: ['string'],
  }, null, 2);
}

function dayOutputSchemaForPrompt(): string {
  return JSON.stringify({
    date: 'YYYY-MM-DD',
    title: 'string',
    notes: 'string',
    items: [{
      name: 'string',
      description: 'string',
      address: 'string or null',
      lat: 'number or null; only include when known, never invent coordinates',
      lng: 'number or null; only include when known, never invent coordinates',
      startTime: 'HH:mm or null',
      durationMinutes: 'integer',
      estimatedCost: 'number in CNY for all travelers, or omit when uncertain',
    }],
  }, null, 2);
}

function planningRules(): string[] {
  return [
    '你的任务不是罗列热门景点，而是为普通游客生成路线合理、强度适中、可以实际执行的旅行计划。',
    '只安排真实、名称明确、通常可在地图中搜索到的地点。不要编造景点、餐厅、地址、票价、营业时间、交通时间或经纬度。',
    '无法确认地址或经纬度时使用 null，不要猜测。',
    '同一天的地点应尽量位于相同或相邻区域，并按合理游览顺序排列，避免反复折返和跨城跳跃。',
    '不同日期不要重复安排同一个地点，除非用户在补充要求中明确提出。',
    'pace 为 relaxed 时通常每天 2 至 3 个地点，balanced 时 3 至 4 个，packed 时 4 至 5 个。',
    '第一天和最后一天默认更轻松。用户未提供 arrivalTime 或 departureTime 时，不要假定可以使用完整一天，并在 notes 中提醒调整。',
    'arrivalTime 是抵达目的地交通枢纽的时间，第一天的活动必须在预留前往住宿地、放置行李等合理缓冲后开始。',
    'departureTime 是离开目的地交通枢纽的时间，最后一天的活动必须提前结束，为取行李和前往机场或车站预留合理时间。',
    '提供 baseLocation 时，每天优先从其附近开始并在合理情况下回到附近；不得为了回到住宿地制造明显绕路。',
    'transportPreference 必须实际影响选点距离、换乘次数和每天密度；步行为主时尤其要缩小活动范围，自驾时要考虑停车和道路可达性。',
    'startTime 是建议到达时间，不是营业时间。时间安排必须为用餐、休息和移动留出合理余量。',
    'durationMinutes 应符合正常游览习惯，不得为了塞入更多地点而刻意缩短。',
    'budget 是全部出行人员在目的地游玩期间的总预算，单位人民币，不含往返大交通和住宿。没有预算时按大众消费水平规划。',
    'estimatedCost 是该项目全部人员的预计支出，单位人民币。无法可靠估计时省略，不要编造精确价格。',
    '兴趣偏好应影响地点选择，同时保留目的地具有代表性的体验。',
    'specialRequirements 优先级最高。涉及儿童、老人、无障碍、饮食或体力限制时，降低强度并避开明显不合适的活动。',
    '餐厅只有在名称明确且较有把握真实存在时才能作为地点；否则只在当天 notes 中建议用餐区域或餐饮类型。',
    'description 应简洁说明推荐理由、适合体验的内容及与前后地点的衔接，不要堆砌宣传文案。',
    '开放时间、预约、门票、天气或季节信息不确定时，在 notes 中提醒出发前确认。',
    '条件无法全部满足时优先保证可执行性，并在 notes 中说明取舍，不要强行安排。',
  ];
}

function promptInput(input: ItineraryInput): Record<string, unknown> {
  const interestDefinitions: Record<string, string> = {
    food: '当地美食与餐饮体验',
    culture: '历史文化与人文景观',
    nature: '自然风光',
    shopping: '购物',
    family: '亲子活动',
    art: '艺术与展览',
    nightlife: '夜生活',
    photo: '适合拍照的地点',
    outdoor: '户外活动',
  };
  return {
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    travelerCount: input.travelerCount,
    budget: input.budget ?? null,
    budgetDefinition: '全部人员的当地游玩总预算，人民币，不含往返交通和住宿',
    arrivalTime: input.arrivalTime ?? null,
    arrivalTimeDefinition: '第一天抵达目的地机场或车站的当地时间',
    departureTime: input.departureTime ?? null,
    departureTimeDefinition: '最后一天从目的地机场或车站离开的当地时间',
    baseLocation: input.baseLocation ?? null,
    baseLocationDefinition: '住宿位置或每天主要出发和返回的位置',
    transportPreference: input.transportPreference,
    transportPreferenceDefinition: {
      mixed: '根据路线灵活混合步行、公共交通和打车',
      public_transit: '优先公共交通，减少打车',
      walking: '以步行为主，地点需要紧凑集中',
      taxi: '优先打车，减少换乘和长距离步行',
      self_drive: '自驾，需要考虑停车和道路可达性',
    }[input.transportPreference],
    interests: input.interests.map(interest => interestDefinitions[interest] ?? interest),
    pace: input.pace,
    specialRequirements: input.specialRequirements || null,
  };
}

export function buildPrompt(input: ItineraryInput): { system: string; user: string } {
  const system = [
    '你是“漫程”的可靠旅行行程规划助手。',
    '只输出一个合法 JSON 对象，不要 Markdown、代码块、解释、前言或 JSON 之外的内容。',
    ...planningRules(),
    '必须为输入日期范围内的每一天输出一个 days 项，日期必须保持 YYYY-MM-DD。',
    '行程标题应简洁，summary 用 2 至 4 句话概括整体风格、重点区域和节奏。',
    '输出结构必须严格遵守以下形状：',
    outputSchemaForPrompt(),
  ].join('\n');
  const user = JSON.stringify(promptInput(input), null, 2);
  return { system, user: `请根据以下旅行条件生成计划：\n${user}` };
}

export function buildDayPrompt(
  input: ItineraryInput,
  itinerary: GeneratedItinerary,
  targetDate: string,
): { system: string; user: string } {
  const system = [
    '你是“漫程”的可靠旅行行程规划助手。',
    '只输出一个合法 JSON 对象，不要 Markdown、代码块、解释、前言或 JSON 之外的内容。',
    ...planningRules(),
    `只重新规划 ${targetDate} 这一天，date 必须严格等于 ${targetDate}。`,
    'existingDays 中的地点已经安排在其他日期，新计划不得与它们重复。',
    '输出结构必须严格遵守以下形状：',
    dayOutputSchemaForPrompt(),
  ].join('\n');
  const user = JSON.stringify({
    tripConditions: promptInput(input),
    targetDate,
    existingDays: itinerary.days
      .filter(day => day.date !== targetDate)
      .map(day => ({ date: day.date, places: day.items.map(item => item.name) })),
  }, null, 2);
  return { system, user: `请重新生成指定日期的完整安排：\n${user}` };
}

async function completeJson(config: NonNullable<ReturnType<typeof resolveLlmConfig>>, prompt: { system: string; user: string }): Promise<unknown> {
  if (config.provider === 'local' && !config.baseUrl) {
    throw new HttpException({ error: '本地 AI 缺少服务地址配置' }, 503);
  }
  const base = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    if (config.provider === 'anthropic') {
      const anthropicBase = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
      const anthropicUrl = anthropicBase.endsWith('/v1') ? `${anthropicBase}/messages` : `${anthropicBase}/v1/messages`;
      const response = await safeFetchLlm(anthropicUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 6000,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        }),
      });
      if (!response.ok) throw new Error(`AI request failed (${response.status})`);
      const data = await response.json() as { content?: { type?: string; text?: string }[] };
      return parseJson(data.content?.find(block => block.type === 'text')?.text);
    }

    const response = await safeFetchLlm(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI request failed (${response.status})`);
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return parseJson(data.choices?.[0]?.message?.content);
  } catch (error) {
    if (error instanceof HttpException) throw error;
    console.error('[ai-itinerary] provider request failed:', error instanceof Error ? error.message : error);
    throw new HttpException({ error: 'AI 服务暂时不可用，请稍后重试' }, 502);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeItinerary(input: ItineraryInput, raw: unknown): GeneratedItinerary {
  const parsed = generatedItinerarySchema.safeParse(raw);
  if (!parsed.success) throw new HttpException({ error: 'AI 返回的行程格式无法识别，请重试' }, 502);
  const expectedDates = dateRange(input.startDate, input.endDate);
  if (expectedDates.length === 0) throw new HttpException({ error: '旅行日期无效或超过 365 天' }, 400);

  const byDate = new Map<string, GeneratedItinerary['days'][number]>();
  for (const day of parsed.data.days) {
    if (!expectedDates.includes(day.date) || byDate.has(day.date)) continue;
    byDate.set(day.date, day);
  }
  const days = expectedDates.map(date => byDate.get(date) ?? { date, title: '行程安排', notes: '', items: [] });
  const totalItems = days.reduce((sum, day) => sum + day.items.length, 0);
  if (totalItems > MAX_ITEMS_TO_GEOCODE) throw new HttpException({ error: '生成的地点过多，请缩短旅行天数后重试' }, 422);
  return {
    title: parsed.data.title?.trim() || `${input.destination}旅行`,
    summary: parsed.data.summary,
    days,
    notes: parsed.data.notes,
  };
}

function normalizeGeneratedDay(raw: unknown, targetDate: string): GeneratedItinerary['days'][number] {
  const wrapped = raw && typeof raw === 'object' && 'day' in raw
    ? (raw as { day?: unknown }).day
    : raw;
  const parsed = generatedDaySchema.safeParse(wrapped);
  if (!parsed.success) throw new HttpException({ error: 'AI 返回的当天行程格式无法识别，请重试' }, 502);
  return { ...parsed.data, date: targetDate };
}

async function enrichItem(userId: number, destination: string, item: GeneratedItinerary['days'][number]['items'][number]) {
  if (item.lat != null && item.lng != null) return item;
  try {
    const result = await searchPlaces(userId, `${item.name}, ${item.address || destination}`, 'zh');
    const match = result.places?.[0] as { lat?: number | null; lng?: number | null; address?: string; google_place_id?: string; osm_id?: string } | undefined;
    if (match?.lat != null && match.lng != null) {
      return { ...item, lat: match.lat, lng: match.lng, address: item.address || match.address || null, googlePlaceId: match.google_place_id, osmId: match.osm_id };
    }
  } catch {
    // Coordinates are an enhancement; a plan remains usable without a map pin.
  }
  return item;
}

async function enrichItinerary(userId: number, input: ItineraryInput, itinerary: GeneratedItinerary): Promise<GeneratedItinerary> {
  const days = [] as GeneratedItinerary['days'];
  for (const day of itinerary.days) {
    const items = [] as typeof day.items;
    for (let i = 0; i < day.items.length; i += 4) {
      const batch = day.items.slice(i, i + 4);
      items.push(...await Promise.all(batch.map(item => enrichItem(userId, input.destination, item))));
    }
    days.push({ ...day, items });
  }
  return { ...itinerary, days };
}

@Injectable()
export class AiItineraryService {
  async generate(userId: number, body: unknown): Promise<GeneratedItinerary> {
    const inputResult = itineraryInputSchema.safeParse(body);
    if (!inputResult.success) throw new HttpException({ error: '请完整填写目的地、日期和出行人数' }, 400);
    if (dateRange(inputResult.data.startDate, inputResult.data.endDate).length === 0) {
      throw new HttpException({ error: '结束日期必须晚于开始日期，且旅行不能超过 365 天' }, 400);
    }
    const config = resolveLlmConfig(userId);
    if (!config) throw new HttpException({ error: 'AI 尚未配置，请管理员先启用 AI Parsing 并配置云端模型' }, 503);
    assertGenerationAllowed(userId);
    const raw = await completeJson(config, buildPrompt(inputResult.data));
    return normalizeItinerary(inputResult.data, raw);
  }

  async regenerateDay(userId: number, body: unknown): Promise<GeneratedItinerary['days'][number]> {
    const payloadResult = regenerateDayInputSchema.safeParse(body);
    if (!payloadResult.success) throw new HttpException({ error: '当天行程条件无效，请重新生成' }, 400);
    const { input, targetDate } = payloadResult.data;
    const expectedDates = dateRange(input.startDate, input.endDate);
    if (!expectedDates.includes(targetDate)) throw new HttpException({ error: '要重新生成的日期不在旅行范围内' }, 400);
    const itinerary = normalizeItinerary(input, payloadResult.data.itinerary);
    const config = resolveLlmConfig(userId);
    if (!config) throw new HttpException({ error: 'AI 尚未配置，请管理员先启用 AI Parsing 并配置云端模型' }, 503);
    assertGenerationAllowed(userId);
    const raw = await completeJson(config, buildDayPrompt(input, itinerary, targetDate));
    return normalizeGeneratedDay(raw, targetDate);
  }

  async create(user: User, body: unknown): Promise<{ trip: unknown; days: unknown }> {
    const payload = body as { input?: unknown; itinerary?: unknown } | null;
    const inputResult = itineraryInputSchema.safeParse(payload?.input);
    if (!inputResult.success) throw new HttpException({ error: '旅行条件无效，请重新填写' }, 400);
    const itinerary = normalizeItinerary(inputResult.data, payload?.itinerary);
    const enriched = await enrichItinerary(user.id, inputResult.data, itinerary);
    const created = db.transaction(() => {
      const { tripId } = createTrip(user.id, {
        title: enriched.title || `${inputResult.data.destination}旅行`,
        description: enriched.summary || null,
        start_date: inputResult.data.startDate,
        end_date: inputResult.data.endDate,
        currency: 'CNY',
      });
      const tripDays = db.prepare('SELECT id, date FROM days WHERE trip_id = ? ORDER BY day_number').all(tripId) as { id: number; date: string | null }[];
      const dayByDate = new Map(tripDays.map(day => [day.date, day.id]));
      for (const generatedDay of enriched.days) {
        const dayId = dayByDate.get(generatedDay.date);
        if (!dayId) continue;
        db.prepare('UPDATE days SET title = ?, notes = ? WHERE id = ?').run(generatedDay.title || null, generatedDay.notes || null, dayId);
        for (const item of generatedDay.items) {
          const place = createPlace(String(tripId), {
            name: item.name,
            description: item.description || undefined,
            address: item.address || undefined,
            lat: item.lat ?? undefined,
            lng: item.lng ?? undefined,
            place_time: item.startTime || undefined,
            duration_minutes: item.durationMinutes,
            price: item.estimatedCost,
            currency: 'CNY',
            google_place_id: (item as typeof item & { googlePlaceId?: string }).googlePlaceId,
            osm_id: (item as typeof item & { osmId?: string }).osmId,
            transport_mode: 'walking',
          });
          createAssignment(dayId, Number(place.id), null);
        }
      }
      return tripId;
    })();
    const trip = db.prepare(`${TRIP_SELECT} WHERE t.id = :tripId`).get({ userId: user.id, tripId: created });
    return { trip, days: listDays(created).days };
  }
}
