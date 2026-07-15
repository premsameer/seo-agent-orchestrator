import KairoDashboard from "../components/kairo-dashboard";

export default function Home() {
  return <KairoDashboard hostedPreview={Boolean(process.env.VERCEL)} />;
}
