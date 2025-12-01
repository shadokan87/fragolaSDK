export default function NotFound() {
  // Mock JS computation: sum of first 10 numbers
  const sum = Array.from({ length: 10 }, (_, i) => i + 1).reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-screen items-center justify-center flex-col">
      <p className="mb-2">(not found: docs)</p>
      <p className="text-sm text-muted-foreground">Mock sum of 1 to 10: <b>{sum}</b></p>
    </div>
  );
}
