import { Body, Controller, Get, NotFoundException, Param, Put } from '@nestjs/common';
import { SavesService } from './saves.service';

@Controller('saves')
export class SavesController {
  constructor(private readonly saves: SavesService) {}

  @Get(':userId')
  get(@Param('userId') userId: string) {
    const state = this.saves.get(userId);
    if (!state) throw new NotFoundException('세이브가 없습니다.');
    return { state };
  }

  @Put(':userId')
  put(@Param('userId') userId: string, @Body() body: { state?: unknown }) {
    const settled = this.saves.put(userId, body?.state);
    return { state: settled };
  }
}
