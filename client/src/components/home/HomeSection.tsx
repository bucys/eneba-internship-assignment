import { useId, type ReactNode } from "react";
import { Container } from "../layout/Container";

type HomeSectionProps = {
  title: string;
  /** Sits at the right of the heading, for example a "See all" link. */
  action?: ReactNode;
  children: ReactNode;
};

/** A full width homepage band. Its colour comes from `.home-bands` in index.css, by DOM order. */
export function HomeSection({ title, action, children }: HomeSectionProps) {
  const headingId = useId();

  return (
    <section data-band aria-labelledby={headingId} className="py-10 md:py-14">
      <Container>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={headingId} className="text-2xl font-extrabold md:text-3xl">
            {title}
          </h2>
          {action}
        </div>
        {children}
      </Container>
    </section>
  );
}
