"use client";

import { Flashcard } from "./Flashcard";

const durations = [450, 600, 750] as const;
const definition =
  "a coding method that lets a program start a long task in the background and keep working on other things instead of freezing while it waits";

export function FlashcardDurationDemo() {
  return (
    <section aria-labelledby="flashcard-duration-title">
      <h1 id="flashcard-duration-title" className="text-2xl font-semibold">
        Perbandingan durasi flip
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Click each card to compare 450, 600, and 750 ms.
      </p>
      <div className="mt-8 grid gap-8 md:grid-cols-3">
        {durations.map((duration, index) => (
          <article key={duration}>
            <div className="mx-auto w-full max-w-[360px]">
              <Flashcard
                term="Asynchronous"
                definition={definition}
                blobVariant={(index + 1) as 1 | 2 | 3}
                flipDuration={duration}
              />
            </div>
            <p className="mt-3 text-center text-sm font-semibold">
              {duration} ms
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
