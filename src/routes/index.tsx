import { clientOnly } from "@solidjs/start";

const TreeGround = clientOnly(() => import("~/components/TreeGround"));

export default function Home() {
  return (
    <main>
      <TreeGround />
    </main>
  );
}
