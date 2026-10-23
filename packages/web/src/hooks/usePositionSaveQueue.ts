import { useCallback, useEffect, useRef } from 'react';
import { createPositionSaveQueue, type PositionSave } from '../lib/positionSaveQueue';

export function usePositionSaveQueue(
  save: (position: PositionSave) => Promise<void>,
  onError: () => void,
) {
  const saveRef = useRef(save);
  const errorRef = useRef(onError);
  saveRef.current = save;
  errorRef.current = onError;
  const queueRef = useRef<ReturnType<typeof createPositionSaveQueue>>();
  if (!queueRef.current) {
    queueRef.current = createPositionSaveQueue({ save: position => saveRef.current(position) });
  }
  const queue = queueRef.current;
  const reportedFailure = useRef(false);
  const flush = useCallback(async () => {
    try {
      await queue.flush();
      reportedFailure.current = false;
    } catch {
      if (!reportedFailure.current) {
        reportedFailure.current = true;
        errorRef.current();
      }
    }
  }, [queue]);

  useEffect(() => {
    const reconnect = () => { void flush(); };
    const leaving = (event: BeforeUnloadEvent) => {
      if (queue.size || queue.saving) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('beforeunload', leaving);
    return () => {
      window.removeEventListener('online', reconnect);
      window.removeEventListener('beforeunload', leaving);
    };
  }, [queue, flush]);

  return { queue: queue.queue, flush };
}
