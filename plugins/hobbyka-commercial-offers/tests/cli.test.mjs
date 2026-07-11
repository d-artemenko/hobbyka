import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cli = path.resolve("skills/manage-commercial-offers/scripts/hobbyka-commercial-offers.mjs");

test("create stores a redacted record and view checks the page", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hobbyka-co-"));
  const historyFile = path.join(tempDir, "history.json");
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  let received = null;
  const server = http.createServer((request, response) => {
    if (request.method === "POST") {
      let raw = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => { raw += chunk; });
      request.on("end", () => {
        received = JSON.parse(raw);
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          status: "success",
          data: {
            success: true,
            data: {
              id: 42,
              number: "900-1-1",
              version: 1,
              offer_link: `http://127.0.0.1:${server.address().port}/personal/commercial_offers/?NUMBER=900-1-1`,
              pdf: { id: "7", url: "https://hobbyka.ru/test.pdf", name: "test.pdf" },
              qr_code_url: "https://hobbyka.ru/co/test/"
            }
          },
          errors: []
        }));
      });
      return;
    }
    response.statusCode = 200;
    response.end("offer page");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const port = server.address().port;
  const env = {
    ...process.env,
    HOBBYKA_CO_API_URL: `http://127.0.0.1:${port}/api/commercial-offers/?action=createCommercialOffer`,
    HOBBYKA_CO_WEB_BASE_URL: `http://127.0.0.1:${port}`,
    HOBBYKA_CO_HISTORY_FILE: historyFile,
    HOBBYKA_CO_TIMEOUT_MS: "5000"
  };
  const create = await execFileAsync(process.execPath, [
    cli, "create", "--item", "7112:2", "--company", "ООО Тест", "--person", "Иван Иванов",
    "--phone", "+70000000000", "--email", "test@example.com", "--object", "Парк", "--yes", "--json"
  ], { cwd: path.dirname(path.dirname(cli)), env });

  assert.equal(JSON.parse(create.stdout).number, "900-1-1");
  assert.equal(received.basket_items[0].ID, "7112");
  const history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
  assert.equal(history[0].number, "900-1-1");
  assert.equal(JSON.stringify(history).includes("test@example.com"), false);
  assert.equal(JSON.stringify(history).includes("+70000000000"), false);

  const view = await execFileAsync(process.execPath, [cli, "view", "900-1-1", "--check", "--json"], {
    cwd: path.dirname(path.dirname(cli)), env
  });
  const viewed = JSON.parse(view.stdout);
  assert.equal(viewed.found_in_local_history, true);
  assert.equal(viewed.reachable, true);
  assert.equal(viewed.http_status, 200);
});

test("live create is rejected without --yes", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [
      cli, "create", "--item", "7112:1", "--company", "Test", "--person", "Test",
      "--phone", "+70000000000", "--email", "test@example.com", "--object", "Test"
    ], { cwd: path.dirname(path.dirname(cli)) }),
    /Live creation requires --yes/
  );
});
