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

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates');

export const itineraryInputSchema = z.object({
  destination: z.string().trim().min(1).max(160),
  startDate: dateSchema,
  endDate: dateSchema,
  travelerCount: z.number().int().min(1).max(50),
  budget: z.number().finite().nonnegative().max(100_000_000).optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  pace: z.enum(['relaxed', 'balanced', 'packed']).default('balanced'),
  specialRequirements: z.string().trim().max(1000).default(''),
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
        estimatedCost: 'number or omit',
      }],
    }],
    notes: ['string'],
  }, null, 2);
}

function buildPrompt(input: ItineraryInput): { system: string; user: string } {
  const system = [
    '你是一个可靠的旅行规划助手。只输出合法 JSON，不要 Markdown，不要解释，不要输出 JSON 之外的内容。',
    '为普通游客生成可执行但不过度拥挤的旅行计划。每天安排 2 到 5 个地点，地点顺序应尽量合理。',
    '不要编造营业时间、票价、交通时长或坐标；不确定时使用空值，并在 notes 中提醒用户出发前确认。',
    '必须为输入日期范围内的每一天输出一个 days 项，日期必须保持 YYYY-MM-DD。',
    '输出结构必须严格遵守以下形状：',
    outputSchemaForPrompt(),
  ].join('\n');
  const user = JSON.stringify({
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    travelerCount: input.travelerCount,
    budget: input.budget ?? null,
    interests: input.interests,
    pace: input.pace,
    specialRequirements: input.specialRequirements || null,
  }, null, 2);
  return { system, user: `请根据以下旅行条件生成计划：\n${user}` };
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
