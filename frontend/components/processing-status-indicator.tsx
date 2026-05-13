interface ProcessingStatusIndicatorProps {
  message: string;
}

export function ProcessingStatusIndicator({ message }: ProcessingStatusIndicatorProps) {
  return (
    <div className="animate-processing-fade text-xs text-muted-foreground space-y-1">
      <p>{message}</p>
    </div>
  );
}