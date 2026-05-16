import { BibleReader } from "./components/BibleReader";
import { getBooks, getPassage } from "@/lib/bible";

export default function Home() {
  const books = getBooks();
  const passage = getPassage("Matthew", 1);

  if (!passage) {
    return <main className="reader-shell">聖經資料尚未同步。</main>;
  }

  return <BibleReader initialBooks={books} initialPassage={passage} />;
}
