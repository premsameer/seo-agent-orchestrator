import KairoDashboard from "../components/kairo-dashboard";

// A stateful host (long-running Node server) runs live unless explicitly left in
// preview. On Vercel there is no persistent filesystem/process, so preview is the
// safe default unless KAIRO_LIVE=1 is set. Honour an explicit KAIRO_LIVE override
// on any host.
const hostedPreview = process.env.VERCEL
  ? !String(process.env.KAIRO_LIVE ?? "").startsWith("1")
  : String(process.env.KAIRO_LIVE ?? "") === "0";

export default function Home() {
  return <KairoDashboard hostedPreview={hostedPreview} />;
}
