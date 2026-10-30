import { TopNav } from "@/components/ui/TopNav";
import { RowSkeletons } from "@/features/friends/ui/Rows";

export default function Loading() {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-4">
        <h1 className="sr-only">Friends</h1>
        <RowSkeletons count={3} />
      </main>
    </>
  );
}
