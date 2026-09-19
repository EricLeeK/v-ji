import { TabBar } from "@/components/tab-bar";

export function PhoneShell({
  children,
  showTab = true,
}: {
  children: React.ReactNode;
  showTab?: boolean;
}) {
  return (
    <div className="app-shell">
      <div className="app-shell-surface mx-auto flex w-full max-w-[430px] flex-col">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {showTab ? <TabBar /> : null}
      </div>
    </div>
  );
}
