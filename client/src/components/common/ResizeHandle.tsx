/**
 * ResizeHandle — draggable vertical divider between panels.
 *
 * Thin grab bar (6px hit area, 2px visible line) with hover/active feedback.
 * Hidden on mobile (below lg breakpoint). Double-click to reset panel width.
 */

interface ResizeHandleProps {
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onDoubleClick: () => void;
}

export default function ResizeHandle({ isDragging, onMouseDown, onDoubleClick }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      className={`hidden lg:flex items-center justify-center w-1.5 cursor-col-resize shrink-0 h-full
                  group select-none z-10 ${isDragging ? 'bg-telos-blue-500/5' : 'hover:bg-slate-700/30'}`}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div
        className={`w-px rounded-full transition-all duration-150
                    ${isDragging
                      ? 'h-16 bg-telos-blue-400'
                      : 'h-8 bg-slate-600 group-hover:h-12 group-hover:bg-slate-400'
                    }`}
      />
    </div>
  );
}
