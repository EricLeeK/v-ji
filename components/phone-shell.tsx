import { TabBar } from "@/components/tab-bar";

export function PhoneShell({
  children,
  showTab = true,
}: {
  children: React.ReactNode;
  showTab?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-[#d7e4df]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-[0_0_80px_rgba(20,60,50,0.12)]">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {showTab ? <TabBar /> : null}
      </div>
    </div>
  );
}
