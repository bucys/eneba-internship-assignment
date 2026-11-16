import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../../lib/cx";

type ScrollRailProps = {
  /** Names the arrows: "Scroll {label} left". */
  label: string;
  /** `<li>` items, each setting its own width. */
  children: ReactNode;
  listClassName?: string;
};

type Ends = { overflows: boolean; atStart: boolean; atEnd: boolean };

function readEnds(list: HTMLElement): Ends {
  const { scrollLeft, clientWidth, scrollWidth } = list;
  return {
    overflows: scrollWidth > clientWidth + 1,
    atStart: scrollLeft <= 1,
    atEnd: scrollLeft + clientWidth >= scrollWidth - 1,
  };
}

function scrollBehavior(): ScrollBehavior {
  const reduced =
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "auto" : "smooth";
}

/** A horizontal list that scrolls inside itself, with arrows from `md` up (spec 0014). */
export function ScrollRail({
  label,
  children,
  listClassName,
}: ScrollRailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState<Ends>({
    overflows: false,
    atStart: true,
    atEnd: true,
  });

  // Returning the previous object when nothing changed lets React skip the re-render.
  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const next = readEnds(list);
    setEnds((prev) =>
      prev.overflows === next.overflows &&
      prev.atStart === next.atStart &&
      prev.atEnd === next.atEnd
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    update();
    list.addEventListener("scroll", update, { passive: true });
    globalThis.addEventListener("resize", update);
    return () => {
      list.removeEventListener("scroll", update);
      globalThis.removeEventListener("resize", update);
    };
  }, [update, children]);

  function scroll(direction: -1 | 1) {
    const list = listRef.current;
    if (!list) return;
    if (direction === -1 ? ends.atStart : ends.atEnd) return;
    list.scrollBy({
      left: direction * list.clientWidth,
      behavior: scrollBehavior(),
    });
  }

  return (
    <div className="relative">
      <ul
        ref={listRef}
        className={cx(
          // relative: sr-only text inside the items is absolutely positioned, and must be
          // clipped by this list, not by an ancestor outside it (that scrolls the page).
          "relative flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]",
          listClassName,
        )}
      >
        {children}
      </ul>
      {ends.overflows && (
        <>
          <RailArrow
            side="left"
            label={`Scroll ${label} left`}
            disabled={ends.atStart}
            onClick={() => scroll(-1)}
          />
          <RailArrow
            side="right"
            label={`Scroll ${label} right`}
            disabled={ends.atEnd}
            onClick={() => scroll(1)}
          />
        </>
      )}
    </div>
  );
}

type RailArrowProps = {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
};

function RailArrow({ side, label, disabled, onClick }: RailArrowProps) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  // aria-disabled, never disabled, so a focused arrow keeps focus at an end.
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={onClick}
      className={cx(
        "absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg shadow-lg transition-colors hover:bg-surface-deep md:flex",
        side === "left" ? "left-2" : "right-2",
        disabled && "cursor-default opacity-40 hover:bg-surface",
      )}
    >
      <Icon aria-hidden="true" className="size-6" />
    </button>
  );
}
