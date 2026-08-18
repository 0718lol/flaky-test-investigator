import { Body, Controller, HttpCode, HttpException, Post, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { checkPermission } from '../../services/permissions';
import { AiItineraryService } from './ai-itinerary.service';

@Controller('api/ai/itinerary')
@UseGuards(JwtAuthGuard)
export class AiItineraryController {
  constructor(private readonly itinerary: AiItineraryService) {}

  @Post('generate')
  @HttpCode(200)
  generate(@CurrentUser() user: User, @Body() body: unknown) {
    return this.itinerary.generate(user.id, body).then(itinerary => ({ itinerary }));
  }

  @Post('create')
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() body: unknown) {
    if (!checkPermission('trip_create', user.role, null, user.id, false)) {
      throw new HttpException({ error: 'No permission to create trips' }, 403);
    }
    return this.itinerary.create(user, body);
  }
}
