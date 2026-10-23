import { mediaRef } from '../../../common/media/images';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Kysely } from 'kysely';
import { CLOCK, type Clock } from '../../../common/clock/clock';
import { problem, uuidParam } from '../../../common/http/problem-response';
import type { Database } from '../../../db/kysely';
import { KYSELY } from '../../../db/tokens';
import { DrawerRepository, type DrawerRow, type HoursRow } from '../data/drawer.repository';
import { drawerNotFound, isOpenAt } from '../domain/drawer-rules';
import { AvailabilityService } from '../services/availability.service';
import { DiscoveryService, type NearbyCandidate } from '../services/discovery.service';
import {
  AvailabilityDto,
  AvailabilityQuery,
  InventoryEntryDto,
  NearbyDrawerDto,
  NearbyRequestDto,
  NearbyResponseDto,
  PublicDrawerDto,
} from './drawers.dto';

const hhmm = (time: string): string => time.slice(0, 5);
const hoursView = (hours: HoursRow[]) =>
  hours.map((h) => ({
    weekday: h.weekday,
    opensAt: hhmm(h.opens_at),
    closesAt: hhmm(h.closes_at),
  }));

const publicView = (drawer: DrawerRow, hours: HoursRow[], openNow: boolean): PublicDrawerDto => ({
  id: drawer.id,
  name: drawer.name,
  address: drawer.address,
  timezone: drawer.timezone,
  latitude: drawer.latitude,
  longitude: drawer.longitude,
  pickupInstructions: drawer.pickup_instructions,
  photoUrl: drawer.photo_media_id ? mediaRef(drawer.photo_media_id) : null,
  hours: hoursView(hours),
  openNow,
});

const nearbyView = (c: NearbyCandidate): NearbyDrawerDto => ({
  ...publicView(c.drawer, c.hours, c.openNow),
  distanceMeters: Math.round(c.drawer.distance_meters),
  availableNow: c.availableNow,
  reason: c.reason,
});

/** What customers see: no sign-in needed. Availability is a snapshot — the booking itself decides (README §9.7). */
@ApiTags('catalog')
@Controller('drawers')
export class PublicDrawersController {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly drawers: DrawerRepository,
    private readonly discovery: DiscoveryService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get()
  @ApiOkResponse({
    type: PublicDrawerDto,
    isArray: true,
    description: 'All active drawers (manual browsing).',
  })
  async list(): Promise<PublicDrawerDto[]> {
    const now = this.clock.now();
    const rows = await this.drawers.list(this.db, 'all', true);
    const ids = rows.map((r) => r.id);
    const [hours, closures] = await Promise.all([
      this.drawers.hoursFor(this.db, ids),
      this.drawers.closuresFor(this.db, ids, now),
    ]);
    return rows.map((drawer) => {
      const own = hours.filter((h) => h.drawer_id === drawer.id);
      const open = isOpenAt(
        now,
        drawer.timezone,
        own,
        closures.filter((c) => c.drawer_id === drawer.id),
      );
      return publicView(drawer, own, open);
    });
  }

  @Post('nearby')
  @HttpCode(200)
  @ApiOkResponse({ type: NearbyResponseDto })
  @problem(
    422,
    '`OUTSIDE_SERVICE_AREA` — no drawer within the search radius; `VALIDATION_FAILED` — coordinates out of range (latitude ±90, longitude ±180).',
  )
  async nearby(@Body() dto: NearbyRequestDto): Promise<NearbyResponseDto> {
    const result = await this.discovery.nearby(dto);
    return {
      drawers: result.drawers.map(nearbyView),
      unavailable: result.unavailable.map(nearbyView),
    };
  }

  @Get(':id/inventory')
  @ApiOkResponse({
    type: InventoryEntryDto,
    isArray: true,
    description: 'Models rentable at this drawer. A snapshot.',
  })
  @problem(404, '`NOT_FOUND` — unknown or inactive drawer.')
  async inventory(
    @Param('id', uuidParam(drawerNotFound)) id: string,
  ): Promise<InventoryEntryDto[]> {
    const { entries } = await this.availability.drawerInventory(id);
    return entries.map(({ model, total, availableNow }) => ({
      itemModelId: model.id,
      name: model.name,
      categoryId: model.category_id,
      photos: model.photos as string[],
      description: model.description,
      pricePerSlotPaise: model.price_per_slot_paise,
      slotMinutes: model.slot_minutes,
      minDurationMin: model.min_duration_min,
      maxDurationMin: model.max_duration_min,
      depositPaise: model.deposit_paise,
      total,
      availableNow,
    }));
  }

  @Get(':id/items/:modelId/availability')
  @ApiOkResponse({ type: AvailabilityDto })
  @problem(404, '`NOT_FOUND` — unknown drawer, or the model is not offered there.')
  @problem(422, '`VALIDATION_FAILED` — `date` is not a calendar day within the next 90 days.')
  async slots(
    @Param('id', uuidParam(drawerNotFound)) id: string,
    @Param('modelId', uuidParam(drawerNotFound)) modelId: string,
    @Query() query: AvailabilityQuery,
  ): Promise<AvailabilityDto> {
    const a = await this.availability.availability(id, modelId, query.date);
    return {
      drawerId: a.drawer.id,
      itemModelId: a.model.id,
      date: a.date,
      timezone: a.drawer.timezone,
      slotMinutes: a.model.slot_minutes,
      minDurationMin: a.model.min_duration_min,
      maxDurationMin: a.model.max_duration_min,
      bufferMin: a.model.buffer_min,
      pricePerSlotPaise: a.model.price_per_slot_paise,
      opensAt: a.opensAt?.toISOString() ?? null,
      closesAt: a.closesAt?.toISOString() ?? null,
      slots: a.slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        freeAssets: s.freeAssets,
        maxFreeMinutes: s.maxFreeMinutes,
      })),
      snapshot: true,
      generatedAt: a.generatedAt.toISOString(),
    };
  }
}
