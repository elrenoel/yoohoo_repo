"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BackBlob,
  FlipArrow,
  FrontBlob,
  type BlobVariant,
} from "./FlashcardArtwork";
import styles from "./Flashcard.module.css";

const DEFINITION_FONT_SIZE = 70;
const DEFINITION_LINE_HEIGHT = 88;
const MIN_DEFINITION_SCALE = 0.7;
const DEFINITION_SCALE_STEP = 0.05;
const GESTURE_THRESHOLD_PX = 8;

type FlashcardStyle = CSSProperties & {
  "--definition-font-size"?: number;
  "--definition-line-height"?: number;
  "--flip-duration"?: string;
};

export interface FlashcardProps {
  term: string;
  definition: string;
  blobVariant: BlobVariant;
  relatedTerms?: FlashcardRelatedTerm[];
  onRelatedTermClick?: (relatedTerm: FlashcardRelatedTerm) => void;
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  flipDuration?: 450 | 600 | 750;
  className?: string;
}

export type FlashcardRelatedTerm = {
  term: string;
  type: "linked" | "suggested";
  definition?: string;
};

export function FlashcardSkeleton() {
  return (
    <div className={`${styles.container} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.button}>
        <span className={styles.inner}>
          <span className={`${styles.face} ${styles.front}`}>
            <FrontBlob
              variant={1}
              className={`${styles.frontBlob} ${styles.frontBlob1}`}
            />
            <span className={styles.skeletonTitle} />
            <span className={styles.skeletonTitleShort} />
            <FlipArrow className={`${styles.arrow} ${styles.skeletonArrow}`} />
          </span>
        </span>
      </div>
    </div>
  );
}

type PointerOrigin = {
  x: number;
  y: number;
} | null;

export function Flashcard({
  term,
  definition,
  blobVariant,
  relatedTerms = [],
  onRelatedTermClick,
  flipped,
  defaultFlipped = false,
  onFlip,
  flipDuration = 600,
  className,
}: FlashcardProps) {
  const [internalFlipped, setInternalFlipped] = useState(defaultFlipped);
  const [definitionFontSize, setDefinitionFontSize] = useState(
    DEFINITION_FONT_SIZE,
  );
  const [definitionOverflows, setDefinitionOverflows] = useState(false);
  const [hoveredRelatedTerm, setHoveredRelatedTerm] =
    useState<FlashcardRelatedTerm | null>(null);
  const definitionFrameRef = useRef<HTMLSpanElement>(null);
  const definitionScrollerRef = useRef<HTMLSpanElement>(null);
  const definitionTextRef = useRef<HTMLParagraphElement>(null);
  const pointerOriginRef = useRef<PointerOrigin>(null);
  const pointerMovedRef = useRef(false);
  const isFlipped = flipped ?? internalFlipped;

  const fitDefinition = useCallback(() => {
    const frame = definitionFrameRef.current;
    const scroller = definitionScrollerRef.current;
    const text = definitionTextRef.current;
    if (!frame || !scroller || !text) return;

    let scale = 1;
    text.style.setProperty(
      "--definition-font-size",
      String(DEFINITION_FONT_SIZE),
    );
    text.style.setProperty(
      "--definition-line-height",
      String(DEFINITION_LINE_HEIGHT),
    );

    while (
      scale > MIN_DEFINITION_SCALE &&
      text.scrollHeight > frame.clientHeight
    ) {
      scale = Math.max(MIN_DEFINITION_SCALE, scale - DEFINITION_SCALE_STEP);
      text.style.setProperty(
        "--definition-font-size",
        String(DEFINITION_FONT_SIZE * scale),
      );
      text.style.setProperty(
        "--definition-line-height",
        String(DEFINITION_LINE_HEIGHT * scale),
      );
    }

    const nextFontSize = DEFINITION_FONT_SIZE * scale;
    setDefinitionFontSize((current) =>
      current === nextFontSize ? current : nextFontSize,
    );
    setDefinitionOverflows(text.scrollHeight > scroller.clientHeight + 1);
  }, []);

  useLayoutEffect(() => {
    const frame = definitionFrameRef.current;
    if (!frame) return;

    fitDefinition();
    const observer = new ResizeObserver(fitDefinition);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [definition, fitDefinition]);

  const toggle = () => {
    const next = !isFlipped;
    if (flipped === undefined) setInternalFlipped(next);
    onFlip?.(next);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerOriginRef.current = { x: event.clientX, y: event.clientY };
    pointerMovedRef.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = pointerOriginRef.current;
    if (!origin) return;
    if (
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >=
      GESTURE_THRESHOLD_PX
    ) {
      pointerMovedRef.current = true;
    }
  };

  const handlePointerEnd = () => {
    pointerOriginRef.current = null;
  };

  const handleClick = () => {
    if (pointerMovedRef.current) {
      pointerMovedRef.current = false;
      return;
    }
    toggle();
  };

  const rootClassName = [
    styles.container,
    isFlipped ? styles.flipped : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const rootStyle: FlashcardStyle = {
    "--flip-duration": `${flipDuration}ms`,
  };
  const definitionStyle: FlashcardStyle = {
    "--definition-font-size": definitionFontSize,
    "--definition-line-height":
      (definitionFontSize / DEFINITION_FONT_SIZE) * DEFINITION_LINE_HEIGHT,
  };
  const normalizedRelatedTerms = [...relatedTerms]
    .filter((relatedTerm) => relatedTerm.term.trim().length > 0)
    .sort((left, right) => right.term.length - left.term.length);
  const definitionParts = normalizedRelatedTerms.length
    ? definition.split(
        new RegExp(
          `(${normalizedRelatedTerms
            .map((relatedTerm) =>
              relatedTerm.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            )
            .join("|")})`,
          "gi",
        ),
      )
    : [definition];

  return (
    <div className={rootClassName} style={rootStyle}>
      <button
        type="button"
        className={styles.button}
        aria-label="Flip card"
        aria-pressed={isFlipped}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <span className={styles.inner}>
          <span
            className={`${styles.face} ${styles.front}`}
            aria-hidden={isFlipped}
          >
            <FrontBlob
              variant={blobVariant}
              className={`${styles.frontBlob} ${styles[`frontBlob${blobVariant}`]}`}
            />
            <span className={styles.frontTitle}>{term}</span>
            <FlipArrow className={styles.arrow} />
          </span>

          <span
            className={`${styles.face} ${styles.back}`}
            aria-hidden={!isFlipped}
          >
            <BackBlob className={styles.backBlob} />
            <span className={styles.backLabel}>{term}</span>
            <span
              ref={definitionFrameRef}
              className={`${styles.definitionFrame} ${
                definitionOverflows ? styles.definitionFrameOverflowing : ""
              }`}
            >
              <span
                ref={definitionScrollerRef}
                className={styles.definitionScroller}
                onScroll={() => {
                  pointerMovedRef.current = true;
                }}
              >
                <span
                  ref={definitionTextRef}
                  className={styles.definitionText}
                  style={definitionStyle}
                >
                  {definitionParts.map((part, index) => {
                    const relatedTerm = normalizedRelatedTerms.find(
                      (candidate) =>
                        candidate.term.toLocaleLowerCase() ===
                        part.toLocaleLowerCase(),
                    );
                    if (!relatedTerm) return <span key={index}>{part}</span>;
                    return (
                      <span
                        key={`${relatedTerm.type}:${relatedTerm.term}:${index}`}
                        className={`${styles.relatedTerm} ${
                          relatedTerm.type === "suggested"
                            ? styles.relatedTermSuggested
                            : ""
                        }`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRelatedTermClick?.(relatedTerm);
                        }}
                        onMouseEnter={() =>
                          setHoveredRelatedTerm(relatedTerm)
                        }
                        onMouseLeave={() => setHoveredRelatedTerm(null)}
                      >
                        {part}
                      </span>
                    );
                  })}
                </span>
              </span>
            </span>
            {hoveredRelatedTerm && (
              <span className={styles.relatedOverlay} aria-live="polite">
                <span className={styles.relatedOverlayTitle}>
                  {hoveredRelatedTerm.term}
                </span>
                {hoveredRelatedTerm.type === "suggested"
                  ? "This term appears in the material and can be turned into a flashcard."
                  : hoveredRelatedTerm.definition ||
                    "Open the related flashcard."}
              </span>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
