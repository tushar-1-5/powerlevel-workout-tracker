import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import * as haptics from '@/lib/haptics';
import { colors } from '@/theme/tokens';

export interface DragListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  /**
   * Every row renders at this fixed height. Deliberate: it turns "which slot
   * is under my finger" into integer division instead of needing to measure
   * variable-height rows mid-drag — every reorderable list in this app
   * (day-groups, exercises within a day) is uniform rows anyway.
   */
  itemHeight: number;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, dragging: boolean) => ReactNode;
  /**
   * Set true to make the whole row a drag target instead of a small handle
   * icon — for a list whose rows carry no other long-press behaviour of
   * their own to conflict with. The pan gesture only *activates* after
   * `activateAfterLongPress`'s hold, so a quick tap on a nested `Pressable`
   * (a per-row button) still reaches it normally; only a hold anywhere on
   * the row starts a drag. Not yet exercised elsewhere in this app the way
   * the handle-only mode is, so treat a whole-row list as needing the same
   * on-device gesture-arbitration check DragList has always needed.
   */
  dragWholeRow?: boolean;
}

/**
 * A long-press-to-drag reorderable list — the PRD's `DragList` shared
 * component. Hand-rolled on `react-native-gesture-handler` +
 * `react-native-reanimated` rather than a third-party drag-list package,
 * the same way the Stepper's hold-to-accelerate arrows (Block 2) are built
 * directly on these two libraries rather than pulled in from elsewhere.
 *
 * By default only a small drag-handle icon is a drag target, not the whole
 * row — the row itself can carry its own taps and buttons (open a day
 * editor, delete a day) without either gesture stealing touches from the
 * other. `dragWholeRow` trades that isolation for a bigger, anywhere-on-the-
 * row drag target, for lists whose rows don't need it.
 */
export function DragList<T>({
  data,
  keyExtractor,
  itemHeight,
  onReorder,
  renderItem,
  dragWholeRow,
}: DragListProps<T>) {
  const [order, setOrder] = useState(data);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragging = useRef(false);
  const orderRef = useRef(order);
  orderRef.current = order;

  // Re-sync from the parent only when nothing is mid-drag — an unrelated
  // prop update (another screen editing the same split) must never yank the
  // list out from under an active gesture.
  useEffect(() => {
    if (!dragging.current) setOrder(data);
  }, [data]);

  const handleDragStart = (index: number) => {
    dragging.current = true;
    setDraggingIndex(index);
    haptics.tick();
  };

  const handleMove = (from: number, to: number) => {
    setOrder((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
        return current;
      }
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggingIndex(to);
  };

  const handleDragEnd = () => {
    dragging.current = false;
    setDraggingIndex(null);
    // Read through the ref, not `order` — this closure was created at some
    // earlier render and `order` may have moved on since, same stale-closure
    // family of bug as Block 2's Stepper and Block 6's `refresh`.
    onReorder(orderRef.current);
  };

  return (
    <View>
      {order.map((item, index) => (
        <Row
          key={keyExtractor(item)}
          index={index}
          count={order.length}
          itemHeight={itemHeight}
          onDragStart={handleDragStart}
          onMove={handleMove}
          onDragEnd={handleDragEnd}
          dragWholeRow={dragWholeRow}>
          {renderItem(item, draggingIndex === index)}
        </Row>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------- row */

interface RowProps {
  index: number;
  count: number;
  itemHeight: number;
  onDragStart: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDragEnd: () => void;
  children: ReactNode;
  dragWholeRow?: boolean;
}

function Row({ index, count, itemHeight, onDragStart, onMove, onDragEnd, children, dragWholeRow }: RowProps) {
  const translateY = useSharedValue(0);
  const active = useSharedValue(false);
  // Where this row's drag began, and where it currently sits in `order`.
  // Their difference is how far the array has already carried this row, so
  // the finger-tracking transform only ever applies the REMAINING offset —
  // without this, the row would jump by a full row height every time a
  // reorder crosses it into a new slot.
  const startIndex = useSharedValue(index);
  const currentIndex = useSharedValue(index);

  currentIndex.value = index;
  if (!active.value) startIndex.value = index;

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      active.value = true;
      startIndex.value = currentIndex.value;
      runOnJS(onDragStart)(currentIndex.value);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      const target = Math.max(
        0,
        Math.min(count - 1, startIndex.value + Math.round(e.translationY / itemHeight)),
      );
      if (target !== currentIndex.value) {
        runOnJS(onMove)(currentIndex.value, target);
      }
    })
    .onEnd(() => {
      translateY.value = 0;
      active.value = false;
      runOnJS(onDragEnd)();
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - (currentIndex.value - startIndex.value) * itemHeight }],
    zIndex: active.value ? 100 : 0,
    elevation: active.value ? 8 : 0,
    opacity: active.value ? 0.94 : 1,
  }));

  if (dragWholeRow) {
    return (
      <Animated.View layout={LinearTransition.duration(180)} style={[{ height: itemHeight }, rowStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.body}>{children}</View>
        </GestureDetector>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.duration(180)} style={[{ height: itemHeight }, styles.row, rowStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.handle} hitSlop={8}>
          <MaterialIcons name="drag-handle" size={22} color={colors.textMuted} />
        </View>
      </GestureDetector>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  handle: { width: 36, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
