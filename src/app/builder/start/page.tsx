import { BuilderStartClient } from "@/components/builder/BuilderStartClient";

export default function BuilderStartPage({ searchParams }: { searchParams: { profile_id?: string; dev?: string } }) {
  return <BuilderStartClient profileId={searchParams.profile_id ?? ""} dev={searchParams.dev === "1"} />;
}
