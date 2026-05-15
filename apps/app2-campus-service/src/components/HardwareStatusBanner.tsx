import {memo} from 'react';
import type {HardwareSocketStatus} from '../hooks/useHardwareSocket';

interface Props {
  status: HardwareSocketStatus;
}

export const HardwareStatusBanner = memo(function HardwareStatusBanner({status}: Props) {
  void status;
  return null;
});
