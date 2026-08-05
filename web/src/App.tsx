import TopBar from "./components/TopBar";
import Hero from "./components/Hero";
import Capabilities from "./components/Capabilities";
import Pipeline from "./components/Pipeline";
import Footer from "./components/Footer";
import { useReveal } from "./hooks/useReveal";

export default function App() {
  useReveal();

  return (
    <>
      <TopBar />
      <main>
        <Hero />
        <Capabilities />
        <Pipeline />
      </main>
      <Footer />
    </>
  );
}
