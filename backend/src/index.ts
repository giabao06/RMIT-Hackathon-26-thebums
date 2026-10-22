import { createApp } from "./app";
import { db } from "./database/db";
import { supabaseDirectory } from "./directory";
import { loadPepper } from "./token";

const app = createApp(db, loadPepper(), supabaseDirectory(db));

// M7: delete unmatched expired ciphertext. pg_cron can run expire_reports() instead in production.
const sweep = () => void db.rpc("expire_reports").then(({ error }) => error && console.error("expiry sweep failed"));
sweep();
setInterval(sweep, 60 * 60 * 1000).unref();

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API on :${port}`));
