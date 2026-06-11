import { migrateSave, simulate, type GameState } from '@idle-rpg/core';
import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * 세이브 저장소.
 * 프로토타입 단계에서는 인메모리 Map이며, 2단계에서 PostgreSQL로 교체한다.
 *
 * 핵심 설계: 서버도 클라이언트와 동일한 @idle-rpg/core의 simulate()를 실행한다.
 * 업로드된 세이브를 서버 시각으로 정산해 저장하므로, 이후 단계에서
 * "클라이언트가 보고한 진행이 물리적으로 가능한가"를 검증하는
 * server-authoritative 구조로 자연스럽게 확장된다.
 */
@Injectable()
export class SavesService {
  private readonly store = new Map<string, GameState>();

  get(userId: string): GameState | null {
    return this.store.get(userId) ?? null;
  }

  put(userId: string, raw: unknown): GameState {
    const state = migrateSave(raw);
    if (!state) {
      throw new BadRequestException('유효하지 않은 세이브 데이터입니다.');
    }
    if (state.lastTickAt > Date.now() + 60_000) {
      throw new BadRequestException('세이브의 시각이 서버 시각보다 미래입니다.');
    }
    const settled = simulate(state, Date.now()).state;
    this.store.set(userId, settled);
    return settled;
  }
}
