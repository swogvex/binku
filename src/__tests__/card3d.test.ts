import { settleAngle } from '@/features/card/settle';

describe('3D card', () => {
  it('settles on the nearest face, a fast fling turns it over', () => {
    expect(settleAngle(40, 0)).toBe(0);
    expect(settleAngle(120, 0)).toBe(180);
    expect(settleAngle(-100, 0)).toBe(-180);
    expect(settleAngle(40, 600)).toBe(180);
  });
});
