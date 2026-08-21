import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/db/database', () => ({ db: {} }));
vi.mock('../../../src/services/placeService', () => ({ createPlace: vi.fn() }));
vi.mock('../../../src/services/assignmentService', () => ({ createAssignment: vi.fn() }));
vi.mock('../../../src/services/tripService', () => ({ createTrip: vi.fn(), TRIP_SELECT: '' }));
vi.mock('../../../src/services/dayService', () => ({ listDays: vi.fn() }));
vi.mock('../../../src/services/mapsService', () => ({ searchPlaces: vi.fn() }));

import {
  buildDayPrompt,
  buildPrompt,
  itineraryInputSchema,
  type GeneratedItinerary,
  type ItineraryInput,
} from '../../../src/nest/ai-itinerary/ai-itinerary.service';

const input: ItineraryInput = {
  destination: '杭州',
  startDate: '2026-10-01',
  endDate: '2026-10-02',
  travelerCount: 3,
  budget: 3000,
  arrivalTime: '11:30',
  departureTime: '18:00',
  baseLocation: '西湖文化广场附近',
  transportPreference: 'public_transit',
  interests: ['culture', 'food'],
  pace: 'balanced',
  specialRequirements: '带一位老人，不要太早出发',
};

const itinerary: GeneratedItinerary = {
  title: '杭州两日游',
  summary: '轻松游览杭州。',
  notes: [],
  days: [
    {
      date: '2026-10-01',
      title: '西湖',
      notes: '',
      items: [{ name: '西湖', description: '', durationMinutes: 180 }],
    },
    {
      date: '2026-10-02',
      title: '古迹',
      notes: '',
      items: [{ name: '灵隐寺', description: '', durationMinutes: 120 }],
    },
  ],
};

describe('AI itinerary prompts', () => {
  it('keeps optional details simple while rejecting impossible day-trip times', () => {
    const minimal = itineraryInputSchema.parse({
      destination: '杭州',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      travelerCount: 2,
    });
    expect(minimal.transportPreference).toBe('mixed');

    const invalid = itineraryInputSchema.safeParse({
      destination: '杭州',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      travelerCount: 2,
      arrivalTime: '18:00',
      departureTime: '12:00',
    });
    expect(invalid.success).toBe(false);
  });

  it('defines an executable itinerary and the exact budget meaning', () => {
    const prompt = buildPrompt(input);

    expect(prompt.system).toContain('路线合理、强度适中、可以实际执行');
    expect(prompt.system).toContain('避免反复折返和跨城跳跃');
    expect(prompt.system).toContain('全部出行人员在目的地游玩期间的总预算');
    expect(prompt.system).toContain('specialRequirements 优先级最高');
    expect(prompt.system).toContain('第一天的活动必须在预留前往住宿地');
    expect(prompt.system).toContain('每天优先从其附近开始');
    expect(prompt.user).toContain('全部人员的当地游玩总预算，人民币，不含往返交通和住宿');
    expect(prompt.user).toContain('"arrivalTime": "11:30"');
    expect(prompt.user).toContain('"departureTime": "18:00"');
    expect(prompt.user).toContain('西湖文化广场附近');
    expect(prompt.user).toContain('优先公共交通，减少打车');
    expect(prompt.user).toContain('历史文化与人文景观');
    expect(prompt.user).toContain('当地美食与餐饮体验');
    expect(prompt.user).toContain('带一位老人，不要太早出发');
  });

  it('regenerates only the target day and supplies other days for deduplication', () => {
    const prompt = buildDayPrompt(input, itinerary, '2026-10-02');

    expect(prompt.system).toContain('只重新规划 2026-10-02 这一天');
    expect(prompt.user).toContain('西湖');
    expect(prompt.user).not.toContain('灵隐寺');
    expect(prompt.user).toContain('"targetDate": "2026-10-02"');
  });
});
