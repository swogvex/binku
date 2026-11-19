// What the "Añadir al chat" sheet picked, handed back to the conversation when it regains focus
// (same pattern as the scan card picker).
import type { Proposal } from '@/data/chat';

export type Picked = { card: string } | { offer: Extract<Proposal, { type: 'offer' }> };

let picked: Picked | null = null;
export const setPicked = (p: Picked) => void (picked = p);
export function takePicked() {
  const p = picked;
  picked = null;
  return p;
}
