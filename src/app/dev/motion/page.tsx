import { notFound } from "next/navigation";
import { MotionPlayground } from "./playground";

export default function MotionDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MotionPlayground />;
}
