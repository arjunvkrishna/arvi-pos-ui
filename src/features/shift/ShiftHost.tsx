import { useUi } from '../../app/ui';
import { ShiftDialog } from './ShiftDialog';

/** Mounts the shift dialog when the header chip asks for it. */
export function ShiftHost() {
  const open = useUi((s) => s.shiftOpen);
  const ui = useUi((s) => s.set);
  return open ? <ShiftDialog onClose={() => ui({ shiftOpen: false })} /> : null;
}
