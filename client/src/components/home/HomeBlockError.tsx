import { ErrorState } from "../ui/ErrorState";
import { HomeSection } from "./HomeSection";

type HomeBlockErrorProps = {
  title: string;
  message?: string;
  onRetry: () => void;
};

export function HomeBlockError({
  title,
  message,
  onRetry,
}: HomeBlockErrorProps) {
  return (
    <HomeSection title={title}>
      <ErrorState message={message} onRetry={onRetry} />
    </HomeSection>
  );
}
