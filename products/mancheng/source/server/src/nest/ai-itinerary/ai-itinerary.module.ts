import { Module } from '@nestjs/common';
import { AiItineraryController } from './ai-itinerary.controller';
import { AiItineraryService } from './ai-itinerary.service';

@Module({
  controllers: [AiItineraryController],
  providers: [AiItineraryService],
})
export class AiItineraryModule {}
